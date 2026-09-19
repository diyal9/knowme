import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'
import { ExpertTaskRoom } from './ExpertTaskRoom'
import { workbenchExpertDiscussionSessionId } from '../../../domain/dialogue-lanes'

const task: WorkbenchTask = {
  id: 'slow-room', kind: 'expert', status: 'running',
  expertId: 'software-engineer', expertName: 'Web 开发专家',
  goal: '开发产品页面', brief: { goal: '开发产品页面', materials: [], deliverables: [], constraints: [] },
  events: [], deliverables: [],
}

beforeEach(() => {
  vi.useFakeTimers()
  resetAppStore()
  useAppStore.setState({ expertRoom: {
    id: task.id, taskId: task.id, expertId: task.expertId, name: 'Web 开发专家',
    goal: task.goal!, messages: [], log: [], skills: [], connectors: [], knowledgeRefs: [],
  } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('accepts a slow initial task response without overlapping polls or starving the room', async () => {
  let resolveTask!: (value: { ok: true; task: WorkbenchTask }) => void
  const get = vi.fn(() => new Promise<{ ok: true; task: WorkbenchTask }>(resolve => { resolveTask = resolve }))
  mockApi({ expertTaskGet: get, agentSessionGet: async () => ({ id: 'empty', messages: [] }) })
  render(<ExpertTaskRoom />)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => { resolveTask({ ok: true, task }); await vi.advanceTimersByTimeAsync(0) })
  expect(screen.queryByText('正在进入协作')).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
  expect(get).toHaveBeenCalledTimes(2)
})

it('shows the task before slow history finishes and then restores its conversation', async () => {
  let resolveHistory!: (value: { id: string; messages: { id: string; role: 'assistant'; text: string }[] }) => void
  const history = new Promise<{ id: string; messages: { id: string; role: 'assistant'; text: string }[] }>(resolve => { resolveHistory = resolve })
  const get = vi.fn(async () => ({ ok: true, task }))
  mockApi({ expertTaskGet: get, agentSessionGet: () => history })
  render(<ExpertTaskRoom />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(screen.queryByText('正在进入协作')).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => {
    resolveHistory({ id: 'saved', messages: [{ id: 'reply', role: 'assistant', text: '已保存的页面设计讨论' }] })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(useAppStore.getState().expertRoom?.messages.some(message => message.text === '已保存的页面设计讨论')).toBe(true)
})

it('paints a cached task immediately while refreshing it in the background', async () => {
  const get = vi.fn(() => new Promise<never>(() => {}))
  useAppStore.setState({ tasks: [task] })
  mockApi({ expertTaskGet: get, agentSessionGet: async () => ({ id: 'empty', messages: [] }) })

  render(<ExpertTaskRoom />)

  expect(screen.queryByRole('status', { name: '正在加载协作信息' })).not.toBeInTheDocument()
  expect(screen.getAllByText('开发产品页面').length).toBeGreaterThanOrEqual(1)
  expect(get).toHaveBeenCalledTimes(1)
})

it('opens a new unpersisted collaboration without a guaranteed-miss task read', () => {
  const get = vi.fn()
  useAppStore.setState({ expertRoom: {
    id: 'software-engineer', expertId: 'software-engineer', name: '软件开发专家',
    goal: '', messages: [], log: [], skills: [], connectors: [], knowledgeRefs: [],
  } })
  mockApi({ expertTaskGet: get })

  render(<ExpertTaskRoom />)

  expect(screen.queryByRole('status', { name: '正在加载协作信息' })).not.toBeInTheDocument()
  expect(screen.getByRole('tabpanel', { name: '需求澄清与计划' })).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it('does not restart loading or poll again when the restored task is terminal', async () => {
  const get = vi.fn(async () => ({ ok: true, task: { ...task, status: 'completed' as const } }))
  mockApi({ expertTaskGet: get, agentSessionGet: async () => ({ id: 'empty', messages: [] }) })
  render(<ExpertTaskRoom />)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(screen.queryByText('正在进入协作')).not.toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(1)
})

it('renders histories as each session arrives and keeps the remaining loading stage visible', async () => {
  type Session = { id: string; messages: { id: string; role: 'assistant'; text: string }[] }
  const pending = new Map<string, (value: Session) => void>()
  mockApi({
    expertTaskGet: async () => ({ ok: true, task }),
    agentSessionGet: id => new Promise<Session>(resolve => pending.set(id, resolve)),
  })
  render(<ExpertTaskRoom />)
  expect(screen.getByRole('status', { name: '正在加载协作信息' })).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(screen.queryByRole('status', { name: '正在加载协作信息' })).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载历史对话' })).toBeInTheDocument()
  const planningId = workbenchExpertDiscussionSessionId(task.id, 'planning')
  await act(async () => {
    pending.get(planningId)!({ id: planningId, messages: [{ id: 'early', role: 'assistant', text: '先到达的需求讨论' }] })
    pending.delete(planningId)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(screen.getByText('先到达的需求讨论')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载历史对话' })).toBeInTheDocument()
  await act(async () => {
    for (const [id, resolve] of pending) resolve({ id, messages: [] })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(screen.queryByRole('status', { name: '正在加载历史对话' })).not.toBeInTheDocument()
  expect(screen.getByText('先到达的需求讨论')).toBeInTheDocument()
})

it('refreshes history quietly after the initial load', async () => {
  let version = 0
  mockApi({
    expertTaskGet: async () => ({ ok: true, task: { ...task, updatedAt: String(++version) } }),
    agentSessionGet: async () => ({ id: 'empty', messages: [] }),
  })
  render(<ExpertTaskRoom />)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  window.api!.agentSessionGet = () => new Promise(() => {})
  await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
  expect(version).toBe(2)
  expect(screen.queryByRole('status', { name: '正在加载历史对话' })).not.toBeInTheDocument()
})

it('does not pull a reader to the bottom when an old user message arrives', async () => {
  type Session = { id: string; messages: { id: string; role: 'user'; text: string }[] }
  let resolveHistory!: (value: Session) => void
  const history = new Promise<Session>(resolve => { resolveHistory = resolve })
  mockApi({ expertTaskGet: async () => ({ ok: true, task }), agentSessionGet: () => history })
  render(<ExpertTaskRoom />)
  await act(async () => { await vi.advanceTimersByTimeAsync(20) })
  const panel = screen.getByTestId('expert-dialogue-scroll')
  Object.defineProperties(panel, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 600 },
  })
  panel.scrollTop = 300
  fireEvent.scroll(panel)
  await act(async () => {
    resolveHistory({ id: 'saved', messages: [{ id: 'old-user', role: 'user', text: '之前的需求说明' }] })
    await vi.advanceTimersByTimeAsync(30)
  })
  expect(panel.scrollTop).toBe(300)
  // A newly sent message still follows the conversation to its end.
  await act(async () => {
    useAppStore.setState(state => ({ expertRoom: { ...state.expertRoom!, messages: [
      ...state.expertRoom!.messages, { id: 'new-user', role: 'user', text: '刚补充的要求' },
    ] } }))
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(30) })
  expect(panel.scrollTop).toBe(2000)
  panel.scrollTop = 300
  fireEvent.scroll(panel)
  await act(async () => { useAppStore.setState({ isGenerating: true }) })
  await act(async () => { await vi.advanceTimersByTimeAsync(30) })
  expect(panel.scrollTop).toBe(300)
})
