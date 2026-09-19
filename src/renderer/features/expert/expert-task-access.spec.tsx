import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { mockApi, resetAppStore } from '../../test/helpers'
import { ExpertTaskAccess } from './ExpertTaskAccess'
import { ExpertTaskCapabilities } from './ExpertTaskCapabilities'

const task = { id: 'access-task', kind: 'expert', expertId: 'expert-one', status: 'needs_input',
  execRef: { kind: 'session', id: 'access-session' },
  attention: { kind: 'approval_required', action: 'provide_input' } } as WorkbenchTask
const owner = { sessionId: 'access-session', taskId: task.id, agentId: task.expertId,
  capabilityKind: 'connectors', capabilityId: 'feishu' }
const draft = { id: 'draft-one', kind: 'capability-access', status: 'pending_review', title: '需要飞书授权',
  body: '读取本次任务所需消息', meta: owner }

describe('task capability authorization', () => {
  beforeEach(() => resetAppStore())
  afterEach(() => cleanup())

  it('filters other task/session/agent drafts and requires an explicit restart after approval', async () => {
    let pending = [draft, ...['taskId', 'sessionId', 'agentId'].map(key => ({ ...draft,
      id: key, title: `其他${key}`, meta: { ...owner, [key]: 'other' } }))]
    const retry = vi.fn(async () => ({ ok: true, task: { ...task, status: 'starting' } }))
    const approve = vi.fn(async () => { pending = []; return { ok: true, restartRequired: true } })
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: pending }), toolApproveDraft: approve,
      expertTaskRetry: retry, taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }) })
    render(<ExpertTaskAccess task={task} />)
    fireEvent.click(await screen.findByRole('button', { name: '授权本任务' }))
    expect(await screen.findByText('已授权本任务；重新运行后生效')).toBeInTheDocument()
    expect(approve).toHaveBeenCalledWith({ draftId: draft.id, sessionId: owner.sessionId, reject: false })
    expect(screen.queryByText(/其他taskId|其他sessionId|其他agentId/)).not.toBeInTheDocument()
    expect(retry).not.toHaveBeenCalled()
    expect(task.status).toBe('needs_input')
    fireEvent.click(screen.getByRole('button', { name: '重新执行任务' }))
    await waitFor(() => expect(retry).toHaveBeenCalledWith(task.id))
  })

  it('restores explicit restart from the persisted grant checkpoint without auto progression', async () => {
    const retry = vi.fn(async () => ({ ok: true }))
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [] }),
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [{ ...owner, id: 'saved-grant' }] }),
      expertTaskRetry: retry })
    render(<ExpertTaskAccess task={{ ...task,
      attention: { kind: 'authorization_required', action: 'open_capability' } }} />)
    const restart = await screen.findByRole('button', { name: '重新执行任务' })
    expect(retry).not.toHaveBeenCalled()
    expect(screen.queryByText('任务已完成')).not.toBeInTheDocument()
    fireEvent.click(restart)
    await waitFor(() => expect(retry).toHaveBeenCalledWith(task.id))
  })

  it('keeps a failed approval card actionable and never shows completion', async () => {
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [draft] }),
      toolApproveDraft: async () => ({ ok: false, message: 'Authorization: Bearer private' }) })
    render(<ExpertTaskAccess task={task} />)
    fireEvent.click(await screen.findByRole('button', { name: '授权本任务' }))
    expect(await screen.findByText('本次操作未完成，请检查任务授权状态后重试。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '授权本任务' })).toBeEnabled()
    expect(screen.queryByText(/private|任务已完成/)).not.toBeInTheDocument()
  })

  it('revokes only this task grant and does not restart an active run', async () => {
    let grants = [{ ...owner, id: 'grant-one' }, { ...owner, id: 'other', taskId: 'other-task' }]
    const revoke = vi.fn(async () => { grants = []; return { ok: true, restartRequired: true } })
    const retry = vi.fn()
    Object.assign(mockApi(), { taskCapabilityGrantsList: async () => ({ ok: true, grants }),
      taskCapabilityGrantRevoke: revoke, expertTaskRetry: retry })
    render(<ExpertTaskAccess task={{ ...task, status: 'running' }} />)
    fireEvent.click(await screen.findByRole('button', { name: '撤销授权' }))
    expect(await screen.findByText('已撤销本任务授权；重新运行后生效')).toBeInTheDocument()
    expect(revoke).toHaveBeenCalledWith({ sessionId: owner.sessionId, grantId: 'grant-one' })
    expect(retry).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '重新执行任务' })).not.toBeInTheDocument()
  })

  it.each(['HTTP', 'CLI'])('shows %s operation target and parameters, updates the exact checkpoint and auto resumes without replay', async transport => {
    const operation = { id: 'operation', kind: 'tool-execution', status: 'pending_review',
      sessionId: owner.sessionId, action: `connector_${transport.toLowerCase()}_call`, target: `${transport} approved-target`,
      preview: '{"path":"/write","body":"approved data"}' }
    let pending = [operation, { ...operation, id: 'other-session', sessionId: 'other-session', target: 'wrong-target' },
      { ...operation, id: 'other-agent', meta: { ...owner, agentId: 'other-agent' }, target: 'wrong-agent' }]
    const resumedTask = { ...task, attention: { kind: 'tool_execution_completed', action: 'retry' } }
    const approve = vi.fn(async () => { pending = []; return { ok: true, executed: true, resumeRequired: true, task: resumedTask } })
    const retry = vi.fn(async () => ({ ok: true }))
    const updated = vi.fn()
    window.addEventListener('knowme:expert-task-updated', updated)
    try {
      Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: pending }),
        taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }), toolApproveDraft: approve, expertTaskRetry: retry })
      render(<ExpertTaskAccess task={task} />)
      const button = await screen.findByRole('button', { name: '批准这次操作' })
      expect(screen.getByText(/approved-target/)).toBeInTheDocument()
      expect(screen.getByText(/approved data/)).toBeInTheDocument()
      expect(screen.queryByText(/wrong-target|wrong-agent/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '授权本任务' })).not.toBeInTheDocument()
      fireEvent.click(button)
      expect(await screen.findByText('本次操作已执行，正在基于结果自动继续；不会重复执行该操作。')).toBeInTheDocument()
      expect(approve).toHaveBeenCalledWith({ draftId: 'operation', sessionId: owner.sessionId, reject: false })
      expect(updated.mock.calls[0][0].detail).toEqual(resumedTask)
      await waitFor(() => expect(retry).toHaveBeenCalledWith(task.id))
      expect(screen.queryByRole('button', { name: '基于执行结果继续' })).not.toBeInTheDocument()
      expect(approve).toHaveBeenCalledTimes(1)
    } finally { window.removeEventListener('knowme:expert-task-updated', updated) }
  })

  it('shows a host file draft as an operation approval with its path and preview', async () => {
    const fileDraft = { id: 'file-draft', kind: 'file', status: 'pending_review',
      sessionId: owner.sessionId, action: 'write_file', path: 'outputs/knowme-landing/index.html',
      preview: '<main>KnowMe</main>' }
    const approve = vi.fn(async () => ({ ok: true, executed: true, resumeRequired: true }))
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [fileDraft] }),
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }), toolApproveDraft: approve })
    render(<ExpertTaskAccess task={task} />)
    expect(await screen.findByText(/outputs\/knowme-landing\/index\.html/)).toBeInTheDocument()
    expect(screen.getByText(/<main>KnowMe<\/main>/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '批准这次操作' }))
    await waitFor(() => expect(approve).toHaveBeenCalledWith({
      draftId: 'file-draft', sessionId: owner.sessionId, reject: false,
    }))
  })

  it('restores result-based continuation on reopen even when the processed draft is no longer pending', async () => {
    const retry = vi.fn(async () => ({ ok: true }))
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [] }),
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }), expertTaskRetry: retry })
    render(<ExpertTaskAccess task={{ ...task, attention: { kind: 'tool_execution_completed', action: 'retry' } }} />)
    const resume = await screen.findByRole('button', { name: '基于执行结果继续' })
    expect(retry).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '批准这次操作' })).not.toBeInTheDocument()
    fireEvent.click(resume)
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1))
  })

  it('offers regeneration only after the host persists a known-not-executed checkpoint', async () => {
    const retry = vi.fn(async () => ({ ok: true }))
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [] }),
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }), expertTaskRetry: retry })
    render(<ExpertTaskAccess task={{ ...task, attention: { kind: 'tool_approval_expired', action: 'retry' } }} />)
    const regenerate = await screen.findByRole('button', { name: '重新生成操作审批' })
    expect(retry).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '基于执行结果继续' })).not.toBeInTheDocument()
    fireEvent.click(regenerate)
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1))
  })

  it('rejects an ordinary operation without granting capability or claiming effects', async () => {
    let pending = [{ id: 'operation', kind: 'tool-execution', status: 'pending_review', sessionId: owner.sessionId, action: 'cli_write' }]
    const approve = vi.fn(async () => { pending = []; return { ok: true, rejected: true } })
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: pending }), toolApproveDraft: approve,
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }) })
    render(<ExpertTaskAccess task={task} />)
    fireEvent.click(await screen.findByRole('button', { name: '拒绝这次操作' }))
    expect(await screen.findByText('已拒绝这次操作，未执行；任务仍等待处理。')).toBeInTheDocument()
    expect(approve).toHaveBeenCalledWith({ draftId: 'operation', sessionId: owner.sessionId, reject: true })
    expect(screen.queryByRole('button', { name: '基于执行结果继续' })).not.toBeInTheDocument()
  })

  it.each(['approval_expired', 'approval_mismatch', 'duplicate_apply'])('explains %s safely and prevents another approval click', async code => {
    const operation = { id: 'operation', kind: 'tool-execution', status: 'pending_review', sessionId: owner.sessionId, action: 'http_write' }
    const approve = vi.fn(async () => ({ ok: false, code, message: 'Bearer secret-diagnostic' }))
    Object.assign(mockApi(), { toolDraftsList: async () => ({ ok: true, drafts: [operation] }), toolApproveDraft: approve,
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }) })
    render(<ExpertTaskAccess task={task} />)
    fireEvent.click(await screen.findByRole('button', { name: '批准这次操作' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '批准这次操作' })).toBeDisabled())
    expect(screen.getByRole('status')).toHaveTextContent(code === 'approval_expired' ? /过期或应用已重启/ : code === 'approval_mismatch' ? /目标或参数已改变/ : /已有执行记录/)
    expect(screen.queryByText(/secret-diagnostic/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新执行任务' })).not.toBeInTheDocument()
  })

  it('limits the final area to accepted, referenced and unblocked artifacts', () => {
    mockApi()
    render(<ExpertTaskCapabilities task={{ ...task, deliverables: [
      { deliverableId: 'ok', title: '正式成果', type: 'document', acceptanceStatus: 'accepted', artifactRef: 's#a' },
      { deliverableId: 'pending', title: '候选成果', type: 'document', acceptanceStatus: 'pending', artifactRef: 's#b' },
      { deliverableId: 'blocked', title: '无证据成果', type: 'document', acceptanceStatus: 'accepted', evidenceStatus: 'blocked', artifactRef: 's#c' },
      { deliverableId: 'empty', title: '无资源记录', type: 'document', acceptanceStatus: 'accepted' },
    ] }} goal="整理材料" stageLabel="等待验收" sop="" onOpenDeliverable={() => {}} />)
    expect(screen.getByRole('button', { name: /正式成果/ })).toBeInTheDocument()
    expect(screen.queryByText(/候选成果|无证据成果|无资源记录/)).not.toBeInTheDocument()
  })

  it('keeps capability details mutually exclusive and dismisses them with Escape', () => {
    mockApi()
    render(<ExpertTaskCapabilities task={task} goal="整理材料" stageLabel="等待补充" sop="1. 确认目标\n2. 交付结果" />)

    fireEvent.click(screen.getByRole('button', { name: /能力/ }))
    expect(screen.getByRole('dialog', { name: '能力配置' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '能力配置' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /SOP/ }))
    expect(screen.getByRole('dialog', { name: /SOP/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /SOP/ })).not.toBeInTheDocument()
  })
})
