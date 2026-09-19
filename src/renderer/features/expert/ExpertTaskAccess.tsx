import { useEffect, useRef, useState } from 'react'
import type { WorkbenchTask } from '../../../shared/api'

type AccessOwner = { sessionId?: string; taskId?: string; agentId?: string; capabilityKind?: string; capabilityId?: string; reason?: string }
type AccessDraft = { id: string; kind: string; status: string; title?: string; body?: string; preview?: string; action?: string; target?: string; path?: string; sessionId?: string; meta?: AccessOwner }
type TaskGrant = AccessOwner & { id: string; revokedAt?: string | null }
type AccessResult = { ok?: boolean; code?: string; executed?: boolean; resumeRequired?: boolean; dryRun?: boolean; restartRequired?: boolean; task?: WorkbenchTask }
type AccessApi = {
  toolDraftsList?: () => Promise<{ ok?: boolean; drafts?: AccessDraft[] }>
  toolApproveDraft?: (input: { draftId: string; sessionId: string; reject: boolean }) => Promise<AccessResult>
  taskCapabilityGrantsList?: (sessionId: string) => Promise<{ ok?: boolean; grants?: TaskGrant[] }>
  taskCapabilityGrantRevoke?: (input: { sessionId: string; grantId: string }) => Promise<AccessResult>
  expertTaskRetry?: (taskId: string) => Promise<AccessResult>
}

const OPERATION_LABELS: Record<string, string> = {
  write_file: '写入文件',
  create_file: '新建文件',
  apply_patch: '修改文件',
  move_path: '移动文件',
  copy_path: '复制文件',
  delete_path: '删除文件',
  mkdir: '新建文件夹',
}

function operationLabel(draft: AccessDraft) {
  return OPERATION_LABELS[draft.action || ''] || draft.title || draft.action || '执行操作'
}

