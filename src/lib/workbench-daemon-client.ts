'use strict'

const { isAuthFailure } = require('./workbench-auth')
const { parseDaemonError } = require('./workbench-daemon-errors')
const { feedDaemonLogSse } = require('./workbench-daemon-log-sse')
const {
  normalizeTaskContext,
  normalizeTaskContextDefaults,
  summarizeTaskContext,
} = require('./workbench-task-context')
const {
  hasPendingHitl,
  resolveDaemonRuntimeState,
} = require('./workbench-task-lifecycle')

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8010'
const DEFAULT_TIMEOUT_MS = 4000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const TASK_SLUG_RE = /^[a-z][a-z0-9-]{0,79}$/
const TERMINAL_STATES = new Set(['finished', 'failed', 'cancelled', 'completed', 'done'])
const VISIBLE_CATALOG = new Set(['primary', 'advanced'])
const DEFAULT_CATALOG_ORDER = 1000

function normalizeEndpoint(value = DEFAULT_ENDPOINT) {
  let parsed
  try {
    parsed = new URL(String(value || DEFAULT_ENDPOINT).trim())
  } catch {
    throw clientError('invalid_endpoint', 'Workbench 地址格式无效')
  }
  const hostname = parsed.hostname.toLowerCase()
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(hostname)
  const allowedProtocol = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback)
  if (
    !allowedProtocol ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname && parsed.pathname !== '/') ||
    parsed.search ||
    parsed.hash
  ) {
    throw clientError('invalid_endpoint', '远程 Workbench 必须使用 HTTPS；本机开发可使用回环 HTTP')
  }
  parsed.pathname = ''
  return parsed.toString().replace(/\/$/, '')
}

