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

    expect(await screen.findByRole('heading', { name: '飞书消息处理清单' })).toBeInTheDocument()
    expect(screen.getByText('这是只存在于完整产物中的正文内容。')).toBeInTheDocument()
    const previewButton = screen.getByRole('button', { name: /展开查看/ })
    fireEvent.click(previewButton)

    const dialog = await screen.findByRole('dialog', { name: '可直接审阅的同步稿' })
    expect(within(dialog).queryByText('成果物预览')).not.toBeInTheDocument()
    expect(within(dialog).getByText('文档 · 第 1 版')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '飞书消息处理清单' })).toBeInTheDocument()
    expect(within(dialog).getByTestId('expert-artifact-view')).toHaveAttribute('data-artifact-kind', 'document')
    expect(within(dialog).getByText('这是只存在于完整产物中的正文内容。')).toBeInTheDocument()
    expect(screen.queryByText(/Document/)).not.toBeInTheDocument()
    expect(screen.queryByText('已整理出待处理消息，并按紧急程度给出负责人和截止时间。')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭成果物预览' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows completion in the stage rail without repeating a status sentence', async () => {
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

    const rail = await screen.findByRole('list', { name: '协作阶段：完成' })
    expect(within(rail).getAllByRole('listitem')).toHaveLength(5)
    expect(within(rail).getByText('完成').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.queryByLabelText('当前状态：已完成')).not.toBeInTheDocument()
    expect(screen.queryByText('任务已完成')).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('任务对话状态')).queryByText('已完成')).not.toBeInTheDocument()
  })

  it('uses five stable phases and submits the expert-authored dynamic plan', async () => {
    const createTask = vi.fn(async (payload: { brief?: WorkbenchTask['brief'] }) => ({
      ok: true,
      task: {
        id: 'task-dynamic-plan', kind: 'expert', status: 'running', title: '分析上周会议',
        expertId: 'office-partner', expertName: '办公协作专家', brief: payload.brief,
        events: [], deliverables: [],
      },
    }))
    useAppStore.setState({
      expertRoom: {
        id: 'office-partner', expertId: 'office-partner', name: '办公协作专家', goal: '', log: [],
        messages: [
          { id: 'user-goal', role: 'user', text: '分析上周会议并整理行动项' },
          {
            id: 'expert-plan', role: 'assistant',
            text: '【协作计划】\n目标：分析上周会议\n执行步骤：\n1. 提取议题与关键结论\n2. 识别负责人和截止时间\n3. 生成可审阅的同步稿\n验收：行动项可以直接跟进',
          },
        ],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task: undefined }),
      expertTaskCreateStart: createTask,
    })

    render(<AppShell />)

    const rail = await screen.findByRole('list', { name: '协作阶段：确认计划' })
    expect(within(rail).getAllByRole('listitem')).toHaveLength(5)
    const plan = screen.getByRole('list', { name: '本次执行步骤' })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3)
    expect(within(plan).getByText('识别负责人和截止时间')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '确认计划并执行' }))
    await waitFor(() => expect(createTask).toHaveBeenCalled())
    const submitted = createTask.mock.calls[0]?.[0]
    expect(submitted?.brief?.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'confirmed-plan',
        title: '已确认的执行计划',
        content: expect.stringContaining('2. 识别负责人和截止时间'),
      }),
    ]))
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
    const processItems = within(room).getByRole('list', { name: '专家协作记录' }).querySelectorAll('li')
    expect(processItems[8]).toHaveTextContent('执行记录 9')
    expect(processItems[8]).toHaveAttribute('aria-current', 'step')
    expect(processItems[7]).not.toHaveAttribute('aria-current')
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
    await waitFor(() => expect(screen.getAllByText('待验收').length).toBeGreaterThan(0))
    expect(within(screen.getByLabelText('任务对话状态')).queryByText('等待验收')).not.toBeInTheDocument()
    const controlPanel = screen.getByTestId('expert-room')
    const reviewPanel = screen.getByTestId('expert-delivery-room')
    expect(within(controlPanel).getByLabelText('当前专家')).toHaveTextContent('办公协作专家')
    expect(within(controlPanel).queryByText('本次委托')).not.toBeInTheDocument()
    expect(within(controlPanel).getByText('目标')).toBeInTheDocument()
    expect(within(controlPanel).getByText('帮我查看当前有哪些消息要处理')).toBeInTheDocument()
    expect(within(controlPanel).getByText('交付')).toBeInTheDocument()
    expect(within(controlPanel).queryByText('当前操作')).not.toBeInTheDocument()
    expect(within(controlPanel).queryByRole('heading', { name: '操作交互' })).not.toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('heading', { name: '执行过程与成果' })).not.toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('tab')).not.toBeInTheDocument()
    const collaborationRecord = within(reviewPanel).getByRole('region', { name: '专家协作记录' })
    expect(within(collaborationRecord).getByRole('heading', { name: '请验收成果' })).toBeInTheDocument()
    expect(within(reviewPanel).queryByText('成果等待你验收')).not.toBeInTheDocument()
    expect(within(collaborationRecord).getByTestId('expert-action-turn')).toBeInTheDocument()
    expect(within(reviewPanel).getByTestId('expert-artifact-view')).toBeInTheDocument()
    expect(controlPanel).toContainElement(reviewPanel)
    expect(screen.queryByLabelText(/修改「可直接审阅的同步稿」/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '退回修改' }))
    fireEvent.click(await screen.findByRole('button', { name: '确认退回' }))
    expect(review).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('请先写明需要修改的内容')

    fireEvent.change(screen.getByLabelText(/修改「可直接审阅的同步稿」/), {
      target: { value: '请补充每条消息的负责人和截止时间。' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '确认退回' }))

    await waitFor(() => expect(review).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-review',
      deliverableId: 'primary',
      action: 'changes_requested',
      comment: '请补充每条消息的负责人和截止时间。',
    })))
    expect((await screen.findAllByText('继续修改')).length).toBeGreaterThan(0)
    expect(await screen.findByText('修改中')).toBeInTheDocument()
    expect(screen.getByText(/请补充每条消息的负责人和截止时间。/)).toBeInTheDocument()
    expect(screen.getAllByText(/修改意见已送达办公协作专家/)).toHaveLength(2)
    expect(within(reviewPanel).getByRole('list', { name: '专家协作记录' })).toBeInTheDocument()
  })

  it('shows an expert-authored collaboration trail and the task capability boundary', async () => {
    const task = reviewTask()
    task.status = 'running'
    task.knowledgeRefs = ['feishu-team-space']
    task.deliverables = []
    task.events = [
      { id: 'event-plan', type: 'task_started', summary: '先整理消息，再按紧急程度核对负责人。', createdAt: '2026-08-19T14:00:00.000Z' },
      { id: 'event-input', type: 'input_provided', summary: '只检查今天收到的消息。', createdAt: '2026-08-19T14:01:00.000Z' },
      { id: 'event-progress', type: 'progress', summary: '已完成消息去重，正在核对截止时间。', createdAt: '2026-08-19T14:02:00.000Z' },
    ]
    useAppStore.setState({
      hubItems: [
        { id: 'writing-polish', kind: 'skill', name: '公文润色' },
        { id: 'feishu', kind: 'connector', name: '飞书' },
      ],
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertGet: async () => ({
        ok: true,
        expert: { name: '办公协作专家', skills: ['writing-polish'], connectors: ['feishu'] },
      }),
      sourcesList: async () => ({
        sources: [{ id: 'feishu-team-space', type: 'local-folder', displayName: '团队知识空间' }],
        activeSourceId: 'feishu-team-space',
      }),
    })

    render(<AppShell />)

    const room = await screen.findByTestId('expert-delivery-room')
    expect(within(room).getByRole('list', { name: '专家协作记录' })).toBeInTheDocument()
    expect(within(room).getAllByText('办公协作专家').length).toBeGreaterThan(0)
    expect(within(room).getByText('执行计划')).toBeInTheDocument()
    expect(within(room).getByText('用户补充')).toBeInTheDocument()
    expect(within(room).getAllByText('我')).toHaveLength(2)
    expect(within(room).getByRole('textbox')).toHaveAttribute('placeholder', expect.stringContaining('继续讨论'))

    const capabilities = screen.getByTestId('expert-task-capabilities')
    expect(within(capabilities).getByRole('heading', { name: '能力' })).toBeInTheDocument()
    expect(await within(capabilities).findByText('公文润色')).toBeInTheDocument()
    expect(within(capabilities).getByText('团队知识空间')).toBeInTheDocument()
    expect(within(capabilities).getByText('飞书')).toBeInTheDocument()
    expect(within(capabilities).queryByText(/能力边界保持稳定/)).not.toBeInTheDocument()
  })

  it('renders formal discussion as focused expert dialogue without generic execution chrome', async () => {
    const task = reviewTask()
    useAppStore.setState({
      expertRoom: {
        id: 'task-review',
        taskId: 'task-review',
        expertId: 'office-partner',
        name: '办公协作专家',
        goal: task.goal || '',
        log: [],
        messages: [
          { id: 'user-question', role: 'user', text: '?' },
          {
            id: 'expert-answer',
            role: 'assistant',
            text: '你可以先查看成果内容，或告诉我需要修改的部分。',
            trace: [{ id: 'trace-1', kind: 'stage', title: '思考执行过程', status: 'done' }],
          },
        ],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    const log = await screen.findByTestId('expert-collab-log')
    expect(within(log).getByTestId('expert-user-message')).toHaveTextContent('?')
    expect(within(log).getByTestId('expert-reply-message')).toHaveTextContent('你可以先查看成果内容')
    expect(within(log).queryByText('思考执行过程')).not.toBeInTheDocument()
    expect(within(log).queryByRole('button', { name: /复制|赞|分享/ })).not.toBeInTheDocument()
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

    const deleteButton = await screen.findByRole('button', { name: '删除本任务' })
    expect(deleteButton).toHaveClass('wb-expert-delete-button')
    expect(deleteButton.closest('.wb-expert-profile-card')).toBeTruthy()
    expect(deleteButton.querySelector('[data-icon="trash"]')).toBeTruthy()
    fireEvent.click(deleteButton)
    const modal = screen.getByTestId('confirm-modal')
    expect(within(modal).getByText(/本地文件、会话产物和源目录不会被删除/)).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole('button', { name: '删除任务' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('task-review'))
    expect(useAppStore.getState().expertRoom).toBeNull()
  })

  it('resumes or deletes a revising task that has no active executor', async () => {
    const task = { ...reviewTask(), status: 'revising' } as WorkbenchTask
    const resumedTask = { ...task, status: 'starting' } as WorkbenchTask
    const retry = vi.fn(async () => ({ ok: true, task: resumedTask, started: true }))
    const cancel = vi.fn(async () => ({ ok: true, task: { ...task, status: 'cancelled' } }))
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertTaskRetry: retry,
      expertTaskCancel: cancel,
      workbenchTaskArchive: archive,
    })

    render(<AppShell />)
    fireEvent.click(await screen.findByRole('button', { name: '继续修改' }))
    await waitFor(() => expect(retry).toHaveBeenCalledWith('task-review'))

    fireEvent.click(screen.getByRole('button', { name: '删除本任务' }))
    fireEvent.click(within(screen.getByTestId('confirm-modal')).getByRole('button', { name: '删除任务' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('task-review'))
    expect(archive).toHaveBeenCalledWith('task-review')
  })
})
