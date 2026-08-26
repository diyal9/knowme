/**
 * feishu-cli/core — lark-cli spawn、重试、query 清洗与只读命令构建/执行。
 * 不负责：会议/IM/日历等工作流编排（见 sibling 模块）。
 */
'use strict'

const { spawn } = require('child_process')
const {
  buildSearchDocsArgs,
  buildReadDocArgs,
  buildSearchChatsArgs,
  buildListChatsArgs,
  buildSearchUsersArgs,
} = require('../feishu-toolkit')

const DEFAULT_TIMEOUT_MS = 20000

/** Allowlisted argv prefixes (after binary). No arbitrary `api` passthrough. */
const READ_COMMANDS = {
  'feishu.search_docs': ['docs', '+search', '--as', 'user'],
  'feishu.read_doc': ['docs', '+fetch', '--api-version', 'v2', '--as', 'user'],
  'feishu.query_bitable': ['base', '+data-query'],
  'feishu.list_wiki_spaces': ['wiki', '+space-list', '--as', 'user'],
  'feishu.list_wiki_nodes': ['wiki', '+node-list', '--as', 'user'],
  'feishu.get_wiki_node': ['wiki', '+node-get', '--as', 'user'],
  'feishu.list_chats': ['im', '+chat-list', '--as', 'user'],
  'feishu.search_chats': ['im', '+chat-search', '--as', 'user'],
  'feishu.search_users': ['contact', '+search-user', '--as', 'user'],
  'feishu.get_self': ['contact', '+get-user', '--as', 'user'],
}

const WRITE_APPLY_COMMANDS = {
  'feishu.apply_write_doc': null, // resolved per draft action
}

function formatLocalDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(base, days) {
  const d = new Date(base instanceof Date ? base.getTime() : new Date(base).getTime())
  d.setDate(d.getDate() + days)
  return d
}

function normalizeRelativeDateQuery(query, now = new Date()) {
  const src = String(query || '').trim()
  if (!src) return src
  const hasAbsoluteDate = /\b\d{4}-\d{2}-\d{2}\b/.test(src)
  if (hasAbsoluteDate) return src
  const terms = [
    { term: '大前天', days: -3 },
    { term: '前天', days: -2 },
    { term: '昨天', days: -1 },
    { term: '今天', days: 0 },
    { term: '明天', days: 1 },
    { term: '后天', days: 2 },
  ]
  let out = src
  let changed = false
  for (const item of terms) {
    if (!out.includes(item.term)) continue
    const anchored = `${formatLocalDate(addDays(now, item.days))}（${item.term}）`
    out = out.split(item.term).join(anchored)
    changed = true
  }
  return changed ? out : src
}

