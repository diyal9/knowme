'use strict'

const FEISHU_HOST_PATTERN = /(?:^|\.)((feishu\.cn)|(larksuite\.com))$/i

function parseUrl(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isFeishuHost(hostname = '') {
  return FEISHU_HOST_PATTERN.test(String(hostname || '').trim())
}

function parseFeishuDocumentLocator(input = {}) {
  const token = String(
    input.doc_token ||
    input.url ||
    input.document_id ||
    input.node_token ||
    ''
  ).trim()
  if (!token) {
    return { ok: false, code: 'invalid_args', message: 'read_doc 需要 doc_token 或 url' }
  }

  const url = parseUrl(token)
  if (!url) {
    // 非 URL 视作 token，兼容 docx / wikcn 等多种 token 形态。
    return { ok: true, locator: token, source: 'token' }
  }

  const hostname = String(url.hostname || '').toLowerCase()
  if (!isFeishuHost(hostname)) {
    if (/kdocs\.cn$/i.test(hostname)) {
      return {
        ok: false,
        code: 'invalid_args',
        message: 'read_doc 仅支持飞书文档：请传 feishu/larksuite 的 docx/wiki 链接或 token',
      }
    }
    return {
      ok: false,
      code: 'invalid_args',
      message: 'read_doc URL 不受支持：请传飞书 docx/wiki 链接或 token',
    }
  }

  const path = String(url.pathname || '').toLowerCase()
  const isDocUrl = /\/(?:doc|docx)\//.test(path)
  const isWikiUrl = /\/wiki\//.test(path)
  if (!isDocUrl && !isWikiUrl) {
    return {
      ok: false,
      code: 'invalid_args',
      message: 'read_doc 仅支持飞书 docx/wiki 链接；当前链接不是文档页面',
    }
  }

  return { ok: true, locator: token, source: isDocUrl ? 'docx_url' : 'wiki_url' }
}

function buildSearchDocsArgs(args = {}, helpers = {}) {
  const normalizeRelativeDateQuery = helpers.normalizeRelativeDateQuery || (q => String(q || '').trim())
  const sanitizeCliQuery = helpers.sanitizeCliQuery || (q => String(q || '').trim())
  const normalizeQueryArgForPlatform = helpers.normalizeQueryArgForPlatform || (q => String(q || '').trim())
  const q = String(args.query || '').trim()
  if (!q) return { ok: false, code: 'invalid_args', message: 'search_docs 需要 query' }
  const normalized = normalizeRelativeDateQuery(q)
  const safeQuery = sanitizeCliQuery(normalized)
  const queryArg = normalizeQueryArgForPlatform(safeQuery)
  if (!queryArg) return { ok: false, code: 'invalid_args', message: 'search_docs 需要有效 query' }
  const out = ['--query', queryArg]
  if (args.page_token) out.push('--page-token', String(args.page_token))
  if (args.page_size) out.push('--page-size', String(Math.max(1, Math.min(20, Number(args.page_size) || 15))))
  out.push('--format', args.format ? String(args.format) : 'json')
  return { ok: true, args: out }
}

function buildReadDocArgs(args = {}) {
  const parsed = parseFeishuDocumentLocator(args)
  if (!parsed.ok) return parsed
  return { ok: true, args: ['--doc', parsed.locator, '--format', 'json'], meta: { locatorSource: parsed.source } }
}

function buildSearchChatsArgs(args = {}, helpers = {}) {
  const sanitizeCliQuery = helpers.sanitizeCliQuery || (q => String(q || '').trim())
  const normalizeQueryArgForPlatform = helpers.normalizeQueryArgForPlatform || (q => String(q || '').trim())
  const q = String(args.query || '').trim()
  if (!q) return { ok: false, code: 'invalid_args', message: 'search_chats 需要 query' }
  const safeQuery = sanitizeCliQuery(q)
  const queryArg = normalizeQueryArgForPlatform(safeQuery)
  if (!queryArg) return { ok: false, code: 'invalid_args', message: 'search_chats 需要有效 query' }
  return {
    ok: true,
    args: [
      '--query', queryArg,
      '--chat-modes', String(args.chat_modes || 'group'),
      '--page-size', String(Math.max(1, Math.min(100, Number(args.page_size || 20)))),
      '--format', 'json',
    ],
  }
}

function buildListChatsArgs(args = {}) {
  return {
    ok: true,
    args: [
      '--types', String(args.types || 'group'),
      ...(args.sort ? ['--sort', String(args.sort)] : []),
      '--page-size', String(Math.max(1, Math.min(100, Number(args.page_size || 20)))),
      '--format', 'json',
    ],
  }
}

function buildSearchUsersArgs(args = {}, helpers = {}) {
  const sanitizeCliQuery = helpers.sanitizeCliQuery || (q => String(q || '').trim())
  const normalizeQueryArgForPlatform = helpers.normalizeQueryArgForPlatform || (q => String(q || '').trim())
  const q = String(args.query || '').trim()
  const userIds = String(args.user_ids || '').trim()
  if (!q && !userIds) return { ok: false, code: 'invalid_args', message: 'search_users 需要 query 或 user_ids' }
  const out = []
  if (q) {
    const safeQuery = sanitizeCliQuery(q)
    const queryArg = normalizeQueryArgForPlatform(safeQuery)
    if (!queryArg) return { ok: false, code: 'invalid_args', message: 'search_users 需要有效 query' }
    out.push('--query', queryArg)
  }
  if (userIds) out.push('--user-ids', userIds)
  out.push('--page-size', String(Math.max(1, Math.min(30, Number(args.page_size || 20)))))
  out.push('--format', 'json')
  return { ok: true, args: out }
}

module.exports = {
  parseFeishuDocumentLocator,
  buildSearchDocsArgs,
  buildReadDocArgs,
  buildSearchChatsArgs,
  buildListChatsArgs,
  buildSearchUsersArgs,
}
