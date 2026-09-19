import { ExpertCompletionSummary } from './ExpertCompletionSummary'
import { projectExpertTaskLifecycle } from '../../../shared/expert-task-lifecycle'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react'
import type { AgentRunArtifact, AgentSession, CapabilityItem, ChatMessage, WorkbenchTask } from '../../../shared/api'
import { createArtifactPreviewContract, type ArtifactPreviewAction } from '../../../domain/artifact-preview'
import { conversationFileName } from '../../../domain/conversation-file'
import { workbenchTaskBackLabel, workbenchTaskModeLabel } from '../../../domain/workbench-task-room'
import { expertArtifactKind, parseExpertArtifactRef } from '../../../domain/expert-artifact'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { collapseExpertDocumentLabels, collapseExpertDocumentOutputs, expertDeliverableDisplayTitle, expertDisplayName, resolveExpertOutputType } from '../../../domain/expert-present'
import { ExpertArtifactPreviewDialog } from './ExpertArtifactPreviewDialog'
import { ExpertImagePreview, ExpertImagePreviewDialog, imagePreviewItem, imagePreviewSource } from './ExpertImagePreview'
import { ExpertDeliverableArtifact } from './ExpertDeliverableArtifact'
import { ExpertTaskCapabilities } from './ExpertTaskCapabilities'
import { ExpertTaskAccess } from './ExpertTaskAccess'
import { ExpertTaskDiagnostics } from './ExpertTaskDiagnostics'
import { ExpertConversationTimeline, expertTurnElapsedMs, ExpertTurnDivider } from './ExpertConversationTimeline'
import { projectExpertTaskDiagnostics, type ExpertTaskDiagnosticSnapshot } from '../../../domain/expert-task-diagnostics'
import { ExpertCollabDialogue, ExpertDialogueMessage, ExpertDialoguePending } from './ExpertCollabDialogue'
import { AgentMessageBubble } from '../assistant/AgentMessageBubble'
import { ExpertNarrativeMomentView } from './ExpertNarrativeMoment'
import { expertCollabStatus } from './ExpertCollabStageRail'
import { AgentComposer } from '../assistant/AgentComposer'
import { parseExpertWorkbenchDetail, type ExpertWorkbenchDetail } from '../../../domain/expert-workbench-detail'
import { buildExpertDiscussionContext } from '../../../domain/expert-discussion'
import { extractExpertPlanningState, formatExpertPlanMaterial, isExpertClarificationAnswerSufficient, isExpertPlanConfirmation } from '../../../domain/expert-collab-plan'
import { describeExpertFailure, describeExpertInputNeed } from '../../../domain/expert-input-need'
import { buildExpertCollabFeed, mergeExpertChatMessages } from '../../../domain/expert-collab-feed'
import { buildExpertCollabNarrative } from '../../../domain/expert-collab-narrative'
import { chatMessagesFromSession } from '../../../domain/agent-session'
import { workbenchExpertDiscussionSessionId } from '../../../domain/dialogue-lanes'
import { ArtifactPreview } from '../artifact/ArtifactPreview'
import { projectWorkbenchTaskAction } from '../../../domain/workbench-task-action'

/** 任务专用卡片仍是对话中的一条助手消息，统一复用伙伴消息气泡。 */
function ExpertTaskConversationTurn({
  text,
  testId,
  className = '',
  children,
}: {
  text: string
  testId: string
  className?: string
  children?: ReactNode
}) {
  return (
    <li className={`agent-virtuoso-row wb-expert-message-row ${className}`.trim()} data-testid={testId}>
      <AgentMessageBubble role="assistant" text={text}>{children}</AgentMessageBubble>
    </li>
  )
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', starting: '正在预检', needs_input: '等待补充', running: '专家执行中',
  review: '等待验收', revising: '修改中', completed: '已完成', failed: '执行失败', cancelled: '已取消',
}

const STATUS_FOCUS: Record<string, { title: string; detail: string }> = {
  draft: { title: '正在准备协作', detail: '请在下方描述希望专家完成的事项，确认计划后再开始执行。' },
  completed: { title: '本次协作已完成', detail: '成果与对话记录已保留，可继续查看或交接。' },
  review: { title: '等待验收', detail: '请查看成果并接受，或在输入框中说明需要修改的内容。' },
  failed: { title: '本次执行未完成', detail: '执行证据和失败原因保留在任务记录中。' },
  cancelled: { title: '任务已取消', detail: '已产生的任务记录仍可查看。' },
}

function isPlaceholderGoal(value: unknown) {
  const normalized = String(value || '').trim()
  return !normalized || /(?:待填写目标|^与.+?(?:专家|Agent)协作$)/.test(normalized)
}

function resolvedTaskGoal(task: WorkbenchTask | null) {
  return [task?.brief?.goal, task?.brief?.plan?.goal, task?.goal].map(value => String(value || '').trim())
    .find(value => !isPlaceholderGoal(value)) || ''
}

function collaborationRoomTitle(goal: string) {
  const value = String(goal || '')
    .replace(/^(我想|请帮我|帮我|我要|希望你|请你)\s*/u, '')
    .replace(/[。！？.!?]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!value) return '新建协作'
  return value.length > 28 ? `${value.slice(0, 28).trim()}…` : value
}

function publishTaskUpdate(task: WorkbenchTask) {
  window.dispatchEvent(new CustomEvent('knowme:expert-task-updated', { detail: task }))
}