function sanitizeCliQuery(query) {
  const src = String(query || '').trim()
  if (!src) return ''
  // Windows cmd 包裹参数时，内层双引号会被拆词，导致 CLI 误判为位置参数。
  const unescaped = src.replace(/\\"/g, '"')
  return unescaped
    .replace(/[“”]/g, '"')
    .replace(/"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeQueryArgForPlatform(query, platform = process.platform) {
  const src = String(query || '').trim()
  if (!src) return ''
  // Windows + cmd 路径下，某些 CLI 会把含空格 --query 值拆成位置参数。
  // 这里改为无空格 token 串，避免拆词（检索语义仍保留关键词集合）。
  if (String(platform) === 'win32') {
    return src.replace(/\s+/g, ',')
  }
  return src
}

function defaultBin() {
  return process.platform === 'win32' ? 'lark-cli.cmd' : 'lark-cli'
}

function commandFor(bin, args) {
  if (process.platform !== 'win32') return [bin, args]
  // Keep argv tokenization intact on Windows by passing each arg separately to cmd.
  // This avoids long --query values being split into positional arguments.
  return [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', bin, ...args]]
}

function sanitizeCliArgs(argv = []) {
  const args = Array.isArray(argv) ? argv.slice() : []
  // Older workflow callers could leak the wiki-only --page-all flag into
  // docs +search. Strip it at the final execution boundary as a safety net.
  if (args[0] === 'docs' && args[1] === '+search') {
    return args.filter(arg => arg !== '--page-all')
  }
  return args
}

function softenQueryForRetry(query) {
  return String(query || '')
    .replace(/[“”"]/g, ' ')
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !/^(OR|AND|NOT)$/i.test(token))
    .join(' ')
    .trim()
}

function isReadTool(name) {
  return Object.prototype.hasOwnProperty.call(READ_COMMANDS, name)
}

function isDraftTool(name) {
  return name === 'feishu.draft_write_doc' || name === 'feishu.draft_minute_permission'
}

function isApplyTool(name) {
  return name === 'feishu.apply_write_doc'
}

function buildReadArgs(toolName, args = {}) {
  const base = READ_COMMANDS[toolName]
  if (!base) return null
  const out = [...base]
  if (toolName === 'feishu.search_docs') {
    const built = buildSearchDocsArgs(args, {
      normalizeRelativeDateQuery,
      sanitizeCliQuery,
      normalizeQueryArgForPlatform,
    })
    if (!built.ok) return { error: built.message || 'search_docs 参数不合法' }
    out.push(...built.args)
  } else if (toolName === 'feishu.read_doc') {
    const built = buildReadDocArgs(args)
    if (!built.ok) return { error: built.message || 'read_doc 参数不合法' }
    out.push(...built.args)
  } else if (toolName === 'feishu.query_bitable') {
    // Prefer explicit JSON DSL via --data when provided
    if (args.data && typeof args.data === 'object') {
      out.push('--data', JSON.stringify(args.data))
    } else if (args.app_token && args.table_id) {
      out.push('--data', JSON.stringify({
        app_token: args.app_token,
        table_id: args.table_id,
        filter: args.filter || undefined,
        limit: args.limit || 20,
      }))
    } else {
      return { error: 'query_bitable 需要 data 或 app_token+table_id' }
    }
    out.push('--format', 'json')
  } else if (toolName === 'feishu.list_wiki_nodes') {
    const spaceId = String(args.space_id || '').trim()
    if (!spaceId) return { error: 'list_wiki_nodes 需要 space_id' }
    out.push('--space-id', spaceId)
    if (args.parent_node_token) out.push('--parent-node-token', String(args.parent_node_token))
    if (args.page_all) out.push('--page-all')
    out.push('--format', 'json')
  } else if (toolName === 'feishu.get_wiki_node') {
    const nodeToken = String(args.node_token || args.url || '').trim()
    if (!nodeToken) return { error: 'get_wiki_node 需要 node_token 或 url' }
    out.push('--node-token', nodeToken, '--format', 'json')
  } else if (toolName === 'feishu.list_wiki_spaces') {
    if (args.page_all) out.push('--page-all')
    out.push('--format', 'json')
  } else if (toolName === 'feishu.list_chats') {
    const built = buildListChatsArgs(args)
    if (!built.ok) return { error: built.message || 'list_chats 参数不合法' }
    out.push(...built.args)
  } else if (toolName === 'feishu.search_chats') {
    const built = buildSearchChatsArgs(args, {
      sanitizeCliQuery,
      normalizeQueryArgForPlatform,
    })
    if (!built.ok) return { error: built.message || 'search_chats 参数不合法' }
    out.push(...built.args)
  } else if (toolName === 'feishu.search_users') {
    const built = buildSearchUsersArgs(args, {
      sanitizeCliQuery,
      normalizeQueryArgForPlatform,
    })
    if (!built.ok) return { error: built.message || 'search_users 参数不合法' }
    out.push(...built.args)
  } else if (toolName === 'feishu.get_self') {
    out.push('--format', 'json')
  }
  return { args: out }
}

function runLarkCli(argv, opts = {}) {
  const bin = opts.bin || process.env.KNOWME_LARK_CLI || defaultBin()
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const injectedSpawn = typeof opts.spawnImpl === 'function'
  const spawnImpl = injectedSpawn ? opts.spawnImpl : spawn

  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    let child
    try {
      // On Windows, run through cmd to reliably execute .cmd shims.
      const safeArgv = sanitizeCliArgs(argv)
      const command = process.platform === 'win32' && !injectedSpawn
        ? commandFor(bin, safeArgv)
        : [bin, safeArgv]
      child = spawnImpl(...command, {
        windowsHide: true,
        shell: false,
        env: process.env,
      })
    } catch (err) {
      return finish({ ok: false, code: 'spawn_error', message: String(err?.message || err), text: '' })
    }
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      finish({ ok: false, code: 'timeout', message: 'lark-cli 超时', text: stdout.slice(0, 2000) })
    }, timeoutMs)
    child.stdout?.on('data', (c) => { stdout += String(c) })
    child.stderr?.on('data', (c) => { stderr += String(c) })
    child.on('error', (err) => {
      clearTimeout(timer)
      const missing = err?.code === 'ENOENT'
      finish({
        ok: false,
        code: missing ? 'missing_cli' : 'spawn_error',
        message: missing ? '未找到 lark-cli' : String(err.message || err),
        text: '',
      })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        finish({ ok: true, text: stdout.slice(0, 24000), code: 0 })
      } else {
        finish({
          ok: false,
          code: 'cli_error',
          message: (stderr || stdout || `exit ${code}`).slice(0, 500),
          text: stdout.slice(0, 4000),
        })
      }
    })
  })
}

