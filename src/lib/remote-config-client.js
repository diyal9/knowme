'use strict'

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8020'
const DEFAULT_TIMEOUT_MS = 4000

function clientError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeEndpoint(value = DEFAULT_ENDPOINT) {
  let parsed
  try {
    parsed = new URL(String(value || DEFAULT_ENDPOINT).trim())
  } catch {
    throw clientError('invalid_endpoint', '远程配置地址格式无效')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(hostname) ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname && parsed.pathname !== '/') ||
    parsed.search ||
    parsed.hash
  ) {
    throw clientError('invalid_endpoint', '首版仅允许连接本机 HTTP 管理配置服务')
  }
  parsed.pathname = ''
  return parsed.toString().replace(/\/$/, '')
}

function normalizeError(error) {
  if (error && error.name === 'AbortError') {
    return { ok: false, code: 'timeout', error: '远程配置服务响应超时' }
  }
  return {
    ok: false,
    code: (error && error.code) || 'offline',
    error: (error && error.message) || '无法连接远程配置服务',
    status: Number((error && error.status) || 0),
  }
}

function createRemoteConfigClient(options = {}) {
  const enabled = options.enabled === true
  const endpoint = normalizeEndpoint(options.endpoint || DEFAULT_ENDPOINT)
  const fetchImpl = options.fetch || globalThis.fetch
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)

  async function fetchPublic() {
    if (!enabled) {
      return { ok: false, code: 'disabled', error: '远程配置未启用' }
    }
    if (typeof fetchImpl !== 'function') {
      return { ok: false, code: 'offline', error: '当前环境不支持 fetch' }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(`${endpoint}/v1/config/public`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      const status = res.status
      let body
      try {
        body = await res.json()
      } catch {
        return { ok: false, code: 'invalid_json', error: '远程配置响应不是 JSON', status }
      }
      if (!res.ok || !body || body.ok !== true) {
        return {
          ok: false,
          code: 'http_error',
          error: (body && body.error) || `HTTP ${status}`,
          status,
        }
      }
      return {
        ok: true,
        config: body.config && typeof body.config === 'object' ? body.config : {},
        updatedAt: body.updated_at || null,
        requestId: res.headers.get('X-Request-Id') || null,
      }
    } catch (error) {
      return normalizeError(error)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    enabled,
    endpoint,
    fetchPublic,
  }
}

module.exports = {
  DEFAULT_ENDPOINT,
  normalizeEndpoint,
  createRemoteConfigClient,
}
