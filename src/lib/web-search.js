'use strict'

const net = require('net')
const webFetch = require('./web-fetch')

const DEFAULT_TIMEOUT_MS = 10000
const MAX_RESPONSE_BYTES = 1024 * 1024
const MAX_RESULTS = 10
const MAX_TOTAL_CHARS = 12000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 KnowMe/0.3'

const ERROR_MESSAGES = {
  invalid_query: '搜索词不能为空。',
  timeout: '网络搜索响应超时，请稍后重试。',
  http_error: '搜索服务返回了错误状态。',
  network_error: '网络不可达，未能连接到搜索服务。',
  invalid_response: '搜索服务返回了无法解析的结果。',
  no_results: '没有找到符合条件的公开网页结果。',
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message: message || ERROR_MESSAGES[code] || '网络搜索失败。',
    ...extra,
  }
}

function clampInteger(value, min, max, fallback) {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

function decodeCodePoint(value, radix = 10) {
  const code = parseInt(String(value), radix)
  if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF) return '\uFFFD'
  try { return String.fromCodePoint(code) } catch { return '\uFFFD' }
}

function decodeXml(text = '') {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_m, n) => decodeCodePoint(n))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => decodeCodePoint(n, 16))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function stripMarkup(text = '', max = 800) {
  return decodeXml(text)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function readTag(block, tag) {
  const match = String(block || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]).trim() : ''
}

function normalizePublishedAt(value) {
  const time = Date.parse(String(value || '').trim())
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function normalizeSearchQuery(query, mode = 'web') {
  const raw = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (mode !== 'news') return raw
  const simplified = raw
    .replace(/\b(today|latest|recent|current|news|updates?)\b/gi, ' ')
    .replace(/(今天|今日|最新|近期|最近|刚刚|实时|本周|这周|本月|这个月|资讯|新闻|动态|消息|快讯)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return simplified.length >= 2 ? simplified : raw
}

function isSafeResultUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl || '').trim())
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  if (net.isIP(hostname) && webFetch.isBlockedAddress(hostname)) return false
  return true
}

function normalizeResultUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || '').trim())
    if (/(^|\.)bing\.com$/i.test(parsed.hostname) && /\/news\/apiclick\.aspx$/i.test(parsed.pathname)) {
      const target = parsed.searchParams.get('url')
      if (target && isSafeResultUrl(target)) {
        const direct = new URL(target)
        direct.hash = ''
        return direct.href
      }
    }
    if (!isSafeResultUrl(parsed.href)) return ''
    parsed.hash = ''
    return parsed.href
  } catch {
    return ''
  }
}

function parseRssItems(xml, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const limit = clampInteger(options.limit, 1, MAX_RESULTS, 6)
  const recencyDays = options.recencyDays == null
    ? null
    : clampInteger(options.recencyDays, 1, 365, 7)
  const cutoff = recencyDays ? now.getTime() - (recencyDays * 86400000) : null
  const blocks = String(xml || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []
  const results = []
  const seen = new Set()
  let usedChars = 0

  for (const block of blocks) {
    const title = stripMarkup(readTag(block, 'title'), 240)
    const url = readTag(block, 'link').trim()
    if (!title || !isSafeResultUrl(url)) continue
    const normalizedUrl = normalizeResultUrl(url)
    if (!normalizedUrl) continue
    if (seen.has(normalizedUrl)) continue

    const publishedAt = normalizePublishedAt(readTag(block, 'pubDate') || readTag(block, 'published'))
    if (cutoff && publishedAt && Date.parse(publishedAt) < cutoff) continue
    const snippet = stripMarkup(readTag(block, 'description') || readTag(block, 'summary'), 700)
    const source = stripMarkup(readTag(block, 'source') || readTag(block, 'News:Source'), 120)
      || (() => {
        try { return new URL(normalizedUrl).hostname } catch { return '' }
      })()
    const entryChars = title.length + normalizedUrl.length + snippet.length + source.length
    if (usedChars + entryChars > MAX_TOTAL_CHARS && results.length) break
    usedChars += entryChars
    seen.add(normalizedUrl)
    results.push({
      title,
      url: normalizedUrl,
      snippet,
      source,
      publishedAt,
      retrievedAt: now.toISOString(),
    })
    if (results.length >= limit) break
  }
  return results
}

function defaultEndpointBuilder({ query, mode, recencyDays }) {
  const base = mode === 'news'
    ? 'https://www.bing.com/news/search'
    : 'https://www.bing.com/search'
  const url = new URL(base)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'rss')
  if (mode === 'news') {
    url.searchParams.set('mkt', 'en-US')
    if (recencyDays != null) {
      url.searchParams.set('freshness', recencyDays <= 1 ? 'Day' : (recencyDays <= 7 ? 'Week' : 'Month'))
    }
  }
  return url.href
}

