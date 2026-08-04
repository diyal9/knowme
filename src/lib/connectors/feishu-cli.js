'use strict'

const { spawn } = require('child_process')
const {
  buildSearchDocsArgs,
  buildReadDocArgs,
  buildSearchChatsArgs,
  buildListChatsArgs,
  buildSearchUsersArgs,
} = require('./feishu-toolkit')

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
  if (/User identity is missing|user identity is missing|no token in keychain/i.test(out)) {
    return '飞书用户身份未授权：请在设置 → 连接器 启用飞书后，先完成 user 授权再查询文档/知识库。'
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

/**
 * Extract structured missing-scope info from a lark-cli JSON error envelope.
 *
 * lark-cli surfaces the authoritative signal (originating from Feishu) as:
 *   { ok:false, identity:"user", error:{ type:"authorization", subtype:"missing_scope",
 *     missing_scopes:["space:document:retrieve"], identity:"user", hint, message } }
 *
 * We prefer this over regex-generalizing the human message, so callers know the
 * exact scope(s) to request instead of a vague "docs/wiki search permission" line.
 * Returns null when the output is not a missing-scope error.
 */
function parseMissingScopeError(text = '') {
  const parsed = parseCliJsonOutput(text)
  const err = parsed && typeof parsed === 'object' ? parsed.error : null
  if (!err || typeof err !== 'object') return null
  const scopes = Array.isArray(err.missing_scopes)
    ? err.missing_scopes.map((s) => String(s || '').trim()).filter(Boolean)
    : []
  const isMissingScope = err.subtype === 'missing_scope' || scopes.length > 0
  if (!isMissingScope) return null
  return {
    missingScopes: scopes,
    identity: String(err.identity || parsed.identity || '').trim() || null,
    hint: String(err.hint || '').trim() || null,
    rawMessage: String(err.message || '').trim() || null,
  }
}

/** Build a precise, non-misleading user message naming the exact missing scope(s). */
function describeMissingScopes(missingScopes = []) {
  const list = (Array.isArray(missingScopes) ? missingScopes : []).filter(Boolean)
  if (!list.length) return '飞书用户授权缺少所需权限，请补充授权后重试。'
  return `飞书用户授权缺少权限：${list.join('、')}。可一键补充授权后自动重试。`
}

/**
 * Query the user's currently granted scopes from lark-cli — the authoritative
 * "what we already have" source (equivalent to the token `scope` field).
 * Returns { ok, scopes:[], tokenStatus, userName }; scopes is empty when unauthorized.
 */
async function getGrantedUserScopes(opts = {}) {
  const result = await runLarkCli(['auth', 'status'], opts)
  const parsed = parseCliJsonOutput(result.text || result.message || '')
  const user = parsed && parsed.identities && parsed.identities.user ? parsed.identities.user : null
  if (!user) {
    return { ok: false, scopes: [], tokenStatus: null, userName: null, message: result.message || '无法读取飞书授权状态' }
  }
  const scopes = String(user.scope || '').split(/\s+/).map((s) => s.trim()).filter(Boolean)
  return {
    ok: user.status === 'ready' && user.tokenStatus === 'valid',
    scopes,
    tokenStatus: String(user.tokenStatus || '') || null,
    userName: String(user.userName || '') || null,
  }
}

const MINUTES_DOMAIN = 'https://forever9.feishu.cn/minutes/'

/** vc +search enumerates meetings the authorized user attended/organized. */
function buildVcSearchArgs({ start, end, pageSize = 20, pageToken = '' } = {}) {
  const out = ['vc', '+search', '--start', String(start), '--end', String(end), '--page-size', String(pageSize), '--format', 'json']
  if (pageToken) out.push('--page-token', String(pageToken))
  return out
}

/** vc +detail hydrates a meeting id into topic/time/note_id/minute_token. */
function buildVcDetailArgs(meetingId) {
  return ['vc', '+detail', '--meeting-ids', String(meetingId), '--format', 'json']
}

/** minutes +detail returns the Smart Minutes body (summary/todo/chapter). */
function buildMinutesDetailArgs(minuteToken) {
  return ['minutes', '+detail', '--minute-tokens', String(minuteToken), '--summary', '--todo', '--chapter', '--format', 'json']
}

/** Parse the human-readable display_info blob returned by vc +search. */
function parseMeetingDisplayInfo(info = '') {
  const lines = String(info || '').split(/\n+/).map(l => l.trim()).filter(Boolean)
  const topic = lines[0] || ''
  const metaLine = lines.find(l => /组织者|ID:|会议室/.test(l)) || ''
  const organizer = (metaLine.match(/组织者[:：]\s*([^|]+)/) || [null, ''])[1].trim()
  const timeText = (metaLine.split('|')[0] || '').trim()
  return { topic, organizer, timeText }
}

/** Extract a minute token from a /minutes/<token> URL. */
function extractMinuteToken(url = '') {
  const m = String(url || '').match(/\/minutes\/([A-Za-z0-9]+)/)
  return m ? m[1] : ''
}

/** Recursively collect string leaf values (ignores object keys). */
function collectStringValues(value, acc = []) {
  if (typeof value === 'string') acc.push(value)
  else if (Array.isArray(value)) value.forEach(v => collectStringValues(v, acc))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => collectStringValues(v, acc))
  return acc
}

/** Flatten a minute row's artifact values into a single text blob for gating. */
function minuteArtifactText(row) {
  if (!row) return ''
  return collectStringValues(row.artifacts || row, []).join('\n')
}

/** Render a Smart Minutes row as readable markdown for the summarizer. */
function formatMinuteBodyForSummary(row = {}) {
  const title = String(row.title || row.topic || row.name || '未命名会议').trim()
  const token = String(row.minute_token || row.minuteToken || '').trim()
  const artifacts = row.artifacts && typeof row.artifacts === 'object' ? row.artifacts : row
  const summary = artifacts.summary || artifacts.Summary || ''
  const todo = artifacts.todo || artifacts.todos || artifacts.Todo || ''
  const chapter = artifacts.chapter || artifacts.chapters || artifacts.Chapter || ''
  const sections = [
    `# 会议纪要：${title}`,
    token ? `minute_token: ${token}` : '',
    '',
  ]
  const pushSection = (heading, value) => {
    const text = typeof value === 'string'
      ? value.trim()
      : (value == null ? '' : collectStringValues(value, []).join('\n').trim())
    if (!text) return
    sections.push(`## ${heading}`, text, '')
  }
  pushSection('摘要', summary)
  pushSection('待办', todo)
  pushSection('章节', chapter)
  if (sections.length <= 3) {
    const fallback = minuteArtifactText(row).trim()
    if (fallback) {
      sections.push('## 正文', fallback, '')
    }
  }
  return sections.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n').trim()
}

function pickVcItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const list = payload.data?.items || payload.items || payload.data?.meeting_list || payload.meeting_list
  return Array.isArray(list) ? list : []
}

function formatMeetingCandidates(items = [], days = 3, identity = null) {
  const who = identity && identity.userName ? `（授权用户：${identity.userName}）` : ''
  const list = Array.isArray(items) ? items : []
  if (!list.length) {
    return `最近 ${days} 个自然日内未找到你参与的会议记录${who}。`
  }
  const lines = [`最近 **${days}** 个自然日内找到 **${list.length}** 场你参与的会议${who}：`, '']
  list.forEach((item, index) => {
    const time = item.meetingTime || '时间未知'
    const cardLabel = [
      `${index + 1}. ${item.title}`,
      time,
      item.organizer ? `组织者：${item.organizer}` : '',
    ].filter(Boolean).join('｜')
    const card = item.url
      ? `[${cardLabel}](${item.url})`
      : `${cardLabel}｜该会议未生成智能纪要`
    lines.push(card)
    lines.push('')
  })
  lines.push('回复序号（如「1」），我来读取对应纪要并做总结与简要分析。')
  return lines.join('\n')
}

/** Resolve the currently authorized Feishu user (open_id + name). */
async function resolveCurrentUserIdentity(opts = {}) {
  try {
    const res = await runLarkCli(['auth', 'status'], opts)
    if (!res || !res.ok) return null
    const parsed = parseCliJsonOutput(res.text)
    const user = parsed && parsed.identities && parsed.identities.user
    if (!user) return null
    const openId = String(user.openId || user.open_id || '').trim()
    const userName = String(user.userName || user.user_name || '').trim()
    if (!openId && !userName) return null
    return { openId, userName }
  } catch {
    return null
  }
}

