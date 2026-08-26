'use strict'

const crypto = require('crypto')

const agentRun = require('./agent-run')
const { normalizeAssistantOutput } = require('./assistant-output-style')
const {
  projectConversationHistory,
  reconcileConversationLog,
  withConversationIdentity,
} = require('./agent-conversation-log')

const AGENTS = [
{ id: 'personal', name: '智能伙伴', icon: 'chat', description: '持续积累、按情境协作的个人工作代理' },
  { id: 'general', name: '通用', icon: 'chat', description: '处理日常问题与笔记整理' },
  { id: 'steward', name: '知识管家', icon: 'book', description: '整理 Wiki、健康检查与升格 OKF' },
  { id: 'writing', name: '写作', icon: 'edit', description: '润色、改写与内容结构化' },
  { id: 'coding', name: '编程', icon: 'code', description: '分析代码与实现方案' },
]

const MAX_MESSAGES = 80
const MAX_CONTEXT_CHARS = 24000
const KEEP_MESSAGES_AFTER_COMPACT = 12
const MAX_RECENT_CONTEXT_MESSAGES = 24
const DEFAULT_TITLE = '新助手'
/** 空会话占位名；含重构前英文标题，normalize 时收成 DEFAULT_TITLE */
const PLACEHOLDER_TITLES = new Set([DEFAULT_TITLE, 'New Agent', '新对话', '对话', '当前协作'])

function isPlaceholderTitle(title) {
  const text = String(title || '').trim()
  if (!text) return true
  if (PLACEHOLDER_TITLES.has(text)) return true
  return /^新对话\s*\d*$/.test(text)
}

const MAX_OPEN_TABS = 24, MAX_HISTORY = 30, MAX_TRACE_EVENTS = 40, MAX_KNOWLEDGE_REFS = 16

function normalizeKnowledgeRefs(raw, max = MAX_KNOWLEDGE_REFS) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(raw) ? raw : []) {
    const item = typeof value === 'string'
      ? { id: value }
      : (value && typeof value === 'object' ? value : null)
    const itemId = String(item?.id || '').trim().slice(0, 80)
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({ id: itemId })
    if (out.length >= max) break
  }
  return out
}

function normalizeTaskRef(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim().slice(0, 80)
  if (!id) return null
  const kind = String(raw.kind || '').trim().slice(0, 40)
  return kind ? { id, kind } : { id }
}

function newId(prefix = 's') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createSession(agentId = 'personal', index = 1, runOpts = {}) {
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0]
  const role = runOpts.role || (agentRun.RUN_ROLES.includes(agent.id) ? agent.id : 'general')
  return {
    id: newId('session'),
    agentId: agent.id,
    sessionKind: String(runOpts.sessionKind || (runOpts.taskRef ? 'legacy' : 'personal-topic')).trim(),
    profileId: String(runOpts.profileId || (!runOpts.taskRef ? 'my-knowme' : '')).trim(),
    contextId: String(runOpts.contextId || '').trim(),
    expertId: String(runOpts.expertId || '').trim(),
    personaExpertId: String(runOpts.personaExpertId || '').trim(),
    executionPolicy: String(runOpts.executionPolicy || '').trim(),
    capabilitySnapshotId: String(runOpts.capabilitySnapshotId || '').trim(),
    snapshotPath: String(runOpts.snapshotPath || '').trim(),
    ephemeral: runOpts.ephemeral === true,
    taskRef: normalizeTaskRef(runOpts.taskRef),
    knowledgeRefs: normalizeKnowledgeRefs(runOpts.knowledgeRefs),
    title: DEFAULT_TITLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: '',
    messages: [],
    pinned: false,
    run: agentRun.createEmptyRun(role, runOpts.goal || ''),
  }
}