function combineSignal(externalSignal, timeoutMs) {
  const controller = new AbortController()
  const abort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  if (externalSignal?.aborted) abort()
  else externalSignal?.addEventListener?.('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  if (typeof timer.unref === 'function') timer.unref()
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
      externalSignal?.removeEventListener?.('abort', abort)
    },
  }
}

async function readTextLimited(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response?.body?.getReader) {
    const text = await response.text()
    const bytes = Buffer.byteLength(text, 'utf8')
    return {
      text: bytes > maxBytes ? Buffer.from(text).subarray(0, maxBytes).toString('utf8') : text,
      truncated: bytes > maxBytes,
    }
  }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    const remaining = maxBytes - total
    if (remaining <= 0) {
      truncated = true
      break
    }
    chunks.push(chunk.subarray(0, remaining))
    total += Math.min(chunk.length, remaining)
    if (chunk.length > remaining) {
      truncated = true
      break
    }
  }
  if (truncated) {
    try { await reader.cancel() } catch { /* ignore */ }
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated }
}

async function searchWeb(query, options = {}) {
  const mode = options.mode === 'news' ? 'news' : 'web'
  const normalizedQuery = normalizeSearchQuery(query, mode)
  if (!normalizedQuery) return fail('invalid_query')
  const limit = clampInteger(options.limit, 1, MAX_RESULTS, 6)
  const recencyDays = options.recencyDays == null
    ? null
    : clampInteger(options.recencyDays, 1, 365, 7)
  const timeoutMs = clampInteger(options.timeoutMs, 100, 30000, DEFAULT_TIMEOUT_MS)
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch
  const endpointBuilder = typeof options.endpointBuilder === 'function'
    ? options.endpointBuilder
    : defaultEndpointBuilder
  if (typeof fetchImpl !== 'function') return fail('network_error', '当前运行时没有可用的网络请求实现。')

  let endpoint
  try {
    endpoint = endpointBuilder({ query: normalizedQuery, mode, recencyDays, limit })
  } catch (error) {
    return fail('invalid_query', String(error?.message || error).slice(0, 300))
  }

  const combined = combineSignal(options.signal, timeoutMs)
  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.5',
      },
      signal: combined.signal,
    })
    if (!response?.ok) {
      return fail('http_error', `搜索服务返回 HTTP ${response?.status || '错误'}。`, {
        status: response?.status || 0,
      })
    }
    const body = await readTextLimited(response, options.maxBytes || MAX_RESPONSE_BYTES)
    const results = parseRssItems(body.text, {
      limit,
      recencyDays,
      now: options.now,
    })
    if (!results.length) {
      const hasRss = /<(?:rss|feed|channel|item)\b/i.test(body.text)
      return fail(hasRss ? 'no_results' : 'invalid_response', undefined, {
        truncated: body.truncated,
      })
    }
    return {
      ok: true,
      query: normalizedQuery,
      mode,
      recencyDays,
      retrievedAt: results[0].retrievedAt,
      results,
      truncated: body.truncated,
      provider: 'bing-rss',
    }
  } catch (error) {
    const cancelled = options.signal?.aborted === true
    const timedOut = combined.signal.aborted && !cancelled
    if (cancelled) return fail('cancelled', '网络搜索已取消。')
    return fail(timedOut ? 'timeout' : 'network_error', timedOut
      ? ERROR_MESSAGES.timeout
      : String(error?.message || ERROR_MESSAGES.network_error).slice(0, 300))
  } finally {
    combined.cleanup()
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  MAX_RESULTS,
  MAX_TOTAL_CHARS,
  ERROR_MESSAGES,
  decodeXml,
  stripMarkup,
  normalizePublishedAt,
  normalizeSearchQuery,
  isSafeResultUrl,
  normalizeResultUrl,
  parseRssItems,
  defaultEndpointBuilder,
  readTextLimited,
  searchWeb,
}
