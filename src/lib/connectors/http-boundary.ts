'use strict'

const REDIRECTS = new Set([301, 302, 303, 307, 308])

function boundaryError(code, message) {
  return Object.assign(new Error(message), { code })
}

function resolveConnectorHttpTarget(baseUrl, relativePath = '') {
  let base, target
  try {
    base = new URL(String(baseUrl))
    target = new URL(String(relativePath), base)
  } catch {
    throw boundaryError('http_target_denied', 'HTTP 连接器 URL 无效')
  }
  if (![base, target].every(url => ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
    || base.origin !== target.origin) {
    throw boundaryError('http_target_denied', 'HTTP 连接器仅允许无内嵌凭据的同源 HTTP(S) URL')
  }
  return target
}

function connectorHttpHeaders(configured = {}, runtime = {}, supplied = {}, accessToken = '') {
  const headers = new Headers(configured)
  new Headers(runtime).forEach((value, key) => headers.set(key, value))
  if (accessToken && !headers.has('authorization')) {
    headers.set('authorization', /^Bearer\s/i.test(accessToken) ? accessToken : `Bearer ${accessToken}`)
  }
  const protectedNames = new Set([...headers.keys()])
  new Headers(supplied).forEach((value, key) => {
    if (protectedNames.has(key) || /^(host|authorization|proxy-authorization|cookie|cookie2|connection|transfer-encoding|content-length)$/i.test(key)) {
      throw boundaryError('http_header_denied', '工具参数不能覆盖连接器配置请求头或路由、凭据请求头')
    }
    headers.set(key, value)
  })
  return headers
}

/** Every hop is checked BEFORE attaching configured credentials. */
async function fetchConnectorHttp(baseUrl, target, init, fetchImpl = globalThis.fetch) {
  let url = resolveConnectorHttpTarget(baseUrl, target)
  let request = { ...init, headers: new Headers(init.headers), redirect: 'manual' }
  for (let hop = 0; ; hop += 1) {
    const response = await fetchImpl(url, request)
    if (!REDIRECTS.has(response.status)) return response
    const location = response.headers.get('location')
    if (!location) return response
    await response.body?.cancel?.()
    if (hop >= 5) throw boundaryError('http_redirect_denied', 'HTTP 连接器重定向次数超限')
    let next
    try {
      next = resolveConnectorHttpTarget(baseUrl, new URL(location, url).href)
    } catch {
      throw boundaryError('http_redirect_denied', 'HTTP 连接器拒绝跨源或不安全的重定向')
    }
    // Match Fetch's method conversion while retaining same-origin credentials.
    if ((response.status === 303 && !['GET', 'HEAD'].includes(request.method))
      || ([301, 302].includes(response.status) && request.method === 'POST')) {
      request = { ...request, method: 'GET', body: undefined, headers: new Headers(request.headers) }
      for (const key of ['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location']) request.headers.delete(key)
    }
    url = next
  }
}

module.exports = { resolveConnectorHttpTarget, connectorHttpHeaders, fetchConnectorHttp }