// 飞书服务端偶发的瞬时错误（Internal error / Please retry / 超时 / 5xx），可自动重试
function isTransientCliFailure(res) {
  if (!res || res.ok) return false
  if (res.code === 'timeout') return true
  const blob = `${res.message || ''} ${res.text || ''}`
  if (/"code"\s*:\s*1\b/.test(blob) && /internal|retry/i.test(blob)) return true
  return /internal error|please retry|try again|服务器繁忙|系统繁忙|\b50[0-3]\b/i.test(blob)
}

async function runLarkCliWithRetry(argv, opts = {}, { retries = 2, backoffMs = 400 } = {}) {
  const maxRetries = Number.isFinite(Number(opts.retries))
    ? Math.max(0, Math.floor(Number(opts.retries)))
    : retries
  const delayBase = Number.isFinite(Number(opts.backoffMs))
    ? Math.max(0, Number(opts.backoffMs))
    : backoffMs
  let res = await runLarkCli(argv, opts)
  for (let attempt = 0; attempt < maxRetries && isTransientCliFailure(res); attempt += 1) {
    if (delayBase > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBase * (attempt + 1)))
    }
    res = await runLarkCli(argv, opts)
  }
  return res
}

function normalizeCliErrorMessage(message, stdoutText = '', toolName = '') {
  const raw = String(message || '').trim()
  const tool = String(toolName || '').trim()
  const out = `${raw}\n${String(stdoutText || '')}\n${tool}`
  if (/User identity is missing|user identity is missing|no token in keychain|need_user_authorization|user authorization is required/i.test(out)) {
    return '飞书用户身份未授权：请在设置 → 连接器 启用飞书后，先完成 user 授权再查询文档/知识库。'
  }
  if (/invalid\s+minute\s+token|minute\s+token\s+(?:is\s+)?invalid|minute_token.*(?:invalid|expired)/i.test(out)) {
    return '飞书返回：妙记 token 无效或已失效。请从对应会议详情重新获取妙记/会议纪要链接后再试。'
  }
  // Per-minute ACL, not a missing app scope: only the minutes owner can grant it.
  const noMinutePerm = out.match(/No read permission for minute\s+([\w-]+)/i)
  if (noMinutePerm) {
    return `这份妙记（${noMinutePerm[1]}）当前授权用户没有查看权限，不是应用权限缺失。可用 feishu.draft_minute_permission 生成一条待确认的权限申请（经你确认后才会向纪要所有者发出），或你自己在飞书里申请「可阅读」后重试。`
  }
  if (/permission|scope|forbidden|unauthorized|401|403/i.test(out)) {
    if (/feishu\.search_users|search-user|contact/i.test(out)) {
      return '飞书权限不足：请补齐通讯录读取权限（contact.search-user）后重试。'
    }
    if (/feishu\.list_chats|feishu\.search_chats|chat-list|chat-search|\bim\b/i.test(out)) {
      return '飞书权限不足：请补齐会话列表读取权限（im.chat-list / im.chat-search）后重试。'
    }
    if (/messages-send|\+messages-send/i.test(out)) {
      return '飞书权限不足：请补齐消息发送权限（im.messages-send）后重试。'
    }
    if (/meeting_candidates|\bvc\b|vc \+|meeting\.search|meeting_list/i.test(out)) {
      return '飞书权限不足：请补齐视频会议读取权限（vc:meeting.search:read / vc:meeting:read）后重试。'
    }
    if (/meeting_read|minutes|minute_token/i.test(out)) {
      return '飞书权限不足：请补齐妙记/会议纪要读取权限（minutes:minutes.search:read）后重试。'
    }
    return '飞书权限不足：请补齐 docs/wiki 搜索读取权限后重试。'
  }
  if (/internal error|please retry|try again|服务器繁忙|系统繁忙|\b50[0-3]\b/i.test(out)) {
    return '飞书接口暂时不可用（已自动重试仍失败），请稍后再试一次。'
  }
  // 兜底：不要把裸 JSON / 长堆栈直接抛给用户
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean || clean.startsWith('{') || clean.length > 160) return '飞书工具调用失败，请稍后重试。'
  return clean
}


