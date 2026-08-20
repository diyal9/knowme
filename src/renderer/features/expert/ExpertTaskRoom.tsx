import { useEffect, useState } from 'react'
import type { AgentRunArtifact, AgentSession, WorkbenchTask } from '../../../shared/api'
import { workbenchTaskBackLabel, workbenchTaskModeLabel } from '../../../domain/workbench-task-room'
import { expertArtifactKindLabel, parseExpertArtifactRef } from '../../../domain/expert-artifact'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { expertDeliverableTitle, expertDisplayName, expertTaskEventLabel } from '../../../domain/expert-present'
import { ExpertArtifactPreviewDialog } from './ExpertArtifactPreviewDialog'
import { ExpertAvatarMark } from './ExpertAvatarMark'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', starting: '正在预检', needs_input: '等待补充', running: '专家执行中',
  review: '等待验收', revising: '修改中', completed: '已完成', failed: '执行失败', cancelled: '已取消',
}

const STATUS_FOCUS: Record<string, { title: string; detail: string }> = {
  starting: { title: '正在检查任务条件', detail: '预检通过后会自动开始，无需再次确认。' },
  running: { title: '专家正在工作', detail: '完成后会在这里提交可验收的正式成果。' },
  review: { title: '成果等待你验收', detail: '你可以接受成果，或写下具体意见退回修改。' },
  revising: { title: '专家正在按意见修改', detail: '新版本生成后，旧版本仍会保留。' },
  completed: { title: '任务已完成', detail: '所有必需交付物均已通过验收。' },
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
  const [task, setTask] = useState<WorkbenchTask | null>(null)
  const [inputNote, setInputNote] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewingAction, setReviewingAction] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewNotice, setReviewNotice] = useState('')
  const [artifacts, setArtifacts] = useState<Record<string, AgentRunArtifact>>({})
  const [artifactLoading, setArtifactLoading] = useState<Record<string, boolean>>({})
  const [previewDeliverableId, setPreviewDeliverableId] = useState('')
  const [activePane, setActivePane] = useState<'process' | 'deliverables'>('process')
  const [reviewEditorId, setReviewEditorId] = useState('')

  async function load() {
    if (!expertRoom?.id) return
    const result = await window.api?.expertTaskGet?.(expertRoom.id).catch(() => null)
    setTask(result?.task || null)
  }

  useEffect(() => {
    void load()
    if (!expertRoom?.id) return undefined
    const timer = window.setInterval(() => void load(), 1600)
    return () => window.clearInterval(timer)
  }, [expertRoom?.id])

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
    if (!task?.id) return
    setActivePane(['review', 'completed'].includes(String(task.status)) ? 'deliverables' : 'process')
  }, [task?.id, task?.status])

  if (!expertRoom) return null
  const status = String(task?.status || 'starting')
  const expertName = expertDisplayName(task?.expertName || expertRoom.name)
  const goal = task?.brief?.goal || task?.goal || expertRoom.goal || ''
  const materials = task?.brief?.materials || []
  const deliverables = task?.deliverables || []
  const processEvents = task?.events || []
  const previewDeliverable = deliverables.find((item) => String(item.deliverableId) === previewDeliverableId) || null
  const statusFocus = STATUS_FOCUS[status] || {
    title: STATUS_LABEL[status] || '任务状态更新中',
    detail: status === 'needs_input' ? '补充所需信息后，专家会继续执行。' : '正在同步最新任务状态。',
  }

  async function provideInput() {
    if (!task || !inputNote.trim()) return
    const result = await window.api?.expertTaskProvideInput?.({
      taskId: task.id,
      note: inputNote.trim(),
      materials: [{ id: `followup-${Date.now()}`, type: 'text', title: '补充说明', content: inputNote.trim() }],
    })
    if (result?.task) {
      setTask(result.task)
      publishTaskUpdate(result.task)
    }
    setInputNote('')
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

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('expert-chat')}
        title={expertName}
        onBack={closeExpertRoom}
        backLabel={workbenchTaskBackLabel('expert-chat')}
      />
      <main className="wb-expert-workspace" aria-label="专家协作工作区">
        <aside className="wb-expert-control" data-testid="expert-room" aria-label="智能体与任务概况">
          <section className="wb-expert-agent-card" aria-label="执行智能体">
            <ExpertAvatarMark
              agent={{ id: task?.expertId || expertRoom.id, name: expertName }}
              className="wb-expert-agent-avatar"
              size={48}
            />
            <div>
              <span>执行智能体</span>
              <strong>{expertName}</strong>
              <small>专家协作 · 单一专业节点</small>
            </div>
          </section>
          <section className="wb-expert-brief-card" aria-labelledby="expertBriefTitle">
            <span className="wb-expert-side-label" id="expertBriefTitle">本次委托</span>
            <div className="wb-expert-brief-field">
              <span>交付目标</span>
              <p>{goal || '等待同步用户输入目标。'}</p>
            </div>
            <div className="wb-expert-brief-field is-materials">
              <span>任务材料</span>
              {materials.length ? (
                <ul>
                  {materials.map((item) => (
                    <li key={item.id || `${item.title}-${item.ref || ''}`}>
                      <strong>{item.title || '补充材料'}</strong>
                      {item.content || item.ref ? <p>{item.content || item.ref}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="is-empty">未提供额外材料</p>}
            </div>
          </section>

          <section className="wb-expert-side-actions" aria-labelledby="expertInteractionTitle">
            <h2 className="wb-sr-only" id="expertInteractionTitle">操作交互</h2>
            {reviewNotice ? <div className="wb-review-notice" role="status">{reviewNotice}</div> : null}
            {status === 'needs_input' ? (
              <div className="wb-delivery-attention" data-testid="expert-needs-input">
                <div><strong>补充后继续</strong><p>{task?.events?.at(-1)?.summary || '请补充专家继续工作所需的材料。'}</p></div>
                <textarea value={inputNote} onChange={(event) => setInputNote(event.target.value)} placeholder="补充背景、数据或限制条件" rows={3} />
                <button type="button" className="wb-modal-btn primary" onClick={() => void provideInput()}>提交并继续</button>
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
            ) : deliverables.some((item) => item.acceptanceStatus === 'pending') ? (
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
            ) : (
              <div className="wb-expert-action-hint">
                <strong>{['starting', 'running', 'revising'].includes(status) ? '专家正在处理' : '当前无需操作'}</strong>
                <span>{statusFocus.detail}</span>
              </div>
            )}
            {['failed', 'cancelled', 'completed'].includes(status) ? (
              <button type="button" className="wb-expert-delete-link" onClick={requestDeleteTask}>删除本任务</button>
            ) : null}
          </section>
        </aside>
        <section className="wb-expert-review-pane is-flat" data-testid="expert-delivery-room" aria-label="执行过程与成果">
          <header className="wb-expert-pane-bar">
            <div className="wb-expert-pane-status" aria-label={`当前状态：${STATUS_LABEL[status] || status}`}>
              <span className={`wb-task-state-dot ${status === 'completed' ? 'done' : status === 'failed' ? 'failed' : 'running'}`} aria-hidden="true" />
              <strong>{statusFocus.title}</strong>
              <span>{statusFocus.detail}</span>
            </div>
            <nav className="wb-expert-pane-tabs" role="tablist" aria-label="任务详情">
              <button
                type="button"
                role="tab"
                aria-selected={activePane === 'process'}
                className={activePane === 'process' ? 'active' : ''}
                onClick={() => setActivePane('process')}
              >
                <Icon name="history" />
                <span className="wb-expert-pane-tab-label">执行过程</span>
                <span className="wb-expert-pane-tab-count">{task?.events?.length || 0}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePane === 'deliverables'}
                className={activePane === 'deliverables' ? 'active' : ''}
                onClick={() => setActivePane('deliverables')}
              >
                <Icon name="note" />
                <span className="wb-expert-pane-tab-label">成果物</span>
                <span className="wb-expert-pane-tab-count">{deliverables.length}</span>
              </button>
            </nav>
          </header>

          <div className="wb-expert-pane-content">
            {activePane === 'process' ? (
              <section role="tabpanel" aria-label="执行过程">
                <h2 className="wb-sr-only">执行过程</h2>
                {processEvents.length ? (
                  <ol className="wb-expert-process-list">
                    {processEvents.map((event, index) => (
                      <li key={event.id}>
                        <span className="wb-expert-process-index">{index + 1}</span>
                        <div>
                          <strong>{expertTaskEventLabel(event.type, event.summary)}</strong>
                          {event.summary ? <p>{event.summary}</p> : null}
                        </div>
                        <time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p className="wb-expert-flat-empty">任务记录将在预检后出现。</p>}
              </section>
            ) : (
              <section role="tabpanel" aria-label="成果物">
                <h2 className="wb-sr-only">成果物</h2>
                {deliverables.length ? (
                  <div className="wb-expert-output-list">
                    {deliverables.map((item) => {
                      const comments = item.comments || []
                      const revising = item.acceptanceStatus === 'changes_requested' && ['revising', 'running'].includes(status)
                      const stateLabel = item.acceptanceStatus === 'accepted'
                        ? '已接受'
                        : revising
                          ? '专家修改中'
                          : item.acceptanceStatus === 'changes_requested'
                            ? '已退回修改'
                            : '等待验收'
                      return (
                        <article className="wb-expert-output-group" key={`${item.deliverableId}-${item.version}`}>
                          <button
                            type="button"
                            className="wb-expert-output-row"
                            aria-label={`预览成果物 ${expertDeliverableTitle(item.title)}`}
                            onClick={() => setPreviewDeliverableId(String(item.deliverableId))}
                          >
                            <span className="wb-expert-output-icon" aria-hidden="true"><Icon name="note" /></span>
                            <span className="wb-expert-output-copy">
                              <strong>{expertDeliverableTitle(item.title)}</strong>
                              <small>{expertArtifactKindLabel(item.type || 'document')} · 第 {item.version || 1} 版</small>
                            </span>
                            <span className={`wb-deliverable-state is-${revising ? 'revising' : item.acceptanceStatus || 'pending'}`}>{stateLabel}</span>
                            <Icon name="chevronRight" />
                          </button>
                          {comments.length ? <p className="wb-expert-output-note">最近修改意见：{comments.at(-1)?.body}</p> : null}
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="wb-delivery-empty">
                    <strong>{status === 'failed' ? '本次执行未产生可验收成果' : '专家正在准备交付物'}</strong>
                    <span>{task?.events?.at(-1)?.summary || '完成后会在这里出现版本化成果。'}</span>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
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
