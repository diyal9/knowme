import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

// Real AppShell -> ExpertTaskRoom -> AgentComposer and actual Zustand state.
// Only the preload API is mocked. No runtime, connector or model is called.
const note = '请按附件中的修订数据继续分析。'
const attachments = [
  { name: '补充.txt', kind: 'text' as const, text: '样本为24份；不得外推总体。' },
  { name: '示意.png', kind: 'image' as const, mimeType: 'image/png', dataUrl: 'data:image/png;base64,ZmFrZQ==' },
]

function taskFixture(status: 'needs_input' | 'running'): WorkbenchTask {
  return {
    id: 'rqa19-input-task', kind: 'expert', title: '补充材料任务', goal: '分析已给材料',
    expertId: 'data-analyst', expertName: '数据分析专家', status,
    brief: { goal: '分析已给材料', materials: [], constraints: [],
      deliverables: [{ id: 'primary', title: '分析结果', type: 'document', required: true }] },
    events: [], deliverables: [],
    ...(status === 'needs_input' ? { attention: {
      kind: 'missing_information' as const, action: 'provide_input' as const,
      title: '需要补充材料', item: '修订数据', question: '请补充修订数据。',
    } } : { progress: { phase: 'waiting_model', label: '正在分析材料',
      startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() } }),
  }
}

async function mountRoom(task: WorkbenchTask, provide: ReturnType<typeof vi.fn>) {
  useAppStore.setState({
    route: 'workbench', workbenchSurface: 'run', isGenerating: task.status === 'running',
    expertRoom: { id: task.id, taskId: task.id, expertId: task.expertId,
      name: task.expertName || '', goal: task.goal || '', log: [], messages: [],
      skills: [], connectors: [], knowledgeRefs: [] },
    workbenchDialogue: { composer: '', attachments: structuredClone(attachments) },
  })
  mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskProvideInput: provide })
  render(<AppShell />)
  await screen.findByTestId('expert-primary-status')
  await waitFor(() => expect(screen.getAllByRole('textbox')).toHaveLength(1))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: note } })
  await waitFor(() => {
    expect(useAppStore.getState().workbenchDialogue.composer).toBe(note)
    expect(screen.getByRole('textbox')).toHaveValue(note)
    expect(screen.getByRole('button', { name: '发送' })).toHaveClass('is-ready')
  })
}

async function submit() {
  await act(async () => { fireEvent.submit(screen.getByRole('textbox').closest('form')!) })
}

function expectPayload(provide: ReturnType<typeof vi.fn>, queue: boolean) {
  expect(provide).toHaveBeenCalledTimes(1)
  const payload = provide.mock.calls[0][0]
  expect(payload).toMatchObject({ taskId: 'rqa19-input-task', note, action: 'provide_input', queue })
  // Runtime consumes materials, not an ignored top-level attachments property.
  // Allow either raw composer names/text or normalized titles/content.
  expect(payload.materials).toHaveLength(2)
  const [document, image] = payload.materials
  expect(document.content || document.text).toBe(attachments[0].text)
  expect(document.title || document.name).toBe('补充.txt')
  expect(image.title || image.name).toBe('示意.png')
  expect(image).toMatchObject({ kind: 'image', mimeType: 'image/png', dataUrl: attachments[1].dataUrl })
}

describe('RQA19 provideInput draft ownership and attachment delivery', () => {
  beforeEach(() => resetAppStore())
  afterEach(() => cleanup())

  it.each(['needs_input', 'running'] as const)('retains typed text and attachments on ok:false with task present (%s)', async status => {
    const task = taskFixture(status)
    const provide = vi.fn(async () => ({ ok: false, task, error: '补充未被接收，请保留后重试。' }))
    await mountRoom(task, provide)
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox')).toHaveValue(note)
    expect(useAppStore.getState().workbenchDialogue.composer).toBe(note)
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual(attachments)
    expect(screen.getByText('补充未被接收，请保留后重试。')).toBeInTheDocument()
  })

  it.each(['missing_task', 'rejection'] as const)('retains the draft on transport/control failure: %s', async failure => {
    const task = taskFixture('needs_input')
    const provide = failure === 'rejection'
      ? vi.fn().mockRejectedValue(new Error('IPC unavailable'))
      : vi.fn().mockResolvedValue({ ok: false, error: '任务暂不可用' })
    await mountRoom(task, provide)
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox')).toHaveValue(note)
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual(attachments)
  })

  it.each(['needs_input', 'running'] as const)('delivers current note plus both attachments and consumes only successful submission (%s)', async status => {
    const task = taskFixture(status)
    const provide = vi.fn(async () => ({ ok: true, task, started: status === 'needs_input', queued: status === 'running' }))
    await mountRoom(task, provide)
    await submit()
    expectPayload(provide, status === 'running')
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([])
  })

  it('does not erase a newer draft or newly attached material when an earlier request succeeds', async () => {
    const task = taskFixture('running')
    let resolve!: (value: { ok: boolean; task: WorkbenchTask; queued: boolean }) => void
    const response = new Promise<{ ok: boolean; task: WorkbenchTask; queued: boolean }>(done => { resolve = done })
    const provide = vi.fn(() => response)
    await mountRoom(task, provide)
    await submit()
    expect(provide).toHaveBeenCalledTimes(1)
    const later = { name: '下一轮.txt', kind: 'text' as const, text: '这是后续补充，不属于在途提交。' }
    await act(async () => {
      useAppStore.setState({ workbenchDialogue: { composer: '后续补充尚未发送', attachments: [...attachments, later] } })
    })
    await act(async () => { resolve({ ok: true, task, queued: true }); await response })
    expect(screen.getByRole('textbox')).toHaveValue('后续补充尚未发送')
    expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([later])
    expectPayload(provide, true)
  })
})
