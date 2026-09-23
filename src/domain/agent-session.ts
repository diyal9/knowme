import type { AgentSession, ChatMessage } from '../shared/api'
import { enrichChatMessage } from './agent-message-ui'
import { BUILTIN_ASSISTANT_MODES, resolveAssistantModeId } from './assistant-modes'
import { isWorkbenchLaneSessionId } from './dialogue-lanes'

const WORKBENCH_SESSION_GOAL = '当前工作'
/** 占位标题不覆盖模式名；含重构前英文 New Agent */
const DEFAULT_TAB_TITLES = new Set(['新助手', '新对话', '对话', '当前协作', 'New Agent'])
const EMPTY_SESSION_TITLES = new Set([...DEFAULT_TAB_TITLES, '新主题'])

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
        projectId: String(art.projectId || meta.projectId || '').trim() || undefined,
        type: String(art.type || '').trim() || undefined,
        title: String(art.title || '').trim() || undefined,
        body: String(art.body || art.content || ''),
        status: String(art.status || 'draft').trim() || 'draft',
        targetPath: String(art.targetPath || meta.path || '').trim() || undefined,
        url: String(art.url || '').trim() || undefined,
        path: String(art.path || '').trim() || undefined,
        meta: {
          mode: String(meta.mode || '').trim() || undefined,
          noteId: String(meta.noteId || '').trim() || undefined,
          sourceId: String(meta.sourceId || '').trim() || undefined,
          path: String(meta.path || '').trim() || undefined,
          projectId: String(meta.projectId || art.projectId || '').trim() || undefined,
          taskId: String(meta.taskId || '').trim() || undefined,
          runId: String(meta.runId || '').trim() || undefined,
          automationId: String(meta.automationId || '').trim() || undefined,
          agentId: String(meta.agentId || '').trim() || undefined,
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
  if (EMPTY_SESSION_TITLES.has(text)) return true
  if (/^\d+$/.test(text)) return true
  return /^新对话\s*\d*$/.test(text)
}

function compactSessionTabLabel(raw: string): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (/(会议总结|会议纪要|会议记录|meeting_candidates|meeting_read)/i.test(text)) return '会议总结'
  if (/(今日优先级|today_priority)/i.test(text)) return '今日优先级'
  if (/(查文档\/知识库|doc_kb_suggest)/i.test(text)) return '查文档/知识库'
  if (/(相关的聊天|related_chats|@我)/i.test(text)) return '分析相关聊天'
  return text.length > 32 ? `${text.slice(0, 28)}…` : text
}

/** 对齐 f6ad048 tabTitle：空会话 general 显示「通用」，默认标题不覆盖 mode 名 */
export function resolveSessionTabLabel(
  session: AgentSession | null | undefined,
  options: { firstUserText?: string } = {},
): string {
  if (!session) return '新主题'
  const display = String(session.displayTitle || '').trim()
  const title = String(session.title || '').trim()
  const raw = [display, title].find((item) => item && !isDefaultTabTitle(item)) || ''
  if (raw) return compactSessionTabLabel(raw) || raw
  const firstFact = String(options.firstUserText || '').replace(/\s+/g, ' ').trim()
  // 问候语不具备主题事实，保留「新主题」避免 tab 与消息正文重复。
  if (firstFact && firstFact.length > 4 && !/^(你好|您好|嗨|hello|hi|在吗)[！!。.?？…\s]*$/i.test(firstFact)) {
    return compactSessionTabLabel(firstFact) || firstFact
  }
  const modeId = resolveAssistantModeId(session.agentId || session.expertId)
  if (session.sessionKind === 'personal-topic' || session.profileId === 'my-knowme') return '新主题'
  if (modeId === 'general') return '新主题'
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
  const sessionKind = String(nested.sessionKind || '').trim()
  const profileId = String(nested.profileId || '').trim()
  const contextId = String(nested.contextId || '').trim()
  const updatedAt = String(nested.updatedAt || '').trim()
  const resume = asRecord(nested.resume)
  const summary = String(nested.summary || resume.summary || '').trim().slice(0, 180)
  return {
    id,
    projectId: String(nested.projectId || '').trim() || undefined,
    title: String(displayTitle || nested.title || '对话').trim() || '对话',
    displayTitle: displayTitle || undefined,
    pinned: nested.pinned === true,
    agentId: agentId || undefined,
    sessionKind: sessionKind || (profileId === 'my-knowme' ? 'personal-topic' : 'legacy'),
    profileId: profileId || undefined,
    contextId: contextId || undefined,
    expertId: String(nested.expertId || '').trim() || undefined,
    knowledgeRefs: refs,
    taskRef: parseTaskRef(nested.taskRef),
    run: parseRun(nested.run),
    ...(updatedAt ? { updatedAt } : {}),
    ...(Number.isFinite(Number(nested.messageCount)) ? { messageCount: Number(nested.messageCount) } : {}),
    ...(summary ? { summary } : {}),
  }
}

