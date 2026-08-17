import type { AgentSession, ChatMessage } from '../shared/api'
import { enrichChatMessage } from './agent-message-ui'
import { BUILTIN_ASSISTANT_MODES, resolveAssistantModeId } from './assistant-modes'
import { isWorkbenchLaneSessionId } from './dialogue-lanes'

const WORKBENCH_SESSION_GOAL = '当前工作'
const DEFAULT_TAB_TITLES = new Set(['新助手', '新对话', '对话', '当前协作'])

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

function parseTaskRef(raw: unknown): AgentSession['taskRef'] {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const id = String(rec.id || '').trim()
  if (!id) return undefined
  const kind = String(rec.kind || '').trim()
  return kind ? { id, kind } : { id }
}

function parseRun(raw: unknown): AgentSession['run'] {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const goal = String(rec.goal || '').trim()
  const artifacts = Array.isArray(rec.artifacts)
    ? rec.artifacts.map((item) => {
      const art = asRecord(item)
      const id = String(art.id || '').trim()
      if (!id) return null
      const meta = asRecord(art.meta)
      return {
        id,
        type: String(art.type || '').trim() || undefined,
        title: String(art.title || '').trim() || undefined,
        body: String(art.body || ''),
        status: String(art.status || 'draft').trim() || 'draft',
        targetPath: String(art.targetPath || meta.path || '').trim() || undefined,
        meta: {
          mode: String(meta.mode || '').trim() || undefined,
          noteId: String(meta.noteId || '').trim() || undefined,
          sourceId: String(meta.sourceId || '').trim() || undefined,
          path: String(meta.path || '').trim() || undefined,
        },
      }
    }).filter(Boolean) as NonNullable<NonNullable<AgentSession['run']>['artifacts']>
    : []
  if (!goal && !artifacts.length) return undefined
  return {
    ...(goal ? { goal } : {}),
    ...(artifacts.length ? { artifacts } : {}),
  }
}

export function dedupeOpenSessionIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids.map(String).filter(Boolean)) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function dedupeSessionsById(sessions: AgentSession[]): AgentSession[] {
  const seen = new Set<string>()
  const out: AgentSession[] = []
  for (const session of sessions) {
    if (!session?.id || seen.has(session.id)) continue
    seen.add(session.id)
    out.push(session)
  }
  return out
}

export function isWorkbenchOwnedSession(session: AgentSession | null | undefined): boolean {
  if (!session) return false
  if (isWorkbenchLaneSessionId(session.id)) return true
  const taskKind = String(session.taskRef?.kind || '')
  if (taskKind === 'workbench-task' || taskKind === 'workflow-chat' || taskKind === 'expert-chat') {
    return true
  }
  const goal = String(session.run?.goal || session.displayTitle || session.title || '').trim()
  if (goal === WORKBENCH_SESSION_GOAL) return true
  if (/^工作台\s*[·\-—–]/.test(goal) || goal.startsWith('工作台·')) return true
  return false
}

export function filterAgentSurfaceSessions(sessions: AgentSession[]): AgentSession[] {
  return dedupeSessionsById(sessions.filter((session) => !isWorkbenchOwnedSession(session)))
}

export function isAssistantLaunchEmpty(messages: ChatMessage[]): boolean {
  return !messages.some((item) => item.role === 'user' && String(item.text || '').trim())
}

function isDefaultTabTitle(title: string): boolean {
  const text = String(title || '').trim()
  if (!text) return true
  if (DEFAULT_TAB_TITLES.has(text)) return true
  return /^新对话\s*\d*$/.test(text)
}

function compactSessionTabLabel(raw: string): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (/(会议总结|会议纪要|会议记录|meeting_candidates|meeting_read)/i.test(text)) return '会议总结'
  if (/(今日优先级|today_priority)/i.test(text)) return '今日优先级'
  if (/(查文档\/知识库|doc_kb_suggest)/i.test(text)) return '查文档/知识库'
  if (/(相关的聊天|related_chats|@我)/i.test(text)) return '分析相关聊天'
  return text.length > 40 ? `${text.slice(0, 36)}…` : text
}

/** 对齐 f6ad048 tabTitle：空会话 general 显示「通用」，默认标题不覆盖 mode 名 */
export function resolveSessionTabLabel(session: AgentSession | null | undefined): string {
  if (!session) return '通用'
  const display = String(session.displayTitle || '').trim()
  const title = String(session.title || '').trim()
  const raw = [display, title].find((item) => item && !isDefaultTabTitle(item)) || ''
  if (raw) return compactSessionTabLabel(raw) || raw
  const modeId = resolveAssistantModeId(session.agentId || session.expertId)
  if (modeId === 'general') return '通用'
  const mode = BUILTIN_ASSISTANT_MODES.find((item) => item.id === modeId)
  return mode?.name || '通用'
}