/** Extract meeting participants (open_id + display name) from doc XML. */
function extractDocParticipants(content = '') {
  const src = String(content || '')
  const ids = new Set()
  const names = new Set()
  const tags = src.match(/<cite\b[^>]*\btype="user"[^>]*>/gi) || []
  for (const tag of tags) {
    const idMatch = tag.match(/user-id="([^"]+)"/i)
    const nameMatch = tag.match(/user-name="([^"]+)"/i)
    if (idMatch) ids.add(String(idMatch[1]).trim())
    if (nameMatch) names.add(String(nameMatch[1]).trim())
  }
  return { ids, names }
}

function docContainsParticipant(content, identity) {
  if (!identity) return false
  const { ids, names } = extractDocParticipants(content)
  if (identity.openId && ids.has(identity.openId)) return true
  if (identity.userName && names.has(identity.userName)) return true
  return false
}

async function executeMeetingCandidates(args = {}, opts = {}) {
  const days = Math.max(1, Math.min(30, Math.floor(Number(args.days || 3) || 3)))
  const now = new Date()
  const start = formatLocalDate(addDays(now, -(days - 1)))
  const end = formatLocalDate(addDays(now, 1))
  const identity = await resolveCurrentUserIdentity(opts)

  // Feishu doc search does NOT index Smart Minutes meeting docs, and the
  // vc/minutes `--participant-ids` filter silently drops valid rows. But
  // `vc +search` is already scoped to meetings the authorized user attended or
  // organized, so a plain time-range query yields "my meetings". We enumerate
  // via vc +search, then hydrate each meeting via vc +detail to obtain the
  // Smart Minutes token used for reading the body.
  const meetings = []
  const seenIds = new Set()
  const seenPageTokens = new Set()
  let pageToken = ''
  for (let page = 0; page < 5; page++) {
    const res = await runLarkCliWithRetry(buildVcSearchArgs({ start, end, pageToken }), opts)
    if (!res.ok) {
      const msg = normalizeCliErrorMessage(res.message, res.text, 'feishu.meeting_candidates')
      // 只回一句干净文案，绝不把裸 JSON / 堆栈抛给用户
      return {
        ok: false,
        code: res.code || 'cli_error',
        message: msg,
        text: msg,
        meta: { workflow: 'meeting_candidates', days, transient: isTransientCliFailure(res) },
      }
    }
    const payload = parseCliJsonOutput(res.text)
    for (const item of pickVcItems(payload)) {
      const id = String(item.id || item.meeting_id || '').trim()
      if (!id || seenIds.has(id)) continue
      seenIds.add(id)
      const appLink = String(item.meta_data?.app_link || '').trim()
      meetings.push({ id, appLink, ...parseMeetingDisplayInfo(item.display_info) })
    }
    const nextToken = String(payload?.data?.page_token || payload?.page_token || '').trim()
    const hasMore = Boolean(payload?.data?.has_more ?? payload?.has_more)
    if (!hasMore || !nextToken || seenPageTokens.has(nextToken)) break
    seenPageTokens.add(nextToken)
    pageToken = nextToken
  }

  const candidates = []
  for (const meeting of meetings.slice(0, 20)) {
    const detail = await runLarkCliWithRetry(buildVcDetailArgs(meeting.id), opts, { retries: 1 })
    if (!detail.ok) continue
    const dp = parseCliJsonOutput(detail.text)
    const row = Array.isArray(dp?.data?.meetings)
      ? dp.data.meetings[0]
      : (dp?.data && typeof dp.data === 'object' ? dp.data : null)
    if (!row) continue
    const minuteToken = String(row.minute_token || '').trim()
    candidates.push({
      meetingId: meeting.id,
      title: String(row.topic || meeting.topic || '').trim() || '(未命名会议)',
      meetingTime: String(row.start_time || meeting.timeText || '').trim(),
      organizer: meeting.organizer,
      minuteToken,
      noteId: String(row.note_id || '').trim(),
      // The vc `app_link` (applink.feishu.cn/client/vctab/open) is rejected by
      // the Feishu desktop client with「暂不支持该功能」, so it must never be the
      // user-facing link; only /minutes/<token> opens the Smart Minutes page.
      url: minuteToken ? `${MINUTES_DOMAIN}${minuteToken}` : '',
      appLink: meeting.appLink || '',
    })
  }
  const top = candidates.slice(0, 10)
  return {
    ok: true,
    text: formatMeetingCandidates(top, days, identity),
    meta: { workflow: 'meeting_candidates', days, candidates: top, identity },
  }
}

function hasMeetingContent(text = '') {
  return /(会议|纪要|妙记|参会|议题|结论|行动项|待办|主持|发言|会议时间|会议记录|minutes|meeting)/i.test(String(text || ''))
}

async function executeMeetingRead(args = {}, opts = {}) {
  // Preferred path: read the Smart Minutes body via minute_token (from
  // meeting_candidates) or a /minutes/<token> url.
  const minuteToken = String(args.minute_token || extractMinuteToken(args.url) || '').trim()
  if (minuteToken) {
    const res = await runLarkCliWithRetry(buildMinutesDetailArgs(minuteToken), opts)
    if (!res.ok) {
      const msg = normalizeCliErrorMessage(res.message, res.text, 'feishu.meeting_read')
      return { ...res, message: msg, text: msg }
    }
    // Gate on artifact VALUES, not the raw envelope: the JSON structure itself
    // contains the literal key "minutes", which would spuriously satisfy the
    // meeting-content check.
    const payload = parseCliJsonOutput(res.text)
    const row = Array.isArray(payload?.data?.minutes) ? payload.data.minutes[0] : null
    if (!hasMeetingContent(minuteArtifactText(row))) {
      return {
        ok: false,
        code: 'not_meeting_document',
        message: '读取到的纪要没有会议内容，已拒绝总结无关文档',
        text: '读取到的妙记正文没有明确会议纪要/会议记录内容，已拒绝将其作为会议记录总结。',
      }
    }
    const body = formatMinuteBodyForSummary({ ...row, minute_token: minuteToken })
    return {
      ok: true,
      text: body || res.text,
      meta: { workflow: 'meeting_read', source: minuteToken, kind: 'minute' },
    }
  }
  // Fallback: legacy Smart Minutes docx by token/url.
  const doc = String(args.doc_token || args.url || '').trim()
  if (!doc) return { ok: false, code: 'invalid_args', message: 'meeting_read 需要 minute_token / doc_token 或 url' }
  const result = await executeFeishuRead('feishu.read_doc', {
    doc_token: args.doc_token,
    url: args.url,
  }, opts)
  if (!result.ok) return result
  if (!hasMeetingContent(result.text)) {
    return {
      ok: false,
      code: 'not_meeting_document',
      message: '读取到的正文没有会议记录证据，已拒绝总结无关文档',
      text: '读取到的正文没有明确会议纪要/会议记录/妙记内容，已拒绝将其作为会议记录总结。',
    }
  }
  return {
    ok: true,
    text: result.text,
    meta: { workflow: 'meeting_read', source: doc, kind: 'doc' },
  }
}