function parseCliJsonOutput(text = '') {
  const src = String(text || '').trim()
  if (!src) return null
  try { return JSON.parse(src) } catch {}
  const lines = src.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  for (const line of lines) {
    if (!(line.startsWith('{') || line.startsWith('['))) continue
    try { return JSON.parse(line) } catch {}
  }
  return null
}

async function executeFeishuRead(toolName, args, opts = {}) {
  if (!isReadTool(toolName)) {
    return { ok: false, code: 'unknown_tool', message: `非只读飞书工具: ${toolName}`, text: '' }
  }
  const built = buildReadArgs(toolName, args)
  if (built.error) return { ok: false, code: 'invalid_args', message: built.error, text: '' }
  let result = await runLarkCliWithRetry(built.args, opts)
  const positionalError = !result.ok && /positional arguments are not supported/i.test(String(result.message || ''))
  if (positionalError && toolName === 'feishu.search_docs') {
    const retryQuery = softenQueryForRetry(args?.query)
    if (retryQuery) {
      const retryBuilt = buildReadArgs(toolName, { ...(args || {}), query: retryQuery })
      if (retryBuilt?.args) {
        result = await runLarkCliWithRetry(retryBuilt.args, opts)
      }
    }
  }
  if (!result.ok) {
    // Prefer the authoritative structured missing-scope signal over regex generalization,
    // so callers can offer precise just-in-time re-authorization for the exact scope(s).
    const { parseMissingScopeError, describeMissingScopes } = require('./scopes')
    const missing = parseMissingScopeError(result.text)
    if (missing) {
      return {
        ...result,
        ok: false,
        code: 'missing_scope',
        missingScopes: missing.missingScopes,
        identity: missing.identity,
        hint: missing.hint,
        message: describeMissingScopes(missing.missingScopes),
        text: String(result.text || '').slice(0, 4000),
      }
    }
    const msg = normalizeCliErrorMessage(result.message, result.text, toolName)
    // Keep toolMessages / UI on the humanized line — never dump raw CLI JSON.
    return {
      ...result,
      message: msg,
      text: msg,
    }
  }
  return result
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  READ_COMMANDS,
  WRITE_APPLY_COMMANDS,
  formatLocalDate,
  addDays,
  normalizeRelativeDateQuery,
  sanitizeCliQuery,
  normalizeQueryArgForPlatform,
  defaultBin,
  commandFor,
  sanitizeCliArgs,
  softenQueryForRetry,
  isReadTool,
  isDraftTool,
  isApplyTool,
  buildReadArgs,
  runLarkCli,
  isTransientCliFailure,
  runLarkCliWithRetry,
  normalizeCliErrorMessage,
  executeFeishuRead,
  parseCliJsonOutput,
}
