/**
 * feishu-cli/write — 通讯录/会话列表、IM 发送、草稿构建与应用。
 * 不负责：只读 search 参数构建（见 core）或 tool 静态定义（见 tool-defs）。
 */
'use strict'

const {
  runLarkCli,
  parseCliJsonOutput,
  normalizeCliErrorMessage,
  executeFeishuRead,
} = require('./core')
const { extractMinuteToken } = require('./meetings')

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
      kind: 'feishu',
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
      kind: 'feishu',
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
  if (!draft) {
    return { ok: false, code: 'invalid_draft', message: '无效草稿', text: '' }
  }
  if (draft.action === 'apply_minute_permission') {
    return applyMinutePermission(draft, opts)
  }
  const action = draft.action
  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      text: `DRY_RUN: ${action || 'write'} ${draft.title || draft.target || ''}`.trim(),
    }
  }
  if (opts.fakeApply) {
    return { ok: true, text: `FAKE_APPLY: ${action}`, fake: true }
  }
  if (action === 'create_doc') {
    const argv = [
      'docs', '+create',
      '--title', String(draft.title || 'KnowMe'),
      '--markdown', String(draft.body || ''),
      '--format', 'json',
    ]
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_send_message') {
    return sendFeishuText({ chat_id: draft.chatId, text: draft.text }, opts)
  }
  if (action === 'draft_create_task') {
    const argv = ['task', '+create', '--title', String(draft.title || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_update_doc') {
    const argv = ['docs', '+update', '--doc-token', String(draft.docToken || ''), '--markdown', String(draft.body || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_calendar_event') {
    const argv = ['calendar', '+create-event', '--summary', String(draft.title || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_drive_upload') {
    const argv = ['drive', '+upload', '--path', String(draft.filePath || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_wiki_node') {
    const argv = ['wiki', '+create-node', '--space-id', String(draft.spaceId || ''), '--title', String(draft.title || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  if (action === 'draft_bitable_record') {
    const argv = ['base', '+create-record', '--app-token', String(draft.appToken || ''), '--table-id', String(draft.tableId || ''), '--format', 'json']
    return runLarkCli(argv, opts)
  }
  return { ok: false, code: 'invalid_draft', message: '无效草稿', text: '' }
}

function buildGenericFeishuDraft(action, args = {}, textBuilder) {
  const idempotencyKey = args.idempotencyKey || null
  const draft = {
    id: `draft_${Date.now()}`,
    kind: 'feishu',
    action,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    idempotencyKey,
    ...args,
  }
  return {
    ok: true,
    draft,
    text: textBuilder(draft),
  }
}

function buildDraftSendMessage(args = {}) {
  const text = String(args.text || args.message || '').trim()
  const chatId = String(args.chat_id || args.chatId || '').trim()
  if (!text) return { ok: false, code: 'invalid_args', message: '需要 text', draft: null }
  return buildGenericFeishuDraft('draft_send_message', { text, chatId }, (d) =>
    `已生成 IM 消息草稿（${d.text.length} 字），等待批准。`)
}

function buildDraftCreateTask(args = {}) {
  const title = String(args.title || '').trim()
  if (!title) return { ok: false, code: 'invalid_args', message: '需要 title', draft: null }
  return buildGenericFeishuDraft('draft_create_task', { title, description: args.description || '' }, (d) =>
    `已生成任务草稿「${d.title}」，等待批准。`)
}

function buildDraftUpdateDoc(args = {}) {
  const docToken = String(args.doc_token || args.docToken || '').trim()
  const body = String(args.body || args.content || '').trim()
  if (!docToken || !body) return { ok: false, code: 'invalid_args', message: '需要 doc_token 和 body', draft: null }
  return buildGenericFeishuDraft('draft_update_doc', { docToken, body, title: args.title || '' }, () =>
    '已生成文档更新草稿，等待批准。')
}

function buildDraftCalendarEvent(args = {}) {
  const title = String(args.title || args.summary || '').trim()
  if (!title) return { ok: false, code: 'invalid_args', message: '需要 title', draft: null }
  return buildGenericFeishuDraft('draft_calendar_event', { title, start: args.start, end: args.end }, (d) =>
    `已生成日历事件草稿「${d.title}」，等待批准。`)
}

function buildDraftDriveUpload(args = {}) {
  const filePath = String(args.file_path || args.filePath || '').trim()
  if (!filePath) return { ok: false, code: 'invalid_args', message: '需要 file_path', draft: null }
  return buildGenericFeishuDraft('draft_drive_upload', { filePath, folder: args.folder || '' }, () =>
    '已生成云盘上传草稿，等待批准。')
}

function buildDraftWikiNode(args = {}) {
  const spaceId = String(args.space_id || args.spaceId || '').trim()
  const title = String(args.title || '').trim()
  if (!spaceId || !title) return { ok: false, code: 'invalid_args', message: '需要 space_id 和 title', draft: null }
  return buildGenericFeishuDraft('draft_wiki_node', { spaceId, title, parent: args.parent || '' }, (d) =>
    `已生成 Wiki 节点草稿「${d.title}」，等待批准。`)
}

function buildDraftBitableRecord(args = {}) {
  const appToken = String(args.app_token || args.appToken || '').trim()
  const tableId = String(args.table_id || args.tableId || '').trim()
  if (!appToken || !tableId) return { ok: false, code: 'invalid_args', message: '需要 app_token 和 table_id', draft: null }
  return buildGenericFeishuDraft('draft_bitable_record', { appToken, tableId, fields: args.fields || {} }, () =>
    '已生成多维表格记录草稿，等待批准。')
}

const FEISHU_EXTENDED_DRAFT_BUILDERS = {
  'feishu.draft_send_message': buildDraftSendMessage,
  'feishu.draft_create_task': buildDraftCreateTask,
  'feishu.draft_update_doc': buildDraftUpdateDoc,
  'feishu.draft_calendar_event': buildDraftCalendarEvent,
  'feishu.draft_drive_upload': buildDraftDriveUpload,
  'feishu.draft_wiki_node': buildDraftWikiNode,
  'feishu.draft_bitable_record': buildDraftBitableRecord,
}

module.exports = {
  pickListCandidates,
  listFeishuUsers,
  listFeishuChats,
  sendFeishuText,
  buildDraftWrite,
  buildDraftMinutePermission,
  applyFeishuWrite,
  buildDraftSendMessage,
  buildDraftCreateTask,
  buildDraftUpdateDoc,
  buildDraftCalendarEvent,
  buildDraftDriveUpload,
  buildDraftWikiNode,
  buildDraftBitableRecord,
  FEISHU_EXTENDED_DRAFT_BUILDERS,
}