/** Local ISO-8601 with timezone offset for im +messages-search --start/--end. */
function formatIsoLocal(date, endOfDay = false) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => String(n).padStart(2, '0')
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  const time = endOfDay ? '23:59:59' : '00:00:00'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}${sign}${oh}:${om}`
}

function buildMessagesSearchAtMeArgs({ start, end, pageSize = 20, pageToken = '' } = {}) {
  const argv = [
    'im', '+messages-search',
    '--as', 'user',
    '--is-at-me',
    '--start', String(start),
    '--end', String(end),
    '--page-size', String(Math.max(1, Math.min(50, Number(pageSize) || 20))),
    '--format', 'json',
  ]
  if (pageToken) argv.push('--page-token', String(pageToken))
  return argv
}

function pickMessageSearchItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const list =
    payload.data?.messages ||
    payload.messages ||
    payload.data?.items ||
    payload.items ||
    payload.data?.list ||
    []
  return Array.isArray(list) ? list : []
}

function extractMessageBody(item = {}) {
  const body = item.body || item.message?.body || item.content || {}
  if (typeof body === 'string') return body.trim()
  const text = body.text || body.content || body.title || ''
  if (typeof text === 'string' && text.trim()) return text.trim()
  try {
    if (body.content && typeof body.content === 'string') {
      const parsed = JSON.parse(body.content)
      if (parsed && typeof parsed === 'object') {
        if (parsed.text) return String(parsed.text).trim()
        if (Array.isArray(parsed.content)) {
          return parsed.content.map(block => {
            if (typeof block === 'string') return block
            if (Array.isArray(block)) {
              return block.map(span => (span && span.text) || '').join('')
            }
            return (block && block.text) || ''
          }).join('').trim()
        }
      }
    }
  } catch { /* ignore */ }
  const raw = item.text || item.preview || item.summary || ''
  return String(raw || '').trim()
}

function buildFeishuChatOpenUrl(chatId) {
  const id = String(chatId || '').trim()
  if (!id || !/^oc_/i.test(id)) return ''
  return `https://applink.feishu.cn/client/chat/open?openChatId=${encodeURIComponent(id)}`
}

/** Strip Feishu markup noise so summaries stay readable. */
function sanitizeImMessageText(raw = '') {
  return String(raw || '')
    .replace(/:Lark_Emoji_[A-Za-z0-9_]+:/g, '')
    .replace(/<\/?at\b[^>]*>/gi, ' ')
    .replace(/<\/?u>/gi, '')
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferMentionTheme(text = '') {
  const cleaned = sanitizeImMessageText(text)
  if (!cleaned) return '（无文本内容）'
  const cut = cleaned.split(/[。！？\n]/)[0] || cleaned
  const theme = cut.trim().slice(0, 48)
  return theme.length < cut.trim().length ? `${theme}…` : theme
}

function inferHandlingSuggestion(text = '', raw = '') {
  const t = sanitizeImMessageText(text)
  const source = `${raw || ''} ${t}`
  if (/报名|参赛|征集|截止|报名截止/.test(t)) {
    return '确认是否参与；需要则打开飞书原会话回复，并留意截止时间'
  }
  if (/丢失|寻物|捡到|耳机|钥匙|钱包/.test(t)) {
    return '如有线索可在群里回复；无关可忽略'
  }
  if (/@all|user_id=["']all["']|所有人|全员/.test(source)) {
    return '群发通知，按兴趣选择性关注；非直接责任可不回复'
  }
  if (/请看|帮忙|确认|回复|跟进|评审|审批|尽快/.test(t)) {
    return '建议打开飞书阅读上下文后回复或给出结论'
  }
  return '先看主题判断是否需要回复；必要时再打开飞书阅读全文'
}

function mdChatLink(label, chatId) {
  const name = String(label || chatId || '会话').trim() || '会话'
  const url = buildFeishuChatOpenUrl(chatId)
  if (!url) return name
  // Escape brackets in label for Markdown safety
  const safe = name.replace(/[\[\]]/g, '')
  return `[${safe}](${url})`
}

function normalizeMentionMessage(item = {}) {
  const id = String(item.message_id || item.msg_id || item.id || '').trim()
  const chatId = String(item.chat_id || item.chatId || item.chat?.chat_id || '').trim()
  const chatName = String(
    item.chat_name ||
    item.chatName ||
    item.chat?.name ||
    item.chat?.chat_name ||
    chatId ||
    '未命名会话'
  ).trim()
  const sender = String(
    item.sender_name ||
    item.sender?.name ||
    item.sender?.sender_id ||
    item.sender_id ||
    '未知发送人'
  ).trim()
  const createTime = String(
    item.create_time ||
    item.created_at ||
    item.createTime ||
    item.timestamp ||
    ''
  ).trim()
  const rawText = extractMessageBody(item).slice(0, 500)
  const text = sanitizeImMessageText(rawText).slice(0, 280)
  if (!id && !rawText && !text) return null
  const openUrl = buildFeishuChatOpenUrl(chatId)
  const theme = inferMentionTheme(rawText)
  const suggestion = inferHandlingSuggestion(rawText, rawText)
  return {
    id,
    chatId,
    chatName,
    sender,
    createTime,
    text,
    rawText,
    theme,
    suggestion,
    openUrl,
    atMe: true,
  }
}

function formatRelatedChats(mentions = [], chats = [], days = 1, identity = null) {
  const who = identity && identity.userName ? `（授权用户：${identity.userName}）` : ''
  const dayLabel = days === 1 ? '今天' : `最近 **${days}** 个自然日`
  const lines = [
    `${dayLabel}与你相关的飞书聊天摘要${who}：`,
    '',
    '说明：会话名可点击跳转飞书；@我 已提炼主题与建议，仅在需要完整上下文时再打开原文。',
    '',
  ]

  lines.push(`## @我 的消息（${mentions.length}）`)
  if (!mentions.length) {
    lines.push('- 未找到明确 @你 的消息。')
  } else {
    mentions.forEach((item, index) => {
      const when = item.createTime || '时间未知'
      const chatLink = mdChatLink(item.chatName, item.chatId)
      const openHint = item.openUrl
        ? `[在飞书打开原文](${item.openUrl})`
        : '（无会话链接）'
      lines.push(
        `### ${index + 1}. ${chatLink}`,
        `- 发送人：${item.sender} · ${when}`,
        `- 主题：${item.theme || inferMentionTheme(item.text)}`,
        `- 要点：${item.text || '(无文本内容)'}`,
        `- 建议处理：${item.suggestion || inferHandlingSuggestion(item.text, item.rawText)}`,
        `- 需要全文时：${openHint}`,
        '',
      )
    })
  }

  const p2p = chats.filter(c => /p2p|private|单聊|私聊/i.test(String(c.mode || '')))
  const groups = chats.filter(c => !/p2p|private|单聊|私聊/i.test(String(c.mode || '')))
  lines.push('', `## 今日相关会话主题（私聊 ${p2p.length} / 群聊 ${groups.length}，共 ${chats.length}）`)
  if (!chats.length) {
    lines.push('- 未能列出近期私聊/群聊主题（可能缺权限或暂无会话）。')
  } else {
    lines.push(`### 私聊（${p2p.length}）`)
    if (!p2p.length) {
      lines.push('- 无')
    } else {
      p2p.slice(0, 16).forEach((chat) => {
        lines.push(`- \`私聊\` ${mdChatLink(chat.name || chat.id, chat.id)}`)
      })
    }
    lines.push(`### 群聊 / 话题群（${groups.length}）`)
    if (!groups.length) {
      lines.push('- 无')
    } else {
      groups.slice(0, 16).forEach((chat) => {
        const kind = /topic/i.test(String(chat.mode || '')) ? '话题群' : '群聊'
        lines.push(`- \`${kind}\` ${mdChatLink(chat.name || chat.id, chat.id)}`)
      })
    }
  }

  lines.push(
    '',
    '请基于以上真实结果分析并输出给用户：',
    '1. 保留每个会话的可点击 Markdown 链接（不要改成纯文本会话名）',
    '2. @我 用「主题 + 建议处理」呈现，不要原文照搬标签或长文',
    '3. 「在飞书打开」只在需要阅读完整上下文时作为次要动作提示',
    '4. 汇总待回应事项与建议下一步；不要编造未出现的聊天；不要索要飞书文档 token',
    '5. 输出风格必须克制专业：默认不使用 emoji、颜文字或装饰性图标，避免夸张语气和拟人化措辞',
    '6. 状态表达统一使用纯文本标签（如「[需确认]」「[高优先级]」「[可延后]」），不要堆叠图标',
    '7. 若引用消息原文，必须保留原文内容；仅对助手自己生成的结构和说明遵循上述风格',
  )
  return lines.filter(Boolean).join('\n')
}

async function executeRelatedChats(args = {}, opts = {}) {
  const days = Math.max(1, Math.min(30, Math.floor(Number(args.days == null ? 1 : args.days) || 1)))
  const now = new Date()
  const startDay = addDays(now, -(days - 1))
  const start = formatIsoLocal(new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()), false)
  const end = formatIsoLocal(now, true)
  const identity = await resolveCurrentUserIdentity(opts)

  const mentions = []
  const seenIds = new Set()
  const seenPageTokens = new Set()
  let pageToken = ''
  for (let page = 0; page < 4; page++) {
    const res = await runLarkCli(buildMessagesSearchAtMeArgs({
      start,
      end,
      pageSize: 20,
      pageToken,
    }), opts)
    if (!res.ok) {
      return { ...res, message: normalizeCliErrorMessage(res.message, res.text, 'feishu.related_chats') }
    }
    const payload = parseCliJsonOutput(res.text)
    for (const item of pickMessageSearchItems(payload)) {
      const normalized = normalizeMentionMessage(item)
      if (!normalized) continue
      const key = normalized.id || `${normalized.chatId}:${normalized.createTime}:${normalized.text.slice(0, 40)}`
      if (seenIds.has(key)) continue
      seenIds.add(key)
      mentions.push(normalized)
    }
    const nextToken = String(payload?.data?.page_token || payload?.page_token || '').trim()
    const hasMore = Boolean(payload?.data?.has_more ?? payload?.has_more)
    if (!hasMore || !nextToken || seenPageTokens.has(nextToken)) break
    seenPageTokens.add(nextToken)
    pageToken = nextToken
  }

  const chatList = await listFeishuChats({
    types: 'p2p,group',
    sort: 'active_time',
    page_size: 20,
  }, opts)
  const chats = chatList.ok ? (chatList.items || []).slice(0, 16) : []

  return {
    ok: true,
    text: formatRelatedChats(mentions.slice(0, 30), chats, days, identity),
    meta: {
      workflow: 'related_chats',
      days,
      mentions: mentions.slice(0, 30),
      chats,
      identity,
    },
  }
}

function buildCalendarAgendaArgs({ start, end } = {}) {
  const argv = [
    'calendar', '+agenda',
    '--as', 'user',
    '--format', 'json',
  ]
  if (start) argv.push('--start', String(start))
  if (end) argv.push('--end', String(end))
  return argv
}

function buildTaskMyTasksArgs({ dueEnd = '', pageLimit = 2 } = {}) {
  const argv = [
    'task', '+get-my-tasks',
    '--as', 'user',
    '--complete=false',
    '--format', 'json',
  ]
  if (dueEnd) argv.push('--due-end', String(dueEnd))
  const limit = Math.max(1, Math.min(10, Math.floor(Number(pageLimit) || 2)))
  argv.push('--page-limit', String(limit))
  return argv
}

function pickAgendaEvents(payload) {
  if (!payload || typeof payload !== 'object') return []
  const list =
    payload.data?.events ||
    payload.events ||
    payload.data?.items ||
    payload.items ||
    payload.data?.list ||
    payload.data?.agenda ||
    []
  return Array.isArray(list) ? list : []
}

function pickTaskItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const list =
    payload.data?.items ||
    payload.items ||
    payload.data?.tasks ||
    payload.tasks ||
    payload.data?.list ||
    []
  return Array.isArray(list) ? list : []
}

