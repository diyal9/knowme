import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it('keeps terminal discussion available and creates a linked follow-up commission', async () => {
    const original = reviewTask()
    const task: WorkbenchTask = { ...original, status: 'completed',
      brief: { ...original.brief, completionPolicy: 'review' },
      deliverables: original.deliverables!.map(item => ({ ...item, acceptanceStatus: 'accepted' })),
    }
    const review = vi.fn()
    const createTask = vi.fn(async () => ({ ok: true, task: { ...task, id: 'task-followup', status: 'draft' } as WorkbenchTask }))
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskReviewDeliverable: review,
      workbenchTaskCreate: createTask, workbenchTaskList: async () => ({ items: [task] }) })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('已结束 · 已完成'))
    expect(screen.queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '继续调整' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '开始后续委托' }))
    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'expert', status: 'draft', taskRef: { id: task.id },
    })))
    await waitFor(() => expect(useAppStore.getState().expertRoom?.taskId).toBe('task-followup'))
    expect(review).not.toHaveBeenCalled()
  })

  it('keeps cancelled collaboration discussion and follow-up creation available', async () => {
    const task = { ...reviewTask(), status: 'cancelled', deliverables: [] } as WorkbenchTask
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })
    render(<AppShell />)
    await screen.findByTestId('expert-action-turn')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始后续委托' })).toBeInTheDocument()
  })

  it('waits for explicit summary confirmation and accepts all outputs without starting generation', async () => {
    const task = reviewTask()
    task.deliverables = [...task.deliverables!, { ...task.deliverables![0], deliverableId: 'second', title: '第二份成果' }]
    const accepted = new Set<string>()
    const generate = vi.fn()
    const review = vi.fn(async ({ deliverableId }: Record<string, unknown>) => {
      accepted.add(String(deliverableId))
      return { ok: true, task: { ...task, status: accepted.size === 2 ? 'completed' : 'review',
        deliverables: task.deliverables!.map(item => ({ ...item, acceptanceStatus: accepted.has(String(item.deliverableId)) ? 'accepted' : 'pending' })),
      } as WorkbenchTask }
    })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskReviewDeliverable: review, aiGenerate: generate })
    render(<AppShell />)
    const summary = await screen.findByRole('region', { name: '本轮协作总结' })
    expect(summary).toHaveTextContent('本轮交付')
    expect(summary).toHaveTextContent('交付成果')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(review).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认完成' }))
    await waitFor(() => expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('已结束 · 已完成'))
    expect(review).toHaveBeenCalledTimes(2)
    expect(accepted).toEqual(new Set(['primary', 'second']))
    expect(generate).not.toHaveBeenCalled()
  })

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

  it.each([
    ['tool_execution_completed', '基于执行结果继续'],
    ['tool_approval_expired', '重新生成操作审批'],
  ])('restores precise %s continuation copy without auto starting', async (kind, label) => {
    const task = { ...reviewTask(), status: 'needs_input', attention: { kind, action: 'retry' }, deliverables: [] } as WorkbenchTask
    const retry = vi.fn(async () => ({ ok: true, task: { ...task, status: 'starting' } as WorkbenchTask }))
    useAppStore.setState({ expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskRetry: retry })
    render(<AppShell />)
    const button = await screen.findByRole('button', { name: label })
    expect(screen.queryByRole('button', { name: '重新执行' })).not.toBeInTheDocument()
    expect(retry).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(retry).toHaveBeenCalledWith(task.id))
  })

  it.each(['answer', 'image', 'video', 'audio'])('RQA07 restores %s v2 review actions after a cold reopen without losing dialogue', async (type) => {
    const task = reviewTask()
    const first = '第一版：先验证渠道成本。'
    const feedback = '请补充退款率并重新判断。'
    const second = '第二版：计入退款率后先小规模验证。'
    task.deliverables = [{ ...task.deliverables![0], type, version: 2, artifactRef: 'session-reopen#v2' }]
    const room = { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId, name: task.title! }
    useAppStore.setState({ expertRoom: room })
    const accept = vi.fn(async () => ({ ok: true, task: { ...task, status: 'completed' } as WorkbenchTask }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertTaskReviewDeliverable: accept,
      agentSessionGet: async (id) => ({ ok: true, session: {
        id,
        messages: id.includes('discussion-v3') ? [
          { id: 'v1-message', role: 'assistant', text: first, createdAt: '2026-09-06T01:00:00Z' },
          { id: 'revision-feedback', role: 'user', text: feedback, createdAt: '2026-09-06T01:01:00Z' },
          { id: 'v2-message', role: 'assistant', text: second, createdAt: '2026-09-06T01:02:00Z' },
        ] : [],
        run: { artifacts: id === 'session-reopen' ? [{
          id: 'v2', type, title: '修订成果', body: second,
          ...(type === 'answer' ? {} : { targetPath: `https://media.example.test/review.${type === 'image' ? 'png' : type === 'video' ? 'mp4' : 'mp3'}` }),
        }] : [] },
      } }),
    })
    const firstMount = render(<AppShell />)
    await screen.findByText(feedback)
    firstMount.unmount()
    useAppStore.setState({ expertRoom: { ...room, messages: [] } })
    render(<AppShell />)
    await screen.findByText(feedback)
    await waitFor(() => expect(screen.getAllByRole('button', { name: '确认完成' })).toHaveLength(1))
    expect(screen.getAllByText(first)).toHaveLength(1)
    expect(screen.getAllByText(second)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '继续调整' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    if (type === 'image') {
      expect(within(screen.getByTestId('artifact-preview')).queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument()
      expect(within(screen.getByTestId('expert-action-turn')).getByRole('button', { name: '确认完成' })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '确认完成' }))
    await waitFor(() => expect(accept).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id, deliverableId: 'primary', decision: 'accept' })))
  })

  it.each(['running', 'revising', 'needs_input', 'failed', 'cancelled', 'completed'].flatMap(status =>
    ['answer', 'image', 'document'].map(type => ({ status, type })),
  ))('RQA07 hides stale pending $type acceptance in $status on reopen', async ({ status, type }) => {
    const task = { ...reviewTask(), status } as WorkbenchTask
    task.deliverables = [{ ...task.deliverables![0], type }]
    useAppStore.setState({ expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('expert-task-goal')).toHaveTextContent('帮我查看当前有哪些消息要处理'))
    expect(screen.queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '继续调整' })).not.toBeInTheDocument()
  })

  it.each(['hub', 'detail'])('RQA07 uses the %s expert identity for the task panel instead of the reopened task title', async (source) => {
    const task = reviewTask()
    task.title = 'QA 渠道判断修订任务'
    task.expertName = task.title
    task.deliverables = [{ ...task.deliverables![0], type: 'image' }]
    useAppStore.setState({
      hubItems: source === 'hub' ? [{ id: task.expertId!, kind: 'expert', name: '商业洞察专家' }] : [],
      expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId, name: task.title,
        messages: [{ id: 'result', role: 'assistant', text: '我已完成渠道判断。' }] },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertGet: async () => source === 'detail' ? ({ ok: true, expert: { id: task.expertId, name: '商业洞察专家' } }) : ({ ok: false }),
    })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByTestId('expert-reply-message')).toHaveTextContent('我已完成渠道判断。')
      expect(screen.getByTestId('expert-reply-message')).toHaveTextContent('商业洞察专家')
    })
  })

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

    const previewCard = await screen.findByTestId('artifact-preview')
    expect(previewCard).toHaveAttribute('data-artifact-contract', 'knowme.artifact-preview/v1')
    expect(previewCard.classList.contains('has-excerpt')).toBe(true)
    await waitFor(() => expect(previewCard).toHaveTextContent('这是只存在于完整产物中的正文内容。'))
    expect(within(previewCard).getByText('预览')).toBeInTheDocument()
    expect(screen.queryByText('交付物')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '飞书消息处理清单' })).not.toBeInTheDocument()
    const previewButton = screen.getByRole('button', { name: '打开今日待办与消息汇总' })
    fireEvent.click(previewButton)

    const dialog = await screen.findByRole('dialog', { name: '今日待办与消息汇总' })
    expect(within(dialog).queryByText('成果物预览')).not.toBeInTheDocument()
    expect(within(dialog).getByText('文档 · 第 1 版')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '飞书消息处理清单' })).toBeInTheDocument()
    expect(within(dialog).getByTestId('expert-artifact-view')).toHaveAttribute('data-artifact-kind', 'document')
    expect(within(dialog).getByRole('document', { name: '今日待办与消息汇总正文' })).toBeInTheDocument()
    expect(within(dialog).getByText('这是只存在于完整产物中的正文内容。')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: '继续处理' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: '复制内容' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /生图专家/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Document/)).not.toBeInTheDocument()
    expect(within(dialog).queryByText('已整理出待处理消息，并按紧急程度给出负责人和截止时间。')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭文档预览' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show an answer deliverable twice when the same assistant turn is already in the dialogue', async () => {
    const task = reviewTask()
    const answer = '产品需求文档已整理完成，包含目标、范围、玩法流程和验收标准。'
    task.brief = {
      ...task.brief,
      deliverables: [{ id: 'primary', title: '产品需求文档', type: 'answer', required: true }],
    }
    task.deliverables = [{
      deliverableId: 'primary', title: '产品需求文档', type: 'answer', version: 1,
      required: true, acceptanceStatus: 'pending', comments: [], artifactRef: 'session-answer#answer-1',
    }]
    useAppStore.setState({ expertRoom: {
      ...useAppStore.getState().expertRoom!,
      messages: [{ id: 'answer-message', role: 'assistant', text: answer, createdAt: '2026-08-19T14:01:00.000Z' }],
    } })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({
        ok: true,
        session: { id: 'session-answer', run: { artifacts: [{ id: 'answer-1', type: 'answer', title: '产品需求文档', body: answer }] } },
      }),
    })

    render(<AppShell />)

    expect(await screen.findAllByText(answer)).toHaveLength(1)
    expect(screen.queryByText('请查看图片，可以接受成果，也可以在下方输入框告诉我需要修改的地方。')).not.toBeInTheDocument()
  })

  it('renders an image deliverable as a thumbnail and opens the original in the preview dialog', async () => {
    const task = reviewTask()
    task.expertId = 'image-producer'
    task.events = [{ id: 'image-ready', type: 'deliverable_ready', summary: '机器人 Icon 候选图' }]
    task.deliverables = [{
      deliverableId: 'generated-image',
      title: '机器人 Icon 候选图',
      type: 'image',
      version: 1,
      required: true,
      acceptanceStatus: 'pending',
      comments: [],
      artifactRef: 'session-image#image-1',
    }]
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({
        ok: true,
        session: {
          id: 'session-image',
          run: {
            artifacts: [{
              id: 'image-1',
              type: 'image',
              title: '机器人 Icon 候选图',
              body: '[机器人 Icon 候选图](https://images.example.test/robot-icon.jpg)',
            }],
          },
        },
      }),
    })

    render(<AppShell />)

    const imageButton = await screen.findByRole('button', { name: '查看机器人 Icon 候选图原图' })
    const preview = screen.getByTestId('artifact-preview')
    expect(within(preview).queryByText('待验收')).not.toBeInTheDocument()
    expect(within(preview).queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument()
    const reviewTurn = screen.getByTestId('expert-action-turn')
    expect(within(reviewTurn).getByText('如需调整，请直接在下方输入修改内容。')).toBeInTheDocument()
    expect(within(reviewTurn).getByRole('button', { name: '确认完成' })).toBeInTheDocument()
    expect(within(reviewTurn).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(within(imageButton).getByRole('img', { name: '机器人 Icon 候选图' })).toHaveAttribute('src', 'https://images.example.test/robot-icon.jpg')
    expect(useAppStore.getState().linkPreview).toBeNull()
    fireEvent.click(imageButton)
    const dialog = await screen.findByRole('dialog', { name: '机器人 Icon 候选图' })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(within(dialog).getByRole('img', { name: '机器人 Icon 候选图' })).toHaveAttribute('src', 'https://images.example.test/robot-icon.jpg')
    expect(within(dialog).queryByRole('button', { name: '继续处理' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /生图专家/ })).not.toBeInTheDocument()
    expect(useAppStore.getState().linkPreview).toBeNull()
  })

  it('renders a locally persisted image artifact in the conversation before opening the preview dialog', async () => {
    const task = reviewTask()
    task.expertId = 'image-producer'
    task.deliverables = [{
      deliverableId: 'generated-image',
      title: '本地机器人图标',
      type: 'image',
      version: 1,
      required: true,
      acceptanceStatus: 'pending',
      comments: [],
      artifactRef: 'session-image#image-local',
    }]
    const artifactPreviewResolve = vi.fn(async (source: string) => ({
      ok: true,
      source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      resolvedFrom: source,
    }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({
        ok: true,
        session: {
          id: 'session-image',
          run: {
            artifacts: [{
              id: 'image-local',
              type: 'image',
              title: '本地机器人图标',
              targetPath: 'C:\\KnowMe\\generated-images\\robot-icon.png',
            }],
          },
        },
      }),
      artifactPreviewResolve,
    })

    render(<AppShell />)

    const image = await screen.findByRole('img', { name: '本地机器人图标' })
    expect(image).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
    expect(artifactPreviewResolve).toHaveBeenCalledWith('C:\\KnowMe\\generated-images\\robot-icon.png')
    const imageButton = screen.getByRole('button', { name: '查看本地机器人图标原图' })
    fireEvent.click(imageButton)
    const dialog = await screen.findByRole('dialog', { name: '本地机器人图标' })
    expect(within(dialog).getByRole('img', { name: '本地机器人图标' })).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
  })

  it('keeps the expert result explanation beside an image deliverable', async () => {
    const task = reviewTask()
    task.expertId = 'image-producer'
    task.deliverables = [{
      deliverableId: 'generated-image', title: '机器人 Icon', type: 'image', version: 1,
      required: true, acceptanceStatus: 'pending', comments: [], artifactRef: 'session-image#image-1',
    }]
    useAppStore.setState({ expertRoom: {
      id: task.id, taskId: task.id, expertId: 'image-producer', name: '生图执行专家', goal: task.goal || '', log: [],
      messages: [{ id: 'result-copy', role: 'assistant', text: '机器人 Icon 生成完成。\n\n本轮采用扁平几何风格，保持了小尺寸辨识度。' }],
      skills: [], connectors: [], knowledgeRefs: [],
    } })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({ ok: true, session: { id: 'session-image', run: { artifacts: [
        { id: 'image-1', type: 'image', title: '机器人 Icon', targetPath: 'https://images.example.test/robot.jpg' },
      ] } } }),
    })

    render(<AppShell />)

    expect(await screen.findByText('机器人 Icon 生成完成。')).toBeInTheDocument()
    expect(screen.getByText('本轮采用扁平几何风格，保持了小尺寸辨识度。')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: '机器人 Icon' })).toBeInTheDocument()
  })

  it('does not render a fake preview or file card before an image artifact exists', async () => {
    const task = reviewTask()
    task.expertId = 'image-producer'
    task.events = [{ id: 'image-ready', type: 'deliverable_ready', summary: '机器人 Icon 候选图' }]
    task.deliverables = [{
      deliverableId: 'generated-image', title: '机器人 Icon 候选图', type: 'image', version: 1,
       required: true, acceptanceStatus: 'pending', comments: [],
    }]
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
    })

    render(<AppShell />)

    await screen.findByTestId('expert-delivery-room')
    expect(screen.queryByTestId('artifact-preview')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '机器人 Icon 候选图' })).not.toBeInTheDocument()
    expect(screen.queryByText('点击打开全文')).not.toBeInTheDocument()
  })

  it('groups multiple image deliverables in one preview dialog with thumbnail navigation', async () => {
    const task = reviewTask()
    task.expertId = 'image-producer'
    task.deliverables = [
      {
        deliverableId: 'generated-image-1', title: '机器人 Icon 方案 A', type: 'image', version: 1,
        required: true, acceptanceStatus: 'pending', comments: [], artifactRef: 'session-image#image-1',
      },
      {
        deliverableId: 'generated-image-2', title: '机器人 Icon 方案 B', type: 'image', version: 1,
        required: true, acceptanceStatus: 'pending', comments: [], artifactRef: 'session-image#image-2',
      },
    ]
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({
        ok: true,
        session: {
          id: 'session-image',
          run: {
            artifacts: [
              { id: 'image-1', type: 'image', title: '机器人 Icon 方案 A', targetPath: 'https://images.example.test/robot-a.jpg' },
              { id: 'image-2', type: 'image', title: '机器人 Icon 方案 B', targetPath: 'https://images.example.test/robot-b.jpg' },
            ],
          },
        },
      }),
    })

    render(<AppShell />)

    expect(await screen.findAllByTestId('artifact-preview')).toHaveLength(2)
    expect(screen.queryByText('已查看 2 张图像')).not.toBeInTheDocument()
    const sidebar = screen.getByTestId('expert-task-capabilities')
    expect(within(sidebar).queryByText('机器人 Icon 方案 A')).not.toBeInTheDocument()
    expect(within(sidebar).queryByText('机器人 Icon 方案 B')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '查看机器人 Icon 方案 B原图' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看机器人 Icon 方案 B原图' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('机器人 Icon 方案 B')
    expect(within(dialog).getByText('2 / 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: '机器人 Icon 方案 B' })).toHaveAttribute('src', 'https://images.example.test/robot-b.jpg')
    fireEvent.click(within(dialog).getByRole('button', { name: '上一张图片' }))
    expect(await within(dialog).findByRole('img', { name: '机器人 Icon 方案 A' })).toHaveAttribute('src', 'https://images.example.test/robot-a.jpg')
    expect(within(dialog).getByText('1 / 2')).toBeInTheDocument()
  })

  it('keeps failed task state authoritative without keyword-filtering normal assistant messages', async () => {
    const task = {
      ...reviewTask(),
      id: 'task-image-failed',
      expertId: 'image-producer',
      expertName: '生图执行专家',
      status: 'needs_input',
      deliverables: [],
      events: [{ id: 'image-failed', type: 'needs_input', summary: '图片生成未返回结果，请重新执行。' }],
    } as WorkbenchTask
    useAppStore.setState({ expertRoom: {
      id: task.id, taskId: task.id, expertId: task.expertId, name: task.expertName || '', goal: task.goal || '', log: [],
      messages: [
        { id: 'image-user', role: 'user', text: '生成一张机器人 Icon' },
        { id: 'image-noisy-reply', role: 'assistant', text: '上下文准备完成，机器人 Icon 生成完成，预览已附在成果区。' },
      ], skills: [], connectors: [], knowledgeRefs: [],
    } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    expect(await screen.findByTestId('expert-primary-status')).toBeInTheDocument()
    expect(screen.getByText(/机器人 Icon 生成完成/)).toBeInTheDocument()
    expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('还需要一项信息')
    expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('还需要一项信息')
    expect(screen.queryByTestId('artifact-preview')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('restores persisted discussion messages when a task is reopened', async () => {
    const task = { ...reviewTask(), status: 'running', deliverables: [] } as WorkbenchTask
    useAppStore.setState({
      expertRoom: {
        id: task.id,
        taskId: task.id,
        expertId: task.expertId,
        name: task.expertName || '',
        goal: task.goal || '',
        log: [],
        messages: [],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    const getSession = vi.fn(async (id: string) => id.includes('discussion-v3') ? ({
      ok: true,
      session: {
        id,
        messages: [
          { id: 'persisted-user', role: 'user', text: '请把结果按优先级重新排序。', createdAt: '2026-08-19T14:00:00.000Z' },
          { id: 'persisted-answer', role: 'assistant', text: '可以，我会按紧急程度和截止时间重新整理。', createdAt: '2026-08-19T14:01:00.000Z' },
        ],
      },
    }) : ({ ok: false }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: getSession,
    })

    render(<AppShell />)

    const log = await screen.findByTestId('expert-collab-log')
    expect(within(log).getByTestId('expert-user-message')).toHaveTextContent('请把结果按优先级重新排序')
    expect(within(log).getByTestId('expert-reply-message')).toHaveTextContent('按紧急程度和截止时间重新整理')
    expect(getSession).toHaveBeenCalledWith('wb-expert-task-review-discussion-v3')
  })

  it('restores task-scoped planning and user confirmation without loading another task by expert ID', async () => {
    const task = { ...reviewTask(), status: 'running', deliverables: [] } as WorkbenchTask
    useAppStore.setState({ expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id } })
    const getSession = vi.fn(async (id: string) => id === 'wb-expert-task-review-planning-v3' ? ({
      ok: true, session: { id, messages: [
        { id: 'brief-user', role: 'user', text: '请生成一张白底机器人头像。', createdAt: '2026-09-05T11:00:00Z' },
        { id: 'brief-plan', role: 'assistant', text: '按白底、极简方案生成一张，是否确认？', createdAt: '2026-09-05T11:01:00Z' },
        { id: 'brief-confirm', role: 'user', text: '确认计划并执行', createdAt: '2026-09-05T11:02:00Z' },
      ] },
    }) : ({ ok: false }))
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), agentSessionGet: getSession })
    render(<AppShell />)
    await screen.findByText('请生成一张白底机器人头像。')
    const log = screen.getByTestId('expert-collab-log')
    expect(within(log).getAllByTestId('expert-user-message').map(node => node.textContent))
      .toEqual(expect.arrayContaining([expect.stringContaining('请生成一张白底机器人头像。'), expect.stringContaining('确认计划并执行')]))
    expect(getSession).toHaveBeenCalledWith('wb-expert-task-review-planning-v3')
    expect(getSession).not.toHaveBeenCalledWith('wb-expert-office-partner-planning-v3')
  })

  it('shows the saved task goal when the discussion session has no messages', async () => {
    const task = { ...reviewTask(), status: 'review', deliverables: [] } as WorkbenchTask
    useAppStore.setState({
      expertRoom: {
        id: task.id,
        taskId: task.id,
        expertId: task.expertId,
        name: task.expertName || '',
        goal: '',
        log: [],
        messages: [{ id: 'sys-reopen', role: 'assistant', text: '我已接手这项协作。' }],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async (id: string) => ({ ok: true, session: { id, messages: [] } }),
    })

    render(<AppShell />)

    const log = await screen.findByTestId('expert-collab-log')
    expect(within(log).queryByTestId('expert-user-message')).not.toBeInTheDocument()
    expect(screen.getByTestId('expert-task-goal')).toHaveTextContent('帮我查看当前有哪些消息要处理')
  })

  it('keeps the newest user message in view after sending', async () => {
    useAppStore.setState({
      expertRoom: {
        id: 'image-producer', expertId: 'image-producer', name: '生图执行专家', goal: '', log: [],
        messages: [{ id: 'expert-question', role: 'assistant', text: '你希望画面中的主体是什么？' }],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task: undefined }),
      expertGet: async () => ({ ok: true, expert: { name: '生图执行专家', skills: [] } }),
    })

    render(<AppShell />)

    const panel = await screen.findByTestId('expert-dialogue-scroll')
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 720 })
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 320 })
    panel.scrollTop = 0
    act(() => {
      const room = useAppStore.getState().expertRoom!
      useAppStore.setState({
        expertRoom: {
          ...room,
          messages: [...room.messages, { id: 'user-answer', role: 'user', text: '偏向具象的小机器人' }],
        },
      })
    })

    await waitFor(() => expect(panel.scrollTop).toBe(720))
  })

  it('uses the expert message as the only prompt when the user merely needs to provide information', async () => {
    const task = {
      ...reviewTask(),
      status: 'needs_input',
      deliverables: [],
      attention: {
        kind: 'information',
        action: 'provide_input',
        detail: '请补充你希望保留的文字成果范围。',
        item: '文字成果范围',
        question: '请补充你希望保留的文字成果范围。',
        nextStep: '直接在下方输入，或添加相关文件。',
      },
    } as WorkbenchTask
    useAppStore.setState({
      expertRoom: {
        id: task.id, taskId: task.id, expertId: task.expertId, name: task.expertName || '', goal: task.goal || '', log: [],
        messages: [], skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    expect(await screen.findByText('请补充你希望保留的文字成果范围。')).toBeInTheDocument()
    expect(screen.queryByTestId('expert-needs-input')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '在下方补充' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('uses the approval card as the only action while a file operation awaits approval', async () => {
    const task = {
      ...reviewTask(),
      status: 'needs_input',
      deliverables: [],
      execRef: { kind: 'session', id: 'approval-session' },
      attention: {
        kind: 'approval_required', action: 'provide_input', draftId: 'file-draft', runId: 'approval-run',
      },
    } as WorkbenchTask
    useAppStore.setState({
      expertRoom: {
        ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId,
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      toolDraftsList: async () => ({ ok: true, drafts: [{
        id: 'file-draft', kind: 'file', status: 'pending_review', action: 'write_file',
        path: 'outputs/knowme-landing/index.html', preview: '+ <main>KnowMe</main>',
        sessionId: 'approval-session', runId: 'approval-run',
      }] }),
      taskCapabilityGrantsList: async () => ({ ok: true, grants: [] }),
    })

    render(<AppShell />)

    expect(await screen.findByText('等待操作审批 · 写入文件')).toBeInTheDocument()
    expect(screen.getByText('查看写入内容')).toBeInTheDocument()
    expect(screen.queryByText(/继续处理前，我还需要你补充/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('expert-needs-input')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    const explanation = screen.getByText(/聊天不会自动批准操作/)
    expect(screen.getByRole('button', { name: '批准这次操作' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝这次操作' })).toBeInTheDocument()
    const approvalCard = screen.getByLabelText('本任务审批与授权')
    const approvalTurn = screen.getByTestId('expert-approval-turn')
    expect(approvalTurn.parentElement).toHaveAttribute('data-testid', 'expert-collab-log')
    expect(approvalTurn).toContainElement(approvalCard)
    expect(approvalTurn).toContainElement(explanation)
    expect(screen.queryByTestId('expert-action-turn')).not.toBeInTheDocument()
  })

  it('keeps the composer available during execution and queues a new instruction', async () => {
    const task = {
      ...reviewTask(),
      status: 'running',
      deliverables: [],
      progress: {
        phase: 'waiting_tool',
        label: '正在调用盘古生成图片',
        detail: '正在等待 generate_image 返回结果。',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      },
    } as WorkbenchTask
    const queueInput = vi.fn(async () => ({ ok: true, queued: true, task }))
    useAppStore.setState({
      isGenerating: true,
      expertRoom: {
        id: task.id, taskId: task.id, expertId: task.expertId, name: task.expertName || '', goal: task.goal || '', log: [],
        messages: [], skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertTaskProvideInput: queueInput,
    })

    render(<AppShell />)

    expect(await screen.findByTestId('expert-primary-status')).toHaveTextContent('正在调用盘古生成图片')
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('当前步骤完成后'))
    fireEvent.change(input, { target: { value: '将画面主体调整为具象小机器人' } })
    // The status panel proves task loading, not the controlled composer's next render.
    // Wait for both the workbench store and render-derived readiness before Enter:
    // the DOM value alone can already contain fireEvent.change's uncommitted value.
    await waitFor(() => {
      expect(useAppStore.getState().workbenchDialogue.composer).toBe('将画面主体调整为具象小机器人')
      expect(screen.getByRole('textbox')).toHaveValue('将画面主体调整为具象小机器人')
      expect(screen.getByRole('button', { name: '发送' })).toHaveClass('is-ready')
    })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    await waitFor(() => expect(queueInput).toHaveBeenCalledWith(expect.objectContaining({
      taskId: task.id,
      note: '将画面主体调整为具象小机器人',
      action: 'provide_input',
      queue: true,
    })))
    expect(queueInput).toHaveBeenCalledTimes(1)
  })

  it('uses a quiet section label and keeps an empty result area silent', async () => {
    const task = { ...reviewTask(), status: 'running', deliverables: [], expertId: 'image-producer', expertName: '生图执行专家' } as WorkbenchTask
    useAppStore.setState({
      expertRoom: {
        id: task.id, taskId: task.id, expertId: task.expertId, name: task.expertName || '', goal: task.goal || '', log: [],
        messages: [], skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    const sidebar = await screen.findByTestId('expert-task-capabilities')
    const label = within(sidebar).getByText('成果物')
    expect(label).toHaveClass('wb-detail-section-kicker')
    expect(label.closest('section')).toHaveClass('is-empty')
    expect(within(sidebar).queryByRole('heading', { name: '成果物' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByText('本次协作')).not.toBeInTheDocument()
    expect(within(sidebar).queryByText('图片生成后会显示在这里')).not.toBeInTheDocument()
  })

  it('shows only the current completion status instead of a workflow-like stage rail', async () => {
    const task = reviewTask()
    task.status = 'completed'
    task.deliverables = task.deliverables?.map((item) => ({
      ...item,
      acceptanceStatus: 'accepted',
      artifactRef: 'session-review#accepted-document',
    }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
    })

    render(<AppShell />)

    await waitFor(() => expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('已结束 · 已完成'))
    expect(screen.queryByRole('list', { name: /协作阶段/ })).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('任务对话状态')).queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('任务已完成')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('expert-room')).getByRole('textbox')).toBeInTheDocument()
    expect(within(screen.getByTestId('expert-task-capabilities')).getByRole('heading', { name: '成果物' })).toBeInTheDocument()
    expect(within(screen.getByTestId('expert-task-capabilities')).getByRole('button', { name: /今日待办与消息汇总/ })).toBeInTheDocument()
  })

  it('keeps one primary status outlet visible before a draft has a plan', async () => {
    const task: WorkbenchTask = {
      id: 'task-draft-empty',
      kind: 'expert',
      title: '待补充的协作',
      goal: '待补充的协作',
      expertId: 'office-partner',
      expertName: '办公协作专家',
      status: 'draft',
      execRef: { kind: 'none' },
      events: [{ id: 'created', type: 'created', summary: '已打开新的协作任务' }],
      deliverables: [],
      brief: { goal: '待补充的协作', materials: [], deliverables: [], constraints: [] },
    }
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    expect(await screen.findByTestId('expert-primary-status')).toHaveAttribute('aria-label', '当前协作状态：正在准备协作')
    expect(screen.getByTestId('expert-primary-status')).toHaveTextContent('正在准备协作')
    expect(within(screen.getByLabelText('任务对话状态')).queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the current plan status and submits the expert-authored structured plan', async () => {
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
            text: '【协作计划】\n目标：分析上周会议\n交付：行动项同步稿\n验收：行动项可以直接跟进\n能力：会议证据与纪要整理\n执行步骤：\n1. 提取议题与关键结论\n2. 识别负责人和截止时间\n3. 生成可审阅的同步稿',
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

    expect(await screen.findByTestId('expert-primary-status')).toHaveTextContent('等待确认计划')
    expect(screen.queryByRole('list', { name: /协作阶段/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('expert-task-goal')).toHaveTextContent('分析上周会议')
    expect(screen.getByTestId('expert-task-goal')).toHaveClass('is-confirmed')
    const plan = screen.getByRole('list', { name: '本次执行步骤' })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3)
    expect(within(plan).getByText('识别负责人和截止时间')).toBeInTheDocument()

    expect(screen.queryByRole('checkbox', { name: /交付后需要我审阅/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认计划并执行' }))
    await waitFor(() => expect(createTask).toHaveBeenCalled())
    const submitted = createTask.mock.calls[0]?.[0]
    expect(submitted?.brief?.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'confirmed-plan',
        title: '已确认的执行计划',
        content: expect.stringContaining('2. 识别负责人和截止时间'),
      }),
      expect.objectContaining({
        id: 'user-plan-confirmation',
        type: 'user_confirmation',
        content: '确认计划并执行',
      }),
    ]))
    expect(submitted?.brief?.completionPolicy).toBe('review')
    expect(submitted?.brief?.plan).toMatchObject({
      goal: '分析上周会议',
      steps: ['提取议题与关键结论', '识别负责人和截止时间', '生成可审阅的同步稿'],
      acceptanceCriteria: ['行动项可以直接跟进'],
    })
    expect(screen.getAllByTestId('expert-user-message').at(-1)).toHaveTextContent('确认计划并执行')
  })

  it.each(['draft', 'running', 'needs_input', 'review', 'completed'] as const)('restores one persisted user confirmation after reopening a %s task', async (status) => {
    const task: WorkbenchTask = {
      ...reviewTask(),
      status,
      brief: {
        ...reviewTask().brief,
        materials: [
          { id: 'confirmed-plan', type: 'text', title: '已确认的执行计划', content: '按三步执行' },
          { id: 'user-plan-confirmation', type: 'user_confirmation', title: '用户确认', content: '确认计划并执行' },
        ],
      },
      deliverables: [],
    }
    useAppStore.setState({
      expertRoom: {
        id: task.id,
        taskId: task.id,
        name: '办公协作专家',
        expertId: 'office-partner',
        goal: String(task.goal || ''),
        log: [],
        messages: [],
        skills: [],
        connectors: [],
        knowledgeRefs: [],
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({ ok: true, session: { id: 'empty-session', messages: [] } }),
    })

    const view = render(<AppShell />)

    expect(await screen.findByText('确认计划并执行')).toBeInTheDocument()
    expect(screen.getAllByTestId('expert-user-message').filter((message) => message.textContent?.includes('确认计划并执行'))).toHaveLength(1)
    expect(screen.getAllByText(task.goal || '').length).toBeGreaterThan(0)

    // An unmounted room must restore from saved task data, not optimistic UI state.
    view.unmount()
    useAppStore.setState((state) => ({ expertRoom: state.expertRoom ? { ...state.expertRoom, messages: [] } : null }))
    render(<AppShell />)
    expect(await screen.findByText('确认计划并执行')).toBeInTheDocument()
    expect(screen.getAllByTestId('expert-user-message').filter((message) => message.textContent?.includes('确认计划并执行'))).toHaveLength(1)
  })

  it('does not invent a user quote from a legacy start event without saved confirmation text', async () => {
    const task: WorkbenchTask = {
      ...reviewTask(), status: 'running', deliverables: [],
      events: [{ id: 'legacy-start', type: 'created', summary: '已确认委托单并开始预检', createdAt: '2026-09-05T10:47:09Z' }],
    }
    useAppStore.setState((state) => ({ expertRoom: state.expertRoom ? { ...state.expertRoom, taskId: task.id } : null }))
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      agentSessionGet: async () => ({ ok: true, session: { id: 'empty-session', messages: [] } }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.queryByText('正在进入协作')).not.toBeInTheDocument())
    const userMessages = screen.queryAllByTestId('expert-user-message')
    expect(userMessages.some((message) => /确认计划并执行|已确认委托单/.test(message.textContent || ''))).toBe(false)
  })

  it.each([true, false])('blocks buttons and typed consent while clarification is unresolved (same message: %s)', async sameMessage => {
    const createTask = vi.fn()
    const plan = '【协作计划】\n目标：开发宣传页\n交付：页面方案\n验收：结构完整\n能力：前端设计\n执行步骤：\n1. 设计布局\n2. 实现组件\n请确认是否按此计划执行？'
    const clarification = '请补充以下关键信息以便进入下一步：\n1. 目标受众是谁？\n2. 是否有指定品牌色？'
    mockApi({ expertTaskCreateStart: createTask, expertTaskGet: async () => ({ ok: true, task: undefined }) })
    useAppStore.setState({ expertRoom: {
      id: 'software-engineer', expertId: 'software-engineer', name: 'Web 开发专家', goal: '开发宣传页',
      messages: [
        { id: 'u', role: 'user', text: '开发宣传页' },
        { id: 'p', role: 'assistant', text: plan + (sameMessage ? '\n' + clarification : '') },
        ...(!sameMessage ? [{ id: 'q', role: 'assistant' as const, text: clarification }] : []),
      ], log: [], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
    } })
    render(<AppShell />)
    expect(await screen.findByTestId('expert-primary-status')).toHaveTextContent('等待补充')
    expect(screen.queryByRole('button', { name: '确认计划并执行' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '直接开始' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '确认' } })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('确认'))
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(createTask).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('确认')
  })

  it('does not show direct start when a free-form assistant reply asks for materials', async () => {
    const createTask = vi.fn()
    mockApi({ expertTaskCreateStart: createTask, expertTaskGet: async () => ({ ok: true, task: undefined }) })
    useAppStore.setState({ expertRoom: {
      id: 'office-partner', expertId: 'office-partner', name: '办公协作专家', goal: '整理会议材料',
      messages: [
        { id: 'u', role: 'user', text: '整理会议材料' },
        { id: 'a', role: 'assistant', text: '请补充需要整理的会议正文、转写记录或纪要草稿。' },
      ], log: [], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
    } })
    render(<AppShell />)
    expect(await screen.findByTestId('expert-primary-status')).toHaveTextContent('等待补充')
    expect(screen.queryByRole('button', { name: '直接开始' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认计划并执行' })).not.toBeInTheDocument()
    expect(createTask).not.toHaveBeenCalled()
  })

  it('accepts plan confirmation when the plan is visible during a status refresh', async () => {
    const createTask = vi.fn(async () => ({ ok: true, task: { ...reviewTask(), status: 'starting' } }))
    mockApi({
      expertTaskCreateStart: createTask,
      expertGet: async () => ({ ok: true, expert: { id: 'image-producer', name: '生图执行专家' } }),
    })
    useAppStore.setState({ expertRoom: {
      id: 'image-producer', name: '生图执行专家', expertId: 'image-producer', goal: '生成一张机器人 Icon',
      messages: [
        { id: 'user-1', role: 'user', text: '生成一张机器人 Icon' },
        { id: 'plan-1', role: 'assistant', text: '【协作计划】\n目标：生成一张机器人 Icon\n交付物：生成图片\n能力调用：generate_image\n执行步骤：\n1. 确认视觉方向\n2. 调用 generate_image 生成图片\n请确认是否按此计划执行？' },
      ], log: [], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
    } })
    render(<AppShell />)
    const input = await screen.findByRole('textbox')
    expect(screen.queryByRole('button', { name: '直接开始' })).not.toBeInTheDocument()
    const planDecision = screen.getByTestId('expert-plan-decision-turn')
    expect(planDecision).toHaveTextContent('我已整理本次计划')
    expect(planDecision.closest('ol')).toHaveAttribute('aria-label', '协作对话')
    expect(screen.queryByText('【协作计划】')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认计划并执行' })).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '确认' } })
    await waitFor(() => {
      expect(useAppStore.getState().workbenchDialogue.composer).toBe('确认')
      expect(screen.getByRole('textbox')).toHaveValue('确认')
      expect(screen.getByRole('button', { name: '发送' })).toHaveClass('is-ready')
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(createTask).toHaveBeenCalled())
  })

  it('locks the plan actions after choosing to continue clarification and focuses the sole composer', async () => {
    useAppStore.setState({ expertRoom: {
      id: 'software-engineer', name: 'Web 开发专家', expertId: 'software-engineer', goal: '开发宣传页',
      messages: [
        { id: 'user-1', role: 'user', text: '开发宣传页' },
        { id: 'plan-1', role: 'assistant', text: '【协作计划】\n目标：开发宣传页\n交付：HTML/CSS/JS 页面文件\n验收：页面可响应式展示\n能力：frontend-design\n执行步骤：\n1. 设计布局\n2. 编写页面\n请确认是否按此计划执行？' },
      ], log: [], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
    } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task: undefined }) })
    render(<AppShell />)

    fireEvent.click(await screen.findByRole('button', { name: '继续澄清' }))
    expect(screen.getByRole('button', { name: '已选择继续澄清' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '确认计划并执行' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('keeps the task in planning when the host refuses the confirmation receipt', async () => {
    const prepare = vi.fn(async () => ({ ok: false, code: 'plan_needs_clarification', error: '计划仍有未决问题，请先补充后再确认。' }))
    const createTask = vi.fn()
    mockApi({
      expertTaskPreparePlanConfirmation: prepare,
      expertTaskCreateStart: createTask,
      expertTaskGet: async () => ({ ok: true, task: undefined }),
    })
    useAppStore.setState({ expertRoom: {
      id: 'software-engineer', name: 'Web 开发专家', expertId: 'software-engineer', goal: '开发宣传页',
      messages: [
        { id: 'user-1', role: 'user', text: '开发宣传页' },
        { id: 'plan-1', role: 'assistant', text: '【协作计划】\n目标：开发宣传页\n交付：HTML/CSS/JS 页面文件\n验收：页面可响应式展示\n能力：frontend-design\n执行步骤：\n1. 设计布局\n2. 编写页面\n请确认是否按此计划执行？' },
      ], log: [], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
    } })

    render(<AppShell />)
    fireEvent.click(await screen.findByRole('button', { name: '确认计划并执行' }))

    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    expect(createTask).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('计划仍有未决问题，请先补充后再确认。')
    expect(screen.queryAllByTestId('expert-user-message').some(message => message.textContent?.includes('确认计划并执行'))).toBe(false)
  })

  it('keeps the plan confirmation area visible while generation is refreshing', async () => {
    useAppStore.setState({
      isGenerating: true,
      expertRoom: {
        id: 'office-partner', name: '办公协作专家', expertId: 'office-partner', goal: '整理上周会议', log: [],
        messages: [
          { id: 'user-goal', role: 'user', text: '整理上周会议' },
          { id: 'plan-1', role: 'assistant', text: '【协作计划】\n目标：整理上周会议\n交付物：会议同步稿\n执行步骤：\n1. 提取关键结论\n2. 整理行动项\n请确认是否按此计划执行？' },
        ], skills: [], connectors: [], knowledgeRefs: [], taskStatus: 'draft',
      },
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task: undefined }),
      expertGet: async () => ({ ok: true, expert: { id: 'office-partner', name: '办公协作专家' } }),
    })

    render(<AppShell />)

    expect(await screen.findByRole('list', { name: '本次执行步骤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正在处理…' })).toBeDisabled()
  })

  it.each(['确认', '确认，按计划执行。', '好的，按这个计划执行吧。'])('routes typed plan consent to execution rather than another planning turn: %s', async (confirmation) => {
    const generate = vi.fn(async () => ({ text: '请继续补充需求' }))
    let runningTask: WorkbenchTask | undefined
    const createTask = vi.fn(async (payload: { brief?: WorkbenchTask['brief'] }) => {
      runningTask = {
        id: 'task-image-running', kind: 'expert', status: 'running', title: '生成 AI 办公伙伴图标',
        expertId: 'image-producer', expertName: '生图执行专家', brief: payload.brief,
        events: [{ id: 'started', type: 'task_started', summary: '专家已开始执行' }], deliverables: [],
      }
      return { ok: true, task: runningTask }
    })
    useAppStore.setState({
      expertRoom: {
        id: 'image-producer', expertId: 'image-producer', name: '生图执行专家', goal: '生成 AI 办公伙伴图标', log: [],
        messages: [
          { id: 'user-goal', role: 'user', text: '生成一个具象小机器人风格的 AI 办公伙伴图标' },
          {
            id: 'expert-plan', role: 'assistant',
            text: '### 【协作计划】\n**目标：** 生成 AI 办公伙伴图标\n**交付物：** 生成图片\n**能力调用：** `generate_image`\n**执行步骤：**\n1. 固定主体与视觉方向\n2. 编译最终 Prompt\n3. 调用 `generate_image` 生成真实图片\n请确认是否按此计划执行？',
          },
        ],
        skills: [], connectors: [], knowledgeRefs: [],
      },
    })
    mockApi({
      aiGenerate: generate,
      expertTaskGet: async () => ({ ok: true, task: runningTask }),
      expertTaskCreateStart: createTask,
    })

    render(<AppShell />)

    expect(await screen.findByTestId('expert-primary-status')).toHaveTextContent('等待确认计划')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: confirmation } })
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(confirmation))
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1))
    expect(generate).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('expert-user-message').at(-1)).toHaveTextContent(confirmation)
    expect(createTask.mock.calls[0][0].brief?.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'user_confirmation', content: confirmation }),
    ]))
    expect(await screen.findByText('计划已确认，任务已启动；实际操作和成果以执行记录为准。')).toBeInTheDocument()
    expect(await screen.findByTestId('expert-primary-status')).toHaveAttribute('aria-label', '当前协作状态：专家执行中')
  })

  it('asks for missing execution evidence in the expert voice with direct choices', async () => {
    const task = {
      ...reviewTask(),
      status: 'needs_input',
      deliverables: [],
      events: [
        { id: 'created', type: 'created', summary: '已确认委托单并开始预检' },
        { id: 'blocked', type: 'needs_input', summary: '缺少必需读取：生成导入方案' },
      ],
    } as WorkbenchTask
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })

    render(<AppShell />)

    const reply = await screen.findByTestId('expert-action-turn')
    expect(within(reply).getByText(/本次执行停在「生成导入方案」/)).toBeInTheDocument()
    expect(within(reply).getByRole('button', { name: '重新执行' })).toBeInTheDocument()
    expect(within(reply).queryByRole('button', { name: '仅用现有材料' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByText('任务系统')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /补做读取|等待补充/ })).not.toBeInTheDocument()
  })

  it('condenses repeated progress into one expert update with expandable work evidence', async () => {
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
    expect(processItems).toHaveLength(1)
    expect(processItems[0]).toHaveTextContent('执行记录 9')
    expect(processItems[0]).toHaveClass('is-active')
    expect(within(room).getByText('查看已完成的工作（9）')).toBeInTheDocument()
    expect(within(room).queryByText('任务系统')).not.toBeInTheDocument()
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
    expect(within(screen.getByLabelText('任务对话状态')).queryByRole('status')).not.toBeInTheDocument()
    const controlPanel = screen.getByTestId('expert-room')
    const reviewPanel = screen.getByTestId('expert-delivery-room')
    expect(within(controlPanel).getByLabelText('当前专家')).toHaveTextContent('办公协作专家')
    expect(within(controlPanel).getByText('本次委托')).toBeInTheDocument()
    expect(within(controlPanel).getByText('目标')).toBeInTheDocument()
    expect(within(controlPanel).getByText('帮我查看当前有哪些消息要处理')).toBeInTheDocument()
    expect(within(controlPanel).getByText('交付')).toBeInTheDocument()
    expect(within(controlPanel).queryByText('当前操作')).not.toBeInTheDocument()
    expect(within(controlPanel).queryByRole('heading', { name: '操作交互' })).not.toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('heading', { name: '执行过程与成果' })).not.toBeInTheDocument()
    expect(within(reviewPanel).queryByRole('tab')).not.toBeInTheDocument()
    const collaborationRecord = within(reviewPanel).getByRole('region', { name: '专家协作记录' })
    expect(within(collaborationRecord).queryByRole('heading', { name: '请验收成果' })).not.toBeInTheDocument()
    expect(within(collaborationRecord).queryByText(/我已经整理好本次成果/)).not.toBeInTheDocument()
    expect(within(collaborationRecord).queryByRole('region', { name: '办公协作专家的协作回复' })).not.toBeInTheDocument()
    expect(within(reviewPanel).queryByText('成果等待你验收')).not.toBeInTheDocument()
    expect(within(collaborationRecord).getByRole('region', { name: '本轮协作总结' })).toBeInTheDocument()
    expect(within(reviewPanel).getByTestId('artifact-preview')).toHaveAttribute('data-artifact-contract', 'knowme.artifact-preview/v1')
    expect(controlPanel).toContainElement(reviewPanel)
    expect(screen.queryByLabelText(/修改「今日待办与消息汇总」/)).not.toBeInTheDocument()
    expect(within(collaborationRecord).getByRole('region', { name: '本轮协作总结' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认退回' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    const composer = screen.getByRole('textbox')
    fireEvent.submit(composer.closest('form')!)
    expect(review).not.toHaveBeenCalled()

    useAppStore.setState({
      workbenchDialogue: {
        composer: '',
        attachments: [{
          name: '修改参考.png',
          kind: 'image',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,ZmFrZQ==',
        }],
      },
    })

    fireEvent.change(composer, {
      target: { value: '请补充每条消息的负责人和截止时间。' },
    })
    fireEvent.submit(composer.closest('form')!)

    await waitFor(() => expect(review).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-review',
      deliverableId: 'primary',
      action: 'changes_requested',
      comment: '请补充每条消息的负责人和截止时间。',
      attachments: [{
        name: '修改参考.png',
        kind: 'image',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
      }],
    })))
    expect((await screen.findAllByText('继续修改')).length).toBeGreaterThan(0)
    expect(await screen.findByTestId('expert-primary-status')).toHaveAttribute('aria-label', '当前协作状态：专家修改中')
    expect(screen.getByText(/请补充每条消息的负责人和截止时间。/)).toBeInTheDocument()
    expect(screen.getAllByText(/修改意见已送达办公协作专家/)).toHaveLength(2)
    expect(within(reviewPanel).getByRole('list', { name: '专家协作记录' })).toBeInTheDocument()
    expect(composer).toHaveValue('')
    await waitFor(() => expect(useAppStore.getState().workbenchDialogue.attachments).toEqual([]))
  })

  it('keeps revision drafts on failure and submits directly from the sole composer', async () => {
    const task = reviewTask()
    const review = vi.fn().mockResolvedValueOnce({ ok: false, error: '提交失败，请重试' })
      .mockResolvedValueOnce({ ok: true, task: { ...task, status: 'revising' } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskReviewDeliverable: review })
    render(<AppShell />)
    await screen.findByTestId('artifact-preview')
    await screen.findByRole('button', { name: '确认完成' })
    const composer = screen.getByRole('textbox')
    fireEvent.change(composer, { target: { value: '请调整排版' } })
    fireEvent.submit(composer.closest('form')!)
    await waitFor(() => expect(review).toHaveBeenCalledTimes(1), { timeout: 3_000 })
    expect(screen.getByRole('alert')).toHaveTextContent('提交失败，请重试')
    expect(composer).toHaveValue('请调整排版')
    expect(composer).toHaveValue('请调整排版')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    fireEvent.submit(composer.closest('form')!)
    await waitFor(() => expect(review).toHaveBeenCalledTimes(2))
    expect(review).toHaveBeenLastCalledWith(expect.objectContaining({ deliverableId: 'primary', comment: '请调整排版', decision: 'changes_requested' }))
    await waitFor(() => expect(composer).toHaveValue(''))
  })

  it('requires a target for multiple deliverables and revises the selected one', async () => {
    const task = reviewTask()
    task.deliverables = [...task.deliverables!, { ...task.deliverables![0], deliverableId: 'second', title: '第二份成果' }]
    const review = vi.fn(async () => ({ ok: true, task: { ...task, status: 'revising' } }))
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskReviewDeliverable: review })
    render(<AppShell />)
    await screen.findByRole('region', { name: '本轮协作总结' })
    const composer = screen.getByRole('textbox')
    fireEvent.change(composer, { target: { value: '请精简文字' } })
    fireEvent.submit(composer.closest('form')!)
    expect(review).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('写明要调整的成果名称'))
    fireEvent.change(composer, { target: { value: '第二份成果：请精简文字' } })
    fireEvent.submit(composer.closest('form')!)
    await waitFor(() => expect(review).toHaveBeenCalledWith(expect.objectContaining({ deliverableId: 'second', comment: '请精简文字', decision: 'changes_requested' })))
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('submits revisions for deliverable titles containing regex metacharacters', async () => {
    const task = reviewTask()
    task.deliverables = [
      { ...task.deliverables![0], deliverableId: 'cpp', title: 'C++ 代码' },
      { ...task.deliverables![0], deliverableId: 'notes', title: '说明文档' },
    ]
    const review = vi.fn(async () => ({ ok: true, task: { ...task, status: 'revising' } as WorkbenchTask }))
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), expertTaskReviewDeliverable: review })
    render(<AppShell />)
    const composer = await screen.findByRole('textbox')
    fireEvent.change(composer, { target: { value: 'C++ 代码：请补充边界检查' } })
    fireEvent.submit(composer.closest('form')!)
    await waitFor(() => expect(review).toHaveBeenCalledWith(expect.objectContaining({
      deliverableId: 'cpp', comment: '请补充边界检查', decision: 'changes_requested',
    })))
  })

  it('shows an expert-authored collaboration trail and the task capability boundary', async () => {
    const task = reviewTask()
    task.status = 'running'
    task.knowledgeRefs = ['feishu-team-space']
    task.deliverables = []
    task.events = [
      { id: 'event-plan', type: 'task_started', summary: '先整理消息，再按紧急程度核对负责人。', createdAt: '2026-08-19T14:00:00.000Z' },
      { id: 'event-input', type: 'input_queued', summary: '只检查今天收到的消息。', createdAt: '2026-08-19T14:01:00.000Z' },
      { id: 'event-progress', type: 'progress', summary: '已完成消息去重，正在核对截止时间。', createdAt: '2026-08-19T14:02:00.000Z' },
      { id: 'event-custom-user', type: 'agent_question_answered', kind: 'message', source: 'user', summary: '只处理本周收到的消息。', createdAt: '2026-08-19T14:03:00.000Z' },
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
    expect(within(room).getByText('只检查今天收到的消息。')).toBeInTheDocument()
    const userSupplement = within(room).getByText('只检查今天收到的消息。').closest('li')
    expect(userSupplement).toHaveClass('is-user')
    expect(userSupplement).toHaveTextContent('我')
    const genericUserTurn = within(room).getByText('只处理本周收到的消息。').closest('li')
    expect(genericUserTurn).toHaveClass('is-user')
    expect(within(room).queryByText('我会先整理消息，再按紧急程度核对负责人。')).not.toBeInTheDocument()
    expect(within(room).getByText('查看执行依据')).toBeInTheDocument()
    expect(within(room).queryByText('执行计划')).not.toBeInTheDocument()
    expect(within(room).queryByText('用户补充')).not.toBeInTheDocument()
    expect(within(room).queryByText('任务系统')).not.toBeInTheDocument()
    expect(within(room).getByRole('textbox')).toBeInTheDocument()

    const capabilities = await screen.findByTestId('expert-task-capabilities')
    expect(within(capabilities).getByRole('button', { name: /能力/ })).toBeInTheDocument()
    expect(within(capabilities).queryByText('公文润色')).not.toBeInTheDocument()
    expect(within(capabilities).queryByText('团队知识空间')).not.toBeInTheDocument()
    expect(within(capabilities).queryByText('飞书')).not.toBeInTheDocument()
    expect(within(capabilities).queryByText(/能力边界保持稳定/)).not.toBeInTheDocument()
    fireEvent.click(within(capabilities).getByRole('button', { name: /能力 3 项已配置/ }))
    expect(await screen.findByRole('dialog', { name: '能力配置' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '能力配置' })).toHaveTextContent('公文润色')
    expect(screen.getByRole('dialog', { name: '能力配置' })).toHaveTextContent('团队知识空间')
    expect(screen.getByRole('dialog', { name: '能力配置' })).toHaveTextContent('飞书')
    fireEvent.click(screen.getByRole('button', { name: '关闭能力配置' }))
    expect(screen.queryByRole('dialog', { name: '能力配置' })).not.toBeInTheDocument()
  })

  it('keeps a long expert description quiet and exposes the full text as a tooltip', async () => {
    const task = reviewTask()
    task.status = 'running'
    task.deliverables = []
    const description = '渐进澄清视觉需求，确认画面方向后调用生图能力完成交付'
    useAppStore.setState({
      hubItems: [{ id: 'office-partner', kind: 'expert', name: '办公协作专家', description }],
    })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }),
      expertGet: async () => ({ ok: true, expert: { name: '办公协作专家', skills: [], connectors: [] } }),
    })

    render(<AppShell />)
    const copy = await screen.findByTitle(description)
    expect(copy).toHaveClass('wb-expert-profile-description')
    expect(copy).not.toHaveAttribute('tabindex')
    expect(copy).toHaveTextContent(description)
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
    // 专家消息走伙伴的同一消息组件，因此消息操作与伙伴对话保持一致。
    expect(within(log).getAllByRole('button', { name: /复制|赞|分享/ }).length).toBeGreaterThan(0)
  })

  it('keeps failed-task follow-up available without starting another execution', async () => {
    const task = { ...reviewTask(), status: 'failed', deliverables: [], attention: {
      kind: 'retryable_failure', action: 'retry', detail: '自动修订后仍未通过质量复核。',
    } } as WorkbenchTask
    const generate = vi.fn(async () => ({ text: '本次未通过质量复核，尚未交付成果。', streamed: true }))
    const retry = vi.fn()
    const start = vi.fn()
    useAppStore.setState({ expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId } })
    mockApi({ expertTaskGet: async () => ({ ok: true, task }), aiGenerate: generate,
      expertTaskRetry: retry, expertTaskCreateStart: start })
    render(<AppShell />)
    await screen.findByTestId('expert-action-turn')
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', '询问失败原因或讨论调整方案… @ 选文件')
    fireEvent.change(input, { target: { value: '为什么这次没有完成？' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      conversationMode: 'expert-discussion', prompt: '为什么这次没有完成？',
      expertDiscussionContext: expect.objectContaining({ taskId: task.id, status: 'failed' }),
    })))
    expect(retry).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it('RQA09 explains a retryable revision failure while preserving the prior answer, feedback and sole composer', async () => {
    const detail = '连接超时（15s）：dashscope.aliyuncs.com 未返回数据（API 已配置，请检查网络或稍后重试）'
    const body = '原版：建议先验证渠道的净回款。'
    const feedback = '修改意见：请补充退款后的净利润。'
    const task = { ...reviewTask(), status: 'failed', attention: {
      kind: 'retryable_failure', action: 'retry', title: '本次执行未完成', item: '专家执行', detail,
    } } as WorkbenchTask
    task.deliverables = [{ ...task.deliverables![0], type: 'answer', acceptanceStatus: 'changes_requested', artifactRef: 'failed-revision#v1' }]
    const retry = vi.fn(async () => ({ ok: true, task: { ...task, status: 'running' } as WorkbenchTask }))
    useAppStore.setState({ expertRoom: { ...useAppStore.getState().expertRoom!, taskId: task.id, expertId: task.expertId } })
    mockApi({
      expertTaskGet: async () => ({ ok: true, task }), expertTaskRetry: retry,
      agentSessionGet: async (id) => ({ ok: true, session: { id,
        messages: id.includes('discussion-v3') ? [
          { id: 'prior-answer', role: 'assistant', text: body, createdAt: '2026-09-06T03:00:00Z' },
          { id: 'revision-feedback', role: 'user', text: feedback, createdAt: '2026-09-06T03:01:00Z' },
        ] : [],
        run: { artifacts: id === 'failed-revision' ? [{ id: 'v1', type: 'answer', body }] : [] },
      } }),
    })
    render(<AppShell />)
    const turn = await screen.findByTestId('expert-action-turn')
    expect(within(turn).getByText(detail)).toBeInTheDocument()
    expect(turn).not.toHaveTextContent('多专家')
    expect(screen.queryByRole('button', { name: '转为工作流' })).not.toBeInTheDocument()
    expect(screen.getAllByText(body)).toHaveLength(1)
    expect(screen.getAllByText(feedback)).toHaveLength(1)
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '确认完成' })).not.toBeInTheDocument()
    expect(retry).not.toHaveBeenCalled()
    fireEvent.click(within(turn).getByRole('button', { name: '重新执行' }))
    await waitFor(() => expect(retry).toHaveBeenCalledWith(task.id))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, { kind: 'unknown', action: 'unknown' }])('RQA09 uses a safe fallback without structured failure detail: %j', async (attention) => {
    const task = { ...reviewTask(), status: 'failed', deliverables: [], attention,
      events: [{ type: 'failed', summary: 'Error: raw-secret\n at execute (private-path:1:2)' }],
    } as WorkbenchTask
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })
    render(<AppShell />)
    const turn = await screen.findByTestId('expert-action-turn')
    expect(turn).toHaveTextContent('当前没有可展示的具体失败原因。')
    expect(turn).toHaveTextContent('已有成果和修改意见已保留')
    expect(document.body).not.toHaveTextContent('raw-secret')
    expect(document.body).not.toHaveTextContent('private-path')
    expect(within(turn).getByRole('button', { name: '重新执行' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('RQA09 does not expose credentials or stack details from malformed failure attention', async () => {
    const task = { ...reviewTask(), status: 'failed', deliverables: [], attention: {
      kind: 'retryable_failure', action: 'retry', title: 'sk-private-title', item: 'private-item',
      detail: '请求失败 Authorization: Bearer fake-private-token\n at execute (private-path:1:2)',
    } } as WorkbenchTask
    mockApi({ expertTaskGet: async () => ({ ok: true, task }) })
    render(<AppShell />)
    const turn = await screen.findByTestId('expert-action-turn')
    expect(turn).toHaveTextContent('当前没有可展示的具体失败原因。')
    expect(document.body.textContent).not.toMatch(/sk-private-title|private-item|fake-private-token|private-path/)
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
    expect(deleteButton.closest('.wb-expert-contract-heading')).toHaveTextContent('本次委托')
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
