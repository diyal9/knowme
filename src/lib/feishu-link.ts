'use strict'

const FEISHU_HOSTS = new Set([
  'feishu.cn',
  'www.feishu.cn',
  'larksuite.com',
  'www.larksuite.com',
])

const PREVIEWABLE_EXTS = new Set([
  '.md', '.markdown', '.txt', '.json', '.csv', '.log', '.yaml', '.yml',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico',
  '.pdf', '.mp4', '.webm', '.mp3', '.wav', '.ogg',
])

function classifyByPath(pathname) {
  const last = String(pathname || '').split('/').pop() || ''
  const dot = last.lastIndexOf('.')
  const ext = dot > -1 ? last.slice(dot).toLowerCase() : ''
  const previewable = PREVIEWABLE_EXTS.has(ext)
  return { ext, previewable }
}

function classifyFeishuResource(pathname) {
  const path = `/${String(pathname || '').toLowerCase().replace(/^\/+|\/+$/g, '')}/`
  const definitions = [
    { pattern: /\/client\/chat\/open\/?/, type: 'chat', label: '飞书会话', glyph: '聊' },
    { pattern: /\/(?:doc|docx)\//, type: 'doc', label: '飞书文档', glyph: '文' },
    { pattern: /\/sheets?\//, type: 'sheet', label: '电子表格', glyph: '表' },
    { pattern: /\/(?:base|bitable)\//, type: 'base', label: '多维表格', glyph: '多' },
    { pattern: /\/wiki\//, type: 'wiki', label: '知识库', glyph: '知' },
    { pattern: /\/(?:minutes?|minutedetail)\//, type: 'minutes', label: '飞书妙记', glyph: '记' },
    { pattern: /\/slides?\//, type: 'slides', label: '飞书幻灯片', glyph: '幻' },
    { pattern: /\/(?:drive|file)\//, type: 'file', label: '飞书文件', glyph: '件' },
  ]
  const matched = definitions.find(item => item.pattern.test(path))
  return matched
    ? { type: matched.type, label: matched.label, glyph: matched.glyph }
    : { type: 'resource', label: '飞书资源', glyph: '飞' }
}

/** Official AppLink to open a Feishu p2p/group chat by chat_id (oc_...). */
function buildFeishuChatOpenUrl(chatId) {
  const id = String(chatId || '').trim()
  if (!id || !/^oc_/i.test(id)) return ''
  return `https://applink.feishu.cn/client/chat/open?openChatId=${encodeURIComponent(id)}`
}

// AppLink hosts serve an https bounce page whose only job is to hand off to the
// desktop client; the matching scheme reaches the client without a browser tab.
const FEISHU_APPLINK_SCHEMES = new Map([
  ['applink.feishu.cn', 'feishu'],
  ['applink.larksuite.com', 'lark'],
])

/** Client-scheme form of an AppLink URL, or '' when the URL is not an AppLink. */
function buildFeishuClientUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'https:') return ''
  const scheme = FEISHU_APPLINK_SCHEMES.get(url.hostname.toLowerCase())
  if (!scheme) return ''
  return `${scheme}://${url.host}${url.pathname}${url.search}${url.hash}`
}

export function parseOpenLink(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  let url
  try { url = new URL(raw) } catch { return null }
  const protocol = url.protocol.toLowerCase()
  const allowed = new Set(['https:', 'http:', 'mailto:', 'file:', 'knowme:'])
  if (!allowed.has(protocol)) return null
  const hostname = url.hostname.toLowerCase()
  const isFeishu = protocol === 'https:'
    && (FEISHU_HOSTS.has(hostname) || hostname.endsWith('.feishu.cn') || hostname.endsWith('.larksuite.com'))
  const fileInfo = classifyByPath(url.pathname)
  const feishuResource = isFeishu ? classifyFeishuResource(url.pathname) : null
  const kind = isFeishu
    ? 'feishu'
    : (protocol === 'http:' || protocol === 'https:')
      ? (fileInfo.previewable ? 'preview' : 'browser')
      : protocol === 'file:'
        ? (fileInfo.previewable ? 'preview' : 'system')
        : protocol === 'knowme:'
          ? 'app'
          : 'mail'
  return {
    href: url.toString(),
    protocol,
    host: hostname,
    path: url.pathname,
    label: url.pathname.split('/').filter(Boolean).pop() || hostname || protocol.replace(':', ''),
    kind,
    ext: fileInfo.ext,
    previewable: fileInfo.previewable,
    isFeishu,
    feishuResource,
  }
}

function parseFeishuUrl(value) {
  const parsed = parseOpenLink(value)
  return parsed?.isFeishu ? parsed : null
}

/**
 * Rewrite Markdown links `[label](https://...)`, supporting nested `[...]` in labels.
 * Returns [{ start, end, label, href }] matches or applies a mapper.
 */
function findMarkdownLinks(text) {
  const src = String(text || '')
  const matches = []
  let i = 0
  while (i < src.length) {
    const close = src.indexOf('](', i)
    if (close < 0) break
    if (!/^\]\(https?:\/\//i.test(src.slice(close))) {
      i = close + 1
      continue
    }
    const urlStart = close + 2
    let urlEnd = urlStart
    while (urlEnd < src.length && src[urlEnd] !== ')' && !/\s/.test(src[urlEnd])) urlEnd++
    if (urlEnd >= src.length || src[urlEnd] !== ')') {
      i = close + 1
      continue
    }
    const href = src.slice(urlStart, urlEnd)
    if (!/^https?:\/\/\S+$/i.test(href)) {
      i = close + 1
      continue
    }
    let depth = 0
    let labelStart = -1
    for (let j = close - 1; j >= 0; j--) {
      const ch = src[j]
      if (ch === ']') depth += 1
      else if (ch === '[') {
        if (depth === 0) { labelStart = j; break }
        depth -= 1
      }
    }
    if (labelStart < 0) {
      i = close + 1
      continue
    }
    matches.push({
      start: labelStart,
      end: urlEnd + 1,
      label: src.slice(labelStart + 1, close),
      href,
    })
    i = urlEnd + 1
  }
  return matches
}

function rewriteMarkdownLinks(text, mapFn) {
  const src = String(text || '')
  const matches = findMarkdownLinks(src)
  if (!matches.length) return src
  let out = ''
  let cursor = 0
  for (const m of matches) {
    out += src.slice(cursor, m.start)
    out += mapFn(m.label, m.href, m)
    cursor = m.end
  }
  out += src.slice(cursor)
  return out
}

function linkAction(value, action) {
  const parsed = parseOpenLink(value)
  if (!parsed) return { ok: false, message: '仅支持 http/https/file/mailto/knowme 链接' }
  const allowed = new Set(['right', 'external', 'copy', 'smart'])
  if (!allowed.has(action)) return { ok: false, message: '不支持的链接操作' }
  return { ok: true, action, ...parsed }
}

const feishuLinkApi = {
  FEISHU_HOSTS,
  PREVIEWABLE_EXTS,
  classifyFeishuResource,
  buildFeishuChatOpenUrl,
  buildFeishuClientUrl,
  parseFeishuUrl,
  parseOpenLink,
  findMarkdownLinks,
  rewriteMarkdownLinks,
  linkAction,
}

if (typeof module === 'object' && module.exports) module.exports = feishuLinkApi
if (typeof window !== 'undefined') window.FeishuLink = feishuLinkApi