function formatEventTime(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') {
    const ts = value.timestamp || value.time || value.date || value.datetime
    if (ts != null && ts !== '') return formatEventTime(ts)
    return ''
  }
  const raw = String(value).trim()
  if (!raw) return ''
  if (/^\d{10,13}$/.test(raw)) {
    const ms = raw.length <= 10 ? Number(raw) * 1000 : Number(raw)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
  const m = raw.match(/T(\d{2}:\d{2})/)
  if (m) return m[1]
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5)
  return raw.slice(0, 16)
}

function normalizeAgendaEvent(item = {}) {
  const summary = String(
    item.summary || item.title || item.name || item.event?.summary || '未命名日程'
  ).trim()
  const start =
    formatEventTime(item.start_time) ||
    formatEventTime(item.start) ||
    formatEventTime(item.begin_time) ||
    formatEventTime(item.startTime) ||
    ''
  const end =
    formatEventTime(item.end_time) ||
    formatEventTime(item.end) ||
    formatEventTime(item.endTime) ||
    ''
  const status = String(
    item.self_rsvp_status || item.rsvp_status || item.status || item.free_busy_status || ''
  ).trim()
  if (!summary && !start) return null
  return { summary, start, end, status }
}

function taskDueLabel(item = {}) {
  const due = item.due || item.due_time || item.deadline || item.dueTime || null
  if (due == null || due === '') return '无截止'
  if (typeof due === 'object') {
    const ts = due.timestamp || due.time || due.date || due.datetime
    if (ts != null) return taskDueLabel({ due: ts })
  }
  const raw = String(due).trim()
  if (!raw) return '无截止'
  if (/^\d{10,13}$/.test(raw)) {
    const ms = raw.length <= 10 ? Number(raw) * 1000 : Number(raw)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
  return raw.slice(0, 19)
}

function taskDueMs(item = {}) {
  const due = item.due || item.due_time || item.deadline || item.dueTime || null
  if (due == null || due === '') return null
  if (typeof due === 'object') {
    const ts = due.timestamp || due.time || due.date || due.datetime
    if (ts != null) return taskDueMs({ due: ts })
  }
  const raw = String(due).trim()
  if (/^\d{10,13}$/.test(raw)) {
    return raw.length <= 10 ? Number(raw) * 1000 : Number(raw)
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizePriorityTask(item = {}, nowMs = Date.now()) {
  const summary = String(
    item.summary || item.title || item.name || item.content || '未命名待办'
  ).trim()
  if (!summary) return null
  const dueMs = taskDueMs(item)
  const overdue = dueMs != null && dueMs < nowMs
  const url = String(item.url || item.share_url || item.link || '').trim()
  return {
    summary,
    due: taskDueLabel(item),
    dueMs,
    overdue,
    url,
    completed: Boolean(item.completed || item.complete || item.is_completed),
  }
}

function formatTodayPriority(events = [], tasks = [], mentions = [], identity = null, opts = {}) {
  const who = identity && identity.userName ? `（授权用户：${identity.userName}）` : ''
  const dateLabel = opts.dateLabel || '今天'
  const lines = [
    `## 今日优先级事实摘要${who}`,
    '',
    `范围：${dateLabel} · 飞书日程 + 未完成待办` + (opts.includeMentions ? ' + 今日 @我' : ''),
    '',
    `### 今日日程（${events.length}）`,
  ]
  if (!events.length) {
    lines.push('- 暂无日程（或日历未授权 / 今日清空）。')
  } else {
    events.slice(0, 20).forEach((ev, i) => {
      const span = [ev.start, ev.end].filter(Boolean).join('-') || '时间未知'
      const st = ev.status ? ` · ${ev.status}` : ''
      lines.push(`- ${i + 1}. **${span}** ${ev.summary}${st}`)
    })
  }

  const overdue = tasks.filter(t => t.overdue)
  const pending = tasks.filter(t => !t.overdue)
  lines.push('', `### 未完成待办（${tasks.length}，其中过期 ${overdue.length}）`)
  if (!tasks.length) {
    lines.push('- 暂无未完成待办（或任务未授权）。')
  } else {
    ;[...overdue, ...pending].slice(0, 25).forEach((t, i) => {
      const flag = t.overdue ? '⚠️已过期' : `截止 ${t.due}`
      const link = t.url ? ` · [打开](${t.url})` : ''
      lines.push(`- ${i + 1}. ${t.summary}（${flag}）${link}`)
    })
  }

  if (opts.includeMentions) {
    lines.push('', `### 今日 @我（${mentions.length}，阻塞信号）`)
    if (!mentions.length) {
      lines.push('- 暂无明确 @你 的消息。')
    } else {
      mentions.slice(0, 10).forEach((m, i) => {
        lines.push(`- ${i + 1}. ${m.chatName || '会话'} · ${m.theme || m.text || '（无文本）'}（${m.sender || '未知'}）`)
      })
    }
  }

  lines.push(
    '',
    '请基于以上真实事实，**立刻**输出我现在先做的最多 3 件事（不要先问三项澄清）：',
    '1. 每项包含：优先级理由（引用日程/待办/@我）、预计耗时、第一步动作',
    '2. 排序优先：已过期待办 > 今日硬截止/临近会议前必须完成的事项 > 今日会议准备 > 其余待办',
    '3. 仅当日程与待办都为空、或关键冲突无法判断时，最多追问 **1** 句（把缺的事实合并成一句）',
    '4. 禁止编造未出现的日程/待办；禁止索要文档 token；禁止走会议文档路径替代本任务',
  )
  return lines.join('\n')
}

async function executeTodayPriority(args = {}, opts = {}) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = formatIsoLocal(todayStart, false)
  const end = formatIsoLocal(now, true)
  const dueHorizon = addDays(todayStart, 7)
  const dueEnd = formatIsoLocal(new Date(dueHorizon.getFullYear(), dueHorizon.getMonth(), dueHorizon.getDate()), true)
  const includeMentions = args.include_mentions !== false
  const identity = await resolveCurrentUserIdentity(opts)
  const dateLabel = `${formatLocalDate(todayStart)}（今天）`

  const [agendaRes, taskRes] = await Promise.all([
    runLarkCli(buildCalendarAgendaArgs({ start, end }), opts),
    runLarkCli(buildTaskMyTasksArgs({ dueEnd, pageLimit: 2 }), opts),
  ])

  const hardFailures = []
  if (!agendaRes.ok) {
    hardFailures.push({ source: 'calendar', message: normalizeCliErrorMessage(agendaRes.message, agendaRes.text, 'feishu.today_priority') })
  }
  if (!taskRes.ok) {
    hardFailures.push({ source: 'task', message: normalizeCliErrorMessage(taskRes.message, taskRes.text, 'feishu.today_priority') })
  }
  // Both primary sources failed → surface auth/scope error; one OK is enough to proceed.
  if (!agendaRes.ok && !taskRes.ok) {
    const msg = hardFailures.map(f => `${f.source}: ${f.message}`).join('；')
    return {
      ok: false,
      code: agendaRes.code || taskRes.code || 'cli_error',
      message: msg || '无法读取今日日程与待办',
      text: `今日优先级事实拉取失败：${msg}\n请到「设置 → 连接器」确认飞书 user 授权，并补齐 calendar / task scope 后重试。`,
    }
  }

  const events = agendaRes.ok
    ? pickAgendaEvents(parseCliJsonOutput(agendaRes.text)).map(normalizeAgendaEvent).filter(Boolean)
    : []
  const nowMs = now.getTime()
  const tasks = taskRes.ok
    ? pickTaskItems(parseCliJsonOutput(taskRes.text))
      .map(item => normalizePriorityTask(item, nowMs))
      .filter(Boolean)
      .filter(t => !t.completed)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
        if (a.dueMs == null && b.dueMs == null) return 0
        if (a.dueMs == null) return 1
        if (b.dueMs == null) return -1
        return a.dueMs - b.dueMs
      })
    : []

  let mentions = []
  let mentionsError = ''
  if (includeMentions) {
    const mentionRes = await runLarkCli(buildMessagesSearchAtMeArgs({
      start,
      end,
      pageSize: 15,
    }), opts)
    if (mentionRes.ok) {
      const seen = new Set()
      for (const item of pickMessageSearchItems(parseCliJsonOutput(mentionRes.text))) {
        const normalized = normalizeMentionMessage(item)
        if (!normalized) continue
        const key = normalized.id || `${normalized.chatId}:${normalized.text.slice(0, 40)}`
        if (seen.has(key)) continue
        seen.add(key)
        mentions.push(normalized)
        if (mentions.length >= 10) break
      }
    } else {
      mentionsError = normalizeCliErrorMessage(mentionRes.message, mentionRes.text, 'feishu.today_priority')
    }
  }

  const notes = []
  if (!agendaRes.ok) notes.push(`日程读取失败（已降级）：${hardFailures.find(f => f.source === 'calendar')?.message || ''}`)
  if (!taskRes.ok) notes.push(`待办读取失败（已降级）：${hardFailures.find(f => f.source === 'task')?.message || ''}`)
  if (mentionsError) notes.push(`@我 信号不可用（已忽略）：${mentionsError}`)

  let text = formatTodayPriority(events, tasks, mentions, identity, {
    dateLabel,
    includeMentions,
  })
  if (notes.length) {
    text = `${text}\n\n### 数据降级说明\n${notes.map(n => `- ${n}`).join('\n')}`
  }

  return {
    ok: true,
    text,
    meta: {
      workflow: 'today_priority',
      dateLabel,
      events,
      tasks,
      mentions,
      identity,
      degraded: {
        calendar: !agendaRes.ok,
        task: !taskRes.ok,
        mentions: Boolean(mentionsError),
      },
    },
  }
}

