/**
 * feishu-cli/calendar — 日程/待办与 today_priority 工作流。
 * 不负责：云盘/doc_kb 或写操作。
 */
'use strict'

const {
  runLarkCli,
  parseCliJsonOutput,
  normalizeCliErrorMessage,
  formatLocalDate,
  addDays,
} = require('./core')
const { resolveCurrentUserIdentity } = require('./scopes')
const {
  formatIsoLocal,
  buildMessagesSearchAtMeArgs,
  pickMessageSearchItems,
  normalizeMentionMessage,
} = require('./im')

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

module.exports = {
  buildCalendarAgendaArgs,
  buildTaskMyTasksArgs,
  formatTodayPriority,
  executeTodayPriority,
}
