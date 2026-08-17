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
const TASK_SLUG_RE = /^[a-z][a-z0-9-]{0,79}$/

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
  return {
    slug: String(item && item.slug || ''),
    workflow: String(item && item.workflow || ''),
    intent: String(item && item.intent || ''),
    state: taskState(item),
    updatedAt: String(item && (item.updated_at || item.updatedAt || item.created_at) || ''),
    raw: item || {},
  }
}

module.exports = {
  normalizeEndpoint,
  validateSlug,
  pad2,
  generateTaskSlug,
  resolveTaskSlug,
  assessExecutorFromHealth,
  clientError,
  normalizeError,
  buildAuthHeaders,
  listFrom,
  normalizeWorkflowCatalog,
  normalizeWorkflow,
  normalizeAgentExpert,
  normalizeAgentCatalog,
  selectAgentExperts,
  partitionAgentExperts,
  normalizeLaunchContextBody,
  taskState,
  buildSubmitContext,
  normalizeTask,
}