function normalizeTraceEvent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const kind = raw.kind === 'tool' ? 'tool' : 'stage'
  const status = ['pending', 'done', 'error'].includes(raw.status) ? raw.status : 'done'
  const duration = Number(raw.durationMs)
  const event = {
    id: String(raw.id || newId('trace')).slice(0, 120),
    kind,
    title: String(raw.title || (kind === 'tool' ? '工具调用' : '执行步骤')).slice(0, 160),
    status: status === 'pending' ? 'done' : status,
  }
  if (raw.summary) event.summary = String(raw.summary).slice(0, 1000)
  if (raw.toolCallId) event.toolCallId = String(raw.toolCallId).slice(0, 160)
  if (raw.toolName) event.toolName = String(raw.toolName).slice(0, 120)
  if (Number.isFinite(duration) && duration >= 0) event.durationMs = Math.min(duration, 3_600_000)
  if (raw.requiresApproval === true) event.requiresApproval = true
  if (raw.draftId) event.draftId = String(raw.draftId).slice(0, 180)
  if (raw.draftStatus) event.draftStatus = String(raw.draftStatus).slice(0, 40)
  if (raw.evidenceStatus) event.evidenceStatus = String(raw.evidenceStatus).slice(0, 40)
  if (Array.isArray(raw.artifactRefs)) event.artifactRefs = raw.artifactRefs.slice(0, 8)
  if (Array.isArray(raw.sources)) event.sources = raw.sources.slice(0, 8)
  if (raw.subRunId) event.subRunId = String(raw.subRunId).slice(0, 160)
  if (raw.parentRunId) event.parentRunId = String(raw.parentRunId).slice(0, 160)
  if (raw.expertId) event.expertId = String(raw.expertId).slice(0, 120)
  if (raw.builderId) event.builderId = String(raw.builderId).slice(0, 80)
  if (raw.phase) event.phase = String(raw.phase).slice(0, 40)
  if (raw.stopReason) event.stopReason = String(raw.stopReason).slice(0, 500)
  if (raw.terminal) event.terminal = String(raw.terminal).slice(0, 40)
  return event
}

const { ALLOWED: ALLOWED_ACTIONS } = require('./agent-suggestion')

function normalizeStructuredUi(raw) {
  const allowedActions = ALLOWED_ACTIONS
  return (Array.isArray(raw) ? raw : []).slice(0, 6).map((entry, entryIndex) => {
    const items = (Array.isArray(entry?.items) ? entry.items : []).slice(0, 8)
      .map((item, itemIndex) => {
        const action = String(item?.action || '')
        if (!allowedActions.has(action)) return null
        return {
          id: String(item?.id || `choice_${entryIndex}_${itemIndex}`).slice(0, 120),
          label: String(item?.label || '').slice(0, 160),
          description: String(item?.description || '').slice(0, 500),
          action,
          payload: String(item?.payload || '').slice(0, 4000),
        }
      })
      .filter(item => item?.label)
    if (!items.length) return null
    return {
      kind: entry?.kind === 'choice' ? 'choice' : 'choice',
      title: String(entry?.title || '').slice(0, 160),
      items,
    }
  }).filter(Boolean)
}

function normalizeMessage(raw, options = {}) {
  if (!raw || typeof raw !== 'object') return null
  const role = raw.role
  if (!['user', 'assistant', 'tool'].includes(role)) return null
  const text = String(raw.text || '').slice(0, role === 'tool' ? 24000 : 12000)
  const trace = Array.isArray(raw.trace)
    ? raw.trace.map(normalizeTraceEvent).filter(Boolean).slice(-MAX_TRACE_EVENTS)
    : []
  const ui = role === 'assistant' ? normalizeStructuredUi(raw.ui) : []
  if (!text.trim() && !trace.length && !ui.length) return null
  const identity = withConversationIdentity(raw, {
    sessionId: options.sessionId || 'session',
    index: options.index || 0,
  })
  const message = {
    id: identity.id,
    role,
    text,
    ...(identity.runId ? { runId: identity.runId } : {}),
    ...(identity.createdAt ? { createdAt: identity.createdAt } : {}),
  }
  if (role === 'assistant') {
    if (trace.length) message.trace = trace
    if (ui.length) message.ui = ui
    const protocolVersion = Number(raw.protocolVersion)
    if (Number.isInteger(protocolVersion) && protocolVersion > 0) message.protocolVersion = protocolVersion
    if (raw.answerHash) message.answerHash = String(raw.answerHash).slice(0, 128)
  }
  if (role === 'tool') {
    message.toolCallId = String(raw.toolCallId || '').slice(0, 160)
    message.toolName = String(raw.toolName || 'tool').slice(0, 120)
    message.status = raw.status === 'error' ? 'error' : 'done'
    const duration = Number(raw.durationMs)
    if (Number.isFinite(duration) && duration >= 0) message.durationMs = Math.min(duration, 3_600_000)
  }
  return message
}