function buildDriveFilesListArgs({ folderToken = '', pageSize = 100 } = {}) {
  const out = [
    'drive', 'files', 'list',
    '--as', 'user',
    '--order-by', 'EditedTime',
    '--direction', 'DESC',
    '--page-size', String(Math.max(1, Math.min(200, Number(pageSize) || 100))),
    '--format', 'json',
  ]
  if (folderToken) out.push('--folder-token', String(folderToken))
  return out
}

function buildDriveSearchArgs({
  query = '',
  editedSince = '',
  openedSince = '',
  sort = 'edit_time',
  pageSize = 5,
} = {}) {
  const out = [
    'drive', '+search',
    '--as', 'user',
    '--page-size', String(Math.max(1, Math.min(20, Number(pageSize) || 5))),
    '--sort', String(sort || 'edit_time'),
    '--format', 'json',
  ]
  const q = sanitizeCliQuery(query)
  if (q) out.push('--query', normalizeQueryArgForPlatform(q))
  if (editedSince) out.push('--edited-since', String(editedSince))
  if (openedSince) out.push('--opened-since', String(openedSince))
  return out
}

function pickDriveFiles(payload) {
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload.files,
    payload.items,
    payload.data?.files,
    payload.data?.items,
    payload.data?.file_list,
  ]
  for (const list of candidates) {
    if (Array.isArray(list)) return list
  }
  return []
}

function pickDriveSearchDocs(payload) {
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload.docs_entities,
    payload.entities,
    payload.items,
    payload.docs,
    payload.documents,
    payload.results,
    payload.data?.docs_entities,
    payload.data?.entities,
    payload.data?.items,
    payload.data?.docs,
    payload.data?.documents,
    payload.data?.results,
  ]
  for (const list of candidates) {
    if (Array.isArray(list)) return list
  }
  return []
}

function normalizeDriveDoc(item = {}) {
  if (!item || typeof item !== 'object') return null
  const stripHighlighted = (value = '') => String(value || '').replace(/<\/?h>/gi, '').trim()
  const token = String(
    item.docs_token ||
    item.doc_token ||
    item.token ||
    item.file_token ||
    item.obj_token ||
    item.node_token ||
    item.id ||
    ''
  ).trim()
  const title = stripHighlighted(
    item.title ||
    item.name ||
    item.doc_title ||
    item.file_name ||
    item.docs_title ||
    ''
  ) || '(未命名)'
  const type = String(item.type || item.doc_type || item.file_type || item.obj_type || '').trim()
  const url = String(
    item.url ||
    item.doc_url ||
    item.docs_url ||
    item.link ||
    item.app_link ||
    ''
  ).trim()
  const updatedAt = String(
    item.edit_time ||
    item.edited_time ||
    item.open_time ||
    item.opened_time ||
    item.modified_time ||
    item.update_time ||
    item.updated_at ||
    ''
  ).trim()
  if (!token && !url && title === '(未命名)') return null
  return { token, title, type, url, updatedAt }
}

function normalizeDriveFolder(item = {}) {
  if (!item || typeof item !== 'object') return null
  const type = String(item.type || item.file_type || '').toLowerCase()
  const token = String(item.token || item.file_token || item.folder_token || '').trim()
  const name = String(item.name || item.title || token || '').trim()
  if (!token && !name) return null
  if (type === 'folder' || /^fld/i.test(token)) {
    return { token, name: name || token, type: 'folder' }
  }
  return null
}