export function mergeSessionRecord(sessions: AgentSession[], session: AgentSession): AgentSession[] {
  const rest = sessions.filter((item) => item.id !== session.id)
  return dedupeSessionsById([session, ...rest])
}

export function normalizeAgentSurfaceTabs(sessions: AgentSession[], activeSessionId: string) {
  const tabs = filterAgentSurfaceSessions(dedupeSessionsById(sessions))
  const activeId = tabs.some((item) => item.id === activeSessionId)
    ? activeSessionId
    : (tabs[0]?.id || activeSessionId)
  return { tabs, activeId }
}

export function parseSessionRecord(raw: unknown): AgentSession | null {
  const result = asRecord(raw)
  const nested = result.session && typeof result.session === 'object'
    ? asRecord(result.session)
    : result
  const id = String(nested.id || '').trim()
  if (!id) return null
  const refs = Array.isArray(nested.knowledgeRefs)
    ? nested.knowledgeRefs.map((item) => {
      const rec = asRecord(item)
      return String(rec.id || item || '').trim()
    }).filter(Boolean)
    : []
  const displayTitle = String(nested.displayTitle || '').trim()
  const agentId = String(nested.agentId || '').trim()
  return {
    id,
    title: String(displayTitle || nested.title || '对话').trim() || '对话',
    displayTitle: displayTitle || undefined,
    pinned: nested.pinned === true,
    agentId: agentId || undefined,
    expertId: String(nested.expertId || '').trim() || undefined,
    knowledgeRefs: refs,
    taskRef: parseTaskRef(nested.taskRef),
    run: parseRun(nested.run),
  }
}

export function parseSessionList(raw: unknown): {
  tabs: AgentSession[]
  history: AgentSession[]
  activeId: string
} {
  const result = asRecord(raw)
  const list = Array.isArray(result.sessions)
    ? result.sessions
    : Array.isArray(result.items)
      ? result.items
      : []
  const history = dedupeSessionsById(
    list.map(parseSessionRecord).filter((item): item is AgentSession => Boolean(item)),
  )
  const byId = new Map(history.map((item) => [item.id, item]))
  const ui = asRecord(result.ui)
  const openIds = dedupeOpenSessionIds(
    Array.isArray(ui.openSessionIds) ? ui.openSessionIds.map(String) : [],
  )
  const tabsRaw = openIds.length
    ? openIds.map((id) => byId.get(id)).filter((item): item is AgentSession => Boolean(item))
    : history
  const tabs = filterAgentSurfaceSessions(tabsRaw)
  let activeId = String(ui.activeSessionId || tabs[0]?.id || history[0]?.id || '')
  if (activeId && !tabs.some((item) => item.id === activeId)) {
    activeId = tabs[0]?.id || ''
  }
  return { tabs: tabs.length ? tabs : filterAgentSurfaceSessions(history), history, activeId }
}

export function sortSessionTabs(sessions: AgentSession[]): AgentSession[] {
  const ordered = dedupeSessionsById(sessions)
  const pinned = ordered.filter((item) => item.pinned)
  const rest = ordered.filter((item) => !item.pinned)
  return [...pinned, ...rest]
}

export function chatMessagesFromSession(raw: unknown): ChatMessage[] {
  const result = asRecord(raw)
  const session = result.session && typeof result.session === 'object' ? asRecord(result.session) : result
  const list = Array.isArray(session.messages) ? session.messages : []
  return list.map((item, index) => {
    const rec = asRecord(item)
    return enrichChatMessage(rec, { id: `m-${index}`, role: 'assistant', text: '' })
  }).filter((item) => item.text || item.role === 'error')
}

export function extractImageUrls(text: string): string[] {
  const source = String(text || '')
  const found = new Set<string>()
  const markdown = /!\[[^\]]*\]\(([^)\s]+)\)/g
  const bare = /https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)]*)?/gi
  let match: RegExpExecArray | null
  while ((match = markdown.exec(source))) found.add(match[1])
  while ((match = bare.exec(source))) found.add(match[0])
  return [...found]
}

export { ASSISTANT_QUICK_COMMANDS } from './agent-quick-commands'
