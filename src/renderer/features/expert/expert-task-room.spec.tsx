import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

function reviewTask(): WorkbenchTask {
  return {
    id: 'task-review',
    kind: 'expert',
    title: '帮我查看当前有哪些消息要处理',
    goal: '帮我查看当前有哪些消息要处理',
    expertId: 'office-partner',
    expertName: '办公协作专家',
    status: 'review',
    brief: {
      goal: '帮我查看当前有哪些消息要处理',
      materials: [],
      deliverables: [{ id: 'primary', title: '可直接审阅的同步稿', type: 'document', required: true }],
      constraints: [],
    },
    resultSummary: '已整理出待处理消息，并按紧急程度给出负责人和截止时间。',
    events: [{ id: 'event-ready', type: 'deliverable_ready', summary: '可直接审阅的同步稿', createdAt: '2026-08-19T13:59:54.000Z' }],
    deliverables: [{
      deliverableId: 'primary',
      title: '可直接审阅的同步稿',
      type: 'document',
      version: 1,
      required: true,
      acceptanceStatus: 'pending',
      comments: [],
    }],
  }
}

describe('expert task review collaboration', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'run',
      expertRoom: {
        id: 'task-review',
        name: '办公协作专家',
        goal: '帮我查看当前有哪些消息要处理',
        log: [],
        messages: [],
        skills: [],
        connectors: [],
        knowledgeRefs: [],
      },
    })
  })
  afterEach(() => cleanup())

  it('opens the complete document artifact instead of presenting its truncated task summary', async () => {
    const task = reviewTask()
    task.deliverables = task.deliverables?.map((item) => ({
      ...item,
      artifactRef: 'session-review#artifact-v1',
    }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({
        ok: true,
        session: {
          id: 'session-review',
          run: {
            artifacts: [{
              id: 'artifact-v1',
              type: 'document',
              title: '可直接审阅的同步稿',
              body: '交付物 1：可直接审阅的同步稿（Document）\n\n---\n\n# 飞书消息处理清单\n\n这是只存在于完整产物中的正文内容。',
            }],
          },
        },
      }),
    })

    render(<AppShell />)

    const previewButton = await screen.findByRole('button', { name: '预览成果物 可直接审阅的同步稿' })
    expect(screen.queryByRole('heading', { name: '飞书消息处理清单' })).not.toBeInTheDocument()
    fireEvent.click(previewButton)

    const dialog = await screen.findByRole('dialog', { name: '可直接审阅的同步稿' })
    expect(within(dialog).getByRole('heading', { name: '飞书消息处理清单' })).toBeInTheDocument()
    expect(within(dialog).getByTestId('expert-artifact-view')).toHaveAttribute('data-artifact-kind', 'document')
    expect(within(dialog).getByText('这是只存在于完整产物中的正文内容。')).toBeInTheDocument()
    expect(screen.queryByText(/Document/)).not.toBeInTheDocument()
    expect(screen.queryByText('已整理出待处理消息，并按紧急程度给出负责人和截止时间。')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭成果物预览' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the completed state in the task body instead of the top bar', async () => {
    const task = reviewTask()
    task.status = 'completed'
    task.deliverables = task.deliverables?.map((item) => ({
      ...item,
      acceptanceStatus: 'accepted',
    }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
    })

    render(<AppShell />)

    const bodyStatus = await screen.findByLabelText('当前状态：已完成')
    expect(bodyStatus).toHaveTextContent('任务已完成')
    expect(bodyStatus).toHaveTextContent('所有必需交付物均已通过验收。')
    expect(within(screen.getByLabelText('任务对话状态')).queryByText('已完成')).not.toBeInTheDocument()
  })

  it('renders the complete process history in the independently scrollable content pane', async () => {
    const task = reviewTask()
    task.status = 'running'
    task.deliverables = []
    task.events = Array.from({ length: 9 }, (_, index) => ({
      id: `event-${index + 1}`,
      type: 'progress',
      summary: index === 0 ? '最早的执行记录' : `执行记录 ${index + 1}`,
      createdAt: `2026-08-19T14:${String(index).padStart(2, '0')}:00.000Z`,
    }))
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    const room = await screen.findByTestId('expert-delivery-room')
    expect(within(room).getAllByText('最早的执行记录').length).toBeGreaterThan(0)
    expect(within(room).queryByRole('button', { name: /展开全部|收起到一屏/ })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('expert-room')).queryByText('当前操作')).not.toBeInTheDocument()
  })

  it('requires actionable feedback and shows the return trip to the expert', async () => {
    let task = reviewTask()
    const review = vi.fn(async (payload: Record<string, unknown>) => {
      task = {
        ...task,
        status: 'revising',
        events: [...(task.events || []), {
          id: 'event-returned',
          type: 'changes_requested',
          summary: String(payload.comment || ''),
          createdAt: '2026-08-19T14:01:00.000Z',
        }],
        deliverables: (task.deliverables || []).map(item => ({
          ...item,
          acceptanceStatus: 'changes_requested',
          comments: [{ id: 'comment-1', body: String(payload.comment || ''), authorId: 'user' }],
        })),
      }
      return { ok: true, task, started: true }
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertTaskReviewDeliverable: review,
    })

    render(<AppShell />)
    await waitFor(() => expect(screen.getAllByText('等待验收').length).toBeGreaterThan(0))
    expect(within(screen.getByLabelText('任务对话状态')).queryByText('等待验收')).not.toBeInTheDocument()
    const controlPanel = screen.getByTestId('expert-room')
    const reviewPanel = screen.getByTestId('expert-delivery-room')
    expect(within(controlPanel).getByLabelText('执行智能体')).toHaveTextContent('办公协作专家')
    expect(within(controlPanel).getByText('本次委托')).toBeInTheDocument()
    expect(within(controlPanel).getByText('交付目标')).toBeInTheDocument()
    expect(within(controlPanel).getByText('帮我查看当前有哪些消息要处理')).toBeInTheDocument()
    expect(within(controlPanel).getByText('任务材料')).toBeInTheDocument()
    expect(within(controlPanel).queryByText('当前操作')).not.toBeInTheDocument()
    expect(within(controlPanel).getByRole('heading', { name: '操作交互' })).toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('heading', { name: '执行过程与成果' })).not.toBeInTheDocument()
    expect(within(reviewPanel).getByRole('tab', { name: /执行过程/ })).toBeInTheDocument()
    await waitFor(() => expect(within(reviewPanel).getByRole('tab', { name: /成果物/ })).toHaveAttribute('aria-selected', 'true'))
    expect(within(reviewPanel).getByRole('heading', { name: '成果物' })).toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('heading', { name: '操作交互' })).not.toBeInTheDocument()
    expect(controlPanel.compareDocumentPosition(reviewPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByLabelText(/修改「可直接审阅的同步稿」/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '退回修改' }))
    fireEvent.click(screen.getByRole('button', { name: '确认退回' }))
    expect(review).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('请先写明需要修改的内容')

    fireEvent.change(screen.getByLabelText(/修改「可直接审阅的同步稿」/), {
      target: { value: '请补充每条消息的负责人和截止时间。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认退回' }))

    await waitFor(() => expect(review).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-review',
      deliverableId: 'primary',
      action: 'changes_requested',
      comment: '请补充每条消息的负责人和截止时间。',
    })))
    expect(await screen.findByText('专家正在按意见修改')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /成果物/ }))
    expect(await screen.findByText('专家修改中')).toBeInTheDocument()
    expect(screen.getByText(/最近修改意见/)).toBeInTheDocument()
    expect(screen.getByText(/请补充每条消息的负责人和截止时间。/)).toBeInTheDocument()
    expect(screen.getAllByText(/修改意见已送达办公协作专家/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: /执行过程/ }))
    expect(screen.getByRole('heading', { name: '执行过程' })).toBeInTheDocument()
  })

  it('retries or deletes a failed task while preserving local files', async () => {
    const task = { ...reviewTask(), status: 'failed', deliverables: [] } as WorkbenchTask
    const retry = vi.fn(async () => ({ ok: false, error: '保持失败态以验证后续清理入口' }))
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertTaskRetry: retry,
      workbenchTaskArchive: archive,
    })

    render(<AppShell />)
    fireEvent.click(await screen.findByRole('button', { name: '重新执行' }))
    await waitFor(() => expect(retry).toHaveBeenCalledWith('task-review'))

    fireEvent.click(await screen.findByRole('button', { name: '删除本任务' }))
    const modal = screen.getByTestId('confirm-modal')
    expect(within(modal).getByText(/本地文件、会话产物和源目录不会被删除/)).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole('button', { name: '删除任务' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('task-review'))
    expect(useAppStore.getState().expertRoom).toBeNull()
  })
})