function formatElapsedTime(startedAt?: string) {
  const started = Date.parse(String(startedAt || ''))
  if (!Number.isFinite(started)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function comparableReplyText(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

function isAnswerAlreadyShown(messages: ChatMessage[], body: string) {
  const candidate = comparableReplyText(body)
  if (!candidate) return false
  return messages.some((message) => (
    message.role === 'assistant' && comparableReplyText(message.text) === candidate
  ))
}

function escapeRegExp(value: unknown) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function ExpertTaskRoom() {
  const expertRoom = useAppStore((s) => s.expertRoom)
  const cachedTask = useAppStore((s) => {
    const taskId = s.expertRoom?.taskId
      || (s.expertRoom?.expertId === s.expertRoom?.id ? '' : s.expertRoom?.id)
    return taskId ? s.tasks.find((item) => item.id === taskId) || null : null
  })
  const roomTaskId = expertRoom?.taskId
    || (expertRoom?.expertId === expertRoom?.id ? '' : expertRoom?.id)
  const closeExpertRoom = useAppStore((s) => s.closeExpertRoom)
  const openConfirm = useAppStore((s) => s.openConfirm)
  const enterStudioFromExpertTask = useAppStore((s) => s.enterStudioFromExpertTask)
  const showToast = useAppStore((s) => s.showToast)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const hubItems = useAppStore((s) => s.hubItems)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const setWorkbenchComposer = useAppStore((s) => s.setWorkbenchComposer)
  const setRoute = useAppStore((s) => s.setRoute)
  const filesOpen = useAppStore((s) => s.filesOpen)
  const toggleFiles = useAppStore((s) => s.toggleFiles)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const setHubQuery = useAppStore((s) => s.setHubQuery)
  const [task, setTask] = useState<WorkbenchTask | null>(() => cachedTask)
  const [collaborationTitleOverride, setCollaborationTitleOverride] = useState('')
  const [taskResolved, setTaskResolved] = useState(() => !roomTaskId || Boolean(cachedTask))
  const [historyLoading, setHistoryLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<ExpertTaskDiagnosticSnapshot | null>(null)
  const [startingPlan, setStartingPlan] = useState(false)
  const [startingFollowup, setStartingFollowup] = useState(false)
  const [planClarificationSelected, setPlanClarificationSelected] = useState(false)
  const [expertDetail, setExpertDetail] = useState<ExpertWorkbenchDetail | null>(null)
  const [reviewingAction, setReviewingAction] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewNotice, setReviewNotice] = useState('')
  const [artifacts, setArtifacts] = useState<Record<string, AgentRunArtifact>>({})
  const [artifactLoading, setArtifactLoading] = useState<Record<string, boolean>>({})
  const [previewDeliverableId, setPreviewDeliverableId] = useState('')
  const [previewImageId, setPreviewImageId] = useState('')
  const [reviewEditorId, setReviewEditorId] = useState('')
  const restoredTaskId = useRef('')
  const historyReadyRef = useRef(false)
  const restoredMessageIdsRef = useRef(new Set<string>())
  const loadRequestId = useRef(0)
  const dialogueScrollRef = useRef<HTMLDivElement | null>(null)
  const composerDockRef = useRef<HTMLDivElement | null>(null)
  const followLatestDialogueRef = useRef(true)
  const followedUserMessageIdRef = useRef('')
  const inputRequestRef = useRef<{ taskId: string } | null>(null)

  async function restoreDiscussionMessages(taskResult: WorkbenchTask, requestId: number) {
    const taskId = String(taskResult.id || '').trim()
    if (!taskId) return
    const executionSessionId = String(taskResult.execRef?.id || '').trim()
    const sessionIds = [...new Set([
      workbenchExpertDiscussionSessionId(taskId, 'planning'),
      executionSessionId,
      workbenchExpertDiscussionSessionId(taskId, 'discussion'),
      workbenchExpertDiscussionSessionId(taskId, 'execution'),
      ].filter(Boolean))]
    const loaded: ChatMessage[][] = sessionIds.map(() => [])
    const publishLoaded = () => {
      const persisted = loaded.flat()
      const current = useAppStore.getState().expertRoom
      if (requestId !== loadRequestId.current || !current || current.id !== expertRoom?.id || current.taskId !== taskId) return
      const confirmationText = String(taskResult.brief?.materials?.find((material) => (
        material.id === 'user-plan-confirmation' || material.type === 'user_confirmation'
      ))?.content || '').trim()
      const hasConfirmationMessage = confirmationText && [...persisted, ...current.messages]
        .some((message) => message.role === 'user' && String(message.text || '').trim() === confirmationText)
      const restoredConfirmation = confirmationText && !hasConfirmationMessage
        ? [{ id: `restored-plan-confirmation-${taskId}`, role: 'user' as const, text: confirmationText,
            createdAt: taskResult.events?.find((event) => event.type === 'plan_confirmed'
              || (event.type === 'created' && event.summary === '已确认委托单并开始预检'))?.createdAt || taskResult.createdAt }]
        : []
      const localMessages = persisted.length
        ? current.messages.filter((message) => !String(message.id || '').startsWith('sys-')
          && !(message.id === `restored-plan-confirmation-${taskId}` && persisted.some(saved => (
            saved.role === 'user' && String(saved.text || '').trim() === confirmationText
          ))))
        : current.messages
      const merged = mergeExpertChatMessages([...persisted, ...restoredConfirmation], localMessages)
      for (const message of [...persisted, ...restoredConfirmation]) {
        if (message.id) restoredMessageIdsRef.current.add(message.id)
      }
      const signature = (messages: typeof merged) => JSON.stringify(messages.map((message) => [message.id, message.role, message.text, message.createdAt, message.streaming]))
      if (signature(merged) === signature(current.messages)) return
      useAppStore.setState({ expertRoom: { ...current, messages: merged } })
    }
    // Keep the source order stable even when sessions arrive out of order.
    if (!historyReadyRef.current) setHistoryLoading(true)
    try {
      if (typeof window.api?.agentSessionGet === 'function') {
        await Promise.all(sessionIds.map(async (sessionId, index) => {
          try {
            const result = await window.api?.agentSessionGet?.(sessionId)
            if (requestId !== loadRequestId.current) return
            if (sessionId === executionSessionId && useAppStore.getState().expertRoom?.id === taskId) {
              const raw = result as unknown as { session?: { expertTaskDiagnostics?: ExpertTaskDiagnosticSnapshot }; expertTaskDiagnostics?: ExpertTaskDiagnosticSnapshot }
              const saved = raw?.session?.expertTaskDiagnostics || raw?.expertTaskDiagnostics
              setDiagnostics(saved ? projectExpertTaskDiagnostics({ metrics: { toolSurface: saved, roundContext: saved } }) : null)
            }
            const messages = chatMessagesFromSession(result)
            loaded[index] = sessionId === executionSessionId
              ? messages.filter((message) => message.role !== 'user')
              : messages
            publishLoaded()
          } catch {
            // Other histories can still render if one session cannot be read.
          }
        }))
      }
      publishLoaded()
    } finally {
      if (requestId === loadRequestId.current) {
        historyReadyRef.current = true
        setHistoryLoading(false)
      }
    }
  }

  async function load() {
    const roomId = expertRoom?.id
    const taskId = expertRoom?.taskId || roomId
    if (!roomId || !taskId) return
    const requestId = ++loadRequestId.current
    const result = await Promise.resolve(window.api?.expertTaskGet?.(taskId)).catch(() => null)
    if (requestId !== loadRequestId.current || useAppStore.getState().expertRoom?.id !== roomId) return
    const loadedTask = result?.task || null
    setTask(loadedTask)
    // Task availability is independent of slower historical session reads.
    setTaskResolved(true)
    const restoreSignature = loadedTask
      ? [loadedTask.id, loadedTask.updatedAt, loadedTask.status, loadedTask.events?.length, loadedTask.deliverables?.length].join(':')
      : ''
    if (loadedTask && restoredTaskId.current !== restoreSignature) {
      restoredTaskId.current = restoreSignature
      await restoreDiscussionMessages(loadedTask, requestId)
    }
    if (requestId !== loadRequestId.current || useAppStore.getState().expertRoom?.id !== roomId) return
    return Boolean(loadedTask && projectExpertTaskLifecycle(loadedTask).terminal)
  }

  useEffect(() => {
    setCollaborationTitleOverride('')
    const taskId = expertRoom?.taskId
      || (expertRoom?.expertId === expertRoom?.id ? '' : expertRoom?.id)
    const warmTask = taskId
      ? useAppStore.getState().tasks.find((item) => item.id === taskId) || null
      : null
    setTaskResolved(!taskId || Boolean(warmTask))
    setHistoryLoading(false)
    setTask(warmTask)
    setDiagnostics(null)
    restoredTaskId.current = ''
    historyReadyRef.current = false
    restoredMessageIdsRef.current.clear()
    followLatestDialogueRef.current = true
    followedUserMessageIdRef.current = ''
    if (!expertRoom?.id) return undefined
    // A newly opened expert room has no persisted task yet. It is already ready
    // for clarification, so avoid a guaranteed-miss IPC and paint it immediately.
    if (!taskId) return undefined
    let active = true
    let timer = 0
    const refresh = async () => {
      const complete = await load()
      // Never overlap reads: a response slower than the polling interval must
      // still be accepted, rather than invalidated by the next request.
      if (active && !complete) {
        timer = window.setTimeout(() => void refresh(), 1600)
      }
    }
    void refresh()
    return () => {
      active = false
      loadRequestId.current += 1
      window.clearTimeout(timer)
    }
  }, [expertRoom?.id, expertRoom?.taskId, expertRoom?.expertId])

  useEffect(() => {
    if (!expertRoom) return
    const expertId = String(task?.expertId || expertRoom.expertId || expertRoom.id)
    const fallback = hubItems.find((item) => item.id === expertId) || ({
      id: expertId, name: task?.expertName || (expertRoom.taskId ? '专家' : expertRoom.name), kind: 'expert',
    } as CapabilityItem)
    setExpertDetail(parseExpertWorkbenchDetail(null, fallback))
    let active = true
    void window.api?.expertGet?.(expertId).then((result) => {
      if (active) setExpertDetail(parseExpertWorkbenchDetail(result, fallback))
    }).catch(() => null)
    return () => { active = false }
  }, [expertRoom?.expertId, expertRoom?.id, expertRoom?.taskId, expertRoom?.name, hubItems, task?.expertId, task?.expertName])

  const artifactSignature = (task?.deliverables || [])
    .flatMap((item) => item.artifactRefs?.length ? item.artifactRefs : [item.artifactRef])
    .map((ref) => String(ref || '').trim())
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    const refs = [...new Set((task?.deliverables || [])
      .flatMap((item) => item.artifactRefs?.length ? item.artifactRefs : [item.artifactRef])
      .map((ref) => String(ref || '').trim())
      .filter(Boolean))]
    let active = true
    if (!refs.length) {
      setArtifacts({})
      setArtifactLoading({})
      return undefined
    }
    setArtifactLoading(Object.fromEntries(refs.map((ref) => [ref, true])))
    void Promise.all(refs.map(async (ref) => {
      const parsed = parseExpertArtifactRef(ref)
      if (!parsed) return [ref, null] as const
      try {
        const result = await window.api?.agentSessionGet?.(parsed.sessionId)
        const session = result && typeof result === 'object' && 'session' in result
          ? result.session
          : result as AgentSession | null
        const artifact = session?.run?.artifacts?.find((item) => item.id === parsed.artifactId) || null
        return [ref, artifact] as const
      } catch {
        return [ref, null] as const
      }
    })).then((entries) => {
      if (!active) return
      const loaded = entries.filter((entry): entry is readonly [string, AgentRunArtifact] => Boolean(entry[1]))
      setArtifacts(Object.fromEntries(loaded))
      setArtifactLoading({})
    })
    return () => { active = false }
  }, [artifactSignature])

  useEffect(() => {
    if (!task || !expertRoom?.id) return
    const discussionContext = buildExpertDiscussionContext(task, artifacts)
    const current = useAppStore.getState().expertRoom
    if (!current || current.id !== expertRoom.id) return
    if (JSON.stringify(current.discussionContext) === JSON.stringify(discussionContext)) return
    useAppStore.setState({
      expertRoom: {
        ...current,
        taskId: current.taskId || task.id,
        taskStatus: task.status,
        expertId: current.expertId || task.expertId || current.id,
        discussionContext,
      },
    })
  }, [task, artifacts, expertRoom?.id])

  const latestDialogueMessage = expertRoom?.messages.at(-1)
  const dialogueRenderKey = [
    expertRoom?.id || '',
    expertRoom?.messages.length || 0,
    latestDialogueMessage?.id || '',
    latestDialogueMessage?.role || '',
    String(latestDialogueMessage?.text || '').length,
    latestDialogueMessage?.streaming === true ? 1 : 0,
    task?.status || '',
    task?.events?.length || 0,
    task?.deliverables?.length || 0,
    isGenerating ? 1 : 0,
  ].join(':')

  useEffect(() => {
    const forceLatest = latestDialogueMessage?.role === 'user'
      && !restoredMessageIdsRef.current.has(String(latestDialogueMessage.id || ''))
      && latestDialogueMessage.id !== followedUserMessageIdRef.current
    if (forceLatest) followedUserMessageIdRef.current = String(latestDialogueMessage.id || '')
    if (!forceLatest && !followLatestDialogueRef.current) return undefined
    const frame = window.requestAnimationFrame(() => {
      const panel = dialogueScrollRef.current
      if (!panel) return
      panel.scrollTop = panel.scrollHeight
      followLatestDialogueRef.current = true
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dialogueRenderKey])

  function trackDialogueScroll(event: UIEvent<HTMLDivElement>) {
    const panel = event.currentTarget
    followLatestDialogueRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 96
  }

  useLayoutEffect(() => {
    const panel = dialogueScrollRef.current
    const dock = composerDockRef.current
    if (!panel) return
    const measure = () => {
      panel.style.setProperty('--expert-composer-height', `${dock?.getBoundingClientRect().height || 0}px`)
      if (followLatestDialogueRef.current) panel.scrollTop = panel.scrollHeight
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    if (dock) observer?.observe(dock)
    return () => {
      observer?.disconnect()
      panel.style.removeProperty('--expert-composer-height')
    }
  }, [expertRoom?.id, taskResolved, task?.status])

  if (!expertRoom) return null
  const hasPersistedPlanConfirmation = Boolean(task?.brief?.materials?.some((item) => item?.type === 'user_confirmation'))
  const isDraft = taskResolved && (
    (!task && !expertRoom.taskId)
    || Boolean(task && task.status === 'draft'
      && task.execRef?.kind === 'none'
      && !hasPersistedPlanConfirmation
      && task.events?.some((event) => event.type === 'created' && event.summary?.includes('打开新的协作任务')))
  )
  const status = isDraft
    ? 'draft'
    : task?.status === 'draft' && hasPersistedPlanConfirmation
      ? 'starting'
      : String(task?.status || 'starting')
  const expertId = String(task?.expertId || expertRoom.expertId || expertRoom.id)
  const hubExpert = hubItems.find((item) => item.id === expertId)
  const currentExpertDetail = expertDetail?.id === expertId ? expertDetail : null
  // Reopened room names can be task titles; speaker identity comes from the expert.
  const expertName = expertDisplayName(hubExpert?.name || currentExpertDetail?.name || task?.expertName
    || (expertRoom.taskId ? '专家' : expertRoom.name))
  const expertItem = { ...hubExpert, id: expertId, name: expertName, kind: 'expert',
    description: hubExpert?.description || currentExpertDetail?.description || '' } as CapabilityItem
  const userMessages = expertRoom.messages.filter((message) => message.role === 'user' && String(message.text || '').trim())
  const firstUserMessage = userMessages[0]
  const draftGoal = String(expertRoom.goal || firstUserMessage?.text || '').trim()
  const isImageDeliverableRecord = (item: NonNullable<WorkbenchTask['deliverables']>[number], artifact?: AgentRunArtifact | null) => (
    expertArtifactKind(item.type) === 'image'
      || expertArtifactKind(artifact?.type) === 'image'
  )
  const deliverables = task?.deliverables || []
  const plainReplyBody = (item: NonNullable<WorkbenchTask['deliverables']>[number], artifact?: AgentRunArtifact | null) => {
    if (artifact?.targetPath || artifact?.url || artifact?.path || artifact?.meta?.path || expertArtifactKind(item.type || artifact?.type) !== 'answer') return ''
    return artifact ? String(artifact.body || '').trim() : item.artifactRef ? '' : String(task?.resultSummary || '').trim()
  }
  const processEvents = task?.events || []
  const previewDeliverable = deliverables.find((item) => String(item.deliverableId) === previewDeliverableId) || null
  const previewArtifact = previewDeliverable?.artifactRef ? artifacts[previewDeliverable.artifactRef] : null
  const imagePreviewItems = deliverables.flatMap((item) => {
    const refs = item.artifactRefs?.length ? item.artifactRefs : [item.artifactRef].filter(Boolean) as string[]
    if (!isImageDeliverableRecord(item, refs[0] ? artifacts[refs[0]] : null)) return []
    return refs.map((ref, index) => imagePreviewItem(
      { ...item, deliverableId: `${item.deliverableId || 'image'}:${ref || index + 1}`, artifactRef: ref },
      artifacts[ref],
      undefined,
      Boolean(artifactLoading[ref]),
    ))
  })
  const previewImageIndex = imagePreviewItems.findIndex((item) => (
    item.id === previewImageId || item.title === previewImageId || item.id.startsWith(`${previewDeliverableId}:`)
  ))
  const planningState = extractExpertPlanningState(expertRoom.messages, expertId)
  const dynamicPlan = planningState.plan
  const clarifiedGoal = String(dynamicPlan?.goal || '').trim()
  const persistedGoal = resolvedTaskGoal(task)
  const goal = isDraft
    ? clarifiedGoal || persistedGoal || draftGoal
    : persistedGoal || clarifiedGoal || draftGoal
  const collaborationTitle = collaborationTitleOverride
    || String(task?.title || '').trim()
    || collaborationRoomTitle(goal)
  const goalConfirmed = Boolean(clarifiedGoal || task?.brief?.goal)
  const dynamicPlanSteps = dynamicPlan?.steps || []
  const hasDynamicPlan = planningState.phase === 'ready'
  const latestPlanningReply = [...expertRoom.messages].reverse().find(message => message.role === 'assistant' && message.text?.trim())
  const latestAssistantMessageId = [...expertRoom.messages].reverse().find(message => message.role === 'assistant')?.id
  // A clarification choice belongs to the displayed plan. A new expert reply
  // supersedes that plan and opens a fresh choice.
  useEffect(() => {
    setPlanClarificationSelected(false)
  }, [latestAssistantMessageId])
  // Models can ask for materials in free-form prose before a structured
  // planning marker is emitted. Treat that visible request as authoritative;
  // never show the shortcut start action alongside an unresolved question.
  const latestPlanningText = String(latestPlanningReply?.text || '').trim()
  const visibleClarificationRequest = /(?:请|需要|还需|仍需)(?:你|您|用户)?(?:先|继续|进一步)?补充|(?:待澄清|尚未明确|信息不足|请提供(?:需要|相关)?材料)/.test(latestPlanningText)
  const planningClarifying = planningState.phase === 'clarifying' || visibleClarificationRequest
  const hasVisiblePlanConfirmation = Boolean(dynamicPlan && /(?:协作计划|执行计划)[\s\S]*(?:请确认|确认是否按)/.test(String(latestPlanningReply?.text || '')))
  const canConfirmPlan = !planningClarifying && (hasDynamicPlan || hasVisiblePlanConfirmation)
  // 计划一旦展示就保持确认区可见；后台生成状态不能把唯一的执行入口卸载掉。
  const planReady = isDraft && canConfirmPlan
  // 协作计划由下方的结构化确认回合承载。保留此前对话，避免把模型的
  // 原始计划文本和同一份计划卡连续展示两遍。
  const draftDialogueMessages = planReady && latestPlanningReply?.id
    ? expertRoom.messages.filter((message) => message.id !== latestPlanningReply.id)
    : expertRoom.messages
  const stageLabel = startingPlan
    ? '正在启动执行'
    : isDraft && planningClarifying
      ? `等待补充：${planningState.missingField || '关键信息'}`
      : expertCollabStatus(status, hasDynamicPlan)
  const inputNeed = status === 'needs_input'
    ? describeExpertInputNeed(task?.events?.at(-1)?.summary, goal, task?.attention)
    : null
  const taskAction = projectWorkbenchTaskAction({
    status,
    attention: task?.attention,
    planReady: isDraft && canConfirmPlan,
    planningClarifying: isDraft && planningClarifying,
    terminal: Boolean(task?.lifecycle?.terminal),
  })
  const awaitingOperationApproval = taskAction.kind === 'approve_operation'
  const hasTaskAccessAction = Boolean(task?.execRef?.id) && ['approval_required', 'tool_execution_completed', 'tool_approval_expired'].includes(String(task?.attention?.kind || ''))
  const failureNeed = status === 'failed' ? describeExpertFailure(task?.attention) : null
  const activeExecution = ['starting', 'running', 'revising'].includes(status)
  const progressHeartbeat = Date.parse(String(task?.progress?.heartbeatAt || task?.progress?.updatedAt || ''))
  const progressUpdated = Date.parse(String(task?.progress?.updatedAt || ''))
  const heartbeatStale = activeExecution && Number.isFinite(progressHeartbeat) && Date.now() - progressHeartbeat > 18_000
  const waitingForProgress = activeExecution && Number.isFinite(progressUpdated) && Date.now() - progressUpdated > 8_000
  const canCancelExecution = activeExecution && (waitingForProgress || heartbeatStale)
  const elapsed = formatElapsedTime(task?.progress?.startedAt)
  const executionFocus = activeExecution
    ? {
        title: heartbeatStale
          ? '执行进程暂时没有响应'
          : status === 'revising'
            ? '专家修改中'
            : (task?.progress?.label || (status === 'starting' ? '正在检查执行条件' : '专家执行中')),
        detail: [
          heartbeatStale
            ? '最近一次运行心跳已超时，可以取消后重新执行。'
            : waitingForProgress
              ? '执行器仍在工作，正在等待模型或工具返回。'
              : (task?.progress?.detail || '关键判断和工具结果会继续同步到对话中。'),
          elapsed ? `已用时 ${elapsed}` : '',
        ].filter(Boolean).join(' · '),
      }
    : null
  const lifecycle = projectExpertTaskLifecycle({ status, attention: task?.attention })
  const statusFocus = lifecycle.terminal
    ? { title: lifecycle.label, detail: status === 'completed' ? '完成条件已满足，成果与记录已保留。可以继续追问，或发起后续委托。'
      : status === 'cancelled' ? '本次委托已取消，已有记录保留。' : failureNeed?.detail || '本次委托未完成，已有进展和原因已保留。' }
    : inputNeed
    ? { title: inputNeed.title, detail: inputNeed.detail }
    : failureNeed ? { title: failureNeed.title, detail: failureNeed.nextStep }
      : executionFocus
        || (status === 'draft' && planReady
          ? { title: '等待确认计划', detail: '请确认专家提出的协作计划后开始执行。' }
          : status === 'draft' && planningClarifying
            ? { title: stageLabel, detail: '请在下方补充信息，专家会继续澄清目标。' }
            : STATUS_FOCUS[status])
  // 右侧属性栏是协作状态的唯一固定入口，包括终态。
  const showStatusFocus = Boolean(statusFocus)
  const hasPendingReviewCandidate = status === 'review' && deliverables.some((item) => item.acceptanceStatus === 'pending')
  const collabFeed = buildExpertCollabNarrative(
    buildExpertCollabFeed(expertRoom.messages, processEvents, deliverables),
    status,
  )
  const isImageGenerationTask = deliverables.some((item) => isImageDeliverableRecord(item, item.artifactRef ? artifacts[item.artifactRef] : null))
    || Boolean(expertDetail?.outputs.some((item) => expertArtifactKind(item.type) === 'image'))
  const hasImageArtifact = deliverables.some((item) => (
    (item.artifactRefs?.length ? item.artifactRefs : [item.artifactRef]).some((ref) => (
      Boolean(ref && artifacts[ref] && isImageDeliverableRecord(item, artifacts[ref]))
    ))
  ))
  // A generated-image task becomes reviewable only after the current
  // deliverable's real artifact has reached the renderer.  A persisted
  // review state or a text summary alone must never prompt the user to
  // accept an image they cannot inspect.
  const hasPendingReview = hasPendingReviewCandidate && (!isImageGenerationTask || hasImageArtifact)
  // 过程性系统事件可以折叠，但专家写给用户的正常对话必须完整保留。
  // 唯一需要隐藏的是：任务已经失败且没有图片证据时，历史消息仍声称生成成功。
  const visibleCollabFeed = collabFeed.filter((item) => (
    item.kind !== 'moment' || item.moment.role === 'user' || item.moment.active
  ))
  const turnDividerForFeed = (feedIndex: number) => {
    const current = visibleCollabFeed[feedIndex]
    if (current?.kind !== 'message' || current.message.role !== 'assistant' || current.message.streaming) return null
    const earlier = visibleCollabFeed.slice(0, feedIndex)
    const userItem = [...earlier].reverse().find((item) => item.kind === 'message' && item.message.role === 'user')
    if (!userItem || userItem.kind !== 'message') return null
    const userIndex = visibleCollabFeed.lastIndexOf(userItem)
    if (visibleCollabFeed.slice(userIndex + 1, feedIndex)
      .some((item) => item.kind === 'message' && item.message.role === 'assistant')) return null
    return <ExpertTurnDivider elapsedMs={expertTurnElapsedMs(userItem.message, current.message)} />
  }
  const showInteraction = !hasTaskAccessAction && (Boolean(reviewNotice)
    || ['needs_input', 'completed', 'failed', 'cancelled', 'revising'].includes(status)
    || hasPendingReview)
  // A failed attempt ends execution, not the conversation. Follow-ups use the
  // discussion lane; retry remains an explicit action.
  // 审批等待时仍保留讨论通道。讨论消息不会调用 provideInput，也不会批准
  // 操作；它们进入无工具的 expert-discussion 会话，避免用户被卡在审批卡片上。
  const canUseTaskComposer = taskResolved || Boolean(task)
  async function provideInput(
    noteOverride?: string,
    action: 'provide_input' | 'reroute' = 'provide_input',
    queue = activeExecution,
  ) {
    const note = String(noteOverride || '').trim()
    const submitted = useAppStore.getState()
    const fromComposer = action === 'provide_input'
    const attachments = fromComposer ? [...submitted.workbenchDialogue.attachments] : []
    const draft = submitted.workbenchDialogue.composer
    const room = submitted.expertRoom
    if (!task || (!note && !attachments.length) || inputRequestRef.current?.taskId === task.id) return
    const request = { taskId: task.id }
    inputRequestRef.current = request
    const materials = attachments.map((attachment, index) => ({
      ...attachment,
      id: `user-attachment-${Date.now().toString(36)}-${index + 1}`,
      type: attachment.kind || 'text',
      title: attachment.name,
      content: attachment.text || '',
    }))
    try {
      const result = await window.api?.expertTaskProvideInput?.({ taskId: task.id, note, action, queue, materials })
      if (!result?.ok || !result.task || result.task.id !== request.taskId) {
        showToast(result?.error || '未能继续任务，请稍后重试')
        return
      }
      const current = useAppStore.getState()
      const sameRoom = current.expertRoom?.id === room?.id && current.expertRoom?.taskId === room?.taskId
      if (sameRoom) setTask(result.task)
      publishTaskUpdate(result.task)
      if (sameRoom && fromComposer) {
        if (current.workbenchDialogue.composer === draft && draft.trim() === note) setWorkbenchComposer('')
        // Only consume the submitted attachment version. A same-name file may
        // have been replaced while the request was in flight.
        for (const attachment of attachments) {
          const latest = useAppStore.getState().workbenchDialogue.attachments.find(item => item.name === attachment.name)
          if (latest && latest.kind === attachment.kind && latest.text === attachment.text
            && latest.dataUrl === attachment.dataUrl && latest.mimeType === attachment.mimeType) {
            useAppStore.getState().removeWorkbenchAttachment(attachment.name)
          }
        }
      }
      if (result.queued) showToast('已收到补充，当前步骤完成后会自动继续处理')
    } catch {
      showToast('未能继续任务，请稍后重试')
    } finally {
      if (inputRequestRef.current === request) inputRequestRef.current = null
    }
  }

  function sendClarifyingPrompt(prompt: string) {
    setWorkbenchComposer(prompt)
    queueMicrotask(() => useAppStore.getState().sendWorkbenchMessage())
  }

  function sendTaskDiscussion(text: string) {
    const note = String(text || '').trim()
    if (!note) return
    // 审批等待期间固定走 discussion lane。运行时会拒绝 provideInput，
    // 这里明确使用无工具会话，避免追问被误当成授权或重新执行。
    setWorkbenchComposer(note)
    queueMicrotask(() => useAppStore.getState().sendWorkbenchMessage())
  }

  // Structured controls are rendered inside the same dialogue turn as in
  //伙伴模式. Their payload follows the current task lane; selecting an item
  // never creates a second, parallel interaction surface.
  function handleStructuredPick(payload: string, needsInput: boolean) {
    const value = String(payload || '').trim()
    if (!value) return
    setWorkbenchComposer(value)
    if (needsInput) {
      queueMicrotask(() => document.getElementById('agentInput')?.focus())
      return
    }
    if (isDraft) return sendClarifyingPrompt(value)
    if (status === 'needs_input') return void provideInput(value)
    return sendTaskDiscussion(value)
  }

  function sendSopRoutePrompt(route: NonNullable<ExpertWorkbenchDetail['routes']>[number]) {
    const routeName = route.label || route.id
    const routeHint = [route.keywords, route.description].filter(Boolean).join('；')
    sendClarifyingPrompt(`我想处理「${routeName}」。请严格按当前专家 SOP 的「${route.id}」路由规划本次协作${routeHint ? `（${routeHint}）` : ''}，先确认必要范围，再给出待确认计划，不要执行。`)
  }


  function openRequiredCapability() {
    if (!inputNeed || !['open_capability', 'open_settings', 'open_workspace'].includes(inputNeed.action)) return
    if (inputNeed.action === 'open_settings') {
      setRoute('settings')
      return
    }
    if (inputNeed.action === 'open_workspace') {
      if (!filesOpen) toggleFiles()
      return
    }
    setHubTab(/技能|Skill/i.test(inputNeed.item) ? 'skill' : 'connector')
    setHubQuery(inputNeed.item)
    setRoute('capabilities')
  }

  async function continueRequiredExecution() {
    if (!inputNeed || !['retry', 'open_workspace'].includes(inputNeed.action)) return
    await retryTask()
  }

  async function continueWithReroutedSource() {
    if (!inputNeed || inputNeed.action !== 'reroute') return
    const alternative = inputNeed.alternative || '建议的执行路径'
    await provideInput(`确认改用「${alternative}」继续当前任务，并保持原目标。`, 'reroute')
  }

  async function confirmPlan(confirmationText = '') {
    const room = expertRoom
    if (!room || !isDraft || !draftGoal || startingPlan || isGenerating
      || planningClarifying) return
    const expertId = String(room.expertId || room.id)
    const rawOutputs = expertDetail?.outputs?.length
      ? expertDetail.outputs
      : [{ id: 'primary', label: '可验收的专业成果' }]
    const outputs = collapseExpertDocumentOutputs(rawOutputs)
    const conversation = userMessages.map((message) => String(message.text || '').trim()).filter(Boolean).join('\n\n')
    const requestContext = `${draftGoal}\n${conversation}`
    const requestedOutputs = outputs.map((item) => ({
      ...item,
      type: resolveExpertOutputType(item.type, requestContext, item.label),
    }))
    const planToRun = dynamicPlan || {
      goal: draftGoal,
      deliverables: [],
      acceptanceCriteria: [],
      capabilityUse: [],
      steps: ['理解目标与已有材料', '生成可直接使用的专业成果', '根据你的反馈继续完善'],
      risks: [],
    }
    const confirmedPlan = {
      ...planToRun,
      goal: planToRun.goal || draftGoal,
      deliverables: planToRun.deliverables.length
        ? collapseExpertDocumentLabels(planToRun.deliverables)
        : requestedOutputs.map((item) => item.label),
      acceptanceCriteria: planToRun.acceptanceCriteria.length
        ? planToRun.acceptanceCriteria
        : ['目标完整', '结论可核验', '结果可直接使用'],
    }
    const planMaterial = formatExpertPlanMaterial(confirmedPlan)
    const confirmedAt = new Date().toISOString()
    const confirmation = String(confirmationText || '确认计划并执行').trim()
    const launchMessageId = `plan-start-${Date.now()}`
    const planningReply = [...room.messages].reverse()
      .find((message) => message.role === 'assistant' && String(message.text || '').trim())?.text || ''
    const optimisticMessages = [
      ...room.messages,
      ...(confirmation ? [{ id: `plan-confirm-${Date.now()}`, role: 'user' as const, text: confirmation, createdAt: confirmedAt }] : []),
      {
        id: launchMessageId,
        role: 'assistant' as const,
        text: '计划已确认，我正在检查执行能力并启动任务。',
        createdAt: confirmedAt,
      },
    ]
    setStartingPlan(true)
    try {
      const receipt = await window.api?.expertTaskPreparePlanConfirmation?.({
        taskId: room.taskId,
        expertId,
        planningReply,
        plan: confirmedPlan,
      })
      if (!receipt?.ok || !receipt.token) throw new Error(receipt?.error || '计划状态校验失败，请重新整理计划后再确认')
      useAppStore.setState({ expertRoom: { ...room, messages: optimisticMessages } })
      const result = await window.api?.expertTaskCreateStart?.({
        taskId: room.taskId,
        planConfirmationToken: receipt.token,
        title: draftGoal.replace(/\s+/g, ' ').slice(0, 20),
        expertId,
        expertName,
        knowledgeRefs: room.knowledgeRefs,
        brief: {
          completionPolicy: 'review',
          goal: draftGoal,
          materials: [
            ...(conversation ? [{ id: 'clarification-record', type: 'text', title: '需求澄清记录', content: conversation }] : []),
            ...(planMaterial ? [{ id: 'confirmed-plan', type: 'text', title: '已确认的执行计划', content: planMaterial }] : []),
            { id: 'user-plan-confirmation', type: 'user_confirmation', title: '用户确认', content: confirmation },
          ],
          requiresMaterials: expertDetail?.requiresMaterials === true,
          requiredInputs: expertDetail?.inputs.filter((item) => item.required).map((item) => ({ id: item.id, label: item.label })) || [],
          constraints: [],
          plan: confirmedPlan,
          deliverables: requestedOutputs.map((item) => ({ id: item.id, title: item.label, type: item.type || 'answer', required: true })),
        },
      })
      if (!result?.ok || !result.task?.id) throw new Error(result?.error || '任务未能开始')
      const didStart = ['starting', 'running', 'revising'].includes(String(result.task.status || ''))
      const blockedNeed = result.task.status === 'needs_input'
        ? describeExpertInputNeed(result.task.events?.at(-1)?.summary, draftGoal, result.task.attention)
        : null
      const launchText = didStart
        ? '计划已确认，任务已启动；实际操作和成果以执行记录为准。'
        : blockedNeed
          ? `${blockedNeed.title}。${blockedNeed.detail}`
          : `任务未能进入执行：${STATUS_LABEL[String(result.task.status || '')] || result.task.status || '状态未知'}。`
      setTask(result.task)
      setTaskResolved(true)
      const currentRoom = useAppStore.getState().expertRoom
      const currentMessages = currentRoom?.id === room.id ? currentRoom.messages : optimisticMessages
      useAppStore.setState({
        expertRoom: {
          ...(currentRoom?.id === room.id ? currentRoom : room),
          id: result.task.id,
          taskId: result.task.id,
          taskStatus: result.task.status,
          expertId,
          goal: draftGoal,
          messages: currentMessages.map((message) => message.id === launchMessageId
            ? { ...message, text: launchText }
            : message),
        },
      })
      publishTaskUpdate(result.task)
      await loadTasks()
      showToast(didStart
        ? '计划已确认，专家开始执行'
        : (blockedNeed?.title || '任务尚未开始'))
    } catch (error) {
      const message = error instanceof Error ? error.message : '任务未能开始'
      // A failed confirmation is a transient action error, not a new expert
      // turn. Keep it beside the composer so the dialogue remains readable
      // and the user can correct the plan without an alarming fake message.
      setReviewError(message)
      queueMicrotask(() => document.getElementById('agentInput')?.focus())
      showToast(message)
    } finally {
      setStartingPlan(false)
    }
  }

  async function submitDraftMessage(text: string) {
    const attachments = useAppStore.getState().workbenchDialogue.attachments
    const confirmablePlan = canConfirmPlan && !isGenerating
    if (confirmablePlan && !attachments.length && isExpertPlanConfirmation(text)) {
      setWorkbenchComposer('')
      await confirmPlan(text)
      return
    }
    if (!attachments.length && !isExpertClarificationAnswerSufficient(text, planningState)) {
      showToast(planningState.question
        ? `还需要回答：${planningState.question}`
        : `还需要补充「${planningState.missingField || '当前问题的具体内容'}」`)
      queueMicrotask(() => document.getElementById('agentInput')?.focus())
      return
    }
    useAppStore.getState().sendWorkbenchMessage()
  }

  async function review(deliverableId: string, decision: 'accept' | 'changes_requested', commentOverride?: string) {
    if (!task || reviewingAction) return false
    const comment = String(commentOverride || '').trim()
    const attachments = decision === 'changes_requested'
      ? [...useAppStore.getState().workbenchDialogue.attachments]
      : []
    if (decision === 'changes_requested' && !comment && !attachments.length) {
      setReviewError('请先写明需要修改的内容，或附上需要参考的材料。')
      return false
    }
    const actionKey = `${deliverableId}:${decision}`
    setReviewingAction(actionKey)
    setReviewError('')
    setReviewNotice('')
    try {
      const result = await window.api?.expertTaskReviewDeliverable?.({
        taskId: task.id,
        deliverableId,
        decision,
        action: decision === 'accept' ? 'accept' : 'changes_requested',
        comment,
        attachments,
      })
      if (!result?.ok || !result.task) throw new Error(result?.error || '操作未完成，请重试')
      setTask(result.task)
      publishTaskUpdate(result.task)
      setReviewEditorId('')
      const notice = decision === 'accept' ? '' : `修改意见已送达${expertName}。`
      setReviewNotice(notice)
      showToast(decision === 'accept' ? '已确认完成。' : notice)
      return true
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '操作未完成，请重试')
      return false
    } finally {
      setReviewingAction('')
    }
  }

  async function confirmResults() {
    if (!task || reviewingAction) return
    for (const item of deliverables.filter(value => value.acceptanceStatus === 'pending')) {
      if (!await review(String(item.deliverableId), 'accept')) break
    }
  }

  async function submitReviewMessage(text: string) {
    const submittedAttachments = [...useAppStore.getState().workbenchDialogue.attachments]
    if (reviewingAction) return
    if (!text.trim() && !submittedAttachments.length) {
      setReviewError('请先写明需要修改的内容，或附上需要参考的材料。')
      return
    }
    const candidates = deliverables.filter((item) => item.acceptanceStatus === 'pending')
    const mentionedCandidate = candidates.find((item) => {
      const title = String(item.title || '').trim()
      return title && text.includes(title)
    })
    const pending = reviewEditorId
      ? candidates.find((item) => String(item.deliverableId) === reviewEditorId)
      : candidates.length === 1
        ? candidates[0]
        : mentionedCandidate
    if (!pending && candidates.length > 1) {
      setReviewError('请在修改意见中写明要调整的成果名称。')
      return
    }
    if (!pending) {
      useAppStore.getState().sendWorkbenchMessage()
      return
    }
    const submittedDraft = useAppStore.getState().workbenchDialogue.composer
    const revisionText = mentionedCandidate
      ? text.replace(new RegExp(`^\\s*${escapeRegExp(mentionedCandidate.title)}\\s*[：:]\\s*`), '').trim()
      : text
    const succeeded = await review(String(pending.deliverableId), 'changes_requested', revisionText)
    if (succeeded) {
      const dialogue = useAppStore.getState().workbenchDialogue
      if (dialogue.composer === submittedDraft) useAppStore.getState().setWorkbenchComposer('')
      submittedAttachments.forEach((attachment) => {
        if (dialogue.attachments.some((item) => item.name === attachment.name)) {
          useAppStore.getState().removeWorkbenchAttachment(attachment.name)
        }
      })
    }
  }

  function requestRevision(deliverableId: string) {
    setReviewEditorId(deliverableId)
    setReviewError('')
    queueMicrotask(() => document.getElementById('agentInput')?.focus())
  }

  async function retryTask() {
    if (!task) return
    const result = await window.api?.expertTaskRetry?.(task.id).catch(() => null)
    if (!result?.ok || !result.task) {
      showToast(result?.error || '重新执行失败，请稍后重试')
      return
    }
    setTask(result.task)
    if (result.task.id !== task.id && expertRoom) {
      useAppStore.setState({ expertRoom: { ...expertRoom, id: result.task.id, taskId: result.task.id,
        taskStatus: result.task.status, messages: [] } })
    }
    publishTaskUpdate(result.task)
    const retryNeed = result.task.status === 'needs_input'
      ? describeExpertInputNeed(result.task.events?.at(-1)?.summary, goal, result.task.attention)
      : null
    showToast(retryNeed?.title || (['starting', 'running', 'revising'].includes(String(result.task.status || ''))
      ? '已重新执行任务'
      : '任务状态已更新'))
  }

  async function startFollowupCommission() {
    if (!task || startingFollowup) return
    const createTask = window.api?.workbenchTaskCreate
    if (typeof createTask !== 'function') {
      showToast('当前无法创建后续委托')
      return
    }
    setStartingFollowup(true)
    try {
      const expertName = task.expertName || expertRoom?.name || task.expertId || '专家'
      const result = await createTask({
        kind: 'expert',
        projectId: task.projectId || undefined,
        title: `${expertName}（后续委托）`,
        goal: `与${expertName}协作（待填写目标）`,
        expertId: task.expertId,
        expertName,
        status: 'draft',
        taskRef: { id: task.id },
        events: [{ type: 'created', summary: '基于上一委托创建后续委托，等待填写目标' }],
      })
      if (!result?.ok || !result.task?.id) throw new Error(result?.error || '创建后续委托失败')
      await loadTasks()
      useAppStore.getState().openExpertRoom({
        id: result.task.id,
        taskId: result.task.id,
        taskStatus: 'draft',
        expertId: task.expertId,
        name: expertName,
      })
      queueMicrotask(() => document.getElementById('agentInput')?.focus())
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建后续委托失败')
    } finally {
      setStartingFollowup(false)
    }
  }

  async function cancelRunningTask() {
    if (!task) return
    const result = await window.api?.expertTaskCancel?.(task.id).catch(() => null)
    if (!result?.ok || !result.task) {
      showToast(result?.error || '取消任务失败，请稍后重试')
      return
    }
    setTask(result.task)
    publishTaskUpdate(result.task)
    showToast('任务已取消，已有记录已保留')
  }

  async function renameCollaborationTitle(nextTitle: string) {
    const next = nextTitle.trim()
    if (!next) return
    setCollaborationTitleOverride(next)
    if (!task?.id || !window.api?.workbenchTaskUpdate) return
    const result = await window.api.workbenchTaskUpdate(task.id, { title: next }).catch(() => null)
    if (!result?.ok || !result.task) {
      showToast(result?.error || '标题已暂存，但未能同步任务记录')
      return
    }
    setTask(result.task)
    publishTaskUpdate(result.task)
  }

  function requestDeleteTask() {
    if (!task) return
    openConfirm({
      title: '删除本任务？',
      body: '只会清除工作台中的任务记录；已生成的本地文件、会话产物和源目录不会被删除。',
      confirmLabel: '删除任务',
      danger: true,
      onConfirm: async () => {
        if (!['failed', 'cancelled', 'completed'].includes(status)) {
          const cancelled = await window.api?.expertTaskCancel?.(task.id).catch(() => null)
          if (cancelled && cancelled.ok === false) {
            showToast(cancelled.error || '停止任务失败，未删除任务记录')
            return
          }
        }
        const result = await window.api?.workbenchTaskArchive?.(task.id).catch(() => null)
        if (!result?.ok) {
          showToast(result?.error || '删除任务失败，请稍后重试')
          return
        }
        window.dispatchEvent(new CustomEvent('knowme:expert-task-updated'))
        closeExpertRoom()
        showToast('任务记录已删除，本地文件未受影响')
      },
    })
  }

  function proposeWorkflow(mode: 'reuse' | 'overflow') {
    if (!task) return
    const resultLabel = task.deliverables?.map((item) => expertDeliverableDisplayTitle(item.title)).filter(Boolean).join('、') || '本次专家成果'
    openConfirm({
      title: mode === 'reuse' ? '将专家成果加入工作流？' : '改用多专家工作流？',
      body: mode === 'reuse'
        ? `将先创建一个工作流草稿，把「${resultLabel}」作为后续专家节点的输入。创建前不会修改当前专家任务。`
        : `当前事项可能超出单一专家节点的处理边界。将以「${goal || task.title}」创建工作流草稿，由你确认专家和交接关系后再运行。`,
      confirmLabel: '查看工作流草稿',
      onConfirm: () => {
        enterStudioFromExpertTask({
          mode,
          taskId: task.id,
          expertName,
          goal: goal || task.title || '',
          resultLabel,
          resultSummary: task.resultSummary,
        })
        showToast('已创建工作流草稿，请确认至少两位专家与交接关系')
      },
    })
  }

  function renderInteractionTurn() {
    if (!showInteraction) return null
    // 图片只展示媒体；验收状态和操作属于对话，不能塞回图片组件。
    const pendingReviewItems = deliverables.filter((item) => status === 'review' && item.acceptanceStatus === 'pending')
    const reviewSubject = pendingReviewItems.length > 0
      && pendingReviewItems.every((item) => isImageDeliverableRecord(
        item,
        item.artifactRef ? artifacts[item.artifactRef] : null,
      ))
      ? '图片'
      : '交付内容'
    // 已有可打开产物时，卡片状态就是完成反馈，不再追加一段重复的完成说明。
    if (status === 'completed' && deliverables.length > 0) return null
    // All artifact types share the persisted confirmation summary below.
    const interactionMessage = awaitingOperationApproval
      ? '我准备执行一项需要授权的操作。请在下方审批卡中核对并批准或拒绝；你也可以在这里追问原因、修改目标或取消任务，聊天不会自动批准操作。'
      : status === 'revising'
      ? '我已收到修改意见，正在据此准备新的版本。'
      : hasPendingReview
        ? `请查看${reviewSubject}，可以接受成果，也可以在下方输入框告诉我需要修改的地方。`
        : status === 'needs_input'
        ? inputNeed?.action === 'retry'
          ? `本次执行停在「${inputNeed.item}」。任务背景和已有材料已经保留，不需要重复补充，可以直接重新执行。`
          : inputNeed?.action === 'reroute'
            ? `我检查后发现当前执行路径不合适。这项任务应改用「${inputNeed.alternative}」，确认后我会从当前进度继续。`
          : inputNeed?.action === 'open_capability'
            ? `我需要使用「${inputNeed.item}」，但它目前尚未安装、启用或授权。完成后可以从这里继续。`
          : inputNeed?.action === 'open_settings'
            ? `当前缺少「${inputNeed.item}」的运行配置。完成设置后，可以直接回到这里重新执行。`
          : inputNeed?.action === 'open_workspace'
            ? `「${inputNeed.item}」是 KnowMe 内置工具。请确认当前项目目录可写，然后重新执行。`
            : (inputNeed?.question || `继续处理前，我还需要你补充「${inputNeed?.item || '任务所需的信息'}」。`)
        : status === 'completed'
          ? '我已经完成本次协作，成果和相关记录都已整理好。'
          : status === 'cancelled'
            ? '本次协作已取消，已有材料和过程记录仍会保留。'
            : status === 'failed'
              ? failureNeed?.detail || '本次协作未完成，已有材料和修改意见均已保留。'
              : '本次协作状态已更新。'

    return (
        <ExpertTaskConversationTurn
          text={interactionMessage}
          testId="expert-action-turn"
          className="wb-expert-action-turn"
        >
          {reviewNotice ? <div className="wb-review-notice" role="status">{reviewNotice}</div> : null}
          {status === 'needs_input' && inputNeed?.action !== 'provide_input' && !awaitingOperationApproval ? (
            <div className={`wb-delivery-attention is-${inputNeed?.kind || 'information'}`} data-testid="expert-needs-input">
              {awaitingOperationApproval ? null : <dl className="wb-expert-input-need">
                <div>
                  <dt>{inputNeed?.action === 'retry' ? '执行停在' : inputNeed?.action === 'reroute' ? '当前路径' : inputNeed?.action === 'open_capability' ? '缺少能力' : inputNeed?.action === 'open_settings' ? '缺少配置' : inputNeed?.action === 'open_workspace' ? '项目目录' : '需要补充'}</dt>
                  <dd>{inputNeed?.item}</dd>
                </div>
                <div>
                  <dt>{inputNeed?.action === 'reroute' ? '改用' : '下一步'}</dt>
                  <dd>{inputNeed?.action === 'reroute' ? inputNeed.alternative : inputNeed?.nextStep}</dd>
                </div>
              </dl>}
              {inputNeed?.issues && inputNeed.issues.length > 1 ? (
                <div className="wb-expert-input-issues" aria-label="未就绪的执行条件">
                  <strong>本次执行还缺少</strong>
                  <ul>
                    {inputNeed.issues.map((issue, index) => (
                      <li key={`${issue.code || 'issue'}-${issue.id}-${index}`}>
                        <span>{issue.id}</span>
                        <small>{issue.detail}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="wb-expert-terminal-actions">
                {awaitingOperationApproval ? null : inputNeed?.action === 'reroute' ? (
                  <button type="button" className="wb-modal-btn primary" onClick={() => void continueWithReroutedSource()}>确认建议路径</button>
                ) : inputNeed?.action === 'retry' ? (
                  <button type="button" className="wb-modal-btn primary" onClick={() => void continueRequiredExecution()}>{task?.attention?.kind === 'tool_execution_completed' ? '基于执行结果继续' : task?.attention?.kind === 'tool_approval_expired' ? '重新生成操作审批' : '重新执行'}</button>
                ) : inputNeed?.action === 'open_capability' || inputNeed?.action === 'open_settings' ? (
                  <button type="button" className="wb-modal-btn primary" onClick={openRequiredCapability}>{inputNeed.action === 'open_settings' ? '前往设置' : '前往能力中心'}</button>
                ) : inputNeed?.action === 'open_workspace' ? (
                  <>
                    <button type="button" className="wb-modal-btn primary" onClick={() => void continueRequiredExecution()}>重新检查并执行</button>
                    <button type="button" className="wb-modal-btn wb-modal-btn-secondary" onClick={openRequiredCapability}>选择项目目录</button>
                  </>
                ) : null}
              </div>
            </div>
          ) : status === 'completed' ? (
            <div className="wb-expert-completion-summary">
              <div className="wb-expert-completion-heading">
                <div><strong>成果已就绪</strong><span>{deliverables.length ? '成果物已同步到右侧，可随时打开查看。' : '专家已完成回复，内容已保留在上方对话中。'}</span></div>
                <span className="wb-expert-completion-count">{deliverables.length} 项</span>
              </div>
              <button type="button" className="wb-expert-workflow-glyph" title="加入工作流" aria-label="加入工作流" onClick={() => proposeWorkflow('reuse')}><Icon name="externalLink" /></button>
            </div>
          ) : status === 'cancelled' ? (
            <div className="wb-expert-dialogue-suggestion" aria-label="专家建议">
              <span>已有记录已保留</span>
            </div>
          ) : status === 'failed' ? (
            <>
              <p className="wb-expert-action-message wb-expert-failure-followup">已有成果和修改意见已保留，你可以直接说明调整方向，或采用下方建议继续。</p>
              <div className="wb-expert-dialogue-suggestion" aria-label="专家建议">
                <span>建议操作</span>
                <button type="button" className="wb-expert-suggestion-button" onClick={() => void retryTask()}>重新执行</button>
              </div>
            </>
          ) : status === 'revising' ? (
            <div className="wb-expert-dialogue-suggestion" aria-label="专家建议">
              <span>建议操作</span>
              <button type="button" className="wb-expert-suggestion-button" onClick={() => void retryTask()}>继续修改</button>
            </div>
          ) : hasPendingReview && task ? (
            <>
              <ExpertCompletionSummary task={task} artifacts={artifacts} onOpenImage={(deliverableId, imageId) => {
                setPreviewDeliverableId(deliverableId)
                setPreviewImageId(imageId)
              }} onConfirm={() => void confirmResults()} confirming={!!reviewingAction} />
            </>
          ) : null}
        </ExpertTaskConversationTurn>
    )
  }

  const planDecisionTurn = !planReady ? null : (
    <ExpertTaskConversationTurn
      text={`我已整理本次计划。确认后将按以下 ${dynamicPlanSteps.length} 步推进；如需调整，请选择继续澄清后在输入框补充。`}
      testId="expert-plan-decision-turn"
      className="wb-expert-plan-turn"
    >
      <section className="wb-expert-plan-card" aria-labelledby="expertPlanTitle">
        <header>
          <div><span>下一步需要你确认</span><h2 id="expertPlanTitle">建议按 {dynamicPlanSteps.length} 步执行</h2></div>
          <small>{planClarificationSelected ? '等待补充' : '待确认'}</small>
        </header>
        <details className="wb-expert-plan-details">
          <summary>查看目标、交付与验收标准</summary>
          <dl>
            <div><dt>目标</dt><dd>{dynamicPlan?.goal || draftGoal}</dd></div>
            <div><dt>交付</dt><dd>{dynamicPlan?.deliverables.join('、') || expertDetail?.outputs?.map((item) => item.label).join('、') || '可验收的专业成果'}</dd></div>
            <div><dt>完成条件</dt><dd>{dynamicPlan?.acceptanceCriteria.join('、') || '目标完整、结论可核验、结果可直接使用'}</dd></div>
            {dynamicPlan?.capabilityUse.length ? <div><dt>能力</dt><dd>{dynamicPlan.capabilityUse.join('、')}</dd></div> : null}
          </dl>
        </details>
        <ol aria-label="本次执行步骤">
          {dynamicPlanSteps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><strong>{step}</strong></li>)}
        </ol>
        <footer>
          <button type="button" className="wb-modal-btn" disabled={planClarificationSelected || startingPlan || isGenerating} onClick={() => {
            setPlanClarificationSelected(true)
            queueMicrotask(() => document.getElementById('agentInput')?.focus())
          }}>{planClarificationSelected ? '已选择继续澄清' : '继续澄清'}</button>
          <button type="button" className="wb-modal-btn primary" disabled={planClarificationSelected || startingPlan || isGenerating} onClick={() => void confirmPlan('确认计划并执行')}>{startingPlan ? '正在开始…' : isGenerating ? '正在处理…' : '确认计划并执行'}</button>
        </footer>
      </section>
    </ExpertTaskConversationTurn>
  )

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('expert-chat')}
        title={collaborationTitle}
        onTitleChange={(nextTitle) => void renameCollaborationTitle(nextTitle)}
        onBack={closeExpertRoom}
        backLabel={workbenchTaskBackLabel('expert-chat')}
      />
      <main className="wb-expert-workspace is-details-open has-edge-scroll" data-testid="expert-room" aria-label="专家协作工作区">
         <section className="wb-expert-review-pane is-flat" data-testid="expert-delivery-room" aria-label="执行过程与成果">
          <div className="wb-expert-main-rail">
          <div
            ref={dialogueScrollRef}
            className="wb-expert-pane-content"
            data-testid="expert-dialogue-scroll"
            onScroll={trackDialogueScroll}
          >
            {!taskResolved ? (
              <div className="wb-expert-history-placeholder" role="status" aria-label="正在加载协作信息">
                <span>正在加载协作信息</span>
                <div aria-hidden="true"><i /><i /><i /></div>
              </div>
            ) : isDraft ? (
              <section className="wb-expert-draft-room" role="tabpanel" aria-label="需求澄清与计划">
                <ExpertCollabDialogue
                  expert={expertItem}
                  messages={draftDialogueMessages}
                  generating={isGenerating}
                  composer={false}
                  onStructuredPick={handleStructuredPick}
                  afterMessages={planDecisionTurn}
                  initialOptions={!firstUserMessage ? expertDetail?.routes || [] : []}
                  onInitialOption={sendSopRoutePrompt}
                />
              </section>
            ) : (
              <section className={isImageGenerationTask ? 'wb-expert-image-conversation' : undefined} aria-label={showInteraction ? '专家协作记录' : '协作过程'}>
                <h2 className="wb-sr-only">专家协作记录</h2>
                <ExpertConversationTimeline className="wb-expert-process-list wb-expert-collab-list" label="专家协作记录" testId="expert-collab-log">
                    {visibleCollabFeed.length === 0 && !historyLoading && !hasTaskAccessAction ? (
                      <li className="wb-expert-collab-empty">
                        <Icon name="commentThread" />
                        <strong>专家会在这里同步关键判断</strong>
                        <span>工作路径、需要你决定的事项和最终结果会作为协作对话保留。</span>
                      </li>
                    ) : null}
                    {visibleCollabFeed.map((feedItem, feedIndex) => {
                      if (feedItem.kind === 'message') {
                        return <Fragment key={`message-${feedItem.message.id || feedIndex}`}>
                          {turnDividerForFeed(feedIndex)}
                          <ExpertDialogueMessage
                            expert={expertItem}
                            message={feedItem.message}
                            interactiveStructuredUi={feedItem.message.id === latestAssistantMessageId && !isGenerating}
                            onStructuredPick={handleStructuredPick}
                          />
                        </Fragment>
                      }
                      if (feedItem.kind === 'moment') {
                        return <ExpertNarrativeMomentView key={feedItem.moment.id} moment={feedItem.moment} expert={expertItem} expertName={expertName} />
                      }
                      const item = feedItem.deliverable
                      const artifact = item.artifactRef ? artifacts[item.artifactRef] : null
                      const isImageDeliverable = isImageDeliverableRecord(item, artifact)
                      // The completion summary is the single image surface during
                      // acceptance. Keep document rows here because they retain
                      // their normal review actions and content context.
                      if (hasPendingReview && isImageDeliverable) return null
                      const revising = item.acceptanceStatus === 'changes_requested' && ['revising', 'running'].includes(status)
                      if (isImageDeliverable) {
                        const refs = item.artifactRefs?.length ? item.artifactRefs : [item.artifactRef].filter(Boolean) as string[]
                        const previews = refs.map((ref, index) => imagePreviewItem(
                          { ...item, deliverableId: `${item.deliverableId || 'image'}:${ref || index + 1}`, artifactRef: ref },
                          artifacts[ref],
                          undefined,
                          Boolean(artifactLoading[ref]),
                        ))
                        return (
                          <li className="wb-expert-feed-deliverable is-image" data-feed-kind="deliverable" key={`${item.deliverableId}-${item.version}`}>
                            {(item.version || 1) > 1 && item.comments?.at(-1)?.body ? <div className="wb-expert-revision-note"><strong>本次修改</strong><span>{item.comments.at(-1)?.body}</span></div> : null}
                            <ExpertImagePreview images={previews} onOpen={(index) => {
                              setPreviewDeliverableId(String(item.deliverableId))
                              setPreviewImageId(previews[index]?.id || '')
                            }} />
                          </li>
                        )
                      }
                      const replyBody = plainReplyBody(item, artifact)
                      if (replyBody) {
                        // Answer deliverables are backed by the same assistant turn that
                        // produced them. Showing both sources makes a reopened task look
                        // like the expert replied twice. Keep the conversational message
                        // as the canonical presentation and retain the deliverable only
                        // for its acceptance metadata/actions below.
                        if (isAnswerAlreadyShown(expertRoom.messages, replyBody)) return null
                        return (
                          <li className="wb-expert-feed-deliverable is-reply" data-feed-kind="deliverable" key={`${item.deliverableId}-${item.version}`}>
                            <ExpertDeliverableArtifact
                              artifact={artifact}
                              fallback={task?.resultSummary}
                              title={expertDeliverableDisplayTitle(item.title)}
                              type={item.type}
                              version={item.version}
                              showToolbar={false}
                              presentation="reply"
                            />
                          </li>
                        )
                      }

                      const title = expertDeliverableDisplayTitle(item.title)
                      const target = String(artifact?.targetPath || artifact?.meta?.path || '').trim()
                      const loading = Boolean(item.artifactRef && artifactLoading[item.artifactRef])
                      const actions: ArtifactPreviewAction[] = ['open']

                      const preview = createArtifactPreviewContract({
                        id: String(item.deliverableId),
                        type: isImageDeliverable ? 'image' : item.type || artifact?.type,
                        title,
                        source: isImageDeliverable ? imagePreviewSource(artifact, artifact?.body || '') : target,
                        fileName: target ? conversationFileName(target) : undefined,
                        version: item.version,
                        state: loading
                          ? 'loading'
                          : item.acceptanceStatus === 'not_required'
                            ? 'ready'
                            : item.acceptanceStatus === 'accepted'
                            ? 'accepted'
                            : revising
                              ? 'revising'
                              : item.acceptanceStatus === 'changes_requested'
                                ? 'rejected'
                                : 'pending',
                        actions,
                      })
                      const handleArtifactAction = (action: ArtifactPreviewAction) => {
                        const deliverableId = String(item.deliverableId)
                        if (action === 'open') return setPreviewDeliverableId(deliverableId)
                        if (action === 'accept') return void review(deliverableId, 'accept')
                        if (action === 'revise') {
                          requestRevision(deliverableId)
                        }
                      }
                      return (
                        <li className="wb-expert-feed-deliverable" data-feed-kind="deliverable" key={`${item.deliverableId}-${item.version}`}>
                          {(item.version || 1) > 1 && item.comments?.at(-1)?.body ? <div className="wb-expert-revision-note"><strong>本次修改</strong><span>{item.comments.at(-1)?.body}</span></div> : null}
                          <ArtifactPreview
                            artifact={preview}
                            excerpt={artifact?.body || task?.resultSummary || ''}
                            onAction={handleArtifactAction}
                          />
                        </li>
                      )
                    })}
                    {isGenerating && !expertRoom.messages.some((message) => message.streaming) ? <ExpertDialoguePending /> : null}
                    {hasTaskAccessAction && task?.execRef?.id ? (
                      <ExpertTaskConversationTurn
                        text={task.attention?.kind === 'tool_approval_expired'
                          ? '上一次操作审批已失效。请重新生成本次操作的审批；旧请求不会被执行。'
                          : task.attention?.kind === 'tool_execution_completed'
                            ? '本次操作已执行并记录。请基于执行结果继续，系统不会重复执行该操作。'
                            : '我准备执行一项需要授权的操作。请核对本次操作后批准或拒绝；你也可以继续追问原因、修改目标或取消任务，聊天不会自动批准操作。'}
                        testId="expert-approval-turn"
                        className="wb-expert-action-turn"
                      >
                        <ExpertTaskAccess key={`${task.id}:${task.execRef.id}`} task={task} />
                      </ExpertTaskConversationTurn>
                    ) : null}
                    {diagnostics ? (
                      <li className="wb-expert-diagnostics-turn" data-feed-kind="diagnostics">
                        <ExpertTaskDiagnostics snapshot={diagnostics} />
                      </li>
                    ) : null}
                    {renderInteractionTurn()}
                  </ExpertConversationTimeline>
              </section>
            )}
            {taskResolved && historyLoading ? (
              <div className={`wb-expert-history-placeholder${expertRoom.messages.some(message => !message.id?.startsWith('sys-')) ? ' is-compact' : ''}`} role="status" aria-label="正在加载历史对话">
                <span>正在加载历史对话</span>
                {!expertRoom.messages.some(message => !message.id?.startsWith('sys-')) ? <div aria-hidden="true"><i /><i /><i /></div> : null}
              </div>
            ) : null}
          </div>
          {lifecycle.terminal && status !== 'failed' ? (
            <div className="wb-expert-terminal-actions">
              <button type="button" className="wb-modal-btn primary" disabled={startingFollowup} onClick={() => void startFollowupCommission()}>{startingFollowup ? '正在创建…' : '开始后续委托'}</button>
            </div>
          ) : null}
          {canUseTaskComposer ? (
            <div className="wb-expert-composer-dock" ref={composerDockRef}>
              {hasPendingReview && reviewEditorId ? (
                <div className="wb-expert-revision-target" role="status">
                  <span>修改：{expertDeliverableDisplayTitle(deliverables.find((item) => String(item.deliverableId) === reviewEditorId)?.title)}</span>
                  <button type="button" className="wb-modal-btn" disabled={!!reviewingAction} onClick={() => { setReviewEditorId(''); setReviewError('') }}>取消选择</button>
                </div>
              ) : null}
              {reviewError ? <div className="wb-expert-composer-error wb-review-error" role="alert">{reviewError}</div> : null}
              <AgentComposer
                surface="workbench"
                placeholder={hasPendingReview
                  ? '直接告诉专家需要修改的地方… @ 选文件'
                  : isDraft && planningState.phase === 'clarifying' && planningState.question
                    ? '补充信息或回答上方问题… @ 选文件'
                    : isDraft
                      ? '回答专家的问题，或补充目标和材料… @ 选文件'
                      : activeExecution
                        ? '可补充方向或材料；当前步骤完成后会自动继续… @ 选文件'
                        : status === 'failed' ? '询问失败原因或讨论调整方案… @ 选文件'
                          : awaitingOperationApproval ? '追问原因、修改要求或取消任务；发送不会批准操作…'
                            : lifecycle.terminal ? '继续追问或输入新的问题…' : inputNeed?.composerPlaceholder || '补充材料或回答专家的问题… @ 选文件'}
                onSubmit={awaitingOperationApproval
                  ? sendTaskDiscussion
                  : status === 'failed'
                    ? sendTaskDiscussion
                  : status === 'needs_input'
                  ? (text) => provideInput(text)
                  : activeExecution
                    ? (text) => provideInput(text, 'provide_input', true)
                    : hasPendingReview ? submitReviewMessage
                      : isDraft ? submitDraftMessage : () => useAppStore.getState().sendWorkbenchMessage()}
                allowSubmitWhileGenerating={activeExecution}
                allowEmptySubmit={hasPendingReview}
              />
            </div>
          ) : null}
          </div>
        </section>
         <ExpertTaskCapabilities
           task={task}
           stageLabel={stageLabel}
           goal={goal}
           goalConfirmed={goalConfirmed}
           status={showStatusFocus ? { title: statusFocus.title, waiting: waitingForProgress, canCancel: canCancelExecution, onCancel: () => void cancelRunningTask() } : undefined}
           sop={expertDetail?.sop || ''}
           expert={expertItem}
           onOpenDeliverable={setPreviewDeliverableId}
           onDelete={task ? requestDeleteTask : undefined}
         />
      </main>
      {previewDeliverable && isImageDeliverableRecord(previewDeliverable, previewArtifact) ? (
        <ExpertImagePreviewDialog
          images={imagePreviewItems}
          initialIndex={previewImageIndex >= 0 ? previewImageIndex : 0}
          onClose={() => { setPreviewDeliverableId(''); setPreviewImageId('') }}
        />
      ) : previewDeliverable ? (
        <ExpertArtifactPreviewDialog
          item={previewDeliverable}
          artifact={previewDeliverable.artifactRef ? artifacts[previewDeliverable.artifactRef] : null}
          fallback={task?.resultSummary}
          loading={Boolean(previewDeliverable.artifactRef && artifactLoading[previewDeliverable.artifactRef])}
          onClose={() => setPreviewDeliverableId('')}
        />
      ) : null}
    </>
  )
}
