import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOMATION_LIST_HINT } from '../../../domain/studio'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('workbench-manage-surface', () => {
  beforeEach(() => {
    mockApi({
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [
          { id: 'office', name: '日常办公', description: '会议与文档', bindings: [] },
          { id: 'engineering', name: '软件研发', description: '交付协作', bindings: [{ expertId: 'dev-1' }] },
        ],
      }),
      workbenchAutomationList: async () => ({
        ok: true,
        jobs: [
          {
            id: 'auto-1',
            name: '每日简报',
            scheduleLabel: '每天 09:00',
            workflowId: '',
            domain: '',
            backend: '',
          },
          {
            id: 'auto-2',
            name: '会议跟进',
            scheduleLabel: '每周一',
            workflowId: 'wf-1',
            domain: 'office',
            backend: 'local-team',
          },
        ],
        templates: [],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage' })
  })
  afterEach(() => cleanup())

  it('loads delivery paths on the pipeline surface', async () => {
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{ id: 'wf-office', name: '办公交付' }],
        daemon: { online: true },
      }),
      workbenchDaemonOverview: async () => ({
        ok: true,
        daemon: {
          online: true,
          workflows: [{ id: 'wf-office', name: '办公交付' }],
          tasks: [],
        },
      }),
      workbenchAutomationList: async () => ({
        ok: true,
        jobs: [
          {
            id: 'auto-1',
            name: '每日简报',
            scheduleLabel: '每天 09:00',
            workflowId: '',
            domain: '',
            backend: '',
          },
          {
            id: 'auto-2',
            name: '会议跟进',
            scheduleLabel: '每周一',
            workflowId: 'wf-1',
            domain: 'office',
            backend: 'local-team',
          },
        ],
        templates: [],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('交付路径')).toBeInTheDocument())
    expect(screen.queryByText('运行正常')).not.toBeInTheDocument()
    expect(document.querySelector('.wb-daemon-health-signal')).not.toBeInTheDocument()
    const connected = screen.getByText('本机已连接').closest('.wb-daemon-link')
    expect(connected).toHaveClass('is-online')
    expect(connected?.querySelector('.wb-daemon-pulse')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索想要的结果')).not.toBeVisible()
    expect(screen.queryByText('服务可用')).not.toBeInTheDocument()
    expect(screen.getAllByText('办公交付').length).toBeGreaterThan(0)
    expect(screen.queryByText('工作模式')).not.toBeInTheDocument()
    expect(screen.queryByText('每日简报')).not.toBeInTheDocument()
    act(() => useAppStore.setState({ route: 'workbench', workbenchSurface: 'shelf', managePanel: 'daemon' }))
    await waitFor(() => expect(screen.getByPlaceholderText('搜索想要的结果')).toBeVisible())
    useAppStore.setState({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
    await waitFor(() => expect(screen.getByText('每日简报')).toBeInTheDocument())
    expect(screen.getByText('会议跟进')).toBeInTheDocument()
  })

  it('does not leak workflow shelf data into delivery paths while pipeline data loads', async () => {
    let resolveOverview!: (value: unknown) => void
    const overview = new Promise((resolve) => { resolveOverview = resolve })
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{ id: 'feishu-daily', name: '飞书日常总结' }],
        daemon: { online: true },
      }),
      workbenchDaemonOverview: async () => overview,
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', shelfDaemonOnline: true })
    render(<AppShell />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '创建开发任务' })).toBeInTheDocument())
    expect(screen.getByText('正在读取交付路径…')).toBeInTheDocument()
    expect(screen.getByTestId('daemon-overview-loading')).toBeInTheDocument()
    expect(screen.queryByText('飞书日常总结')).not.toBeInTheDocument()
    expect(screen.queryByText('新运行')).not.toBeInTheDocument()
    expect(screen.queryByText('运行记录')).not.toBeInTheDocument()

    await act(async () => {
      resolveOverview({
        ok: true,
        daemon: { online: true, workflows: [{ id: 'daemon-stage-impl', name: '文档到实施计划' }], tasks: [] },
      })
      await overview
    })
    await waitFor(() => expect(screen.getAllByText('文档到实施计划').length).toBeGreaterThan(0))
    expect(screen.queryByTestId('daemon-overview-loading')).not.toBeInTheDocument()
    expect(screen.queryByText('飞书日常总结')).not.toBeInTheDocument()
  })

  it('reuses a fresh daemon snapshot when switching away and back', async () => {
    const overview = vi.fn(async () => ({
      ok: true,
      daemon: {
        online: true,
        workflows: [{ id: 'daemon-stage-impl', name: '文档到实施计划' }],
        tasks: [{
          slug: 'cached-run',
          intent: '缓存任务',
          status: 'running',
          workflow: 'daemon-stage-impl',
        }],
      },
    }))
    mockApi({
      workbenchLoad: async () => ({ daemon: { online: true } }),
      workbenchDaemonOverview: overview,
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'daemon' })
    render(<AppShell />)

    await waitFor(() => expect(screen.getByTestId('daemon-run-cached-run')).toBeInTheDocument())
    expect(overview).toHaveBeenCalledTimes(1)

    act(() => useAppStore.setState({ managePanel: 'automation' }))
    await waitFor(() => expect(screen.getByTestId('manage-automation-list')).toBeInTheDocument())
    act(() => useAppStore.setState({ managePanel: 'daemon' }))

    expect(await screen.findByTestId('daemon-run-cached-run')).toBeInTheDocument()
    expect(screen.queryByTestId('daemon-overview-loading')).not.toBeInTheDocument()
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(1))
  })

  it('presents delivery paths as a grouped picker with up to three tags per option', async () => {
    mockApi({
      workbenchLoad: async () => ({ daemon: { online: true } }),
      workbenchDaemonOverview: async () => ({
        ok: true,
        daemon: {
          online: true,
          workflows: [
            { id: 'backend', name: '后端编码', tags: ['后端', '本地部署', '修复循环', '额外标签'], catalog: { category: 'development', order: 30 } },
            { id: 'plan', name: '文档到实施计划', tags: ['需求'], catalog: { category: 'planning', order: 10 } },
            { id: 'qa', name: '测试修复循环', tags: ['测试'], catalog: { category: 'testing', order: 20 } },
          ],
          tasks: [],
        },
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', shelfDaemonOnline: true })
    render(<AppShell />)

    const trigger = await screen.findByRole('button', { name: /文档到实施计划/ })
    expect(trigger).not.toBeNull()
    expect(screen.queryByText('点击切换交付路径')).not.toBeInTheDocument()
    expect(within(trigger as HTMLButtonElement).getByText('选择')).toBeInTheDocument()
    fireEvent.click(trigger as HTMLButtonElement)

    expect(screen.getByText('规划与方案')).toBeInTheDocument()
    expect(screen.getByText('测试与质量')).toBeInTheDocument()
    expect(screen.getByText('功能开发')).toBeInTheDocument()
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('data-testid'))).toEqual([
      'daemon-path-plan',
      'daemon-path-qa',
      'daemon-path-backend',
    ])
    const backend = screen.getByTestId('daemon-path-backend')
    expect(within(backend).getByText('后端')).toBeInTheDocument()
    expect(within(backend).getByText('本地部署')).toBeInTheDocument()
    expect(within(backend).getByText('修复循环')).toBeInTheDocument()
    expect(within(backend).queryByText('额外标签')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('daemon-path-qa'))
    expect(within(trigger as HTMLButtonElement).getByText('测试修复循环')).toBeInTheDocument()
  })

  it('shows honest copy when automation is unbound', async () => {
    useAppStore.setState({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('manage-automation-hint')).toBeInTheDocument())
    expect(screen.getByTestId('manage-automation-hint')).toHaveTextContent(AUTOMATION_LIST_HINT)
    expect(screen.getByTestId('automation-unbound-auto-1')).toHaveTextContent('尚未绑定可执行管线')
    expect(screen.queryByTestId('automation-unbound-auto-2')).not.toBeInTheDocument()
  })

  it('starts a pipeline run from the selected delivery path', async () => {
    const launch = vi.fn(async () => ({ ok: true, intent: { slug: 'run-1' } }))
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{ id: 'wf-office', name: '办公交付' }],
        daemon: { online: true },
      }),
      workbenchDaemonOverview: async () => ({
        ok: true,
        daemon: { online: true, workflows: [{ id: 'wf-office', name: '办公交付' }], tasks: [] },
      }),
      workbenchLaunchStart: launch,
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', shelfDaemonOnline: true })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('交付路径')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('业务目标、范围、验收标准与约束（建议≥20 字）'), {
      target: { value: '整理本周会议纪要，列出可执行待办，并给出负责人和截止时间。' },
    })
    await waitFor(() => expect(screen.getByTestId('daemon-compose-submit')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('daemon-compose-submit'))
    await waitFor(() => expect(launch).toHaveBeenCalled())
  })

  it('opens pipeline review instead of workflow dialogue from all-runs', async () => {
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{ id: 'daemon-stage-impl', name: '文档到实施计划' }],
        daemon: { online: true },
      }),
      workbenchDaemonOverview: async () => ({
        ok: true,
        daemon: {
          online: true,
          workflows: [{ id: 'daemon-stage-impl', name: '文档到实施计划' }],
          tasks: [{
            slug: 'rdpi-run-1',
            intent: '飞书需求文档',
            status: 'running',
            workflow: 'daemon-stage-impl',
          }],
        },
      }),
      workbenchDaemonLogs: async () => ({ lines: ['running'], status: 'running' }),
      workbenchDaemonArtifacts: async () => ({ items: [] }),
      workbenchDaemonTask: async () => ({ ok: true }),
      workbenchDaemonProgress: async () => ({ text: '执行中' }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', shelfDaemonOnline: true })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('daemon-run-rdpi-run-1')).toBeInTheDocument())

    const allRunsTab = screen.getByRole('tab', { name: '全部' })
    expect(within(allRunsTab).getByText('（1）')).toBeInTheDocument()
    expect(screen.queryByText('共 1 条任务')).not.toBeInTheDocument()
    expect(document.querySelector('.wb-daemon-rail-head')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '进行中' }))
    expect(within(screen.getByRole('tab', { name: '进行中' })).getByText('（1）')).toBeInTheDocument()
    expect(within(allRunsTab).queryByText('（1）')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('daemon-run-rdpi-run-1'))
    await waitFor(() => expect(screen.getByTestId('daemon-review')).toBeInTheDocument())
    expect(within(screen.getByLabelText('任务对话状态')).getByText('管线服务')).toBeInTheDocument()
    expect(screen.queryByLabelText('工作流对话')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管线服务' }))
    await waitFor(() => expect(screen.getByText('交付路径')).toBeInTheDocument())
    expect(useAppStore.getState().workbenchSurface).toBe('manage')
    expect(useAppStore.getState().managePanel).toBe('daemon')
  })

  it('renders task topic, time and a Feishu document action instead of a raw URL', async () => {
    const sourceUrl = 'https://forever9.feishu.cn/wiki/DB8YwCuKtiRUkhkL6lyc'
    mockApi({
      workbenchLoad: async () => ({ daemon: { online: true } }),
      workbenchDaemonOverview: async () => ({
        ok: true,
        daemon: {
          online: true,
          workflows: [{ id: 'daemon-stage-impl', name: '文档到实施计划' }],
          tasks: [{
            slug: 'linked-run',
            intent: `需求文档：${sourceUrl}`,
            status: 'finished',
            workflow: 'daemon-stage-impl',
            documentTitle: '飞书云文档',
            updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          }],
        },
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', shelfDaemonOnline: true })
    render(<AppShell />)

    const openTask = await screen.findByTestId('daemon-run-linked-run')
    const card = openTask.closest('article')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText('需求文档任务')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('文档到实施计划')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('已完成')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('1 小时前')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('飞书文档')).toBeInTheDocument()
    expect(within(card as HTMLElement).queryByText('点击查看文档')).not.toBeInTheDocument()
    expect(within(card as HTMLElement).queryByText(sourceUrl)).not.toBeInTheDocument()

    const resolver = screen.getByTestId('link-title-resolver').querySelector('webview')
    const titleEvent = new Event('page-title-updated') as Event & { title: string }
    titleEvent.title = '【FF项目】0元礼包 - 飞书云文档'
    act(() => resolver?.dispatchEvent(titleEvent))
    await waitFor(() => expect(within(card as HTMLElement).getByText('【FF项目】0元礼包')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('daemon-run-source-linked-run'))
    expect(useAppStore.getState().linkPreview?.href).toBe(sourceUrl)
    expect(useAppStore.getState().linkPreview?.title).toBe('【FF项目】0元礼包')
    expect(useAppStore.getState().linkPreview?.presentation).toBe('overlay')
    expect(useAppStore.getState().route).toBe('workbench')
    expect(useAppStore.getState().linkFullscreen).toBe(true)
    expect(await screen.findByTestId('link-preview-surface')).toBeInTheDocument()
  })

  it('opens automation editor and saves via IPC', async () => {
    const create = vi.fn(async () => ({ ok: true, job: { id: 'n1', name: '新任务' } }))
    mockApi({
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [{ id: 'office', name: '日常办公', bindings: [] }] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
      workbenchAutomationCreate: create,
      workbenchLoad: async () => ({
        workflowPackages: [{ id: 'wf-1', name: '日报管线', executionBackends: ['local-team'], provenance: { domain: 'office' } }],
        daemon: { online: false },
      }),
      connectorsList: async () => ({ items: [{ id: 'feishu', name: '飞书' }] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('automation-create')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('automation-create'))
    expect(screen.getByTestId('automation-modal')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '晨会摘要' } })
    fireEvent.change(screen.getByLabelText('提示词'), { target: { value: '汇总昨日进展' } })
    fireEvent.change(screen.getByLabelText('执行权限'), { target: { value: 'full' } })
    fireEvent.change(screen.getByLabelText('执行管线'), { target: { value: 'wf-1' } })
    fireEvent.click(screen.getByRole('button', { name: '确认创建' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
  })

  it('loads feishu targets when push checkboxes enabled', async () => {
    const feishuTargets = vi.fn(async () => ({ ok: true, items: [{ id: 'ou_1', name: '张三' }] }))
    mockApi({
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [{ id: 'office', name: '日常办公', bindings: [] }] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
      workbenchAutomationFeishuTargets: feishuTargets,
    })
    resetAppStore()
    useAppStore.setState({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
    render(<AppShell />)
    fireEvent.click(await screen.findByTestId('automation-create'))
    fireEvent.click(screen.getByLabelText('推送到飞书个人会话'))
    await waitFor(() => expect(feishuTargets).toHaveBeenCalled())
  })

  it('confirms workflow delete before archive', async () => {
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{
          id: 'my-fork',
          name: '我的派生',
          description: '个人副本',
          source: 'personal',
          provenance: { domain: 'engineering' },
        }],
      }),
      workbenchWorkflowPackageArchive: archive,
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'workflows' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('workflow-delete-my-fork')).toBeInTheDocument())
    const workflowCard = screen.getByTestId('workflow-card-my-fork')
    expect(workflowCard).toHaveClass('wb-shelf-card')
    expect(within(workflowCard).getByText('交付')).toBeInTheDocument()
    expect(within(workflowCard).getByText('协作路径')).toBeInTheDocument()
    expect(within(workflowCard).getByRole('button', { name: '复制' })).toBeInTheDocument()
    expect(within(workflowCard).getByRole('button', { name: '编辑' })).toBeInTheDocument()
    expect(within(workflowCard).getByRole('button', { name: '删除' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('workflow-delete-my-fork'))
    const modal = screen.getByTestId('confirm-modal')
    expect(modal).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('my-fork'))
  })

  it('opens studio from shelf graph when package get fails', async () => {
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{
          id: 'my-msv52jon',
          name: '我的专家协作',
          description: '个人工作流，可在编排中继续完善。',
          source: 'personal',
          provenance: { domain: 'engineering' },
          graph: {
            nodes: [{ id: 'agent', type: 'agent', name: '办公伙伴', agentPackageId: 'office-partner' }],
            edges: [{ from: 'agent', to: 'n-terminal' }],
          },
        }],
      }),
      workbenchWorkflowPackageGet: async () => ({ ok: false, error: '流程不存在' }),
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'workflows' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('workflow-edit-my-msv52jon')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('workflow-edit-my-msv52jon'))
    await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
    expect(useAppStore.getState().studioDraft?.sourceWorkflowId).toBe('my-msv52jon')
    expect(useAppStore.getState().studioDraft?.nodes.some((n) => n.agentPackageId === 'office-partner')).toBe(true)
  })

  it('opens studio canvas for the selected workflow', async () => {
    const getPkg = vi.fn(async (id: string) => ({
      ok: true,
      package: {
        id,
        name: '我的派生',
        description: '个人副本',
        graph: {
          nodes: [{ id: 'n-copy', type: 'agent', name: '文案' }],
          edges: [{ from: 'n-copy', to: '__end__' }],
        },
      },
    }))
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{
          id: 'my-fork',
          name: '我的派生',
          description: '个人副本',
          source: 'personal',
          provenance: { domain: 'engineering' },
          graph: {
            nodes: [{ id: 'n-copy', type: 'agent', name: '文案' }],
            edges: [{ from: 'n-copy', to: '__end__' }],
          },
        }],
      }),
      workbenchWorkflowPackageGet: getPkg,
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'workflows' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('workflow-edit-my-fork')).toBeInTheDocument())
    await waitFor(() => {
      const headerActions = document.getElementById('wbHeadDetailActions')
      expect(headerActions).toBeTruthy()
      expect(within(headerActions as HTMLElement).getByRole('button', { name: '返回工作流' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('搜索想要的结果')).not.toBeVisible()
    })
    expect(screen.getAllByRole('button', { name: '返回工作流' })).toHaveLength(1)
    fireEvent.click(screen.getByTestId('workflow-edit-my-fork'))
    await waitFor(() => expect(getPkg).toHaveBeenCalledWith('my-fork'))
    await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
    expect(useAppStore.getState().studioDraft?.sourceWorkflowId).toBe('my-fork')
    expect(useAppStore.getState().studioDraft?.name).toBe('我的派生')
    fireEvent.click(screen.getByRole('button', { name: /返回管理工作流/ }))
    await waitFor(() => expect(screen.getByTestId('manage-workflows')).toBeInTheDocument())
    expect(useAppStore.getState().workbenchSurface).toBe('manage')
    expect(useAppStore.getState().managePanel).toBe('workflows')
  })

  it('forks a personal workflow from the copy action', async () => {
    const fork = vi.fn(async () => ({ ok: true, package: { id: 'my-fork-2' } }))
    mockApi({
      workbenchLoad: async () => ({
        workflowPackages: [{
          id: 'my-fork',
          name: '我的派生',
          description: '个人副本',
          source: 'personal',
          provenance: { domain: 'engineering' },
        }],
      }),
      workbenchWorkflowPackageFork: fork,
      workbenchModeList: async () => ({ ok: true, activeModeId: 'office', modes: [] }),
      workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'workflows' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('workflow-card-my-fork')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '复制' }))
    await waitFor(() => expect(fork).toHaveBeenCalledWith('my-fork', expect.objectContaining({
      name: '我的派生（我的版本）',
      package: expect.objectContaining({ id: 'my-fork', name: '我的派生' }),
    })))
  })
})