function isUnstartedSession(session: AgentSession): boolean {
  return session.messageCount === 0
    && EMPTY_SESSION_TITLES.has(String(session.title || '').trim())
    && !session.pinned
    && !session.run?.goal
    && !session.run?.artifacts?.length
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
  const allSessions = dedupeSessionsById(
    list.map(parseSessionRecord).filter((item): item is AgentSession => Boolean(item)),
  )
  const ui = asRecord(result.ui)
  const openIds = dedupeOpenSessionIds(
    Array.isArray(ui.openSessionIds) ? ui.openSessionIds.map(String) : [],
  )
  const byId = new Map(allSessions.map((item) => [item.id, item]))
  const opened = openIds.length
    ? openIds.map((id) => byId.get(id)).filter((item): item is AgentSession => Boolean(item))
    : allSessions
  const activeIdHint = String(ui.activeSessionId || '')
  const emptyTabKept = opened.find((item) => item.id === activeIdHint && isUnstartedSession(item))
    || opened.find((item) => isUnstartedSession(item))
  const tabsRaw = opened.filter((item) => !isUnstartedSession(item) || item.id === emptyTabKept?.id)
  const tabs = filterAgentSurfaceSessions(tabsRaw)
  const history = allSessions.filter((item) => !isUnstartedSession(item))
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
  return list.filter((item) => asRecord(item).role !== 'tool').map((item, index) => {
    const rec = asRecord(item)
    return enrichChatMessage(rec, { id: `m-${index}`, role: 'assistant', text: '' })
  }).filter((item) => item.text || item.role === 'error')
}

export function extractImageUrls(text: string): string[] {
  // Provider responses may escape Markdown parentheses or emit HTML image tags.
  // Normalize only the transport escaping here; the renderer still treats the
  // resulting URL as untrusted and resolves it through the preview bridge.
  const source = String(text || '')
    .replace(/\\([()])/g, '$1')
  const found = new Set<string>()
  const markdown = /(!?)\[[^\]]*\]\(([^)\s]+)\)/g
  const html = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
  const bare = /https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s)]*)?/gi
  let match: RegExpExecArray | null
  while ((match = markdown.exec(source))) {
    const href = match[2]
    const explicitImage = match[1] === '!'
    const imageLikeTarget = /^(?:data:image\/|blob:)/i.test(href)
      || /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(href)
    if (explicitImage || imageLikeTarget) found.add(href)
  }
  while ((match = html.exec(source))) found.add(match[1])
  while ((match = bare.exec(source))) found.add(match[0])
  return [...found].filter((url) => /^(?:https?:\/\/|data:image\/|blob:|file:|[A-Za-z]:[\\/]|\.\.?[\\/]|\/)/i.test(url))
}

/** 图片已由消息层渲染为缩略预览时，从正文中移除对应 Markdown/裸地址，避免重复展示。 */
export function removeExtractedImageReferences(text: string, imageUrls = extractImageUrls(text)): string {
  let output = String(text || '')
  const sources = new Set(imageUrls)
  output = output.replace(/!?\[[^\]]*\]\(([^)\s]+)\)/g, (match, href: string) => (
    sources.has(href) ? '' : match
  ))
  for (const url of sources) {
    output = output.split(url).join('')
  }
  return output
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export { ASSISTANT_QUICK_COMMANDS } from './agent-quick-commands'
