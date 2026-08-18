import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { makeRunState, mockApi, resetAppStore } from '../../test/helpers'

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
    expect(screen.getByTestId('pipeline-progress-card')).toBeInTheDocument()
    expect(screen.queryByTestId('wb-run-trace')).not.toBeInTheDocument()
    expect(screen.queryByTestId('run-agents')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workflow-dialogue')).not.toBeInTheDocument()
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

  it('keeps workflow dialogue as session chat while a run is live', () => {
    useAppStore.setState({
      run: makeRunState({
        phase: 'running',
        log: ['daemon start task=rdpi-ff-zero-gift'],
        processLogsText: 'daemon start task=rdpi-ff-zero-gift',
        progressText: '',
        dialogueMessages: [{ id: 'm1', role: 'user', text: '请继续推进' }],
      }),
    })
    render(<AppShell />)
    expect(screen.getByTestId('run-dialogue-log')).toHaveTextContent('请继续推进')
    expect(screen.getByTestId('workflow-room')).toBeInTheDocument()
    expect(screen.getByText('现在可以在左侧对话推进。')).toBeInTheDocument()
    expect(screen.queryByTestId('daemon-review')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-process-feed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-dialogue')).not.toBeInTheDocument()
    expect(screen.getByText('对话中')).toBeInTheDocument()
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

  it('streams workflow task dialogue onto the shared bubble timeline', async () => {
    let emit: ((event: Record<string, unknown>) => void) | undefined
    const generate = vi.fn(async (payload: Record<string, unknown>) => {
      expect(String(payload.sessionId)).toMatch(/^wb-run-/)
      expect(payload.surface).toBe('workbench')
      await new Promise((r) => setTimeout(r, 40))
      return { text: '任务答复', streamed: true }
    })
    mockApi({
      onAiStreamEvent: (cb) => {
        emit = (event) => cb(event as never)
        return () => undefined
      },
      aiGenerate: generate,
    })
    useAppStore.setState({
      run: makeRunState({ phase: 'input', log: [], dialogueMessages: [] }),
      workbenchDialogue: { composer: '你好', attachments: [] },
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(true))
    emit?.({
      version: 2,
      seq: 1,
      type: 'stage',
      payload: { id: 'stage_prepare', title: '上下文准备完成', status: 'done' },
    })
    await waitFor(() => expect(screen.getByTestId('agent-execution-timeline')).toHaveTextContent('内容整理完成'))
    await waitFor(() => expect(screen.getByTestId('msg-assistant')).toHaveTextContent('任务答复'))
    expect(screen.queryByTestId('agent-stream-timing')).not.toBeInTheDocument()
    expect(useAppStore.getState().isGenerating).toBe(false)
  })

  it('stops workbench streaming bubbles', async () => {
    mockApi({
      aiGenerate: async () => {
        await new Promise((r) => setTimeout(r, 400))
        return { text: '不应出现', streamed: true }
      },
    })
    useAppStore.setState({
      run: makeRunState({ phase: 'input', log: [], dialogueMessages: [] }),
      workbenchDialogue: { composer: '停一下', attachments: [] },
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    await waitFor(() => expect(useAppStore.getState().isGenerating).toBe(false))
    const live = useAppStore.getState().run?.dialogueMessages.find((m) => m.role === 'assistant')
    expect(live?.streaming).toBe(false)
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
