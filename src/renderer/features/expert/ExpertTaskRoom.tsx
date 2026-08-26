import { useEffect, useState } from 'react'
import type { AgentRunArtifact, AgentSession, CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { workbenchTaskBackLabel, workbenchTaskModeLabel } from '../../../domain/workbench-task-room'
import { parseExpertArtifactRef } from '../../../domain/expert-artifact'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { expertDeliverableTitle, expertDisplayName } from '../../../domain/expert-present'
import { ExpertArtifactPreviewDialog } from './ExpertArtifactPreviewDialog'
import { ExpertAvatarMark } from './ExpertAvatarMark'
import { ExpertDeliverableArtifact } from './ExpertDeliverableArtifact'
import { ExpertTaskCapabilities } from './ExpertTaskCapabilities'
import { ExpertTaskTimeline } from './ExpertTaskTimeline'
import { ExpertCollabDialogue } from './ExpertCollabDialogue'
import { ExpertCollabStageRail, expertCollabStage } from './ExpertCollabStageRail'
import { AgentComposer } from '../assistant/AgentComposer'
import { parseExpertWorkbenchDetail, type ExpertWorkbenchDetail } from '../../../domain/expert-workbench-detail'
import { buildExpertDiscussionContext } from '../../../domain/expert-discussion'
import { extractExpertPlanSteps, formatExpertPlanMaterial } from '../../../domain/expert-collab-plan'
import { describeExpertInputNeed } from '../../../domain/expert-input-need'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', starting: '正在预检', needs_input: '等待补充', running: '专家执行中',
  review: '等待验收', revising: '修改中', completed: '已完成', failed: '执行失败', cancelled: '已取消',
}

const STATUS_FOCUS: Record<string, { title: string; detail: string }> = {
  failed: { title: '本次执行未完成', detail: '执行证据和失败原因保留在任务记录中。' },
  cancelled: { title: '任务已取消', detail: '已产生的任务记录仍可查看。' },
}

function publishTaskUpdate(task: WorkbenchTask) {
  window.dispatchEvent(new CustomEvent('knowme:expert-task-updated', { detail: task }))
}