function normalizeSession(raw, fallbackIndex = 1, options = {}) {
  const base = createSession(raw?.agentId || 'general', fallbackIndex, { taskRef: raw?.taskRef })
  const sessionId = String(raw?.id || base.id)
  const normalizedMessages = Array.isArray(raw?.messages)
    ? raw.messages
      .map((message, index) => normalizeMessage(message, { sessionId, index }))
      .filter(Boolean)
    : []
  const reconciledMessages = reconcileConversationLog(normalizedMessages, [], { sessionId })
  const messageLimit = options.messageLimit === Infinity
    ? Infinity
    : Math.max(1, Number(options.messageLimit) || MAX_MESSAGES)
  const messages = Number.isFinite(messageLimit)
    ? reconciledMessages.slice(-messageLimit)
    : reconciledMessages
  const rawTitle = String(raw?.title || '').trim()
  const title = isPlaceholderTitle(rawTitle) ? DEFAULT_TITLE : rawTitle
  const run = raw?.run != null ? agentRun.normalizeRun(raw.run) : undefined
  return {
    ...base,
    ...raw,
    id: String(raw?.id || base.id),
    agentId: AGENTS.some(a => a.id === raw?.agentId) ? raw.agentId : 'general',
    sessionKind: String(raw?.sessionKind || (raw?.taskRef ? 'legacy' : 'legacy')).trim().slice(0, 40),
    profileId: String(raw?.profileId || '').trim().slice(0, 80),
    contextId: String(raw?.contextId || '').trim().slice(0, 80),
    expertId: String(raw?.expertId || '').trim(),
    personaExpertId: String(raw?.personaExpertId || '').trim(),
    executionPolicy: String(raw?.executionPolicy || '').trim().slice(0, 40),
    capabilitySnapshotId: String(raw?.capabilitySnapshotId || raw?.snapshotId || '').trim(),
    snapshotPath: String(raw?.snapshotPath || '').trim(),
    ephemeral: raw?.ephemeral === true,
    taskRef: normalizeTaskRef(raw?.taskRef),
    knowledgeRefs: normalizeKnowledgeRefs(raw?.knowledgeRefs),
    title: title.slice(0, 80) || DEFAULT_TITLE,
    summary: String(raw?.summary || '').slice(0, 12000),
    displayTitle: String(raw?.displayTitle || '').slice(0, 80),
    labels: Array.isArray(raw?.labels)
      ? [...new Set(raw.labels.map(String).map(v => v.trim()).filter(Boolean))].slice(0, 3)
      : [],
    grounding: String(raw?.grounding || '').slice(0, 3000),
    messages,
    pinned: !!raw?.pinned,
    createdAt: raw?.createdAt || base.createdAt,
    updatedAt: raw?.updatedAt || base.updatedAt,
    ...(run ? { run } : { run: undefined }),
  }
}

function estimateChars(session) {
  return String(session?.summary || '').length +
    (session?.messages || []).reduce((n, m) => n + String(m.text || '').length, 0)
}

function compactMessageText(text, max = 900) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max - 80)} … ${value.slice(-77)}`
}

function buildSessionDigest(messages, max = 8000) {
  const list = Array.isArray(messages) ? messages : []
  const users = list.filter(m => m.role === 'user' && String(m.text || '').trim())
  const assistants = list.filter(m => m.role === 'assistant' && String(m.text || '').trim())
  const tools = list.filter(m => m.role === 'tool' && String(m.text || '').trim())
  const sections = []
  const goals = [...new Set([
    users[0]?.text,
    users.at(-1)?.text,
  ].filter(Boolean))]
  if (goals.length) {
    sections.push(`### 当前目标\n${goals.map(text => `- ${compactMessageText(text)}`).join('\n')}`)
  }
  if (assistants.length) {
    sections.push(`### 已确认内容\n${assistants.slice(-4).map(m => `- ${compactMessageText(m.text)}`).join('\n')}`)
  }
  if (tools.length) {
    sections.push(`### 已执行工具与结果\n${tools.slice(-6).map(m =>
      `- ${m.toolName || 'tool'}：${compactMessageText(m.text, 700)}`
    ).join('\n')}`)
  }
  if (users.length > 1) {
    sections.push(`### 用户约束与待办\n${users.slice(-3).map(m => `- ${compactMessageText(m.text, 700)}`).join('\n')}`)
  }
  if (list.length) {
    const chronology = list.map(message => {
      const label = message.role === 'user'
        ? '用户'
        : message.role === 'assistant'
          ? '助手'
          : `工具(${message.toolName || 'tool'})`
      return `- ${label}：${compactMessageText(message.text, 500)}`
    }).join('\n')
    sections.push(`### 历史对话线索\n${chronology}`)
  }
  const digest = sections.join('\n\n')
  if (digest.length <= max) return digest
  const sectionBudget = Math.max(220, Math.floor(max / sections.length))
  return sections.map(section => limitSummary(section, sectionBudget)).join('\n\n')
}