/** Task grants are host-owned. This view submits decisions, never changes scope locally. */
export function ExpertTaskAccess({ task }: { task: WorkbenchTask }) {
  const api = window.api as unknown as AccessApi | undefined
  const sessionId = task.execRef?.id || ''
  const [drafts, setDrafts] = useState<AccessDraft[]>([])
  const [grants, setGrants] = useState<TaskGrant[]>([])
  const [notice, setNotice] = useState('')
  const [restartRequired, setRestartRequired] = useState(false)
  const [resumeRequired, setResumeRequired] = useState(false)
  const [closedDrafts, setClosedDrafts] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [refresh, setRefresh] = useState(0)
  const owns = (owner?: AccessOwner) => owner?.sessionId === sessionId
    && owner?.taskId === task.id && owner?.agentId === task.expertId
  const isOperationDraft = (draft?: AccessDraft) => Boolean(draft && draft.kind !== 'capability-access')

  useEffect(() => {
    if (!sessionId) return
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const [pending, granted] = await Promise.all([
          api?.toolDraftsList?.(), api?.taskCapabilityGrantsList?.(sessionId),
        ])
        if (!active) return
        if (pending?.ok) setDrafts((pending.drafts || []).filter(item => item.status === 'pending_review'
          && (item.kind === 'capability-access' ? owns(item.meta)
            : item.sessionId === sessionId
              && (!item.meta?.taskId || item.meta.taskId === task.id)
              && (!item.meta?.agentId || item.meta.agentId === task.expertId)
              && (!item.meta?.sessionId || item.meta.sessionId === sessionId))))
        if (granted?.ok) setGrants((granted.grants || []).filter(item => !item.revokedAt && owns(item)))
      } catch { /* preserve the last confirmed view; failed approval never consumes a card */ }
      finally { loading = false }
    }
    void load()
    const timer = window.setInterval(() => void load(), 1600)
    return () => { active = false; window.clearInterval(timer) }
  }, [sessionId, task.id, task.expertId, refresh])

  async function decide(id: string, action: 'approve' | 'reject' | 'revoke' | 'restart') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const operation = isOperationDraft(drafts.find(item => item.id === id))
      const result = action === 'restart' ? await api?.expertTaskRetry?.(task.id)
        : action === 'revoke' ? await api?.taskCapabilityGrantRevoke?.({ sessionId, grantId: id })
          : await api?.toolApproveDraft?.({ draftId: id, sessionId, reject: action === 'reject' })
      if (result?.task?.id === task.id && result.task.execRef?.id === sessionId) {
        window.dispatchEvent(new CustomEvent('knowme:expert-task-updated', { detail: result.task }))
      }
      if (!result?.ok) {
        const feedback: Record<string, string> = {
          approval_expired: '批准请求已过期或应用已重启；原请求不能再执行，请重新生成操作审批。',
          approval_mismatch: '操作目标或参数已改变；请重新生成审批并核对。',
          duplicate_apply: '这次操作已有执行记录，请查看执行结果，不要重复执行。',
          not_pending: '这项请求已被处理或正在处理中，请刷新任务状态。',
          scope_denied: '当前任务已无权执行此操作，请检查授权或任务状态。',
          operation_status_unknown: '操作结果尚未确认，请先核查外部执行记录，不要重新执行。',
        }
        setNotice(feedback[result?.code || ''] || '本次操作未完成，请检查任务授权状态后重试。')
        if (operation && ['approval_expired', 'approval_mismatch', 'duplicate_apply', 'not_pending'].includes(result?.code || '')) {
          setClosedDrafts(current => [...current, id])
        }
        setRefresh(current => current + 1)
        return
      }
      if (action === 'restart') {
        setRestartRequired(false)
        setResumeRequired(false)
        setNotice(canResume ? '已请求基于执行结果继续；不会将批准视为任务完成。' : '已请求重新执行，正在重新检查执行条件。')
      } else if (action === 'reject') {
        setDrafts(current => current.filter(item => item.id !== id))
        setNotice(operation ? '已拒绝这次操作，未执行；任务仍等待处理。' : '已拒绝本次授权请求，任务仍等待处理。')
      } else if (operation) {
        if (!result.dryRun && result.executed) setDrafts(current => current.filter(item => item.id !== id))
        const shouldResume = result.resumeRequired === true && result.executed === true
        setResumeRequired(shouldResume)
        setNotice(shouldResume ? '本次操作已执行，正在基于结果自动继续；不会重复执行该操作。'
          : result.executed ? '本次操作已执行，结果已记录；任务尚未完成。'
            : '审批已处理，正在核对执行结果；请勿重复执行。')
        // The host has already persisted the exact receipt and advanced the
        // checkpoint. Resuming here only asks the task runtime to continue;
        // it cannot replay the approved operation because recovery is receipt
        // based and idempotent. Keep the manual button for reopened tasks or
        // hosts that do not return resumeRequired.
        if (shouldResume && api?.expertTaskRetry) {
          const resumed = await api.expertTaskRetry(task.id)
          if (resumed?.task?.id === task.id && resumed.task.execRef?.id === sessionId) {
            window.dispatchEvent(new CustomEvent('knowme:expert-task-updated', { detail: resumed.task }))
          }
          if (!resumed?.ok) {
            setResumeRequired(true)
            setNotice('操作已执行，但自动继续未启动；可使用“基于执行结果继续”恢复任务。')
          } else {
            setResumeRequired(false)
          }
        }
      } else {
        if (action === 'approve') setDrafts(current => current.filter(item => item.id !== id))
        else setGrants(current => current.filter(item => item.id !== id))
        setRestartRequired(result.restartRequired === true)
        setNotice(action === 'approve' ? '已授权本任务；重新运行后生效' : '已撤销本任务授权；重新运行后生效')
      }
      setRefresh(current => current + 1)
    } catch { setNotice('本次操作未完成，请稍后重试。') }
    finally { inFlight.current = false; setBusy(false) }
  }

  const persistedRestart = grants.length > 0 && task.status === 'needs_input'
    && task.attention?.kind === 'authorization_required' && task.attention.action === 'open_capability'
  const canResume = resumeRequired || (task.status === 'needs_input'
    && task.attention?.kind === 'tool_execution_completed' && task.attention.action === 'retry')
  const canRegenerate = task.status === 'needs_input'
    && task.attention?.kind === 'tool_approval_expired' && task.attention.action === 'retry'
  if (!drafts.length && !grants.length && !notice && !canResume && !canRegenerate) return null
  return (
    <section className="wb-expert-plan-card" aria-label="本任务审批与授权">
      {drafts.map(draft => (
        <div key={draft.id}>
          <strong>{isOperationDraft(draft) ? `等待操作审批 · ${operationLabel(draft)}` : `等待能力授权 · ${draft.title || '本任务授权请求'}`}</strong>
          {isOperationDraft(draft) ? <>
            <p>目标：{draft.target || draft.path || '请核对下方参数及连接器配置'}</p>
            <details><summary>{['write_file', 'create_file', 'apply_patch'].includes(draft.action || '') ? '查看写入内容' : '查看操作详情'}</summary><pre>{draft.preview || '未提供内容预览'}</pre></details>
            <p>批准仅执行这一次操作，不会授予任务长期能力，也不代表任务完成。</p>
          </> : <>
            <p>{draft.meta?.capabilityKind} · {draft.meta?.capabilityId}</p>
            <p>{draft.body || draft.meta?.reason || '允许此专家在本任务中使用这项能力。'}</p>
          </>}
          <button type="button" className="wb-modal-btn primary" disabled={busy || closedDrafts.includes(draft.id)} onClick={() => void decide(draft.id, 'approve')}>{isOperationDraft(draft) ? '批准这次操作' : '授权本任务'}</button>
          <button type="button" className="wb-modal-btn" disabled={busy || closedDrafts.includes(draft.id)} onClick={() => void decide(draft.id, 'reject')}>{isOperationDraft(draft) ? '拒绝这次操作' : '拒绝授权'}</button>
        </div>
      ))}
      {grants.map(grant => (
        <div key={grant.id}>
          <span>{grant.capabilityId} · 本任务已授权</span>
          <button type="button" className="wb-modal-btn" disabled={busy} onClick={() => void decide(grant.id, 'revoke')}>撤销授权</button>
        </div>
      ))}
      {notice ? <p role="status">{notice}</p> : null}
      {(canResume || canRegenerate || restartRequired || persistedRestart) && !drafts.length && !['starting', 'running', 'revising', 'review', 'completed'].includes(task.status || '') ? (
        <button type="button" className="wb-modal-btn primary" disabled={busy} onClick={() => void decide('', 'restart')}>{canResume ? '基于执行结果继续' : canRegenerate ? '重新生成操作审批' : '重新执行任务'}</button>
      ) : null}
    </section>
  )
}
