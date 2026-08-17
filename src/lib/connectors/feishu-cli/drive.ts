/**
 * feishu-cli/drive — 云盘/知识库检索与 doc_kb_suggest 工作流。
 * 不负责：文档正文读取（core.executeFeishuRead）或草稿写入。
 */
'use strict'

const {
  runLarkCli,
  parseCliJsonOutput,
  normalizeCliErrorMessage,
  executeFeishuRead,
  sanitizeCliQuery,
  normalizeQueryArgForPlatform,
} = require('./core')
const {
  resolveCurrentUserIdentity,
  parseMissingScopeError,
  describeMissingScopes,
} = require('./scopes')
const { pickListCandidates } = require('./write')

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
    productMemory = require('../../product-memory')
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

module.exports = {
  buildDriveFilesListArgs,
  buildDriveSearchArgs,
  extractMemoryKeywords,
  formatDocKbSuggest,
  executeDocKbSuggest,
}
