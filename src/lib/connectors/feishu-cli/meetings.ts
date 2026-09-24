/**
 * feishu-cli/meetings — 视频会议 vc/minutes 候选枚举与纪要读取。
 * 不负责：IM、日历或云盘检索。
 */
'use strict'

const {
  runLarkCli,
  runLarkCliWithRetry,
  parseCliJsonOutput,
  normalizeCliErrorMessage,
  isTransientCliFailure,
  executeFeishuRead,
  formatLocalDate,
  addDays,
} = require('./core')
const { resolveCurrentUserIdentity } = require('./scopes')

const MINUTES_DOMAIN = 'https://forever9.feishu.cn/minutes/'
const DOC_DOMAIN = 'https://forever9.feishu.cn/docx/'

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

/** minutes +detail returns the Smart Minutes body and its associated note_id. */
function buildMinutesDetailArgs(minuteToken) {
  return ['minutes', '+detail', '--minute-tokens', String(minuteToken), '--summary', '--todo', '--chapter', '--transcript', '--format', 'json']
}

/** note +detail resolves the separate AI meeting-notes document chain. */
function buildNoteDetailArgs(noteId) {
  return ['note', '+detail', '--note-id', String(noteId), '--as', 'user', '--format', 'json']
}

function nextIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function resolveMeetingDateRange({ date, days } = {}, now = new Date()) {
  const requestedDate = String(date || '').trim()
  if (requestedDate) {
    const match = requestedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return { ok: false, code: 'invalid_date', message: '会议日期必须使用 YYYY-MM-DD 格式。' }
    const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    const normalized = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`
    if (normalized !== requestedDate) return { ok: false, code: 'invalid_date', message: '会议日期不是有效的自然日。' }
    return { ok: true, date: requestedDate, days: 1, start: requestedDate, end: nextIsoDate(requestedDate) }
  }
  const count = Math.max(1, Math.min(30, Math.floor(Number(days || 3) || 3)))
  return {
    ok: true,
    date: '',
    days: count,
    start: formatLocalDate(addDays(now, -(count - 1))),
    end: formatLocalDate(addDays(now, 1)),
  }
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
  const transcript = artifacts.transcript || artifacts.transcripts || artifacts.Transcript || ''
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
  pushSection('逐字稿', transcript)
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

function formatMeetingCandidates(items = [], days = 3, identity = null, date = '') {
  const who = identity && identity.userName ? `（授权用户：${identity.userName}）` : ''
  const list = Array.isArray(items) ? items : []
  const period = date ? `${date} 当天` : `最近 ${days} 个自然日内`
  if (!list.length) {
    return `${period}未找到你参与的会议记录${who}。`
  }
  const lines = [`${date ? `**${date}** 当天` : `最近 **${days}** 个自然日内`}找到 **${list.length}** 场你参与的会议${who}：`, '']
  list.forEach((item, index) => {
    const time = item.meetingTime || '时间未知'
    const cardLabel = [
      `${index + 1}. ${item.title}`,
      time,
      item.organizer ? `组织者：${item.organizer}` : '',
    ].filter(Boolean).join('｜')
    const card = item.url
      ? `[${cardLabel}](${item.url})`
      : `${cardLabel}｜${item.locatorStatus === 'lookup_failed'
        ? '飞书纪要详情查询失败，未能获得可读取链接'
        : item.locatorStatus === 'document_missing'
          ? '会议纪要详情未返回可读取的文档'
          : '该会议没有可读取的智能纪要'}`
    lines.push(card)
    lines.push('')
  })
  lines.push('回复序号（如「1」），我来读取对应纪要并做总结与简要分析。')
  return lines.join('\n')
}

async function mapLimit(items = [], limit = 3, mapper) {
  const list = Array.isArray(items) ? items : []
  const results = new Array(list.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(Math.max(1, limit), list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor++
      results[index] = await mapper(list[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function resolveAssociatedNoteDocToken(noteId, opts = {}) {
  const id = String(noteId || '').trim()
  if (!id) return { token: '', status: 'not_requested' }
  const detail = await runLarkCliWithRetry(buildNoteDetailArgs(id), opts, { retries: 1 })
  if (!detail.ok) return {
    token: '',
    status: 'lookup_failed',
    code: 'note_detail_failed',
    message: normalizeCliErrorMessage(detail.message, detail.text, 'feishu.note_detail'),
  }
  const token = extractNoteDocToken(parseCliJsonOutput(detail.text))
  return token
    ? { token, status: 'resolved' }
    : { token: '', status: 'document_missing', code: 'note_document_missing' }
}

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
  const range = resolveMeetingDateRange(args, opts.now instanceof Date ? opts.now : new Date())
  if (!range.ok) return { ok: false, code: range.code, message: range.message, text: range.message }
  const { date, days, start, end } = range
  const identity = await resolveCurrentUserIdentity(opts)

  // Feishu doc search does NOT index Smart Minutes meeting docs, and the
  // vc/minutes `--participant-ids` filter silently drops valid rows. But
  // `vc +search` is already scoped to meetings the authorized user attended or
  // organized, so a plain time-range query yields "my meetings". We enumerate
  // via vc +search, then hydrate each meeting via vc +detail. If a note_id is
  // present, resolve note_doc_token as well so the candidate points at the
  // actual meeting record rather than only the recording artifact.
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

  const hydrated = await mapLimit(meetings.slice(0, 20), 4, async (meeting) => {
    const detail = await runLarkCliWithRetry(buildVcDetailArgs(meeting.id), opts, { retries: 1 })
    if (!detail.ok) return null
    const dp = parseCliJsonOutput(detail.text)
    const row = Array.isArray(dp?.data?.meetings)
      ? dp.data.meetings[0]
      : (dp?.data && typeof dp.data === 'object' ? dp.data : null)
    if (!row) return null
    const minuteToken = String(row.minute_token || '').trim()
    const noteId = String(row.note_id || '').trim()
    // VC meetings may have both a recording and a separate AI meeting-notes
    // Docx. Resolve note_id -> note_doc_token while building candidates so the
    // displayed link points to the actual meeting record when it exists.
    const noteLookup = await resolveAssociatedNoteDocToken(noteId, opts)
    const noteDocToken = noteLookup.token
    return {
      meetingId: meeting.id,
      title: String(row.topic || meeting.topic || '').trim() || '(未命名会议)',
      meetingTime: String(row.start_time || meeting.timeText || '').trim(),
      organizer: meeting.organizer,
      minuteToken,
      noteId,
      noteDocToken,
      locatorStatus: minuteToken ? 'minute_token'
        : ['lookup_failed', 'document_missing'].includes(noteLookup.status) ? noteLookup.status : 'no_artifact',
      locatorErrorCode: noteLookup.code || '',
      locatorErrorMessage: noteLookup.message || '',
      // The vc app_link is not a stable readable source and must never be
      // shown. Prefer the associated Docx; fall back to the minutes page.
      url: noteDocToken ? `${DOC_DOMAIN}${noteDocToken}` : (minuteToken ? `${MINUTES_DOMAIN}${minuteToken}` : ''),
      appLink: meeting.appLink || '',
    }
  })
  const candidates = hydrated.filter(Boolean)
  const top = candidates.slice(0, 10)
  return {
    ok: true,
    text: formatMeetingCandidates(top, days, identity, date),
    // `turnComplete` is a generic host-runtime contract: the tool has already
    // produced the complete user-facing result for this turn. Zero candidates
    // cannot feed the later read stage, so another model/tool round would only
    // duplicate work or invent a locator.
    meta: { workflow: 'meeting_candidates', days, date: date || undefined, start, end,
      candidates: top, identity, turnComplete: top.length === 0 },
  }
}

function hasMeetingContent(text = '') {
  return /(会议|纪要|妙记|参会|议题|结论|行动项|待办|主持|发言|会议时间|会议记录|minutes|meeting)/i.test(String(text || ''))
}

function normalizeDocumentBody(raw = '') {
  const source = String(raw || '').trim()
  if (!source) return ''
  let parsed = null
  try { parsed = JSON.parse(source) } catch { /* plain text */ }
  const decode = value => String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
  if (parsed && typeof parsed === 'object') {
    const queue = [parsed]
    const keys = ['content', 'body', 'plain_text', 'plainText', 'markdown', 'text', 'doc_content']
    while (queue.length) {
      const item = queue.shift()
      if (!item || typeof item !== 'object') continue
      for (const key of keys) {
        if (typeof item[key] === 'string' && item[key].trim()) return decode(item[key]).trim()
      }
      for (const value of Object.values(item)) {
        if (value && typeof value === 'object') queue.push(value)
      }
    }
  }
  return decode(source)
}

function firstObject(value) {
  if (Array.isArray(value)) return value.find(item => item && typeof item === 'object') || null
  return value && typeof value === 'object' ? value : null
}

function extractMinuteRow(payload) {
  const candidates = [
    payload?.data?.minutes,
    payload?.minutes,
    payload?.data?.items,
    payload?.items,
  ]
  for (const candidate of candidates) {
    const row = firstObject(candidate)
    if (row) return row
  }
  return firstObject(payload?.data) || null
}

function findStringByKeys(value, keys, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return ''
  seen.add(value)
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim()
  }
  for (const child of Object.values(value)) {
    const found = findStringByKeys(child, keys, seen)
    if (found) return found
  }
  return ''
}

function extractNoteId(payload, row) {
  return findStringByKeys(row, ['note_id', 'noteId']) || findStringByKeys(payload, ['note_id', 'noteId'])
}

function extractNoteDocToken(payload) {
  return findStringByKeys(payload, ['note_doc_token', 'noteDocToken', 'main_doc_token', 'mainDocToken'])
}

async function readAssociatedMeetingNote(noteId, opts = {}) {
  const id = String(noteId || '').trim()
  if (!id) return { ok: false, code: 'missing_note_id', message: '会议没有关联的飞书会议纪要', text: '' }
  const detail = await runLarkCliWithRetry(buildNoteDetailArgs(id), opts, { retries: 1 })
  if (!detail.ok) {
    const msg = normalizeCliErrorMessage(detail.message, detail.text, 'feishu.note_detail')
    return { ...detail, message: msg, text: msg }
  }
  const payload = parseCliJsonOutput(detail.text)
  const noteDocToken = extractNoteDocToken(payload)
  if (!noteDocToken) {
    return { ok: false, code: 'missing_note_document', message: '已找到会议纪要，但飞书未返回可读取的纪要文档', text: '已找到会议纪要，但没有可读取的会议纪要文档。' }
  }
  const doc = await executeFeishuRead('feishu.read_doc', { doc_token: noteDocToken }, opts)
  if (!doc.ok) return doc
  const body = normalizeDocumentBody(doc.text)
  if (!hasMeetingContent(body)) {
    return { ok: false, code: 'not_meeting_document', message: '关联文档没有会议纪要证据，已拒绝总结', text: '关联文档没有明确会议纪要/会议记录内容，已拒绝总结。' }
  }
  return { ok: true, text: body, meta: { workflow: 'meeting_read', source: noteDocToken, kind: 'note_doc', noteId: id } }
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
    const row = extractMinuteRow(payload)
    // lark-cli may exit successfully while returning an envelope whose
    // individual minute row failed (for example need_user_authorization or
    // per-minute ACL denial). Preserve that authoritative error instead of
    // degrading it to “no meeting body”, which hides the correct next step.
    const rowError = findStringByKeys(row, ['error', 'message'])
    const topError = String(payload?.msg || payload?.message || '').trim()
    const codeFailure = Number(payload?.code) >= 400
    if (rowError || topError || payload?.ok === false || codeFailure) {
      const rawFailure = rowError || topError || findStringByKeys(payload, ['error', 'message']) || `飞书返回错误码 ${payload?.code}`
      const msg = normalizeCliErrorMessage(rawFailure, res.text, 'feishu.meeting_read')
      const minuteAcl = /No read permission for minute|没有查看权限|缺少可阅读权限/i.test(`${rawFailure}\n${msg}`)
      return {
        ok: false,
        code: minuteAcl ? 'minute_permission_denied' : (/need_user_authorization|identity is missing|no token in keychain/i.test(rawFailure) ? 'user_authorization_required' : 'cli_error'),
        message: msg,
        text: msg,
        ...(minuteAcl ? { minutePermissionDenied: true } : {}),
      }
    }
    const artifactText = minuteArtifactText(row)
    if (hasMeetingContent(artifactText)) {
      const body = formatMinuteBodyForSummary({ ...row, minute_token: minuteToken })
      return { ok: true, text: body || res.text, meta: { workflow: 'meeting_read', source: minuteToken, kind: 'minute' } }
    }
    // A recording/Smart Minutes token can also point to a separate AI meeting
    // note. Resolve that note before declaring the read a failure; never let
    // the model infer a meeting summary from the card metadata alone.
    const noteId = extractNoteId(payload, row)
    if (noteId) {
      const note = await readAssociatedMeetingNote(noteId, opts)
      if (note.ok) return note
      return note
    }
    return { ok: false, code: 'not_meeting_document', message: '读取到的妙记没有会议正文或可关联的会议纪要', text: '读取到的妙记没有会议正文，也没有可关联的会议纪要文档，已拒绝编造总结。' }
  }
  // Fallback: legacy Smart Minutes docx by token/url.
  const doc = String(args.doc_token || args.url || '').trim()
  if (!doc) return { ok: false, code: 'invalid_args', message: 'meeting_read 需要 minute_token / doc_token 或 url' }
  const result = await executeFeishuRead('feishu.read_doc', {
    doc_token: args.doc_token,
    url: args.url,
  }, opts)
  if (!result.ok) return result
  const body = normalizeDocumentBody(result.text)
  if (!hasMeetingContent(body)) {
    return {
      ok: false,
      code: 'not_meeting_document',
      message: '读取到的正文没有会议记录证据，已拒绝总结无关文档',
      text: '读取到的正文没有明确会议纪要/会议记录/妙记内容，已拒绝将其作为会议记录总结。',
    }
  }
  return {
    ok: true,
    text: body,
    meta: { workflow: 'meeting_read', source: doc, kind: 'doc' },
  }
}

/** Enumerate and read a bounded meeting set in one host tool call. */
async function executeMeetingInventory(args = {}, opts = {}) {
  const range = resolveMeetingDateRange(args, opts.now instanceof Date ? opts.now : new Date())
  if (!range.ok) return { ok: false, code: range.code, message: range.message, text: range.message }
  const { days, date } = range
  const maxMeetings = Math.max(1, Math.min(10, Math.floor(Number(args.max_meetings || 5) || 5)))
  const discovered = await executeMeetingCandidates({ days, date }, opts)
  if (!discovered.ok) return discovered
  const candidates = Array.isArray(discovered.meta?.candidates)
    ? discovered.meta.candidates.slice(0, maxMeetings)
    : []
  if (!candidates.length) {
    return {
      ...discovered,
      meta: { ...(discovered.meta || {}), workflow: 'meeting_inventory', readCount: 0, failureCount: 0, turnComplete: true },
    }
  }

  const reads = await mapLimit(candidates, 3, async (candidate, index) => {
    const locator = candidate.minuteToken
      ? { minute_token: candidate.minuteToken }
      : candidate.noteDocToken
        ? { doc_token: candidate.noteDocToken }
        : candidate.url
          ? { url: candidate.url }
          : null
    if (!locator) {
      const code = candidate.locatorErrorCode || 'missing_locator'
      const message = candidate.locatorStatus === 'lookup_failed'
        ? `已找到会议，但飞书纪要详情查询失败，未能获得可读取链接。${candidate.locatorErrorMessage ? `原因：${candidate.locatorErrorMessage}` : ''}`
        : candidate.locatorStatus === 'document_missing'
          ? '已找到会议关联纪要，但飞书未返回可读取的纪要文档。'
          : '已找到会议，但会议未生成可读取的智能纪要或纪要文档。'
      return { index, candidate, result: { ok: false, code, message, text: message } }
    }
    return { index, candidate, result: await executeMeetingRead(locator, opts) }
  })
  const successful = reads.filter(item => item.result?.ok)
  const failures = reads.filter(item => !item.result?.ok)
  const sections = reads.map(({ candidate, result }, index) => {
    const heading = `## ${index + 1}. ${candidate.title || '未命名会议'}`
    const meta = [candidate.meetingTime, candidate.organizer ? `组织者：${candidate.organizer}` : '', candidate.url || '']
      .filter(Boolean).join('｜')
    const body = result?.ok
      ? String(result.text || '').trim().slice(0, 3500)
      : `读取失败：${String(result?.message || result?.text || result?.code || '未知错误').trim().slice(0, 500)}`
    return [heading, meta, body].filter(Boolean).join('\n')
  })
  const text = [
    `# ${date ? `${date} 当天` : `最近 ${days} 个自然日`}会议正文（${successful.length}/${candidates.length} 场读取成功）`,
    '',
    ...sections.flatMap(section => [section, '']),
  ].join('\n').trim()
  if (!successful.length) {
    return {
      ok: false,
      code: failures[0]?.result?.code || 'meeting_inventory_read_failed',
      message: failures[0]?.result?.message || '已找到会议，但未能读取任何会议正文。',
      text,
      meta: { workflow: 'meeting_inventory', days, date: date || undefined, candidates, readCount: 0, failureCount: failures.length },
    }
  }
  return {
    ok: true,
    text,
    meta: {
      workflow: 'meeting_inventory',
      days,
      date: date || undefined,
      candidates,
      readCount: successful.length,
      failureCount: failures.length,
      partial: failures.length > 0,
    },
  }
}

module.exports = {
  MINUTES_DOMAIN,
  buildVcSearchArgs,
  buildVcDetailArgs,
  buildMinutesDetailArgs,
  buildNoteDetailArgs,
  parseMeetingDisplayInfo,
  extractMinuteToken,
  formatMinuteBodyForSummary,
  normalizeDocumentBody,
  extractDocParticipants,
  docContainsParticipant,
  mapLimit,
  resolveMeetingDateRange,
  executeMeetingCandidates,
  executeMeetingRead,
  executeMeetingInventory,
}
