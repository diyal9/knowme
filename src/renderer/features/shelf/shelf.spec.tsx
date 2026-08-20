import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

const workflowGraph = {
  nodes: [
    { id: 'producer', type: 'agent', agentPackageId: 'producer', name: '制作人' },
    { id: 'developer', type: 'agent', agentPackageId: 'developer', name: '开发' },
  ],
  edges: [{ from: 'producer', to: 'developer' }],
}

const fixture = {
  workflowPackages: [
    {
      id: 'official-office-meeting-loop',
      name: '会议闭环',
      description: '把会议资料整理成可跟进的纪要与待办。',
      source: 'official',
      provenance: { domain: 'office' },
      inputs: [{ label: '会议资料或妙记' }],
      outputs: [{ label: '会议纪要' }],
      graph: workflowGraph,
    },
    {
      id: 'team-shared-flow',
      name: '团队共享流',
      description: '团队编排',
      source: 'team',
      provenance: { domain: 'engineering' },
      graph: workflowGraph,
    },
    {
      id: 'my-fork',
      name: '我的派生',
      description: '个人副本',
      source: 'personal',
      provenance: { domain: 'engineering' },
      graph: workflowGraph,
    },
    {
      id: 'demo-meeting-minutes',
      name: '会议资料 → 纪要与待办',
      source: 'official',
    },
    {
      id: 'demo-test10',
      name: 'demo-test10',
      source: 'team',
    },
  ],
}