function normalizeWikiSpace(item = {}) {
  if (!item || typeof item !== 'object') return null
  const id = String(item.space_id || item.id || item.spaceId || '').trim()
  const name = String(item.name || item.space_name || item.title || id || '').trim()
  if (!id && !name) return null
  return {
    id,
    name: name || id,
    description: String(item.description || item.space_description || '').trim(),
  }
}

function extractMemoryKeywords(memoryDir) {
  if (!memoryDir) return []
  let productMemory
  try {
    productMemory = require('../product-memory')
  } catch {
    return []
  }
  const recent = typeof productMemory.getRecent === 'function'
    ? productMemory.getRecent(memoryDir, 40)
    : []
  const patterns = (() => {
    try {
      const overview = productMemory.overview?.(memoryDir, { recentLimit: 1 })
      return Array.isArray(overview?.patterns) ? overview.patterns : []
    } catch {
      return []
    }
  })()
  const texts = []
  for (const row of recent) {
    if (row?.summary) texts.push(String(row.summary))
  }
  for (const pat of patterns) {
    if (!pat?.summary) continue
    if (pat.prompt_state === 'dismissed') continue
    texts.push(String(pat.summary))
  }
  const stop = new Set([
    '的', '了', '和', '与', '或', '在', '是', '有', '我', '你', '他', '她', '它',
    '一个', '一下', '这个', '那个', '什么', '如何', '怎么', '进行', '使用',
    '文档', '知识库', '飞书', '文件', '打开', '编辑', '阅读', '查询', '搜索',
    'knowme', 'wiki', 'okf', 'agent',
  ])
  const counts = new Map()
  for (const text of texts) {
    const cn = text.match(/[\u4e00-\u9fff]{2,8}/g) || []
    const en = text.match(/[A-Za-z][A-Za-z0-9_-]{2,24}/g) || []
    for (const raw of [...cn, ...en]) {
      const token = String(raw || '').trim().toLowerCase()
      if (!token || stop.has(token) || stop.has(raw)) continue
      counts.set(token, (counts.get(token) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([token]) => token)
}

function formatDocLink(doc) {
  if (!doc) return ''
  const title = String(doc.title || '(未命名)').trim()
  if (doc.url) return `[${title}](${doc.url})`
  if (doc.token) return `${title}（token: ${doc.token}）`
  return title
}

function formatDocKbSuggest({
  folders = [],
  spaces = [],
  needed = [],
  edited = [],
  opened = [],
  identity = null,
  days = 30,
  memoryKeywords = [],
  errors = {},
  permissionBlocked = false,
} = {}) {
  const who = identity?.name ? `授权用户 ${identity.name}` : '当前授权用户'
  const lines = [
    `## 文档 / 知识库候选（${who} · 近 ${days} 天）`,
    '',
    '### 个人文件夹',
  ]
  if (errors.folders) {
    lines.push(`- （读取失败：${errors.folders}）`)
  } else if (!folders.length) {
    lines.push('- （云空间根目录暂无文件夹）')
  } else {
    for (const folder of folders.slice(0, 20)) {
      lines.push(`- ${folder.name}${folder.token ? ` · \`${folder.token}\`` : ''}`)
    }
  }
  lines.push('', '### 知识库空间')
  if (errors.spaces) {
    lines.push(`- （读取失败：${errors.spaces}）`)
  } else if (!spaces.length) {
    lines.push('- （暂无可见知识库空间）')
  } else {
    for (const space of spaces.slice(0, 20)) {
      lines.push(`- ${space.name}${space.id ? ` · \`${space.id}\`` : ''}`)
    }
  }
  lines.push('', '### 可能需要的文件（依据个人记忆，≤5）')
  if (memoryKeywords.length) {
    lines.push(`- 记忆关键词：${memoryKeywords.join('、')}`)
  }
  if (errors.needed) {
    lines.push(`- （检索失败：${errors.needed}）`)
  } else if (!needed.length) {
    lines.push('- （个人记忆暂无足够线索，或未命中飞书文档）')
  } else {
    needed.slice(0, 5).forEach((doc, idx) => {
      lines.push(`- ${idx + 1}. ${formatDocLink(doc)}${doc.reason ? ` · ${doc.reason}` : ''}`)
    })
  }
  lines.push('', '### 最近自己编辑的文件（≤5）')
  if (errors.edited) {
    lines.push(`- （检索失败：${errors.edited}）`)
  } else if (!edited.length) {
    lines.push('- （近窗内暂无编辑记录）')
  } else {
    edited.slice(0, 5).forEach((doc, idx) => {
      lines.push(`- ${idx + 1}. ${formatDocLink(doc)}${doc.updatedAt ? ` · ${doc.updatedAt}` : ''}`)
    })
  }
  lines.push('', '### 最近自己阅读的文件（≤5）')
  if (errors.opened) {
    lines.push(`- （检索失败：${errors.opened}）`)
  } else if (!opened.length) {
    lines.push('- （近窗内暂无阅读记录）')
  } else {
    opened.slice(0, 5).forEach((doc, idx) => {
      lines.push(`- ${idx + 1}. ${formatDocLink(doc)}${doc.updatedAt ? ` · ${doc.updatedAt}` : ''}`)
    })
  }
  lines.push('', '---')
  if (permissionBlocked) {
    lines.push('部分分区因飞书授权权限不足未取到数据，请如实说明是权限受限，不要用其他分区推测填补。')
  }
  lines.push(
    '请用简洁 Markdown 复述上述分区；不要编造未出现的文件。',
    '用户选定文件后，再用 `feishu.read_doc` / `feishu.search_docs` / `feishu.list_wiki_nodes` 深入。',
  )
  return lines.join('\n')
}

async function searchDriveDocs(filters = {}, opts = {}) {
  const res = await runLarkCli(buildDriveSearchArgs(filters), opts)
  if (!res.ok) {
    const missing = parseMissingScopeError(res.text)
    return {
      ok: false,
      message: normalizeCliErrorMessage(res.message, res.text, 'feishu.doc_kb_suggest'),
      missingScopes: missing ? missing.missingScopes : [],
      rawText: String(res.text || res.message || ''),
      items: [],
    }
  }
  const payload = parseCliJsonOutput(res.text)
  const items = []
  const seen = new Set()
  for (const raw of pickDriveSearchDocs(payload)) {
    const doc = normalizeDriveDoc(raw)
    if (!doc) continue
    const key = doc.token || doc.url || doc.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push(doc)
    if (items.length >= Math.max(1, Math.min(20, Number(filters.pageSize) || 5))) break
  }
  return { ok: true, items }
}

const PERMISSION_FAILURE_RE = /权限不足|未授权|permission|scope|forbidden|unauthorized|401|403/i

async function executeDocKbSuggest(args = {}, opts = {}) {
  const days = Math.max(1, Math.min(90, Math.floor(Number(args.days == null ? 30 : args.days) || 30)))
  const since = `${days}d`
  const identity = await resolveCurrentUserIdentity(opts)
  const errors = {}
  // Track authorization gaps across sections. A workflow tool that "succeeds"
  // while every section was permission-blocked hides the gap from the grounding
  // layer, which then cannot offer the just-in-time authorization CTA.
  const missingScopeSet = new Set()
  let permissionBlocked = false
  const notePermissionGap = (scopes, ...texts) => {
    for (const scope of (Array.isArray(scopes) ? scopes : [])) {
      const value = String(scope || '').trim()
      if (value) missingScopeSet.add(value)
    }
    if (missingScopeSet.size || texts.some(text => PERMISSION_FAILURE_RE.test(String(text || '')))) {
      permissionBlocked = true
    }
  }

  let folders = []
  {
    const res = await runLarkCli(buildDriveFilesListArgs({ pageSize: 100 }), opts)
    if (!res.ok) {
      errors.folders = normalizeCliErrorMessage(res.message, res.text, 'feishu.doc_kb_suggest')
      notePermissionGap(parseMissingScopeError(res.text)?.missingScopes, res.text, errors.folders)
    } else {
      const payload = parseCliJsonOutput(res.text)
      const seen = new Set()
      for (const raw of pickDriveFiles(payload)) {
        const folder = normalizeDriveFolder(raw)
        if (!folder) continue
        const key = folder.token || folder.name
        if (seen.has(key)) continue
        seen.add(key)
        folders.push(folder)
        if (folders.length >= 20) break
      }
    }
  }

  let spaces = []
  {
    const res = await executeFeishuRead('feishu.list_wiki_spaces', { page_all: false }, opts)
    if (!res.ok) {
      errors.spaces = String(res.message || res.text || 'wiki space list failed').slice(0, 180)
      notePermissionGap(res.missingScopes, res.text, errors.spaces)
    } else {
      const payload = parseCliJsonOutput(res.text)
      const list = [
        ...pickListCandidates(payload),
        ...pickListCandidates(payload?.data),
      ]
      const seen = new Set()
      for (const raw of list) {
        const space = normalizeWikiSpace(raw)
        if (!space) continue
        const key = space.id || space.name
        if (seen.has(key)) continue
        seen.add(key)
        spaces.push(space)
        if (spaces.length >= 20) break
      }
    }
  }

  let edited = []
  {
    const res = await searchDriveDocs({ editedSince: since, sort: 'edit_time', pageSize: 5 }, opts)
    if (!res.ok) {
      errors.edited = res.message
      notePermissionGap(res.missingScopes, res.rawText, res.message)
    } else edited = res.items.slice(0, 5)
  }

  let opened = []
  {
    const res = await searchDriveDocs({ openedSince: since, sort: 'open_time', pageSize: 5 }, opts)
    if (!res.ok) {
      errors.opened = res.message
      notePermissionGap(res.missingScopes, res.rawText, res.message)
    } else opened = res.items.slice(0, 5)
  }

  const memoryKeywords = extractMemoryKeywords(opts.memoryDir)
  const needed = []
  const neededSeen = new Set(
    [...edited, ...opened].map(d => d.token || d.url || d.title).filter(Boolean)
  )
  if (memoryKeywords.length) {
    const searchErrors = []
    for (const keyword of memoryKeywords) {
      if (needed.length >= 5) break
      const res = await searchDriveDocs({
        query: keyword.slice(0, 30),
        sort: 'edit_time',
        pageSize: 5,
      }, opts)
      if (!res.ok) {
        searchErrors.push(`${keyword}: ${res.message}`)
        notePermissionGap(res.missingScopes, res.rawText, res.message)
        continue
      }
      for (const doc of res.items) {
        const key = doc.token || doc.url || doc.title
        if (!key || neededSeen.has(key)) continue
        neededSeen.add(key)
        needed.push({ ...doc, reason: `记忆词「${keyword}」` })
        if (needed.length >= 5) break
      }
    }
    if (!needed.length && searchErrors.length) {
      errors.needed = searchErrors[0]
    }
  }

  const topFolders = folders.slice(0, 20)
  const topSpaces = spaces.slice(0, 20)
  const topNeeded = needed.slice(0, 5)
  const topEdited = edited.slice(0, 5)
  const topOpened = opened.slice(0, 5)

  // Nothing came back and the blocker is authorization: fail with the structured
  // signal so grounding renders the "补齐授权并继续" CTA, which authorizes
  // incrementally and auto-resumes the interrupted question. Reporting success
  // here would leave the model to improvise plain-text options that do nothing.
  const hasAnyData = topFolders.length || topSpaces.length || topNeeded.length
    || topEdited.length || topOpened.length
  if (!hasAnyData && permissionBlocked) {
    const missingScopes = [...missingScopeSet]
    const message = missingScopes.length
      ? describeMissingScopes(missingScopes)
      : '飞书文档/知识库整理失败：当前 user 授权权限不足，请补齐授权后重试。'
    return {
      ok: false,
      code: 'missing_scope',
      missingScopes,
      message,
      text: message,
    }
  }

  return {
    ok: true,
    text: formatDocKbSuggest({
      folders: topFolders,
      spaces: topSpaces,
      needed: topNeeded,
      edited: topEdited,
      opened: topOpened,
      identity,
      days,
      memoryKeywords,
      errors,
      permissionBlocked,
    }),
    meta: {
      workflow: 'doc_kb_suggest',
      permissionBlocked,
      days,
      folders: topFolders,
      spaces: topSpaces,
      needed: topNeeded,
      edited: topEdited,
      opened: topOpened,
      memoryKeywords,
      identity,
      errors,
    },
  }
}

function pickListCandidates(payload) {
  if (!payload || typeof payload !== 'object') return []
  const keys = ['items', 'users', 'chats', 'data', 'list', 'nodes', 'results']
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') {
      if (Array.isArray(value.items)) return value.items
      if (Array.isArray(value.users)) return value.users
      if (Array.isArray(value.chats)) return value.chats
      if (Array.isArray(value.list)) return value.list
    }
  }
  return []
}

function normalizeUserTarget(item = {}) {
  const id = String(item.open_id || item.user_id || item.union_id || item.id || '').trim()
  if (!id) return null
  const name = String(
    item.name ||
    item.display_name ||
    item.localized_name ||
    item.en_name ||
    item.nickname ||
    id
  ).trim()
  return {
    id,
    name,
    p2pChatId: String(item.p2p_chat_id || '').trim(),
    email: String(item.email || '').trim(),
  }
}

function normalizeChatTarget(item = {}) {
  const id = String(item.chat_id || item.id || '').trim()
  if (!id) return null
  const name = String(item.name || item.chat_name || item.title || id).trim()
  return {
    id,
    name,
    mode: String(item.chat_mode || item.mode || '').trim(),
    ownerId: String(item.owner_id || '').trim(),
  }
}

async function listFeishuUsers(args = {}, opts = {}) {
  const query = String(args.query || '').trim()
  const readArgs = query
    ? { query, page_size: args.page_size || 20 }
    : { user_ids: 'me', page_size: 20 }
  const res = await executeFeishuRead('feishu.search_users', readArgs, opts)
  if (!res.ok) return { ...res, items: [] }
  const json = parseCliJsonOutput(res.text)
  const items = pickListCandidates(json).map(normalizeUserTarget).filter(Boolean)
  return { ok: true, items, raw: json, text: res.text }
}

async function listFeishuChats(args = {}, opts = {}) {
  const query = String(args.query || '').trim()
  const tool = query ? 'feishu.search_chats' : 'feishu.list_chats'
  const readArgs = query
    ? { query, chat_modes: 'group', page_size: args.page_size || 20 }
    : {
      types: args.types || 'group',
      sort: args.sort || undefined,
      page_size: args.page_size || 20,
    }
  const res = await executeFeishuRead(tool, readArgs, opts)
  if (!res.ok) return { ...res, items: [] }
  const json = parseCliJsonOutput(res.text)
  const items = pickListCandidates(json).map(normalizeChatTarget).filter(Boolean)
  return { ok: true, items, raw: json, text: res.text }
}

async function sendFeishuText(args = {}, opts = {}) {
  const text = String(args.text || '').trim()
  const chatId = String(args.chat_id || '').trim()
  const userId = String(args.user_id || '').trim()
  if (!text) return { ok: false, code: 'invalid_args', message: 'messages-send 需要 text', text: '' }
  if (!chatId && !userId) return { ok: false, code: 'invalid_args', message: 'messages-send 需要 chat_id 或 user_id', text: '' }
  const argv = ['im', '+messages-send', '--as', 'user', '--text', text, '--format', 'json']
  if (chatId) argv.push('--chat-id', chatId)
  if (userId) argv.push('--user-id', userId)
  const res = await runLarkCli(argv, opts)
  if (!res.ok) {
    return {
      ...res,
      message: normalizeCliErrorMessage(res.message, res.text, 'feishu.send_message'),
      text: String(res.text || '').slice(0, 4000),
    }
  }
  return res
}

function buildDraftWrite(args = {}) {
  const title = String(args.title || '未命名文档').trim().slice(0, 200)
  const body = String(args.body || args.content || '').trim().slice(0, 20000)
  if (!body) {
    return { ok: false, code: 'invalid_args', message: 'draft_write_doc 需要 body', draft: null }
  }
  return {
    ok: true,
    draft: {
      id: `draft_${Date.now()}`,
      action: 'create_doc',
      title,
      body,
      createdAt: new Date().toISOString(),
      status: 'pending_review',
    },
    text: `已生成飞书文档草稿「${title}」，等待确认后才会写入飞书。`,
  }
}

const MINUTE_PERMS = new Set(['view', 'edit'])

function buildDraftMinutePermission(args = {}) {
  const minuteToken = String(args.minute_token || extractMinuteToken(args.url) || '').trim()
  if (!minuteToken) {
    return { ok: false, code: 'invalid_args', message: 'draft_minute_permission 需要 minute_token', draft: null }
  }
  const requested = String(args.perm || 'view').trim().toLowerCase()
  const perm = MINUTE_PERMS.has(requested) ? requested : 'view'
  return {
    ok: true,
    draft: {
      id: `draft_${Date.now()}`,
      action: 'apply_minute_permission',
      title: `申请妙记${perm === 'edit' ? '编辑' : '查看'}权限 · ${minuteToken}`,
      minuteToken,
      perm,
      createdAt: new Date().toISOString(),
      status: 'pending_review',
    },
    text: `已生成权限申请草稿：向该妙记（${minuteToken}）所有者申请「${perm === 'edit' ? '可编辑' : '可阅读'}」。确认后才会真的发出申请。`,
  }
}

async function applyMinutePermission(draft, opts = {}) {
  const minuteToken = String(draft.minuteToken || '').trim()
  if (!minuteToken) {
    return { ok: false, code: 'invalid_draft', message: '草稿缺少 minute_token', text: '' }
  }
  const perm = MINUTE_PERMS.has(String(draft.perm || '')) ? String(draft.perm) : 'view'
  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      text: `DRY_RUN: 将向妙记 ${minuteToken} 所有者申请 ${perm} 权限`,
    }
  }
  const argv = [
    'minutes', '+apply-permission',
    '--as', 'user',
    '--minute-token', minuteToken,
    '--perm', perm,
    '--format', 'json',
  ]
  const res = await runLarkCli(argv, opts)
  if (!res.ok) {
    return { ...res, message: normalizeCliErrorMessage(res.message, res.text, 'feishu.apply_minute_permission') }
  }
  return res
}

async function applyFeishuWrite(draft, opts = {}) {
  if (draft && draft.action === 'apply_minute_permission') {
    return applyMinutePermission(draft, opts)
  }
  if (!draft || draft.action !== 'create_doc') {
    return { ok: false, code: 'invalid_draft', message: '无效草稿', text: '' }
  }
  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      text: `DRY_RUN: 将创建文档「${draft.title}」（${String(draft.body || '').length} 字）`,
    }
  }
  // Prefer markdown create when available
  const argv = [
    'docs', '+create',
    '--title', String(draft.title || 'KnowMe'),
    '--markdown', String(draft.body || ''),
    '--format', 'json',
  ]
  return runLarkCli(argv, opts)
}

const FEISHU_READ_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'feishu.meeting_candidates',
      description: 'Deterministic Feishu meeting workflow: list meetings the authorized user attended in the recent 3 natural days via vc +search (already identity-scoped), then hydrate each via vc +detail to get topic/time/minute_token. Returns candidates only; does not summarize bodies.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', minimum: 1, maximum: 30 } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.meeting_read',
      description: 'Deterministic Feishu meeting workflow: read a selected meeting candidate body. Prefer minute_token (from meeting_candidates) to read the Smart Minutes summary/todo/chapter via minutes +detail; falls back to a docx token/url. Returns the body only if it contains meeting evidence.',
      parameters: {
        type: 'object',
        properties: {
          minute_token: { type: 'string' },
          doc_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.related_chats',
      description: 'Deterministic Feishu IM workflow: summarize chats related to the authorized user for recent natural days (default 1 = today). Uses im +messages-search --is-at-me for @mentions, plus im +chat-list --types p2p,group --sort active_time for personal/group chat topics. Returns a readable digest; does not send messages or read docs.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', minimum: 1, maximum: 30 } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.today_priority',
      description: 'Deterministic Feishu workflow for today priorities: pull today calendar agenda (calendar +agenda), incomplete tasks (task +get-my-tasks --complete=false), and optional today @me mentions as blocker signals. Returns a grounded fact digest so the agent can output Top-3 actions without asking three clarifying questions first. Read-only; does not create/update tasks or send messages.',
      parameters: {
        type: 'object',
        properties: {
          include_mentions: {
            type: 'boolean',
            description: 'Include today @me messages as blocker signals (default true). IM failure does not fail the whole workflow.',
          },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.doc_kb_suggest',
      description: 'Deterministic Feishu docs/knowledge workflow: list personal Drive root folders, visible wiki spaces, then suggest up to 5 possibly-needed docs (from local product memory keywords), 5 recently edited-by-me docs, and 5 recently opened-by-me docs. Returns a readable digest only; does not read document bodies.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            minimum: 1,
            maximum: 90,
            description: 'Lookback window in days for edited/opened filters (default 30).',
          },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.search_docs',
      description: 'Search Feishu docs and wiki knowledge base by query (read-only).',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.read_doc',
      description: 'Fetch a Feishu document by token or URL (read-only).',
      parameters: {
        type: 'object',
        properties: {
          doc_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.query_bitable',
      description: 'Query Feishu Base / bitable data (read-only).',
      parameters: {
        type: 'object',
        properties: {
          app_token: { type: 'string' },
          table_id: { type: 'string' },
          data: { type: 'object' },
          filter: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.list_wiki_spaces',
      description: 'List Feishu knowledge base spaces (read-only, user identity).',
      parameters: {
        type: 'object',
        properties: { page_all: { type: 'boolean' } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.list_wiki_nodes',
      description: 'List nodes in a Feishu knowledge base space (read-only).',
      parameters: {
        type: 'object',
        properties: {
          space_id: { type: 'string' },
          parent_node_token: { type: 'string' },
          page_all: { type: 'boolean' },
        },
        required: ['space_id'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.get_wiki_node',
      description: 'Get a Feishu knowledge base node by token or URL (read-only).',
      parameters: {
        type: 'object',
        properties: {
          node_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
]

const FEISHU_DRAFT_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'feishu.draft_write_doc',
      description: 'Create an in-app draft for a Feishu doc. Does NOT write to Feishu until user approves.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['body'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_minute_permission',
      description: 'Create an in-app draft that asks the Smart Minutes owner for read (or edit) access. Use it when meeting_read fails with a per-minute ACL error. Does NOT contact Feishu until the user approves.',
      parameters: {
        type: 'object',
        properties: {
          minute_token: { type: 'string' },
          url: { type: 'string' },
          perm: { type: 'string', enum: ['view', 'edit'] },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: false },
  },
]

module.exports = {
  READ_COMMANDS,
  WRITE_APPLY_COMMANDS,
  isReadTool,
  isDraftTool,
  isApplyTool,
  buildReadArgs,
  runLarkCli,
  sanitizeCliArgs,
  executeFeishuRead,
  executeMeetingCandidates,
  executeMeetingRead,
  executeRelatedChats,
  executeTodayPriority,
  executeDocKbSuggest,
  formatDocKbSuggest,
  extractMemoryKeywords,
  buildDriveSearchArgs,
  buildDriveFilesListArgs,
  buildCalendarAgendaArgs,
  buildTaskMyTasksArgs,
  formatTodayPriority,
  sanitizeImMessageText,
  inferMentionTheme,
  inferHandlingSuggestion,
  buildFeishuChatOpenUrl,
  resolveCurrentUserIdentity,
  extractDocParticipants,
  docContainsParticipant,
  buildVcSearchArgs,
  buildVcDetailArgs,
  buildMinutesDetailArgs,
  parseMeetingDisplayInfo,
  extractMinuteToken,
  formatMinuteBodyForSummary,
  normalizeRelativeDateQuery,
  sanitizeCliQuery,
  normalizeQueryArgForPlatform,
  softenQueryForRetry,
  buildDraftWrite,
  buildDraftMinutePermission,
  applyFeishuWrite,
  parseCliJsonOutput,
  parseMissingScopeError,
  describeMissingScopes,
  getGrantedUserScopes,
  listFeishuUsers,
  listFeishuChats,
  sendFeishuText,
  FEISHU_READ_TOOL_DEFS,
  FEISHU_DRAFT_TOOL_DEFS,
  isTransientCliFailure,
  normalizeCliErrorMessage,
  runLarkCliWithRetry,
}