function validateSlug(value) {
  const slug = String(value || '').trim()
  if (!TASK_SLUG_RE.test(slug)) {
    throw clientError('invalid_slug', '任务标识须以小写字母开头，并且只包含小写字母、数字和连字符')
  }
  return slug
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

/** Time-linked legal slug: `{workflow}-{YYYYMMDD-HHmmss}-{rand}` (≤80 chars). */
function generateTaskSlug(workflowId = 'task', now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date()
  const stamp = [
    safeDate.getFullYear(),
    pad2(safeDate.getMonth() + 1),
    pad2(safeDate.getDate()),
    '-',
    pad2(safeDate.getHours()),
    pad2(safeDate.getMinutes()),
    pad2(safeDate.getSeconds()),
  ].join('')
  const base = String(workflowId || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'task'
  const rand = Math.random().toString(36).slice(2, 5)
  const slug = `${base}-${stamp}-${rand}`.replace(/-+/g, '-').slice(0, 80)
  return TASK_SLUG_RE.test(slug) ? slug : `task-${stamp}-${rand}`.slice(0, 80)
}

function resolveTaskSlug(payload = {}) {
  const raw = String(payload.slug || '').trim()
  if (raw && TASK_SLUG_RE.test(raw)) return raw
  return generateTaskSlug(payload.workflow)
}

const EXECUTOR_STALE_MS = 15 * 60 * 1000

function assessExecutorFromHealth(health = {}) {
  const source = health && typeof health === 'object' ? health : {}
  const host = String(source.executor_hostname || source.executorHostname || '').trim()
  const seenRaw = source.executor_seen_at || source.executorSeenAt || ''
  const seenAt = String(seenRaw || '').trim()
  if (!host && !seenAt) {
    return {
      ready: false,
      code: 'executor_unseen',
      message: '管线执行器尚未上报心跳，请确认 Daemon executor 已启动',
    }
  }
  if (seenAt) {
    const ts = Date.parse(seenAt)
    if (Number.isFinite(ts) && Date.now() - ts > EXECUTOR_STALE_MS) {
      return {
        ready: false,
        code: 'executor_stale',
        message: '管线执行器心跳过旧，请重启 executor 或检查 CURSOR_API_KEY',
        seenAt,
        hostname: host,
      }
    }
  }
  return {
    ready: true,
    code: 'ready',
    message: '执行器已就绪',
    seenAt,
    hostname: host,
  }
}

function clientError(code, message, status = 0) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

function normalizeError(error) {
  if (error && error.name === 'AbortError') {
    return { ok: false, code: 'timeout', error: '本机 Workbench 响应超时，请确认服务已启动' }
  }
  const status = Number((error && error.status) || 0)
  const code = (error && error.code) || (status === 401 || status === 403 ? 'auth_required' : 'offline')
  return {
    ok: false,
    code,
    error: (error && error.message) || '无法连接 Workbench 服务',
    status,
  }
}

function buildAuthHeaders(token) {
  const value = String(token || '').trim()
  if (!value) return {}
  return { Authorization: `Bearer ${value}` }
}

function listFrom(body, key) {
  if (Array.isArray(body)) return body
  return body && Array.isArray(body[key]) ? body[key] : []
}

function normalizeWorkflowCatalog(rawCatalog) {
  if (rawCatalog === undefined || rawCatalog === null) {
    return { visibility: 'primary', category: 'general', order: DEFAULT_CATALOG_ORDER }
  }
  if (typeof rawCatalog !== 'object' || Array.isArray(rawCatalog)) return null
  const visibility = String(rawCatalog.visibility || 'primary').trim().toLowerCase()
  if (!VISIBLE_CATALOG.has(visibility)) return null
  const category = String(rawCatalog.category || 'general').trim() || 'general'
  const numericOrder = rawCatalog.order === null || rawCatalog.order === ''
    ? NaN
    : Number(rawCatalog.order)
  const order = Number.isInteger(numericOrder) ? numericOrder : DEFAULT_CATALOG_ORDER
  return { ...rawCatalog, visibility, category, order }
}

function normalizeWorkflow(item) {
  const catalog = normalizeWorkflowCatalog(item && item.catalog)
  if (!catalog) return null
  const rawAgents = Array.isArray(item && (item.agentIds || item.agents || item.members))
    ? (item.agentIds || item.agents || item.members)
    : []
  return {
    id: String(item && (item.id || item.workflow) || ''),
    name: String(item && (item.name || item.title || item.id || item.workflow) || '未命名流程'),
    summary: String(item && (item.summary || item.purpose) || ''),
    description: String(item && item.description || ''),
    path: String(item && item.path || '').trim(),
    tags: Array.isArray(item && item.tags) ? item.tags.map(String) : [],
    locked: !!(item && item.locked),
    agentIds: rawAgents.map(agent => String(agent && (agent.id || agent.agentId || agent) || '').trim()).filter(Boolean),
    catalog,
    source: 'daemon',
  }
}

function normalizeAgentExpert(item, index = 0) {
  const raw = item && typeof item === 'object' ? item : {}
  const id = String(raw.id || '').trim()
  if (!id || raw.exists === false) return null
  const labelZh = String(raw.label_zh || raw.labelZh || '').trim()
  const labelEn = String(raw.label_en || raw.labelEn || '').trim()
  const title = [labelZh, labelEn].filter(Boolean).join(' · ') || id
  const displayOrder = Number.isFinite(Number(raw.display_order))
    ? Number(raw.display_order)
    : index
  const capabilities = Array.isArray(raw.keywords_purpose)
    ? raw.keywords_purpose.map(String).map(value => value.trim()).filter(Boolean).slice(0, 6)
    : []
  return {
    id,
    title,
    model: String(raw.model || '').trim(),
    version: '',
    description: String(raw.description || '').trim(),
    persona: {
      role: labelZh,
      stance: '',
      behavior: '',
    },
    display: {
      summary: String(raw.card_line || raw.cardLine || '').trim(),
      capabilities,
    },
    modes: [],
    skills: { required: [], optional: [] },
    workflowNodes: [],
    nodeSpecs: {},
    path: '',
    state: String(raw.state || 'idle').trim().toLowerCase(),
    displayOrder,
    source: 'daemon',
    origin: 'daemon',
    editable: false,
  }
}

function normalizeAgentCatalog(body) {
  return listFrom(body, 'agents')
    .map(normalizeAgentExpert)
    .filter(Boolean)
    .sort((a, b) => (a.displayOrder - b.displayOrder) || a.id.localeCompare(b.id))
}

function selectAgentExperts(localAgents, daemonOverview) {
  const local = Array.isArray(localAgents) ? localAgents : []
  if (daemonOverview && daemonOverview.agentCatalogAvailable === true) {
    return {
      agents: Array.isArray(daemonOverview.agents) ? daemonOverview.agents : [],
      source: 'daemon',
    }
  }
  return { agents: local, source: local.length ? 'repository' : 'none' }
}

function partitionAgentExperts(localAgents, daemonOverview) {
  const local = (Array.isArray(localAgents) ? localAgents : []).map(agent => ({
    ...agent,
    source: agent.source || 'local',
    origin: agent.origin || 'local',
    editable: agent.editable !== false,
  }))
  const daemon = (Array.isArray(daemonOverview?.agents) ? daemonOverview.agents : []).map(agent => ({
    ...agent,
    source: 'daemon',
    origin: 'daemon',
    editable: false,
  }))
  return { localAgents: local, daemonAgents: daemon }
}

function normalizeLaunchContextBody(body) {
  const raw = body && typeof body === 'object'
    ? (body.context || body.defaults || body.launch_context || body.launchContext || body)
    : body
  return normalizeTaskContextDefaults(raw)
}

function taskState(item) {
  // 对齐 Daemon WebUI：status + HITL 优先于陈旧 job.state
  return resolveDaemonRuntimeState(item || {}).state || 'idle'
}

function buildSubmitContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : null
  let gitlab = null
  try {
    gitlab = normalizeTaskContext({
      workspace: raw.workspace,
      inputs: raw.inputs,
      outputs: raw.outputs,
    })
  } catch (error) {
    if (!meta) throw error
  }
  if (!gitlab && !meta) return null
  return {
    protocolVersion: '1',
    ...(gitlab || {}),
    ...(meta ? { meta } : {}),
  }
}

function normalizeTask(item) {
  const raw = item && typeof item === 'object' ? item : {}
  const source = raw.source && typeof raw.source === 'object' ? raw.source : null
  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null
  return {
    slug: String(raw.slug || ''),
    workflow: String(raw.workflow || ''),
    intent: String(raw.intent || ''),
    state: taskState(raw),
    updatedAt: String(raw.updated_at || raw.updatedAt || raw.created_at || ''),
    sourceTitle: String(raw.source_title || raw.sourceTitle || source?.title || ''),
    documentTitle: String(raw.document_title || raw.documentTitle || metadata?.document_title || metadata?.documentTitle || ''),
    source,
    metadata,
    raw,
  }
}

function createClient(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint || process.env.KNOWME_WORKBENCH_URL || DEFAULT_ENDPOINT)
  const fetchImpl = options.fetch || globalThis.fetch
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const maxResponseBytes = Number(options.maxResponseBytes || MAX_RESPONSE_BYTES)
  const token = String(options.token || process.env.KNOWME_WORKBENCH_TOKEN || '').trim()
  if (typeof fetchImpl !== 'function') throw clientError('fetch_unavailable', '当前运行环境不支持 HTTP 请求')

  async function requestRaw(pathname, options = {}) {
    if (!String(pathname).startsWith('/api/')) {
      throw clientError('invalid_path', 'Workbench API 路径不在允许范围内')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const accept = String((options.headers && options.headers.Accept) || options.accept || 'application/json')
      const response = await fetchImpl(`${endpoint}${pathname}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: accept,
          ...buildAuthHeaders(token),
          ...(options.headers || {}),
        },
      })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > maxResponseBytes) {
        throw clientError('response_too_large', 'Workbench 响应超过安全上限')
      }
      return { response, bytes }
    } finally {
      clearTimeout(timer)
    }
  }

  async function request(pathname, options = {}) {
    const { response, bytes } = await requestRaw(pathname, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    })
    let body = {}
    if (bytes.length) {
      try {
        body = JSON.parse(bytes.toString('utf8'))
      } catch {
        throw clientError('invalid_json', 'Workbench 返回了无法识别的数据')
      }
    }
    if (!response.ok) {
      const parsed = parseDaemonError(body, response.status, `Workbench 请求失败（${response.status}）`, {
        isAuthFailure,
      })
      throw clientError(parsed.code, parsed.message, response.status)
    }
    return body
  }

  async function requestText(pathname, options = {}) {
    const { response, bytes } = await requestRaw(pathname, {
      ...options,
      headers: {
        Accept: 'text/plain, application/json;q=0.8, */*;q=0.5',
        ...(options.headers || {}),
      },
    })
    const raw = bytes.toString('utf8')
    if (!response.ok) {
      let body = null
      try {
        body = JSON.parse(raw)
      } catch {
        body = null
      }
      if (body && typeof body === 'object') {
        const parsed = parseDaemonError(body, response.status, `Workbench 请求失败（${response.status}）`, {
          isAuthFailure,
        })
        throw clientError(parsed.code, parsed.message, response.status)
      }
      const message = raw.trim()
        ? raw.trim().slice(0, 400)
        : `Workbench 请求失败（${response.status}）`
      const code = response.status === 401 || isAuthFailure(response.status, message)
        ? 'auth_required'
        : (response.status === 403 ? 'forbidden' : 'http_error')
      throw clientError(code, message, response.status)
    }
    // Some endpoints may still wrap text; unwrap { text|content|body|progress|logs }
    try {
      const body = JSON.parse(raw)
      if (body && typeof body === 'object') {
        const nested = body.text || body.content || body.body || body.progress || body.logs
        if (typeof nested === 'string') return nested
      }
    } catch {
      // plain text
    }
    return raw
  }

  async function overview() {
    try {
      const health = await request('/api/health')
      const [workflowBody, taskBody, agentCatalog] = await Promise.all([
        request('/api/workflows'),
        request('/api/tasks'),
        request('/api/agents-team/overview')
          .then(body => ({ available: true, agents: normalizeAgentCatalog(body) }))
          .catch(error => ({ available: false, agents: [], error: normalizeError(error) })),
      ])
      const executor = assessExecutorFromHealth(health)
      return {
        ok: true,
        online: true,
        endpoint,
        health,
        executor,
        executorReady: executor.ready === true,
        workflows: listFrom(workflowBody, 'workflows').map(normalizeWorkflow).filter(item => item && item.id),
        tasks: listFrom(taskBody, 'tasks').map(normalizeTask).filter(item => item.slug).slice(0, 20),
        agents: agentCatalog.agents,
        agentCatalogAvailable: agentCatalog.available,
        agentCatalogError: agentCatalog.error || null,
      }
    } catch (error) {
      const normalized = normalizeError(error)
      const offlineCodes = new Set(['offline', 'timeout', 'invalid_json', 'fetch_unavailable', 'response_too_large'])
      return {
        ...normalized,
        online: !offlineCodes.has(normalized.code),
        endpoint,
        workflows: [],
        tasks: [],
        agents: [],
        agentCatalogAvailable: false,
        agentCatalogError: normalized,
        hint: normalized.code === 'auth_required'
          ? '请在设置中配置 Workbench 授权码后再启动任务'
          : '请检查 Workbench 服务地址与网络连接',
      }
    }
  }

  async function launchContext(workflowIdValue) {
    try {
      const workflowId = String(workflowIdValue || '').trim()
      if (!workflowId) throw clientError('invalid_workflow', '缺少工作流标识')
      const body = await request(`/api/workflows/${encodeURIComponent(workflowId)}/launch-context`)
      return {
        ok: true,
        workflowId,
        context: normalizeLaunchContextBody(body),
      }
    } catch (error) {
      if (error && error.status === 404) {
        return {
          ok: false,
          code: 'unsupported',
          error: '当前管线服务尚未提供默认上下文接口',
        }
      }
      return normalizeError(error)
    }
  }

  async function createAndRun(payload = {}) {
    try {
      const slug = resolveTaskSlug(payload)
      const workflow = String(payload.workflow || '').trim()
      const intent = String(payload.intent || '').trim()
      if (!workflow) throw clientError('invalid_workflow', '请选择工作流')
      if (!intent) throw clientError('invalid_intent', '请填写任务目标')
      const context = buildSubmitContext(payload.context)
      const requestId = String(payload.requestId || createRequestId())
      const form = new FormData()
      form.set('workflow', workflow)
      form.set('slug', slug)
      form.set('intent', intent)
      form.set('mode', 'long')
      form.set('request_id', requestId)
      if (context) {
        form.set('protocol_version', context.protocolVersion)
        form.set('context', JSON.stringify(context))
      }
      const created = await request('/api/tasks', { method: 'POST', body: form })
      const started = await request(`/api/tasks/${encodeURIComponent(slug)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify_mode: 'web' }),
      })
      return {
        ok: true,
        slug,
        requestId,
        context: context || null,
        contextSummary: summarizeTaskContext(context),
        task: created.task || null,
        job: started.job || null,
      }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function task(slugValue) {
    try {
      const slug = validateSlug(slugValue)
      const body = await request(`/api/tasks/${encodeURIComponent(slug)}`)
      const resolved = resolveDaemonRuntimeState(body)
      // computed state/terminal 必须覆盖 body 同名字段（避免 ...body 盖掉）
      return {
        ...body,
        ok: true,
        slug,
        state: resolved.state,
        terminal: resolved.terminal === true,
        hitlPending: resolved.hitl === true,
      }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function artifacts(slugValue) {
    try {
      const slug = validateSlug(slugValue)
      const body = await request(`/api/tasks/${encodeURIComponent(slug)}/artifacts`)
      return { ok: true, files: listFrom(body, 'files').slice(0, 100).map(normalizeArtifact) }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function progress(slugValue) {
    try {
      const slug = validateSlug(slugValue)
      const bodyText = await requestText(`/api/tasks/${encodeURIComponent(slug)}/progress`)
      return { ok: true, slug, text: String(bodyText || '') }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function logs(slugValue) {
    try {
      const slug = validateSlug(slugValue)
      const bodyText = await requestText(`/api/tasks/${encodeURIComponent(slug)}/logs`)
      return { ok: true, slug, text: String(bodyText || '') }
    } catch (error) {
      return normalizeError(error)
    }
  }

  /**
   * Subscribe to Daemon logs SSE. Long-lived: only cancelled via `signal`.
   * @param {string} slugValue
   * @param {{ signal?: AbortSignal, onLine?: (line: string) => void, onDone?: (data: string) => void }} handlers
   */
  async function streamLogs(slugValue, handlers = {}) {
    const slug = validateSlug(slugValue)
    const signal = handlers.signal
    const response = await fetchImpl(`${endpoint}/api/tasks/${encodeURIComponent(slug)}/logs/stream`, {
      method: 'GET',
      signal,
      headers: {
        Accept: 'text/event-stream',
        ...buildAuthHeaders(token),
      },
    })
    if (!response.ok) {
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      const parsed = parseDaemonError(body, response.status, `Workbench 请求失败（${response.status}）`, {
        isAuthFailure,
      })
      throw clientError(parsed.code, parsed.message, response.status)
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw clientError('stream_unavailable', '当前运行环境不支持日志流')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    try {
      while (true) {
        if (signal && signal.aborted) break
        const { done, value } = await reader.read()
        if (done) break
        const piece = decoder.decode(value, { stream: true })
        const parsed = feedDaemonLogSse(buffer, piece)
        buffer = parsed.buffer
        for (const event of parsed.events) {
          if (event.type === 'line') handlers.onLine?.(event.data)
          else if (event.type === 'done') handlers.onDone?.(event.data)
        }
      }
      if (buffer.trim()) {
        const parsed = feedDaemonLogSse(`${buffer}\n\n`, '')
        for (const event of parsed.events) {
          if (event.type === 'line') handlers.onLine?.(event.data)
          else if (event.type === 'done') handlers.onDone?.(event.data)
        }
      }
      return { ok: true, slug }
    } finally {
      try { reader.releaseLock() } catch { /* ignore */ }
    }
  }

  async function events(slugValue, query = {}) {
    try {
      const slug = validateSlug(slugValue)
      const afterId = Number(query.afterId || query.after_id || 0) || 0
      const limit = Math.min(500, Math.max(1, Number(query.limit || 200) || 200))
      const body = await request(
        `/api/tasks/${encodeURIComponent(slug)}/events?after_id=${afterId}&limit=${limit}`,
      )
      const list = listFrom(body, 'events')
      return { ok: true, slug, events: list, raw: body }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function changes(slugValue) {
    try {
      const slug = validateSlug(slugValue)
      const body = await request(`/api/tasks/${encodeURIComponent(slug)}/changes`)
      return { ok: true, slug, ...(body && typeof body === 'object' ? body : { body }) }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function workspaceTree(slugValue, relPath = '') {
    try {
      const slug = validateSlug(slugValue)
      const path = String(relPath || '')
      const body = await request(
        `/api/tasks/${encodeURIComponent(slug)}/workspace/tree?path=${encodeURIComponent(path)}`,
      )
      return { ok: true, slug, ...(body && typeof body === 'object' ? body : { body }) }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function workspaceBlob(slugValue, relPath = '') {
    try {
      const slug = validateSlug(slugValue)
      const path = String(relPath || '').trim()
      if (!path) throw clientError('invalid_path', '请选择要预览的文件')
      const body = await request(
        `/api/tasks/${encodeURIComponent(slug)}/workspace/blob?path=${encodeURIComponent(path)}`,
      )
      return { ok: true, slug, ...(body && typeof body === 'object' ? body : { body }) }
    } catch (error) {
      return normalizeError(error)
    }
  }

  /** Download artifact bytes from Daemon for local open/preview. */
  async function downloadArtifact(slugValue, relPath = '') {
    try {
      const slug = validateSlug(slugValue)
      const rel = String(relPath || '').trim().replace(/\\/g, '/')
      if (!rel || rel.includes('..')) throw clientError('invalid_path', '非法产物路径')
      const encoded = rel.split('/').filter(Boolean).map(encodeURIComponent).join('/')
      const { response, bytes } = await requestRaw(`/api/tasks/${encodeURIComponent(slug)}/artifacts/${encoded}`, {
        headers: { Accept: '*/*' },
      })
      if (!response.ok) {
        let body = {}
        if (bytes.length) {
          try { body = JSON.parse(bytes.toString('utf8')) } catch { body = {} }
        }
        const parsed = parseDaemonError(body, response.status, `Workbench 请求失败（${response.status}）`, {
          isAuthFailure,
        })
        throw clientError(parsed.code, parsed.message, response.status)
      }
      const name = pathBasename(rel)
      return { ok: true, slug, path: rel, name, bytes }
    } catch (error) {
      return normalizeError(error)
    }
  }

  function pathBasename(rel) {
    const parts = String(rel || '').replace(/\\/g, '/').split('/').filter(Boolean)
    return parts[parts.length - 1] || 'artifact'
  }

  function createRequestId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    return `knowme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  function normalizeArtifact(item) {
    if (typeof item === 'string') return { name: item, path: item, local: true }
    const raw = item && typeof item === 'object' ? item : {}
    const downloadUrl = String(raw.download_url || raw.downloadUrl || raw.url || '').trim()
    const path = String(raw.path || raw.full_path || raw.fullPath || '').trim()
    return {
      ...raw,
      id: String(raw.id || raw.artifact_id || raw.artifactId || '').trim(),
      name: String(raw.name || raw.title || path || '未命名制品'),
      path,
      kind: String(raw.kind || raw.type || '').trim(),
      size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : null,
      downloadUrl,
      local: raw.local === true || (!downloadUrl && /^[a-zA-Z]:[\\/]/.test(path)),
    }
  }

  async function decide(slugValue, payload = {}) {
    try {
      const slug = validateSlug(slugValue)
      const node = String(payload.node || '').trim()
      const decision = String(payload.decision || '').trim()
      if (!node || !['approve', 'reject', 'revise'].includes(decision)) {
        throw clientError('invalid_gate', '审批参数无效')
      }
      await request(`/api/tasks/${encodeURIComponent(slug)}/gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, decision, comment: String(payload.comment || '') }),
      })
      return { ok: true }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function clarify(slugValue, payload = {}) {
    try {
      const slug = validateSlug(slugValue)
      const node = String(payload.node || '').trim()
      const answer = String(payload.answer || '').trim()
      if (!node || !answer) throw clientError('invalid_clarification', '请填写需要提交的回答')
      await request(`/api/tasks/${encodeURIComponent(slug)}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, answer }),
      })
      return { ok: true }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function cancel(slugValue, payload = {}) {
    try {
      const slug = validateSlug(slugValue)
      const reason = String(payload.reason || 'user_cancelled').trim()
      const body = reason ? { reason } : {}
      await request(`/api/tasks/${encodeURIComponent(slug)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { ok: true, slug }
    } catch (error) {
      return normalizeError(error)
    }
  }

  async function syncHandoffArtifacts(payload = {}) {
    return {
      ok: true,
      synced: true,
      artifactIds: Array.isArray(payload.artifactIds) ? payload.artifactIds : [],
      runId: payload.runId || '',
      readOnly: true,
    }
  }

  return {
    endpoint,
    overview,
    launchContext,
    createAndRun,
    task,
    artifacts,
    progress,
    logs,
    streamLogs,
    events,
    changes,
    workspaceTree,
    workspaceBlob,
    downloadArtifact,
    decide,
    clarify,
    cancel,
    syncHandoffArtifacts,
  }
}

module.exports = {
  DEFAULT_ENDPOINT,
  TASK_SLUG_RE,
  EXECUTOR_STALE_MS,
  normalizeEndpoint,
  validateSlug,
  generateTaskSlug,
  resolveTaskSlug,
  assessExecutorFromHealth,
  normalizeWorkflowCatalog,
  normalizeWorkflow,
  normalizeAgentExpert,
  normalizeAgentCatalog,
  selectAgentExperts,
  partitionAgentExperts,
  normalizeError,
  buildAuthHeaders,
  buildSubmitContext,
  taskState,
  hasPendingHitl,
  resolveDaemonRuntimeState,
  createClient,
}