describe('workbench-workflow-shelf', () => {
  beforeEach(() => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchLaunchStart: async () => ({ ok: true, intent: { slug: 'official-office-meeting-loop' } }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'shelf' })
  })
  afterEach(() => cleanup())

  it('mixes team and personal cards with provenance badges and hides demo seeds', async () => {
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByText('会议闭环')).toBeInTheDocument()
    })
    expect(screen.getByText('官方')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbShelfGridToggle'))
    expect(screen.getByText('我的派生')).toBeInTheDocument()
    expect(screen.getByText('我的')).toBeInTheDocument()
    expect(screen.getByText('共享')).toBeInTheDocument()
    expect(screen.queryByText('会议资料 → 纪要与待办')).not.toBeInTheDocument()
    expect(screen.queryByText('demo-test10')).not.toBeInTheDocument()
  })

  it('defaults domain filter to 全部 and filters by domain', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    expect(screen.getByTestId('shelf-surface')).toHaveClass('wb-workbench-home-surface')
    expect(screen.getByRole('heading', { name: '选择工作流' })).toHaveClass('wb-workbench-page-title')
    const runHeading = screen.getByRole('heading', { name: '运行记录' })
    const catalogHeading = screen.getByRole('heading', { name: '选择工作流' })
    expect(runHeading.compareDocumentPosition(catalogHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('最近运行')).not.toBeInTheDocument()
    expect(screen.queryByText('工作流目录')).not.toBeInTheDocument()
    const shelfStatus = screen.getByTestId('shelf-status')
    expect(shelfStatus).toHaveTextContent('3 个可运行')
    expect(shelfStatus.parentElement).toContainElement(screen.getByRole('button', { name: '管理工作流' }))
    const allChip = screen.getByRole('button', { name: '全部' })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('团队共享流')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '办公' }))
    expect(screen.getByText('会议闭环')).toBeInTheDocument()
    expect(screen.queryByText('团队共享流')).not.toBeInTheDocument()
    expect(shelfStatus).toHaveTextContent('3 个可运行')
  })

  it('keeps workflow filters scoped to the catalog and presents runs as a board', async () => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({ items: [
        { id: 'workflow-active', kind: 'workflow', title: '研发协作运行', goal: '完成研发交接', status: 'running', workflowId: 'team-shared-flow', workflowName: '团队共享流' },
        { id: 'workflow-failed', kind: 'workflow', title: '视觉产物运行', status: 'failed', workflowId: 'visual-flow', workflowName: '视觉流程', events: [{ type: 'failed', summary: '输出校验未通过' }] },
      ] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'shelf' })
    render(<AppShell />)

    const board = await screen.findByTestId('wbWorkflowRun-board')
    expect(within(board).getByText('研发协作运行')).toBeInTheDocument()
    expect(within(board).getByText('视觉产物运行')).toBeInTheDocument()
    expect(within(board).getByText('待我处理')).toBeInTheDocument()
    expect(within(board).getByText('进行中')).toBeInTheDocument()
    expect(within(board).getByText('异常')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '办公' }))
    expect(within(screen.getByTestId('shelf-catalog-section')).queryByText('团队共享流')).not.toBeInTheDocument()
    expect(within(board).getByText('研发协作运行')).toBeInTheDocument()
    expect(within(board).getByText('视觉产物运行')).toBeInTheDocument()
  })

  it('keeps collaboration paths to one ellipsized line', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    const paths = screen.getAllByLabelText('简要流程')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0].querySelector('.wb-shelf-brief-flow-text')).toHaveAttribute('title', '制作人 → 开发')
  })

  it('manages workflow runs with workflow data instead of expert collaboration tasks', async () => {
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({ items: [
        {
          id: 'workflow-done',
          kind: 'workflow',
          title: '整理本周需求',
          status: 'done',
          workflowId: 'official-office-meeting-loop',
          workflowName: '会议闭环',
          resultSummary: '已形成需求清单与后续安排',
        },
        {
          id: 'expert-done',
          kind: 'expert',
          title: '专家能力验收',
          status: 'done',
          expertId: 'office-partner',
        },
      ] }),
      workbenchTaskArchive: archive,
    })

    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('button', { name: '管理工作流运行' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '管理工作流运行' }))

    const modal = screen.getByTestId('task-manage-modal')
    expect(modal).toHaveAttribute('aria-modal', 'true')
    expect(within(modal).getByRole('heading', { name: '清理工作流运行记录' })).toBeInTheDocument()
    expect(within(modal).getByText('整理本周需求')).toBeInTheDocument()
    expect(within(modal).getByText('工作流 · 会议闭环')).toBeInTheDocument()
    expect(within(modal).getByText('已形成需求清单与后续安排')).toBeInTheDocument()
    expect(within(modal).queryByText('专家能力验收')).not.toBeInTheDocument()

    fireEvent.click(within(modal).getByRole('checkbox', { name: /整理本周需求/ }))
    fireEvent.click(within(modal).getByRole('button', { name: '清理所选' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('workflow-done'))
  })

  it('opens a workflow launch drawer and starts with every declared input', async () => {
    const persistedStart = vi.fn(async () => ({ ok: true, run: { runId: 'persisted-run-1' } }))
    const graphStart = vi.fn(async () => ({ ok: true, rootRunId: 'graph-run-1' }))
    mockApi({
      workbenchLoad: async () => fixture,
      workflowRunStart: persistedStart,
      workbenchAgentGraphStart: graphStart,
      workbenchWorkflowPackageGet: async () => ({ ok: true, package: {
        id: 'official-office-meeting-loop',
        name: '会议闭环',
        source: 'official',
        version: '1.0.0',
        inputs: [
          { id: 'materials', label: '会议资料或妙记', required: true },
          { id: 'audience', label: '同步对象', required: false },
        ],
        outputs: [{ id: 'minutes', label: '会议纪要' }],
        graph: workflowGraph,
      } }),
      workbenchTaskList: async () => ({ items: [{ id: 'r1', title: '上次会议闭环', status: 'done', workflowId: 'official-office-meeting-loop', workflowName: '会议闭环' }] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('查看工作流：会议闭环'))
    await waitFor(() => expect(screen.getByTestId('workflow-detail')).toBeInTheDocument())
    await waitFor(() => {
      const headerActions = document.getElementById('wbHeadDetailActions')
      expect(headerActions).toBeTruthy()
      expect(within(headerActions as HTMLElement).getByRole('button', { name: '返回工作流' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('搜索想要的结果')).not.toBeVisible()
    })
    const summary = screen.getByTestId('workflow-detail-summary')
    const path = screen.getByTestId('workflow-detail-path')
    expect(within(summary).queryByText('官方工作流')).not.toBeInTheDocument()
    expect(within(path).queryByText('执行路径')).not.toBeInTheDocument()
    expect(summary).toHaveTextContent('输入与产出')
    expect(within(summary).getByRole('button', { name: '使用此工作流' })).toBeInTheDocument()
    expect(path).toHaveTextContent('节点如何流转')
    expect(within(path).getByRole('region', { name: '工作流编排预览' })).toHaveClass('wb-workflow-dag-scroll')
    expect(within(path).getByTestId('workflow-dag')).toBeInTheDocument()
    expect(within(path).getByTestId('workflow-canvas-start')).toHaveTextContent('开始节点')
    expect(within(path).getByTestId('workflow-canvas-end')).toHaveTextContent('结束节点')
    expect(screen.getAllByTestId('workflow-dag-edge')).toHaveLength(3)
    fireEvent.click(within(summary).getByRole('button', { name: '使用此工作流' }))
    const drawer = await screen.findByTestId('workflow-launch-drawer')
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(drawer).toHaveClass('is-task-composer', 'is-workflow-launch-drawer')
    expect(drawer).not.toHaveClass('is-workflow-launch')
    expect(drawer.querySelector('.wb-task-composer-modal')).toBeTruthy()
    expect(screen.getByTestId('workflow-detail')).toBeInTheDocument()
    expect(within(drawer).getByText('会议纪要')).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: '启动工作流' })).toBeDisabled()

    fireEvent.change(within(drawer).getByLabelText(/本次运行目标/), { target: { value: '整理今天的会议并形成后续安排' } })
    fireEvent.change(within(drawer).getByLabelText(/会议资料或妙记/), { target: { value: '会议转写正文' } })
    fireEvent.click(within(drawer).getByRole('button', { name: '启动工作流' }))

    await waitFor(() => expect(screen.getByTestId('workflow-run')).toBeInTheDocument())
    expect(screen.queryByTestId('workflow-launch-drawer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workflow-run-input')).not.toBeInTheDocument()
    expect(persistedStart).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: 'official-office-meeting-loop',
      input: expect.objectContaining({ goal: '整理今天的会议并形成后续安排', materials: '会议转写正文' }),
    }))
    expect(graphStart).toHaveBeenCalledWith(expect.objectContaining({
      inputs: expect.objectContaining({ goal: '整理今天的会议并形成后续安排', materials: '会议转写正文' }),
    }))
  })

  it('allows a composed workflow with one expert to open its launch drawer', async () => {
    const singleAgentGraph = {
      nodes: [
        { id: 'office-partner', type: 'agent', agentPackageId: 'office-partner', name: '办公协作专家' },
        { id: 'done', type: 'terminal', name: '完成' },
      ],
      edges: [{ from: 'office-partner', to: 'done' }],
    }
    const singleAgentWorkflow = {
      id: 'single-agent-workflow',
      name: '飞书日常总结',
      description: '由一位专家按已编排流程完成日常总结。',
      source: 'personal',
      graph: singleAgentGraph,
    }
    mockApi({
      workbenchLoad: async () => ({ workflowPackages: [singleAgentWorkflow] }),
      workbenchWorkflowPackageGet: async () => ({ ok: true, package: singleAgentWorkflow }),
      workbenchTaskList: async () => ({ items: [] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('飞书日常总结')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('查看工作流：飞书日常总结'))
    await waitFor(() => expect(screen.getByTestId('workflow-detail')).toBeInTheDocument())
    const useButton = screen.getByRole('button', { name: '使用此工作流' })
    expect(useButton).toBeEnabled()
    expect(screen.queryByText(/不能作为工作流启动/)).not.toBeInTheDocument()
    fireEvent.click(useButton)
    await waitFor(() => expect(screen.getByTestId('workflow-launch-drawer')).toBeInTheDocument())
    expect(screen.queryByTestId('workflow-run-input')).not.toBeInTheDocument()
  })

  it('reopens a recent workflow run from shelf', async () => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({
        items: [{
          id: 'r1',
          title: '上次会议闭环',
          status: 'done',
          workflowId: 'official-office-meeting-loop',
          workflowName: '会议闭环',
          execRef: { id: 'run-slug-1' },
        }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('shelf-recent-list')).toHaveTextContent('上次会议闭环'))
    const runCard = screen.getByTestId('task-open-r1')
    expect(within(runCard).getByText('已完成')).toHaveClass('wb-task-card-status', 'is-done')
    expect(runCard.querySelector('.wb-task-card-heading-icon [data-icon="workflow"]')).toBeTruthy()
    fireEvent.click(runCard)
    await waitFor(() => expect(screen.getByTestId('workflow-run')).toBeInTheDocument())
    expect(screen.getByTestId('workflow-room')).toBeInTheDocument()
    expect(screen.queryByTestId('daemon-review')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('管线过程')).not.toBeInTheDocument()
  })

  it('keeps the catalog collapsed and expands more cards', async () => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({ items: [{ id: 'r1', title: '上次会议闭环', status: 'done', workflowId: 'official-office-meeting-loop', workflowName: '会议闭环' }] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    expect(screen.getByTestId('shelf-recent-list')).toHaveTextContent('上次会议闭环')
    expect(screen.queryByText('我的派生')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbShelfGridToggle'))
    expect(screen.getByText('我的派生')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '管理工作流' }))
    await waitFor(() => expect(screen.getByTestId('manage-workflows')).toBeInTheDocument())
  })

  it('keeps normal workflows available when daemon is offline', async () => {
    mockApi({
      workbenchLoad: async () => ({ ...fixture, daemon: { online: false } }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    expect(screen.queryByTestId('shelf-locked')).not.toBeInTheDocument()
  })

  it('offers new workflow from empty shelf', async () => {
    mockApi({
      workbenchLoad: async () => ({ workflowPackages: [], daemon: { online: true } }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('shelf-empty')).toBeInTheDocument())
    expect(screen.getByText('还没有工作流')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 新建工作流' }))
    await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
    expect(useAppStore.getState().studioDraft?.name).toBe('我的专家协作')
    expect(useAppStore.getState().studioReturnSurface).toBe('shelf')
    fireEvent.click(screen.getByRole('button', { name: /返回工作流/ }))
    await waitFor(() => expect(screen.getByTestId('shelf-surface')).toBeInTheDocument())
  })
})
