'use strict'

const DEFAULT_WORKBENCH_AUTH = {
  endpoint: 'http://127.0.0.1:8010',
  tenantId: '',
  tier: '',
  user: '',
  configuredAt: '',
}

function normalizeEndpoint(value = DEFAULT_WORKBENCH_AUTH.endpoint) {
  let parsed
  try {
    parsed = new URL(String(value || DEFAULT_WORKBENCH_AUTH.endpoint).trim())
  } catch {
    const error = new Error('Workbench 地址格式无效')
    error.code = 'invalid_endpoint'
    throw error
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
    const error = new Error('远程 Workbench 必须使用 HTTPS；本机开发可使用回环 HTTP')
    error.code = 'invalid_endpoint'
    throw error
  }
  parsed.pathname = ''
  return parsed.toString().replace(/\/$/, '')
}

function normalizeWorkbenchAuth(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  return {
    endpoint: String(input.endpoint || DEFAULT_WORKBENCH_AUTH.endpoint).trim() || DEFAULT_WORKBENCH_AUTH.endpoint,
    tenantId: String(input.tenantId || '').trim(),
    tier: String(input.tier || '').trim(),
    user: String(input.user || '').trim(),
    configuredAt: String(input.configuredAt || '').trim(),
  }
}

function resolveToken(settings = {}) {
  const fromSettings = String(settings.workbenchToken || '').trim()
  if (fromSettings) return fromSettings
  return String(process.env.KNOWME_WORKBENCH_TOKEN || '').trim()
}

function publicStatus(settings = {}, health = null) {
  const auth = normalizeWorkbenchAuth(settings.workbenchAuth)
  const configured = !!resolveToken(settings)
  const authEnabled = !!(health && health.auth_enabled)
  let state = 'disabled'
  if (authEnabled) state = configured ? 'ready' : 'required'
  return {
    configured,
    authEnabled,
    endpoint: auth.endpoint,
    tenantId: auth.tenantId,
    tier: auth.tier,
    user: auth.user,
    configuredAt: auth.configuredAt,
    state,
  }
}

function mergeAuthFromHealth(status, health) {
  const next = { ...status }
  if (health && typeof health === 'object') {
    next.authEnabled = !!health.auth_enabled
    if (next.authEnabled) next.state = next.configured ? 'ready' : 'required'
    else next.state = 'disabled'
  }
  return next
}

function isAuthFailure(statusCode, message = '') {
  if (statusCode === 401) return true
  if (statusCode !== 403) return false
  const text = String(message || '').toLowerCase()
  return /授权|auth|login|未登录|guest|token|permission denied/.test(text)
}

function errorMessage(body, fallback) {
  if (!body || typeof body !== 'object') return fallback
  const detail = body.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail.message === 'string') return detail.message
  if (typeof body.message === 'string') return body.message
  return fallback
}

async function login(payload = {}, options = {}) {
  let endpoint
  try {
    endpoint = normalizeEndpoint(payload.endpoint || DEFAULT_WORKBENCH_AUTH.endpoint)
  } catch (error) {
    return { ok: false, code: error.code || 'invalid_endpoint', error: error.message }
  }
  const key = String(payload.key || '').trim()
  const tenantId = String(payload.tenantId || '').trim()
  if (!key) return { ok: false, code: 'invalid_key', error: '请填写 Workbench 授权码' }
  const fetchImpl = options.fetch || globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return { ok: false, code: 'fetch_unavailable', error: '当前运行环境不支持 HTTP 请求' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 4000))
  try {
    const response = await fetchImpl(`${endpoint.replace(/\/$/, '')}/api/auth/login`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, tenant_id: tenantId }),
    })
    let body = {}
    try {
      body = await response.json()
    } catch {
      body = {}
    }
    if (!response.ok) {
      const message = errorMessage(body, `授权失败（${response.status}）`)
      return {
        ok: false,
        code: isAuthFailure(response.status, message) ? 'auth_required' : 'http_error',
        error: message,
        status: response.status,
      }
    }
    return {
      ok: true,
      token: key,
      tier: String(body.tier || '').trim(),
      user: String(body.user || '').trim(),
      tenantId: String(body.tenant_id || tenantId || '').trim(),
    }
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { ok: false, code: 'timeout', error: 'Workbench 授权请求超时' }
    }
    return { ok: false, code: 'offline', error: (error && error.message) || '无法连接 Workbench 服务' }
  } finally {
    clearTimeout(timer)
  }
}

function clearedAuthPatch() {
  return {
    workbenchToken: '',
    workbenchAuth: {
      ...DEFAULT_WORKBENCH_AUTH,
    },
  }
}

module.exports = {
  DEFAULT_WORKBENCH_AUTH,
  normalizeEndpoint,
  normalizeWorkbenchAuth,
  resolveToken,
  publicStatus,
  mergeAuthFromHealth,
  isAuthFailure,
  login,
  clearedAuthPatch,
}
