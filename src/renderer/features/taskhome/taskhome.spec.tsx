import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('workbench-taskhome-surface', () => {
  beforeEach(() => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{
          id: 't1', title: '跟进会议纪要', goal: '把本周会议行动项整理成可跟进清单', status: 'open',
          expertId: 'office-partner', expertName: '办公协作专家', updatedAt: new Date().toISOString(),
        }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [{ expertId: 'action-owner' }] }],
      }),
      expertTaskCreateStart: async () => ({ ok: true, task: { id: 'task-new', status: 'starting' } }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
  })
  afterEach(() => cleanup())

  it('lists tasks from workbenchTaskList', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toHaveClass('wb-workbench-home-surface'))
    expect(screen.getByRole('heading', { name: '专家任务' })).toHaveClass('wb-workbench-page-title')
    expect(screen.getByText('跟进会议纪要')).toBeInTheDocument()
    const card = screen.getByTestId('task-open-t1')
    expect(within(card).getByText('把本周会议行动项整理成可跟进清单')).toBeInTheDocument()
    expect(within(card).queryByText('当前进度')).not.toBeInTheDocument()
    expect(within(card).queryByText('查看进度')).not.toBeInTheDocument()
    expect(within(card).getByText('办公协作专家')).toBeInTheDocument()
    expect(within(card).getByText('刚刚')).toBeInTheDocument()
    expect(within(card).getByText('待处理')).toHaveClass('wb-task-card-status')
    expect(within(card).queryByText('草稿')).not.toBeInTheDocument()
  })

  it('shows the detailed task state only in the card footer', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{ id: 'revising-1', title: '完善同步稿', goal: '补齐风险说明并更新结论', status: 'revising' }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    const card = await screen.findByTestId('task-open-revising-1')
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(within(card).getByText('修改中')).toHaveClass('wb-task-card-status')
    expect(card.querySelector('.wb-task-card-top')).toBeNull()
    expect(within(card).getByText('补齐风险说明并更新结论')).toBeInTheDocument()
    expect(within(card).queryByText('当前进度')).not.toBeInTheDocument()
  })

  it('keeps expert identity while removing the old progress wording', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{ id: 't-avatar', title: '整理周报', status: 'running', expertId: 'office-partner', expertName: '办公协作专家' }],
      }),
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'office-partner', kind: 'expert', name: '办公协作专家', avatar: 'other/partner', installed: true }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    const { container } = render(<AppShell />)
    await waitFor(() => expect(screen.getByText('整理周报')).toBeInTheDocument())
    expect(container.querySelector('.wb-task-card-progress')).toBeNull()
    expect(container.querySelector('.wb-task-card-avatar.has-photo img')).toBeTruthy()
    expect(screen.getByText('办公协作专家')).toBeInTheDocument()
    expect(screen.getByText('专家执行中')).toBeInTheDocument()
  })

  it('uses the same waiting-for-input status wording as the task detail', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{ id: 'needs-input-1', title: '补充项目材料', status: 'needs_input', expertName: '智能体运维专员' }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)

    const card = await screen.findByTestId('task-open-needs-input-1')
    const status = within(card).getByText('等待补充')
    expect(status).toHaveClass('wb-task-card-status', 'is-attention')
    expect(status.parentElement).toHaveClass('wb-task-card-meta')
    expect(card.querySelector('.wb-task-card-heading-icon [data-icon="clipboardCheck"]')).toBeTruthy()
  })

  it('shows empty state when there are no tasks', async () => {
    mockApi({ workbenchTaskList: async () => ({ items: [] }) })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('wbTaskRecentEmpty')).toBeInTheDocument())
  })

  it('opens completed-task cleanup and only clears completed task records', async () => {
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchTaskList: async () => ({
        items: [
          { id: 't1', title: '跟进会议纪要', status: 'done' },
          { id: 't2', title: '周报整理', status: 'open' },
          { id: 'wf1', kind: 'workflow', title: '工作流验收', status: 'done', workflowId: 'wf-1', workflowName: '需求评审流' },
        ],
      }),
      workbenchTaskArchive: archive,
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '全部任务' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清理已完成任务' }))
    const cleanupModal = screen.getByTestId('task-manage-modal')
    expect(cleanupModal).toBeInTheDocument()
    expect(within(cleanupModal).queryByText('周报整理')).not.toBeInTheDocument()
    expect(within(cleanupModal).queryByText('工作流验收')).not.toBeInTheDocument()
    expect(screen.getByText(/相关文件与交付物不会删除/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /跟进会议纪要/ }))
    fireEvent.click(screen.getByRole('button', { name: '清理所选' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('t1'))
  })

  it('opens the arrange-collaboration modal instead of studio', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [] }),
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'action-owner', kind: 'expert', name: 'action-owner', description: '专业 Agent' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [{ expertId: 'action-owner' }] }],
      }),
      expertTaskCreateStart: async () => ({ ok: true, task: { id: 'task-new', status: 'starting' } }),
    })
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'taskhome',
      hubItems: [{ id: 'action-owner', kind: 'expert', name: 'action-owner', description: '专业 Agent' }],
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    expect(screen.queryByText('了解能力')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看专家 action-owner' }))
    expect(screen.getByTestId('expert-detail')).toBeInTheDocument()
    await waitFor(() => {
      const headerActions = document.getElementById('wbHeadDetailActions')
      expect(headerActions).toBeTruthy()
      expect(within(headerActions as HTMLElement).getByRole('button', { name: '返回专家协作' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('搜索想要的结果')).not.toBeVisible()
    })
    expect(screen.queryByTestId('task-composer-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回专家协作' }))
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '向action-owner发起快捷任务' }))
    expect(screen.getByTestId('task-composer-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('expert-detail')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始任务' })).toBeInTheDocument()
    expect(screen.getByText('更多设置')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-surface')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/例如：根据这份调研材料/), {
      target: { value: '整理本周待办' },
    })
    fireEvent.change(screen.getByPlaceholderText(/粘贴必要背景/), { target: { value: '本周项目记录' } })
    fireEvent.click(screen.getByRole('button', { name: '开始任务' }))
    await waitFor(() => expect(screen.getByTestId('expert-room')).toBeInTheDocument())
  })

  it('keeps home task columns bounded and opens all tasks for the remainder', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [
          { id: 't1', title: '协作甲', status: 'open' },
          { id: 't2', title: '协作乙', status: 'open' },
          { id: 't3', title: '协作丙', status: 'open' },
          { id: 't4', title: '协作丁', status: 'open' },
        ],
      }),
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'e1', kind: 'expert', name: '专家一' },
          { id: 'e2', kind: 'expert', name: '专家二' },
          { id: 'e3', kind: 'expert', name: '专家三' },
          { id: 'e4', kind: 'expert', name: '专家四' },
          { id: 'test1', kind: 'expert', name: 'test1' },
        ],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{
          id: 'office',
          bindings: [
            { expertId: 'e1' },
            { expertId: 'e2' },
            { expertId: 'e3' },
            { expertId: 'e4' },
            { expertId: 'test1' },
          ],
        }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('专家一')).toBeInTheDocument())
    expect(screen.queryByText('专家四')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbTaskQuickToggle'))
    expect(screen.getByText('专家四')).toBeInTheDocument()
    expect(screen.queryByText('test1')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('协作甲')).toBeInTheDocument())
    expect(screen.queryByText('协作丁')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更多（1）' }))
    expect(screen.getByText('协作丁')).toBeInTheDocument()
  })

  it('keeps the exception column stable without duplicating failure details', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{
          id: 'failed-1',
          title: '整理研究报告',
          status: 'failed',
          events: [{ type: 'failed', summary: 'AI 接口超时' }],
        }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('异常')).toBeInTheDocument())
    expect(screen.getByText('整理研究报告')).toBeInTheDocument()
    expect(screen.queryByText('AI 接口超时')).not.toBeInTheDocument()
    expect(screen.getByText('没有等待处理的任务')).toBeInTheDocument()
    expect(screen.getByText('当前没有执行中的任务')).toBeInTheDocument()
  })

  it('uses a short task theme and moves the full request into a two-line content area', async () => {
    const longTitle = '扫描 D:\\aiworkspace\\th-art，只规划并导入 th-art-psd-to-artbundle'
    mockApi({
      workbenchTaskList: async () => ({ items: [{ id: 'long-1', title: longTitle, status: 'open' }] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)

    const card = await screen.findByTestId('task-open-long-1')
    const theme = within(card).getByTestId('task-theme-long-1')
    expect(theme).toHaveTextContent('扫描并导入项目资源')
    expect(Array.from(theme.textContent || '').length).toBeLessThanOrEqual(20)
    expect(within(card).getByText(longTitle)).toHaveClass('wb-task-card-content')
    expect(within(card).queryByText('当前进度')).not.toBeInTheDocument()
  })

  it('shows one row of completed cards and expands the remainder inline', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [
          { id: 'audit-1', title: '[能力验收] qa-engineer', status: 'completed' },
          { id: 'done-1', title: '本周项目周报', status: 'completed' },
          { id: 'done-2', title: '会议行动项', status: 'completed' },
          { id: 'done-3', title: '调研摘要', status: 'completed' },
        ],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('本周项目周报')).toBeInTheDocument())
    expect(screen.getByText('[能力验收] qa-engineer')).toBeInTheDocument()
    expect(screen.queryByText('调研摘要')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbTaskCompletedToggle'))
    expect(screen.getByText('调研摘要')).toBeInTheDocument()
  })

  it('does not dump unbound catalog experts onto the home grid', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [] }),
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'producer', kind: 'expert', name: '制作人' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [] }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    expect(screen.queryByText('制作人')).not.toBeInTheDocument()
    expect(screen.getByText(/还没有常用专家/)).toBeInTheDocument()
  })

  it('opens expert task room from a recent collab', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    fireEvent.click(screen.getByText('跟进会议纪要'))
    expect(screen.getByTestId('expert-room')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '开始协作' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回专家协作' }))
    expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument()
  })

  it('keeps expert management out of the task room critical path', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [{ id: 't1', title: '跟进会议纪要', status: 'open' }] }),
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'action-owner', kind: 'expert', name: '办公伙伴' },
          { id: 'skill-1', kind: 'skill', name: '会议纪要' },
          { id: 'feishu', kind: 'connector', name: '飞书' },
        ],
      }),
      expertGet: async () => ({ ok: true, expert: { id: 'action-owner', skills: ['skill-1'], connectors: [] } }),
    })
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'taskhome',
      hubItems: [
        { id: 'action-owner', kind: 'expert', name: '办公伙伴' },
        { id: 'skill-1', kind: 'skill', name: '会议纪要' },
        { id: 'feishu', kind: 'connector', name: '飞书' },
      ],
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    fireEvent.click(screen.getByText('跟进会议纪要'))
    await waitFor(() => expect(screen.getByTestId('expert-room')).toBeInTheDocument())
    expect(screen.queryByTestId('expert-side-manage-skills')).not.toBeInTheDocument()
    expect(screen.getByText('当前操作')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /执行过程/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '执行过程' })).toBeInTheDocument()
  })
})
