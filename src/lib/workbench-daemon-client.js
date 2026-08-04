'use strict'

const { isAuthFailure } = require('./workbench-auth')
const {
  normalizeTaskContext,
  normalizeTaskContextDefaults,
  summarizeTaskContext,
} = require('./workbench-task-context')

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8010'
const DEFAULT_TIMEOUT_MS = 4000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const TASK_SLUG_RE = /^[a-z][a-z0-9-]{0,79}$/
const TERMINAL_STATES = new Set(['finished', 'failed', 'cancelled', 'completed', 'done'])

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

function clientError(code, message, status = 0) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

function errorMessage(body, fallback) {
  if (!body || typeof body !== 'object') return fallback
  const detail = body.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail.message === 'string') return detail.message
  if (typeof body.message === 'string') return body.message
  return fallback
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

function normalizeWorkflow(item) {
  return {
    id: String(item && (item.id || item.workflow) || ''),
    name: String(item && (item.name || item.title || item.id || item.workflow) || '未命名流程'),
    summary: String(item && (item.summary || item.purpose) || ''),
    description: String(item && item.description || ''),
    tags: Array.isArray(item && item.tags) ? item.tags.map(String) : [],
    locked: !!(item && item.locked),
    source: 'daemon',
  }
}

function normalizeLaunchContextBody(body) {
  const raw = body && typeof body === 'object'
    ? (body.context || body.defaults || body.launch_context || body.launchContext || body)
    : body
  return normalizeTaskContextDefaults(raw)
}

function taskState(item) {
  return String(
    item && item.job && item.job.state ||
    item && item.status && (item.status.state || item.status.status) ||
    item && item.state ||
    'idle'
  ).toLowerCase()
}

function normalizeTask(item) {
  return {
    slug: String(item && item.slug || ''),
    workflow: String(item && item.workflow || ''),
    intent: String(item && item.intent || ''),
    state: taskState(item),
    updatedAt: String(item && (item.updated_at || item.updatedAt || item.created_at) || ''),
    raw: item || {},
  }
}

function createClient(options = {}) {
  const endpoint = normalizeEndpoint(options.endpoint || process.env.KNOWME_WORKBENCH_URL || DEFAULT_ENDPOINT)
  const fetchImpl = options.fetch || globalThis.fetch
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const maxResponseBytes = Number(options.maxResponseBytes || MAX_RESPONSE_BYTES)
  const token = String(options.token || process.env.KNOWME_WORKBENCH_TOKEN || '').trim()
  if (typeof fetchImpl !== 'function') throw clientError('fetch_unavailable', '当前运行环境不支持 HTTP 请求')

  async function request(pathname, options = {}) {
    if (!String(pathname).startsWith('/api/')) {
      throw clientError('invalid_path', 'Workbench API 路径不在允许范围内')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${endpoint}${pathname}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...buildAuthHeaders(token),
          ...(options.headers || {}),
        },
      })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > maxResponseBytes) {
        throw clientError('response_too_large', 'Workbench 响应超过安全上限')
      }
      let body = {}
      if (bytes.length) {
        try {
          body = JSON.parse(bytes.toString('utf8'))
        } catch {
          throw clientError('invalid_json', 'Workbench 返回了无法识别的数据')
        }
      }
      if (!response.ok) {
        const message = errorMessage(body, `Workbench 请求失败（${response.status}）`)
        const bodyCode = String(body && (body.code || body.error_code || '') || '').toLowerCase()
        const protocolFailure = response.status === 409 || response.status === 426
          || /protocol|version/.test(bodyCode)
          || /协议版本|protocol version/i.test(message)
        const code = response.status === 401 || isAuthFailure(response.status, message)
          ? 'auth_required'
          : (protocolFailure
            ? 'protocol_incompatible'
            : (response.status === 403 ? 'forbidden' : 'http_error'))
        throw clientError(code, message, response.status)
      }
      return body
    } finally {
      clearTimeout(timer)
    }
  }

  async function overview() {
    try {
      const health = await request('/api/health')
      const [workflowBody, taskBody] = await Promise.all([
        request('/api/workflows'),
        request('/api/tasks'),
      ])
      return {
        ok: true,
        online: true,
        endpoint,
        health,
        workflows: listFrom(workflowBody, 'workflows').map(normalizeWorkflow).filter(item => item.id),
        tasks: listFrom(taskBody, 'tasks').map(normalizeTask).filter(item => item.slug).slice(0, 20),
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
          error: '当前工作服务尚未提供默认上下文接口',
        }
      }
      return normalizeError(error)
    }
  }

  async function createAndRun(payload = {}) {
    try {
      const slug = validateSlug(payload.slug)
      const workflow = String(payload.workflow || '').trim()
      const intent = String(payload.intent || '').trim()
      if (!workflow) throw clientError('invalid_workflow', '请选择工作流')
      if (!intent) throw clientError('invalid_intent', '请填写任务目标')
      const context = normalizeTaskContext(payload.context)
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
      const state = taskState(body)
      return { ok: true, slug, state, terminal: TERMINAL_STATES.has(state), ...body }
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

  return { endpoint, overview, launchContext, createAndRun, task, artifacts, decide, clarify }
}

module.exports = {
  DEFAULT_ENDPOINT,
  TASK_SLUG_RE,
  normalizeEndpoint,
  validateSlug,
  normalizeError,
  buildAuthHeaders,
  createClient,
}
