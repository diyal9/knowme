import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { makeRunState, mockApi, resetAppStore } from '../../test/helpers'
import { toShelfCard } from '../../../domain/shelf'

function pipelineRun(overrides: Parameters<typeof makeRunState>[0]) {
  return makeRunState({ ...overrides, lane: 'pipeline' })
}

describe('run / pipeline review', () => {
  beforeEach(() => {
    mockApi({
      workbenchDaemonGate: async () => ({ ok: true }),
      workbenchLaunchStart: async () => ({ ok: true, intent: { slug: 'wf-1' } }),
    })
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'run',
      run: pipelineRun({
        phase: 'hitl',
        log: ['等待确认'],
        gateNode: 'gate-1',
        gateTitle: '审阅产出',
      }),
    })
  })
  afterEach(() => cleanup())

  it('shows HITL actions and return-to-pipeline', async () => {
    render(<AppShell />)
    expect(screen.getByText('需要确认：审阅产出')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
    expect(screen.queryByTestId('workflow-dialogue')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回管线服务' }))
    await waitFor(() => expect(screen.getByTestId('manage-surface')).toBeInTheDocument())
  })

  it('shows run trace, agents, graph, and daemon review while running', () => {
    useAppStore.setState({
      run: pipelineRun({
        phase: 'running',
        brief: '整理纪要',
        log: ['执行中'],
        progressText: '节点 2/5',
        agents: [{ id: 'a1', name: '制作人' }, { id: 'a2', name: '开发' }],
        currentOwner: '制作人',
        graphNodes: [{
          id: 'n1',
          label: '整理纪要',
          meta: 'agent · 制作人',
          status: 'active',
          owner: '制作人',
          handoff: '',
          outputLabel: '',
        }],
      }),
    })
    render(<AppShell />)
    expect(screen.getByTestId('daemon-review')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-dialogue')).toBeInTheDocument()
    const progressCard = screen.getByTestId('pipeline-progress-card')
    expect(progressCard).toBeInTheDocument()
    expect(within(progressCard).getByText('已完成 0/1 步')).toBeInTheDocument()
    expect(within(progressCard).queryByText('进行中')).not.toBeInTheDocument()
    expect(screen.getByTestId('daemon-review-status')).toHaveTextContent('执行中')
    expect(screen.getByLabelText('任务对话状态').querySelector('[role="status"]')).toBeNull()
    expect(within(screen.getByTestId('daemon-review')).queryByText('工作流')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('daemon-review')).queryByText('任务详情')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wb-run-trace')).not.toBeInTheDocument()
    expect(screen.queryByTestId('run-agents')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workflow-dialogue')).not.toBeInTheDocument()
  })

  it('turns a stalled clarification into an actionable workbench conversation', async () => {
    const clarify = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchDaemonClarify: clarify,
      workbenchDaemonTask: async () => ({
        pending_clarifications: [{ node: 'n3-proto', questions: ['请补充验收说明'] }],
      }),
      workbenchDaemonLogs: async () => ({
        status: 'waiting',
        lines: ['[22:22:18] ALERT: Workflow 暂停待人工 · 原因: NEED_INPUT 超时未收到澄清'],
      }),
    })
    useAppStore.setState({
      run: pipelineRun({
        phase: 'running',
        clarifyNode: 'n3-proto',
        daemonStatus: 'waiting',
        log: ['[22:22:18] ALERT: Workflow 暂停待人工 · 原因: NEED_INPUT 超时未收到澄清'],
        graphNodes: [{
          id: 'n3-proto', label: '原型设计', meta: 'Agent', status: 'active', owner: '', handoff: '', outputLabel: '',
        }],
        dialogueMessages: [],
      }),
    })

    render(<AppShell />)
    const recovery = await screen.findByTestId('pipeline-recovery')
    expect(recovery).toHaveTextContent('任务已暂停，等待补充信息')
    expect(recovery).toHaveTextContent('步骤「原型设计」等待补充信息超时')
    expect(screen.getByTestId('daemon-review-status')).toHaveTextContent('等待补充')
    expect(within(screen.getByTestId('pipeline-dialogue')).queryByText(/ALERT:/)).not.toBeInTheDocument()

    const composer = screen.getByPlaceholderText('补充缺失信息，发送后继续任务… @ 选文件')
    fireEvent.change(composer, { target: { value: '验收以生成原型说明为准' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(clarify).toHaveBeenCalledWith('wf-1', {
      node: 'n3-proto',
      answer: '验收以生成原型说明为准',
    }))
    expect(useAppStore.getState().run?.dialogueMessages.some((item) => (
      item.role === 'assistant' && item.text === '已提交补充信息，正在重新检查任务状态。'
    ))).toBe(true)
  })

  it('offers refresh, logs, and restart when a paused task has no clarification node', () => {
    useAppStore.setState({
      run: pipelineRun({
        phase: 'running',
        clarifyNode: null,
        log: ['NEED_INPUT 超时未收到澄清，Workflow 暂停待人工'],
        processLogsText: 'NEED_INPUT 超时未收到澄清，Workflow 暂停待人工',
      }),
    })
    render(<AppShell />)

    expect(screen.getByTestId('pipeline-recovery')).toHaveTextContent('当前没有可直接提交的澄清节点')
    fireEvent.click(screen.getByRole('button', { name: '查看过程日志' }))
    expect(screen.getByTestId('daemon-review-logs')).toHaveTextContent('NEED_INPUT 超时未收到澄清')
    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))
    expect(screen.getByTestId('run-input-stage')).toBeInTheDocument()
  })

  it('shows input agents preview on run input stage', () => {
    useAppStore.setState({
      run: pipelineRun({
        phase: 'input',
        brief: '写纪要',
        log: ['已打开'],
        inputAgents: ['制作人', '开发'],
      }),
    })
    render(<AppShell />)
    expect(screen.getByTestId('run-input-agents')).toBeInTheDocument()
    expect(screen.getByTestId('run-input-agents')).toHaveTextContent('制作人')
    expect(screen.getByTestId('run-input-agents')).toHaveTextContent('开发')
    expect(screen.getByText('本次目标')).toBeInTheDocument()
    expect(screen.getByText(/执行方式：/)).toBeInTheDocument()
    expect(screen.queryByText(/填写右侧目标后即可开始/)).not.toBeInTheDocument()
  })

  it('switches daemon review tabs', () => {
    useAppStore.setState({
      run: pipelineRun({
        phase: 'running',
        graphNodes: [{
          id: 'n1',
          label: '步骤一',
          meta: 'agent',
          status: 'done',
          owner: '',
          handoff: '',
          outputLabel: '',
        }],
        reviewEvents: [{ id: 'e1', type: 'step', message: 'started', at: '' }],
        reviewChanges: { summary: '1 个文件变更', files: [{ id: 'f1', path: 'out.md', status: 'added' }], empty: false },
      }),
    })
    render(<AppShell />)
    expect(screen.getByTestId('daemon-review-steps')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '事件' }))
    expect(screen.getByTestId('daemon-review-events')).toHaveTextContent('started')
    fireEvent.click(screen.getByRole('tab', { name: '变更' }))
    expect(screen.getByTestId('daemon-review-changes')).toHaveTextContent('out.md')
  })

  it('submits HITL via workbenchDaemonGate then shows footer actions', async () => {
    const gate = vi.fn(async () => ({ ok: true }))
    mockApi({ workbenchDaemonGate: gate, workbenchLaunchStart: async () => ({ ok: true }) })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => expect(gate).toHaveBeenCalledWith('wf-1', { node: 'gate-1', decision: 'approve' }))
    await waitFor(() => expect(screen.getByTestId('run-footer-actions')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '再跑一次' })).toBeInTheDocument()
  })

  it('reruns via workbenchLaunchStart with allowRelaunch', async () => {
    const launch = vi.fn(async () => ({ ok: true, intent: { slug: 'wf-1' } }))
    mockApi({ workbenchDaemonGate: async () => ({ ok: true }), workbenchLaunchStart: launch })
    useAppStore.setState({
      run: pipelineRun({
        phase: 'done',
        log: ['完成'],
        processLogsText: 'log line',
        progressText: 'progress',
        artifacts: [{ id: 'a1', name: '纪要.md' }],
      }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '再跑一次' }))
    expect(screen.getByTestId('run-input-stage')).toBeInTheDocument()
    expect(launch).not.toHaveBeenCalled()
  })

  it('toggles process log pane', () => {
    useAppStore.setState({
      run: pipelineRun({
        phase: 'done',
        log: ['完成'],
        processLogsText: 'daemon log line',
        progressText: 'step done',
      }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('tab', { name: '过程日志' }))
    expect(screen.getByTestId('daemon-review-logs')).toHaveTextContent('step done')
    expect(screen.getByTestId('daemon-review-logs')).toHaveTextContent('daemon log line')
  })

  it('pulls daemon logs after confirm launch', async () => {
    const launch = vi.fn(async () => ({ ok: true, intent: { slug: 'wf-1' } }))
    const logs = vi.fn(async () => ({
      lines: ['daemon: started'],
      progress: '10%',
      status: 'running',
    }))
    mockApi({
      workbenchLaunchStart: launch,
      workbenchDaemonLogs: logs,
      workbenchDaemonArtifacts: async () => ({ items: [{ id: 'a1', name: 'out.md' }] }),
    })
    useAppStore.setState({
      run: pipelineRun({ phase: 'input', brief: '写纪要', log: ['已打开'] }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByTestId('run-input-start'))
    await waitFor(() => expect(launch).toHaveBeenCalled())
    await waitFor(() => expect(logs).toHaveBeenCalledWith('wf-1'))
    fireEvent.click(screen.getByRole('tab', { name: '过程日志' }))
    await waitFor(() => expect(screen.getByTestId('daemon-review-logs')).toHaveTextContent('daemon: started'))
    expect(screen.queryByTestId('workflow-dialogue')).not.toBeInTheDocument()
  })

  it('shows workflow graph instead of a chat while a run is live', () => {
    useAppStore.setState({
      run: makeRunState({
        phase: 'running',
        log: ['daemon start task=rdpi-ff-zero-gift'],
        processLogsText: 'daemon start task=rdpi-ff-zero-gift',
        progressText: '',
        graphNodes: [{ id: 'n1', label: '制作人分析', meta: '专家 Agent', status: 'running', owner: '制作人', handoff: '', outputLabel: '' }],
        currentOwner: '制作人',
      }),
    })
    render(<AppShell />)
    expect(screen.getByTestId('workflow-run')).toBeInTheDocument()
    expect(screen.getAllByText('制作人分析').length).toBeGreaterThan(0)
    expect(screen.getByTestId('workflow-room')).toBeInTheDocument()
    expect(screen.queryByTestId('daemon-review')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-dialogue')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()
  })

  it('shows workflow results directly after the run completes', () => {
    useAppStore.setState({
      run: makeRunState({
        phase: 'done',
        graphNodes: [{
          id: 'n1',
          label: '办公协作专家',
          meta: '专家 Agent',
          status: 'completed',
          owner: 'office-partner',
          handoff: '',
          outputLabel: '已整理待办、负责人和截止时间。',
        }],
      }),
    })
    render(<AppShell />)
    const controlPanel = screen.getByTestId('workflow-run-control-panel')
    const deliveryPanel = screen.getByTestId('workflow-run-results')
    const statusBar = screen.getByLabelText('任务对话状态')
    expect(deliveryPanel).toBeInTheDocument()
    expect(screen.getByText('交付与预览')).toBeInTheDocument()
    expect(controlPanel).not.toHaveTextContent('工作流运行')
    expect(controlPanel).not.toHaveTextContent('本轮运行已经完成')
    expect(deliveryPanel).not.toHaveTextContent('本次交付')
    expect(deliveryPanel).not.toHaveTextContent('查看本轮各节点形成的结果')
    expect(deliveryPanel).toHaveTextContent('已整理待办、负责人和截止时间。')
    expect(controlPanel).not.toHaveTextContent('已整理待办、负责人和截止时间。')
    expect(within(statusBar).getByRole('button', { name: '返回工作流' })).toBeInTheDocument()
    expect(within(statusBar).queryByText('已完成')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '返回工作流' })).toHaveLength(1)
  })

  it('switches the delivery preview from the right-side result navigator', () => {
    useAppStore.setState({
      run: makeRunState({
        phase: 'done',
        graphNodes: [
          { id: 'n1', label: '研究结论', meta: '专家 Agent', status: 'completed', owner: 'researcher', handoff: '', outputLabel: '第一份结果' },
          { id: 'n2', label: '最终清单', meta: '专家 Agent', status: 'completed', owner: 'editor', handoff: '', outputLabel: '第二份结果' },
        ],
      }),
    })

    render(<AppShell />)
    fireEvent.click(within(screen.getByLabelText('节点交付结果')).getByRole('button', { name: /最终清单/ }))

    expect(useAppStore.getState().run?.selectedNodeId).toBe('n2')
    expect(screen.getByLabelText('最终清单结果预览')).toHaveTextContent('第二份结果')
  })

  it('acks pipeline task-room text onto the shared bubble timeline without aiGenerate', async () => {
    const generate = vi.fn(async () => ({ text: '任务答复', streamed: true }))
    mockApi({ aiGenerate: generate })
    useAppStore.setState({
      run: pipelineRun({ phase: 'running', log: [], dialogueMessages: [] }),
      workbenchDialogue: { composer: '你好', attachments: [] },
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      const messages = useAppStore.getState().run?.dialogueMessages || []
      expect(messages.some((m) => m.role === 'user' && m.text === '你好')).toBe(true)
      expect(messages.some((m) => m.role === 'assistant' && String(m.text).includes('已记下'))).toBe(true)
    })
    expect(generate).not.toHaveBeenCalled()
    expect(useAppStore.getState().isGenerating).toBe(false)
  })

  it('does not leave pipeline bubbles streaming after an ack', async () => {
    mockApi({
      aiGenerate: async () => ({ text: '不应出现', streamed: true }),
    })
    useAppStore.setState({
      run: pipelineRun({ phase: 'running', log: [], dialogueMessages: [] }),
      workbenchDialogue: { composer: '停一下', attachments: [] },
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      const live = useAppStore.getState().run?.dialogueMessages.find((m) => m.role === 'assistant')
      expect(live?.text).toMatch(/已记下/)
      expect(live?.streaming).toBeFalsy()
    })
    expect(useAppStore.getState().isGenerating).toBe(false)
  })

  it('starts a workflow through v2 persistence and local agent graph', async () => {
    const generate = vi.fn(async () => ({ text: '不应调用' }))
    const workflowStart = vi.fn(async () => ({ ok: true, run: { runId: 'workflow-run-1' } }))
    const graphStart = vi.fn(async () => ({ ok: true, rootRunId: 'graph-run-1' }))
    mockApi({
      aiGenerate: generate,
      workbenchWorkflowPackageGet: async () => ({ ok: true, package: {
        id: 'wf-1', name: '会议闭环', version: '1.0.0',
        graph: { nodes: [
          { id: 'producer', type: 'agent', agentPackageId: 'producer' },
          { id: 'developer', type: 'agent', agentPackageId: 'developer' },
        ], edges: [{ from: 'producer', to: 'developer' }] },
      } }),
      workflowRunStart: workflowStart,
      workbenchAgentGraphStart: graphStart,
      workbenchAgentRunTree: async () => ({ ok: true, root: { status: 'running' }, events: [] }),
    })
    const card = toShelfCard({ id: 'wf-1', name: '会议闭环', source: 'personal', graph: { nodes: [
      { id: 'producer', type: 'agent', agentPackageId: 'producer' },
      { id: 'developer', type: 'agent', agentPackageId: 'developer' },
    ] } })
    const launched = await useAppStore.getState().launchWorkflow(card, {
      goal: '整理会议结果',
      inputs: { goal: '整理会议结果', materials: '会议转写' },
    })
    expect(launched).toBe(true)
    await waitFor(() => expect(workflowStart).toHaveBeenCalledWith(expect.objectContaining({ enforceProductBoundary: true })))
    await waitFor(() => expect(graphStart).toHaveBeenCalledWith(expect.objectContaining({
      inputs: expect.objectContaining({ goal: '整理会议结果', materials: '会议转写' }),
    })))
    expect(useAppStore.getState().run?.phase).not.toBe('input')
    expect(generate).not.toHaveBeenCalled()
  })

  it('syncs a completed workflow into its persisted task record', async () => {
    const updateTask = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchTaskUpdate: updateTask,
      workbenchAgentRunTree: async () => ({
        ok: true,
        root: { status: 'completed' },
        events: [{
          type: 'workbench.graph.terminal',
          result: { results: { office: { summary: '已生成飞书消息处理清单。' } } },
        }],
      }),
    })
    useAppStore.setState({
      run: makeRunState({
        taskId: 'task-1',
        phase: 'running',
        slug: 'graph-run-1',
        workflowPackage: {
          graph: { nodes: [{ id: 'office', type: 'agent', name: '办公协作专家' }] },
        },
      }),
    })

    await useAppStore.getState().refreshRunTelemetry()

    expect(updateTask).toHaveBeenCalledWith('task-1', {
      status: 'completed',
      resultSummary: '已生成飞书消息处理清单。',
    })
    expect(useAppStore.getState().run?.phase).toBe('done')
  })

  it('does not render the removed full-page workflow input contract', () => {
    useAppStore.setState({
      run: makeRunState({ phase: 'input', log: [] }),
    })
    render(<AppShell />)
    expect(screen.queryByTestId('workflow-run-input')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '本次运行目标' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('请输入本次运行目标和验收要求')).not.toBeInTheDocument()
    expect(screen.queryByText('补充目标与验收标准，工作流会按照已编排的节点执行。')).not.toBeInTheDocument()
    expect(screen.queryByText('写清目标、材料范围和验收要求')).not.toBeInTheDocument()
    expect(screen.queryByText('参与专家')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止生成' })).not.toBeInTheDocument()
  })
})

describe('taskhome / manage / studio', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })
  afterEach(() => cleanup())

  it('reaches taskhome manage and studio', async () => {
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    const view = render(<AppShell />)
    expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument()
    useAppStore.setState({ workbenchSurface: 'manage' })
    view.rerender(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('manage-surface')).toBeInTheDocument())
    useAppStore.setState({ workbenchSurface: 'studio' })
    view.rerender(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
  })
})
