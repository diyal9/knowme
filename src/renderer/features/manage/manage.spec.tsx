import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getAllByText('办公交付').length).toBeGreaterThan(0)
    expect(screen.queryByText('工作模式')).not.toBeInTheDocument()
    expect(screen.queryByText('每日简报')).not.toBeInTheDocument()
    useAppStore.setState({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
    await waitFor(() => expect(screen.getByText('每日简报')).toBeInTheDocument())
    expect(screen.getByText('会议跟进')).toBeInTheDocument()
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
    fireEvent.click(screen.getByTestId('daemon-run-rdpi-run-1'))
    await waitFor(() => expect(screen.getByTestId('daemon-review')).toBeInTheDocument())
    expect(within(screen.getByLabelText('任务对话状态')).getByText('管线服务')).toBeInTheDocument()
    expect(screen.queryByLabelText('工作流对话')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管线服务' }))
    await waitFor(() => expect(screen.getByText('交付路径')).toBeInTheDocument())
    expect(useAppStore.getState().workbenchSurface).toBe('manage')
    expect(useAppStore.getState().managePanel).toBe('daemon')
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