function limitSummary(text, max) {
  const value = String(text || '')
  if (value.length <= max) return value
  const left = Math.max(1, Math.floor(max * 0.65))
  const right = Math.max(1, max - left - 30)
  return `${value.slice(0, left)}\n…（摘要已压缩）…\n${value.slice(-right)}`
}

function compactSession(session, fallbackIndex = 1) {
  // Compaction must inspect the complete input before enforcing storage caps;
  // otherwise messages beyond MAX_MESSAGES disappear without entering summary.
  const normalized = normalizeSession(session, fallbackIndex, { messageLimit: Infinity })
  if (estimateChars(normalized) <= MAX_CONTEXT_CHARS && normalized.messages.length <= MAX_MESSAGES) {
    return { session: normalized, compacted: false }
  }
  const keep = normalized.messages.slice(-KEEP_MESSAGES_AFTER_COMPACT)
  const old = normalized.messages.slice(0, -KEEP_MESSAGES_AFTER_COMPACT)
  const keptChars = keep.reduce((n, m) => n + String(m.text || '').length, 0)
  const summaryBudget = Math.max(1000, MAX_CONTEXT_CHARS - keptChars - 200)
  const digest = buildSessionDigest(old, summaryBudget)
  const summary = limitSummary(
    [normalized.summary, digest].filter(Boolean).join('\n\n'),
    summaryBudget,
  )
  return {
    session: {
      ...normalized,
      summary,
      messages: keep,
      updatedAt: new Date().toISOString(),
    },
    compacted: true,
  }
}

function contextMessages(session, options = {}) {
  const compacted = compactSession(session).session
  const excluded = new Set((options.excludeMessageIds || []).map(String).filter(Boolean))
  const available = compacted.messages.filter(message => !excluded.has(String(message?.id || '')))
  let remainingChatMessages = MAX_RECENT_CONTEXT_MESSAGES
  let recentStart = available.length
  for (let index = available.length - 1; index >= 0; index -= 1) {
    if (available[index]?.role === 'user' || available[index]?.role === 'assistant') {
      remainingChatMessages -= 1
    }
    recentStart = index
    if (remainingChatMessages <= 0) break
  }
  const older = remainingChatMessages <= 0 ? available.slice(0, recentStart) : []
  const recent = remainingChatMessages <= 0 ? available.slice(recentStart) : available
  const projectedSummary = older.length ? buildSessionDigest(older, 8000) : ''
  const summaryText = [compacted.summary, projectedSummary].filter(Boolean).join('\n\n')
  const history = []
  if (summaryText) {
    history.push({ id: `summary_${compacted.id}_user`, role: 'user', text: `[会话历史摘要]\n${summaryText}` })
    history.push({ id: `summary_${compacted.id}_assistant`, role: 'assistant', text: '已了解以上会话背景，我会继续基于当前 Session 作答。' })
  }
  return history.concat(projectConversationHistory(recent))
}

function sessionDisplayTitle(session) {
  const t = String(session?.title || '').trim()
  if (t && !isPlaceholderTitle(t)) return t.slice(0, 40)
  const goal = String(session?.run?.goal || '').trim()
  if (goal) return goal.replace(/\s+/g, ' ').slice(0, 28)
  const firstUser = (session?.messages || []).find(m => m.role === 'user' && String(m.text || '').trim())
  if (firstUser) return String(firstUser.text).replace(/\s+/g, ' ').trim().slice(0, 28) || DEFAULT_TITLE
  if (session?.agentId === 'steward') {
    const steward = AGENTS.find(a => a.id === 'steward')
    return steward?.name || '知识管家'
  }
  if (session?.agentId) {
    const agent = AGENTS.find(a => a.id === session.agentId)
    if (agent?.name) return agent.name
  }
  return DEFAULT_TITLE
}

