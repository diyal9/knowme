import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

// Bounded supplement; the original seven tests remain unchanged.
const textAttachment = { name: '材料.txt', kind: 'text' as const, text: '原始材料版本' }
type Reply = { ok: boolean; task: WorkbenchTask; queued?: boolean; error?: string }

function pendingReply() {
  let resolve!: (reply: Reply) => void
  const promise = new Promise<Reply>(done => { resolve = done })
  return { promise, resolve }
}

function taskFixture(status: 'needs_input' | 'running'): WorkbenchTask {
  return { id: 'rqa19-boundary-task', kind: 'expert', status, title: '补充边界检查',
    expertId: 'data-analyst', expertName: '数据分析专家', goal: '按用户材料分析',
    brief: { goal: '按用户材料分析', materials: [], constraints: [],
      deliverables: [{ id: 'primary', title: '分析', type: 'document', required: true }] },
    events: [], deliverables: [],
    ...(status === 'needs_input' ? { attention: { kind: 'missing_information' as const,
      action: 'provide_input' as const, title: '需要材料', question: '请提供数据', item: '数据' } } : {}),
  }
}

async function mountRoom(task: WorkbenchTask, provide: ReturnType<typeof vi.fn>, draft = '待提交正文') {
  useAppStore.setState({ route: 'workbench', workbenchSurface: 'run', isGenerating: task.status === 'running',
    expertRoom: { id: task.id, taskId: task.id, expertId: task.expertId, name: task.expertName || '',
      goal: task.goal || '', log: [], messages: [], skills: [], connectors: [], knowledgeRefs: [] },
    workbenchDialogue: { composer: draft, attachments: [{ ...textAttachment }] },
  })
  mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskProvideInput: provide })
  render(<AppShell />)
  await screen.findByTestId('expert-primary-status')
  await waitFor(() => {
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toHaveValue(draft)
    expect(screen.getByRole('button', { name: '发送' })).toHaveClass('is-ready')
  })
}

async function submit() {
  await act(async () => { fireEvent.submit(screen.getByRole('textbox').closest('form')!) })
}

describe('RQA19 bounded provideInput controls', () => {
  beforeEach(() => resetAppStore())
  afterEach(() => cleanup())

  it.each(['needs_input', 'running'] as const)('allows only one in-flight submission for the same task, then permits retry (%s)', async status => {
    const task = taskFixture(status)
    const pending = pendingReply()
    const provide = vi.fn().mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ ok: true, task, queued: status === 'running' })
    await mountRoom(task, provide)
    await submit()
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox')).toHaveValue('待提交正文')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([textAttachment])
    await act(async () => { pending.resolve({ ok: false, task, error: '暂未接收' }); await pending.promise })
    expect(screen.getByRole('textbox')).toHaveValue('待提交正文')
    await submit()
    expect(provide).toHaveBeenCalledTimes(2)
    expect(provide.mock.calls[1][0]).toMatchObject({ taskId: task.id, note: '待提交正文', queue: status === 'running' })
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([])
  })

  it.each(['needs_input', 'running'] as const)('submits attachment-only input through the actual composer (%s)', async status => {
    const task = taskFixture(status)
    const provide = vi.fn(async (_payload: Record<string, unknown>) => ({ ok: true, task, queued: status === 'running' }))
    await mountRoom(task, provide, '')
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    const payload = provide.mock.calls[0][0] as Record<string, any>
    expect(payload).toMatchObject({ taskId: task.id, note: '', action: 'provide_input', queue: status === 'running' })
    expect(payload.materials).toHaveLength(1)
    expect(payload.materials[0].content || payload.materials[0].text).toBe(textAttachment.text)
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([])
  })

  it('reroute button submits only the explicit route confirmation, preserving composer text and attachments', async () => {
    const task = taskFixture('needs_input')
    task.attention = { kind: 'missing_information', action: 'reroute', title: '需要调整路径',
      item: '公开网络搜索', defaultValue: '任务指定的飞书内容', detail: '确认路径后继续' }
    const provide = vi.fn(async (_payload: Record<string, unknown>) => ({ ok: true, task, started: true }))
    await mountRoom(task, provide, '这是尚未提交的草稿，不是路径确认')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '确认建议路径' })) })
    expect(provide).toHaveBeenCalledTimes(1)
    const payload = provide.mock.calls[0][0] as Record<string, any>
    expect(payload).toMatchObject({ taskId: task.id, action: 'reroute', queue: false })
    expect(payload.note).toContain('任务指定的飞书内容')
    expect(payload.note).not.toContain('尚未提交的草稿')
    expect(payload.materials || []).toEqual([])
    expect(screen.getByRole('textbox')).toHaveValue('这是尚未提交的草稿，不是路径确认')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([textAttachment])
  })

  it.each(['text', 'image'] as const)('preserves a same-filename %s replacement when the submitted version succeeds', async kind => {
    const task = taskFixture('running')
    const pending = pendingReply()
    const provide = vi.fn((_payload: Record<string, unknown>) => pending.promise)
    await mountRoom(task, provide)
    const original = kind === 'text' ? textAttachment : { name: '材料.png', kind: 'image' as const,
      mimeType: 'image/png', dataUrl: 'data:image/png;base64,b2xk' }
    const replacement = kind === 'text' ? { ...textAttachment, text: '替换后的新材料版本' }
      : { ...original, dataUrl: 'data:image/png;base64,bmV3' }
    await act(async () => { useAppStore.setState({ workbenchDialogue: { composer: '待提交正文', attachments: [original] } }) })
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    await act(async () => { useAppStore.setState({ workbenchDialogue: { composer: '待提交正文', attachments: [replacement] } }) })
    await act(async () => { pending.resolve({ ok: true, task, queued: true }); await pending.promise })
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([replacement])
    const sent = (provide.mock.calls[0][0] as Record<string, any>).materials[0]
    if (kind === 'text') expect(sent.content || sent.text).toBe(textAttachment.text)
    else expect(sent.dataUrl).toBe('data:image/png;base64,b2xk')
  })
})