export function ExpertTaskRoom() {
  const expertRoom = useAppStore((s) => s.expertRoom)
  const closeExpertRoom = useAppStore((s) => s.closeExpertRoom)
  const openConfirm = useAppStore((s) => s.openConfirm)
  const enterStudioFromExpertTask = useAppStore((s) => s.enterStudioFromExpertTask)
  const showToast = useAppStore((s) => s.showToast)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const hubItems = useAppStore((s) => s.hubItems)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const setWorkbenchComposer = useAppStore((s) => s.setWorkbenchComposer)
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const setHubQuery = useAppStore((s) => s.setHubQuery)
  const [task, setTask] = useState<WorkbenchTask | null>(null)
  const [taskResolved, setTaskResolved] = useState(false)
  const [startingPlan, setStartingPlan] = useState(false)
  const [expertDetail, setExpertDetail] = useState<ExpertWorkbenchDetail | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewingAction, setReviewingAction] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewNotice, setReviewNotice] = useState('')
  const [artifacts, setArtifacts] = useState<Record<string, AgentRunArtifact>>({})
  const [artifactLoading, setArtifactLoading] = useState<Record<string, boolean>>({})
  const [previewDeliverableId, setPreviewDeliverableId] = useState('')
  const [reviewEditorId, setReviewEditorId] = useState('')

  async function load() {
    if (!expertRoom?.id) return
    const result = await window.api?.expertTaskGet?.(expertRoom.taskId || expertRoom.id).catch(() => null)
    setTask(result?.task || null)
    setTaskResolved(true)
  }

  useEffect(() => {
    setTaskResolved(false)
    void load()
    if (!expertRoom?.id) return undefined
    if (!expertRoom.taskId) return undefined
    const timer = window.setInterval(() => void load(), 1600)
    return () => window.clearInterval(timer)
  }, [expertRoom?.id, expertRoom?.taskId])

  useEffect(() => {
    if (!expertRoom) return
    const expertId = String(task?.expertId || expertRoom.expertId || expertRoom.id)
    const fallback = hubItems.find((item) => item.id === expertId) || ({ id: expertId, name: expertRoom.name, kind: 'expert' } as CapabilityItem)
    setExpertDetail(parseExpertWorkbenchDetail(null, fallback))
    let active = true
    void window.api?.expertGet?.(expertId).then((result) => {
      if (active) setExpertDetail(parseExpertWorkbenchDetail(result, fallback))
    }).catch(() => null)
    return () => { active = false }
  }, [expertRoom?.expertId, expertRoom?.id, expertRoom?.name, hubItems, task?.expertId])

  const artifactSignature = (task?.deliverables || [])
    .map((item) => String(item.artifactRef || '').trim())
    .filter(Boolean)
    .join('|')

  useEffect(() => {
    const refs = [...new Set((task?.deliverables || [])
      .map((item) => String(item.artifactRef || '').trim())
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
        expertId: current.expertId || task.expertId || current.id,
        discussionContext,
      },
    })
  }, [task, artifacts, expertRoom?.id])

  if (!expertRoom) return null
  const isDraft = taskResolved && !task && !expertRoom.taskId
  const status = isDraft ? 'draft' : String(task?.status || 'starting')
  const expertName = expertDisplayName(task?.expertName || expertRoom.name)
  const expertId = String(task?.expertId || expertRoom.expertId || expertRoom.id)
  const expertItem = hubItems.find((item) => item.id === expertId)
    || ({ id: expertId, name: expertName, kind: 'expert', description: expertDetail?.description || '' } as CapabilityItem)
  const userMessages = expertRoom.messages.filter((message) => message.role === 'user' && String(message.text || '').trim())
  const firstUserMessage = userMessages[0]
  const draftGoal = String(expertRoom.goal || firstUserMessage?.text || '').trim()
  const goal = task?.brief?.goal || task?.goal || draftGoal
  const deliverables = task?.deliverables || []
  const processEvents = task?.events || []
  const hasActiveProcessStep = ['starting', 'running', 'revising'].includes(status)
  const previewDeliverable = deliverables.find((item) => String(item.deliverableId) === previewDeliverableId) || null
  const dynamicPlanSteps = extractExpertPlanSteps(expertRoom.messages)
  const hasDynamicPlan = dynamicPlanSteps.length >= 2
  const planReady = isDraft && hasDynamicPlan && !isGenerating
  const stageIndex = expertCollabStage(status, hasDynamicPlan)
  const stageLabel = ['澄清需求', '确认计划', '专业执行', '验收结果', '任务完成'][stageIndex]
  const inputNeed = status === 'needs_input'
    ? describeExpertInputNeed(task?.events?.at(-1)?.summary, goal)
    : null
  const statusFocus = inputNeed
    ? { title: inputNeed.title, detail: inputNeed.detail }
    : STATUS_FOCUS[status]
  const showStatusFocus = Boolean(statusFocus)
  const hasPendingReview = deliverables.some((item) => item.acceptanceStatus === 'pending')
  const showInteraction = Boolean(reviewNotice)
    || ['needs_input', 'completed', 'failed', 'revising'].includes(status)
    || hasPendingReview

  async function provideInput(noteOverride?: string) {
    const note = String(noteOverride || '').trim()
    if (!task || !note) return
    const result = await window.api?.expertTaskProvideInput?.({ taskId: task.id, note }).catch(() => null)
    if (!result?.task) {
      showToast(result?.error || '未能继续任务，请稍后重试')
      return
    }
    if (result?.task) {
      setTask(result.task)
      publishTaskUpdate(result.task)
    }
    setWorkbenchComposer('')
  }

  function sendClarifyingPrompt(prompt: string) {
    setWorkbenchComposer(prompt)
    queueMicrotask(() => useAppStore.getState().sendWorkbenchMessage())
  }

  function focusComposerWith(text: string) {
    setWorkbenchComposer(text)
    queueMicrotask(() => document.getElementById('agentInput')?.focus())
  }

  function openRequiredCapability() {
    if (!inputNeed || inputNeed.kind !== 'capability') return
    setHubTab(/技能|Skill/i.test(inputNeed.item) ? 'skill' : 'connector')
    setHubQuery(inputNeed.item)
    setRoute('capabilities')
  }

  async function continueRequiredExecution() {
    if (!inputNeed || inputNeed.kind !== 'execution') return
    await provideInput(`请先完成「${inputNeed.item}」，并基于真实读取结果继续执行。`)
  }

  async function continueWithReroutedSource() {
    if (!inputNeed || inputNeed.kind !== 'reroute') return
    await provideInput(`不要进行「${inputNeed.item}」。请改用已授权的飞书连接器读取${inputNeed.alternative || '任务所需内容'}，并按原目标继续。`)
  }

  async function confirmPlan() {
    const room = expertRoom
    if (!room || !isDraft || !draftGoal || startingPlan) return
    const expertId = String(room.expertId || room.id)
    const outputs = expertDetail?.outputs?.length
      ? expertDetail.outputs
      : [{ id: 'primary', label: '可验收的专业成果' }]
    const conversation = userMessages.map((message) => String(message.text || '').trim()).filter(Boolean).join('\n\n')
    const planMaterial = formatExpertPlanMaterial(dynamicPlanSteps)
    setStartingPlan(true)
    try {
      const result = await window.api?.expertTaskCreateStart?.({
        title: draftGoal.replace(/\s+/g, ' ').slice(0, 20),
        expertId,
        expertName,
        knowledgeRefs: room.knowledgeRefs,
        brief: {
          goal: draftGoal,
          materials: [
            ...(conversation ? [{ id: 'clarification-record', type: 'text', title: '需求澄清记录', content: conversation }] : []),
            ...(planMaterial ? [{ id: 'confirmed-plan', type: 'text', title: '已确认的执行计划', content: planMaterial }] : []),
          ],
          requiresMaterials: expertDetail?.requiresMaterials === true,
          constraints: [],
          deliverables: outputs.map((item) => ({ id: item.id, title: item.label, type: 'document', required: true })),
        },
      })
      if (!result?.ok || !result.task?.id) throw new Error(result?.error || '任务未能开始')
      setTask(result.task)
      setTaskResolved(true)
      useAppStore.setState({
        expertRoom: {
          ...room,
          id: result.task.id,
          taskId: result.task.id,
          expertId,
          goal: draftGoal,
          messages: [
            ...room.messages,
            { id: `plan-${Date.now()}`, role: 'assistant', text: '计划已确认。我会按约定执行，并在需要你判断时停下来。' },
          ],
        },
      })
      publishTaskUpdate(result.task)
      await loadTasks()
      showToast('计划已确认，专家开始执行')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '任务未能开始')
    } finally {
      setStartingPlan(false)
    }
  }

  async function review(deliverableId: string, decision: 'accept' | 'changes_requested') {
    if (!task) return
    const comment = reviewComment.trim()
    if (decision === 'changes_requested' && !comment) {
      setReviewError('请先写明需要修改的内容，专家会按这条意见继续工作。')
      return
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
      })
      if (!result?.ok || !result.task) throw new Error(result?.error || '操作未完成，请重试')
      setTask(result.task)
      publishTaskUpdate(result.task)
      setReviewComment('')
      setReviewEditorId('')
      const notice = decision === 'accept'
        ? '成果已接受，任务状态已更新。'
        : `修改意见已送达${expertName}，专家正在准备下一版。`
      setReviewNotice(notice)
      showToast(notice)
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '操作未完成，请重试')
    } finally {
      setReviewingAction('')
    }
  }

  async function retryTask() {
    if (!task) return
    const result = await window.api?.expertTaskRetry?.(task.id).catch(() => null)
    if (!result?.ok || !result.task) {
      showToast(result?.error || '重新执行失败，请稍后重试')
      return
    }
    setTask(result.task)
    publishTaskUpdate(result.task)
    showToast('已重新执行任务')
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
    const resultLabel = task.deliverables?.map((item) => expertDeliverableTitle(item.title)).filter(Boolean).join('、') || '本次专家成果'
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
    const interactionTitle = hasPendingReview
      ? '请验收成果'
      : status === 'needs_input'
        ? inputNeed?.kind === 'execution'
          ? '补做读取后继续'
          : inputNeed?.kind === 'reroute'
            ? '调整路径后继续'
          : inputNeed?.kind === 'capability'
            ? '启用后继续'
            : '补充后继续'
        : status === 'completed'
          ? '成果已完成'
          : status === 'failed'
            ? '执行未完成'
            : '继续修改'

    return (
      <div className="wb-expert-action-turn" data-testid="expert-action-turn">
        <span className="wb-expert-process-actor" aria-hidden="true">
          <span className="wb-expert-system-mark"><Icon name="check" /></span>
        </span>
        <section className="wb-expert-hil-panel" aria-labelledby="expertInteractionTitle">
          <div className="wb-expert-hil-heading">
            <h2 id="expertInteractionTitle">{interactionTitle}</h2>
          </div>
          {reviewNotice ? <div className="wb-review-notice" role="status">{reviewNotice}</div> : null}
          {status === 'needs_input' ? (
            <div className={`wb-delivery-attention is-${inputNeed?.kind || 'information'}`} data-testid="expert-needs-input">
              <dl className="wb-expert-input-need">
                <div>
                  <dt>{inputNeed?.kind === 'execution' ? '尚未完成' : inputNeed?.kind === 'reroute' ? '无需' : inputNeed?.kind === 'capability' ? '缺少能力' : '需要补充'}</dt>
                  <dd>{inputNeed?.item}</dd>
                </div>
                <div>
                  <dt>{inputNeed?.kind === 'reroute' ? '改用' : '下一步'}</dt>
                  <dd>{inputNeed?.kind === 'reroute' ? inputNeed.alternative : inputNeed?.nextStep}</dd>
                </div>
              </dl>
              <div className="wb-expert-terminal-actions">
                {inputNeed?.kind === 'reroute' ? (
                  <button type="button" className="wb-modal-btn primary" onClick={() => void continueWithReroutedSource()}>改用飞书内容继续</button>
                ) : inputNeed?.kind === 'execution' ? (
                  <>
                    <button type="button" className="wb-modal-btn primary" onClick={() => void continueRequiredExecution()}>继续执行读取</button>
                    <button type="button" className="wb-modal-btn" onClick={() => focusComposerWith(`不再执行${inputNeed.item}，请仅根据现有材料继续完成任务。`)}>仅用现有材料</button>
                  </>
                ) : inputNeed?.kind === 'capability' ? (
                  <>
                    <button type="button" className="wb-modal-btn primary" onClick={openRequiredCapability}>前往能力中心</button>
                    <button type="button" className="wb-modal-btn" onClick={() => focusComposerWith(`不使用${inputNeed.item}，请调整方案并继续。`)}>调整任务要求</button>
                  </>
                ) : (
                  <button type="button" className="wb-modal-btn primary" onClick={() => focusComposerWith('')}>在下方补充</button>
                )}
              </div>
            </div>
          ) : status === 'completed' ? (
            <div className="wb-expert-reuse">
              <div><strong>继续流转成果</strong><span>将已验收成果作为后续流程输入。</span></div>
              <button type="button" className="wb-modal-btn" onClick={() => proposeWorkflow('reuse')}>加入工作流</button>
            </div>
          ) : status === 'failed' ? (
            <div className="wb-expert-reuse is-overflow">
              <div><strong>本次执行未完成</strong><span>可以重试，或改用多专家流程。</span></div>
              <div className="wb-expert-terminal-actions">
                <button type="button" className="wb-modal-btn primary" onClick={() => void retryTask()}>重新执行</button>
                <button type="button" className="wb-modal-btn" onClick={() => proposeWorkflow('overflow')}>转为工作流</button>
              </div>
            </div>
          ) : status === 'revising' ? (
            <div className="wb-expert-reuse is-overflow">
              <div><strong>继续生成新版本</strong><span>上次修改未完成，可从保留的意见和产物继续执行。</span></div>
              <button type="button" className="wb-modal-btn primary" onClick={() => void retryTask()}>继续修改</button>
            </div>
          ) : hasPendingReview ? (
            <div className="wb-expert-review-actions-list">
              {deliverables.filter((item) => item.acceptanceStatus === 'pending').map((item) => {
                const deliverableId = String(item.deliverableId)
                const returning = reviewingAction === `${deliverableId}:changes_requested`
                const accepting = reviewingAction === `${deliverableId}:accept`
                const editorOpen = reviewEditorId === deliverableId
                return (
                  <div className="wb-deliverable-review" key={`review-${deliverableId}`}>
                    <div className="wb-deliverable-review-title">
                      <span>待验收</span>
                      <strong>{expertDeliverableTitle(item.title)}</strong>
                    </div>
                    {editorOpen ? (
                      <>
                        <label className="wb-sr-only" htmlFor={`expert-review-${deliverableId}`}>修改「{expertDeliverableTitle(item.title)}」</label>
                        <textarea
                          id={`expert-review-${deliverableId}`}
                          value={reviewComment}
                          onChange={(event) => { setReviewComment(event.target.value); setReviewError('') }}
                          placeholder="写明需要修改的内容"
                          rows={3}
                          autoFocus
                          aria-invalid={reviewError ? 'true' : undefined}
                        />
                        <span className="wb-review-error" role="alert">{reviewError}</span>
                        <div className="wb-deliverable-review-actions">
                          <button type="button" className="wb-modal-btn" disabled={!!reviewingAction} onClick={() => { setReviewEditorId(''); setReviewError('') }}>取消</button>
                          <button type="button" className="wb-modal-btn primary" disabled={!!reviewingAction} onClick={() => void review(deliverableId, 'changes_requested')}>{returning ? '正在退回…' : '确认退回'}</button>
                        </div>
                      </>
                    ) : (
                      <div className="wb-deliverable-review-actions is-compact">
                        <button type="button" className="wb-modal-btn" disabled={!!reviewingAction} onClick={() => setReviewEditorId(deliverableId)}>退回修改</button>
                        <button type="button" className="wb-modal-btn primary" disabled={!!reviewingAction} onClick={() => void review(deliverableId, 'accept')}>{accepting ? '正在接受…' : '接受成果'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('expert-chat')}
        title={expertName}
        onBack={closeExpertRoom}
        backLabel={workbenchTaskBackLabel('expert-chat')}
      />
      <main className="wb-expert-workspace" data-testid="expert-room" aria-label="专家协作工作区">
        <section className="wb-expert-review-pane is-flat" data-testid="expert-delivery-room" aria-label="执行过程与成果">
          {showStatusFocus ? (
            <header className="wb-expert-pane-bar">
              <div className="wb-expert-pane-status" aria-label={`当前状态：${STATUS_LABEL[status] || status}`}>
                <span className={`wb-task-state-dot ${status === 'failed' ? 'failed' : 'running'}`} aria-hidden="true" />
                <div>
                  <strong>{statusFocus.title}</strong>
                  <small>{statusFocus.detail}</small>
                </div>
              </div>
            </header>
          ) : null}
          <ExpertCollabStageRail active={stageIndex} />

          <div className="wb-expert-pane-content">
            {!taskResolved ? (
              <div className="wb-expert-room-loading" role="status"><span /><strong>正在进入协作</strong></div>
            ) : isDraft ? (
              <section className="wb-expert-draft-room" role="tabpanel" aria-label="需求澄清与计划">
                <ExpertCollabDialogue
                  expert={expertItem}
                  messages={expertRoom.messages}
                  empty={!expertRoom.messages.length}
                  generating={isGenerating}
                  composer={false}
                  onPrompt={sendClarifyingPrompt}
                />
                {!firstUserMessage ? (
                  <div className="wb-expert-clarify-choices" aria-label="常见协作目标">
                    <button type="button" onClick={() => sendClarifyingPrompt('我需要你分析现状，给出专业判断和下一步建议。')}>分析并给建议</button>
                    <button type="button" onClick={() => sendClarifyingPrompt('我需要你把现有材料整理成一份可以直接使用的文档。')}>整理成文档</button>
                    <button type="button" onClick={() => sendClarifyingPrompt('我有一份现有成果，希望你检查问题并提出改进方案。')}>检查并改进</button>
                  </div>
                ) : null}
                {planReady ? (
                  <section className="wb-expert-plan-card" aria-labelledby="expertPlanTitle">
                    <header>
                      <span className="wb-expert-plan-mark"><Icon name="check" /></span>
                      <div><span>协作计划</span><h2 id="expertPlanTitle">建议按 {dynamicPlanSteps.length} 步执行</h2></div>
                      <small>待确认</small>
                    </header>
                    <dl>
                      <div><dt>目标</dt><dd>{draftGoal}</dd></div>
                      <div><dt>交付</dt><dd>{expertDetail?.outputs?.map((item) => item.label).join('、') || '可验收的专业成果'}</dd></div>
                      <div><dt>验收</dt><dd>目标完整、结论可核验、结果可直接使用</dd></div>
                    </dl>
                    <ol aria-label="本次执行步骤">
                      {dynamicPlanSteps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><strong>{step}</strong></li>)}
                    </ol>
                    <footer>
                      <button type="button" className="wb-modal-btn" onClick={() => document.getElementById('agentInput')?.focus()}>继续澄清</button>
                      <button type="button" className="wb-modal-btn primary" disabled={startingPlan} onClick={() => void confirmPlan()}>{startingPlan ? '正在开始…' : '确认计划并执行'}</button>
                    </footer>
                  </section>
                ) : null}
              </section>
            ) : (
              <section aria-label="专家协作记录">
                <h2 className="wb-sr-only">专家协作记录</h2>
                <ExpertTaskTimeline
                  events={processEvents}
                  expertId={expertId}
                  expertName={expertName}
                  hasActiveStep={hasActiveProcessStep}
                />
                {deliverables.map((item) => {
                  const revising = item.acceptanceStatus === 'changes_requested' && ['revising', 'running'].includes(status)
                  const stateLabel = item.acceptanceStatus === 'accepted'
                    ? '已接受'
                    : revising
                      ? '修改中'
                      : item.acceptanceStatus === 'changes_requested'
                        ? '已退回'
                        : '待验收'
                  const artifact = item.artifactRef ? artifacts[item.artifactRef] : null
                  return (
                    <article className="wb-expert-inline-result" key={`${item.deliverableId}-${item.version}`}>
                      <header>
                        <ExpertAvatarMark agent={{ id: expertId, name: expertName }} className="wb-expert-inline-result-avatar" size={32} />
                        <div><strong>{expertName}</strong><span>提交了成果</span></div>
                        <span className={`wb-deliverable-state is-${revising ? 'revising' : item.acceptanceStatus || 'pending'}`}>{stateLabel}</span>
                      </header>
                      <div className="wb-expert-inline-result-body">
                        <ExpertDeliverableArtifact
                          artifact={artifact}
                          fallback={task?.resultSummary}
                          loading={Boolean(item.artifactRef && artifactLoading[item.artifactRef])}
                          title={expertDeliverableTitle(item.title)}
                          type={item.type}
                          version={item.version}
                        />
                      </div>
                      <footer>
                        <button type="button" onClick={() => setPreviewDeliverableId(String(item.deliverableId))}>展开查看 <Icon name="chevronRight" /></button>
                      </footer>
                    </article>
                  )
                })}
                {expertRoom.messages.length > 1 ? (
                  <div className="wb-expert-followup-thread">
                    <ExpertCollabDialogue
                      expert={expertItem}
                      messages={expertRoom.messages}
                      empty={false}
                      generating={isGenerating}
                      composer={false}
                      onPrompt={sendClarifyingPrompt}
                    />
                  </div>
                ) : null}
                {renderInteractionTurn()}
              </section>
            )}
          </div>
          <div className="wb-expert-composer-dock">
            <AgentComposer
              surface="workbench"
              placeholder={isDraft ? '回答专家的问题，或补充目标和材料… @ 选文件' : inputNeed?.composerPlaceholder || '继续讨论、补充材料或调整要求… @ 选文件'}
              onSubmit={status === 'needs_input' ? (text) => provideInput(text) : undefined}
            />
          </div>
        </section>
        <ExpertTaskCapabilities
          task={task}
          stageLabel={stageLabel}
          goal={goal}
          onDelete={task ? requestDeleteTask : undefined}
        />
      </main>
      {previewDeliverable ? (
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