function buildSummaryText(session) {
  const normalized = normalizeSession(session)
  if (normalized.summary?.trim()) return normalized.summary.trim()
  const lines = (normalized.messages || []).slice(-12).map(m =>
    `${m.role === 'user' ? '用户' : '助手'}：${m.role === 'assistant'
      ? normalizeAssistantOutput(m.text)
      : String(m.text || '').trim()}`
  ).filter(l => l.length > 3)
  return lines.join('\n\n').slice(0, 8000)
}

function buildResumeProjection(session) {
  const normalized = normalizeSession(session)
  const summary = buildSummaryText(normalized).trim()
  const goal = String(normalized.run?.goal || '').trim()
  if (!summary && !goal) return null
  return {
    id: normalized.id,
    agentId: normalized.agentId,
    title: sessionDisplayTitle(normalized),
    summary: (summary || goal).slice(0, 600),
    updatedAt: normalized.updatedAt,
    source: 'session',
  }
}

function buildTranscriptText(session) {
  const normalized = normalizeSession(session)
  const parts = []
  if (normalized.summary?.trim()) {
    parts.push(`[会话摘要]\n${normalized.summary.trim()}`)
  }
  for (const m of normalized.messages || []) {
    const label = m.role === 'user' ? 'User' : m.role === 'tool' ? `Tool (${m.toolName || 'tool'})` : 'Assistant'
    const text = m.role === 'assistant'
      ? normalizeAssistantOutput(m.text).trim()
      : String(m.text || '').trim()
    if (text) parts.push(`${label}:\n${text}`)
  }
  return parts.join('\n\n').slice(0, 200000)
}

/** 打开 Tab：Pin 的 Session 靠前，其余保持相对顺序 */
function sortOpenSessionIds(openIds, sessions) {
  const byId = new Map(sessions.map(s => [s.id, s]))
  const pinned = []
  const rest = []
  for (const id of openIds) {
    if (byId.get(id)?.pinned) pinned.push(id)
    else rest.push(id)
  }
  return [...pinned, ...rest]
}

function normalizeUi(rawUi, sessions) {
  const ids = new Set(sessions.map(s => s.id))
  let openSessionIds = Array.isArray(rawUi?.openSessionIds)
    ? rawUi.openSessionIds.map(String).filter(id => ids.has(id))
    : []
  openSessionIds = [...new Set(openSessionIds)].slice(0, MAX_OPEN_TABS)

  if (!openSessionIds.length && sessions.length) {
    // 迁移：按最近更新取最多 3 个打开 Tab
    openSessionIds = [...sessions]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 3)
      .map(s => s.id)
  }

  openSessionIds = sortOpenSessionIds(openSessionIds, sessions)

  let activeSessionId = String(rawUi?.activeSessionId || '')
  if (!openSessionIds.includes(activeSessionId)) {
    activeSessionId = openSessionIds[0] || ''
  }

  return { openSessionIds, activeSessionId }
}

function migrateStore(raw) {
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions.map((s, i) => compactSession(s, i + 1).session)
    : (Array.isArray(raw) ? raw.map((s, i) => compactSession(s, i + 1).session) : [])
  const ui = normalizeUi(raw?.ui, sessions)
  return { sessions, ui }
}

function forkSession(source, agentId) {
  const summary = buildSummaryText(source)
  const session = createSession(agentId || source?.agentId || 'general')
  session.title = DEFAULT_TITLE
  session.summary = summary.slice(0, 12000)
  session.messages = []
  return session
}

module.exports = {
  AGENTS, MAX_MESSAGES, MAX_CONTEXT_CHARS, KEEP_MESSAGES_AFTER_COMPACT, MAX_RECENT_CONTEXT_MESSAGES, DEFAULT_TITLE,
  MAX_OPEN_TABS, MAX_HISTORY, MAX_TRACE_EVENTS, MAX_KNOWLEDGE_REFS, normalizeKnowledgeRefs,
  normalizeTaskRef, createSession, normalizeMessage, normalizeTraceEvent, normalizeSession,
  compactSession, contextMessages, sessionDisplayTitle, buildSummaryText, buildResumeProjection,
  buildTranscriptText, sortOpenSessionIds, normalizeUi, migrateStore, forkSession, agentRun,
}
