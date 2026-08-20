import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

async function mountStudio() {
  render(<AppShell />)
  await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
}

async function addUnboundAgent() {
  await waitFor(() => expect(screen.getByTestId('studio-add-node')).toBeInTheDocument())
  useAppStore.getState().addStudioNode()
  await waitFor(() => expect(screen.getByLabelText('专家节点')).toBeInTheDocument())
}

describe('workbench-studio-surface', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
  })
  afterEach(() => {
    cleanup()
    resetAppStore()
  })

  it('lists nodes and edges after init', async () => {
    await mountStudio()
    expect(screen.getByTestId('studio-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('studio-edge-list')).toBeInTheDocument()
    expect(screen.getByText('__start__ → __end__')).toBeInTheDocument()
    expect(screen.getByTestId('studio-toggle-mode')).toBeInTheDocument()
    expect(screen.getByTestId('studio-inspect')).toBeInTheDocument()
    expect(screen.getByTestId('studio-auto-layout')).toBeInTheDocument()
    expect(screen.getByTestId('studio-palette-tool')).toHaveTextContent('工具')
    expect(screen.getByTestId('studio-palette-gate')).toHaveTextContent('人工确认')
    expect(screen.queryByTestId('studio-palette-human')).not.toBeInTheDocument()
    expect(screen.queryByTestId('studio-palette-action')).not.toBeInTheDocument()
  })

  it('adds a node and marks draft dirty', async () => {
    await mountStudio()
    await addUnboundAgent()
    await waitFor(() => expect(screen.getByTestId('studio-dirty')).toBeInTheDocument())
    expect(screen.getByTestId('studio-node-list')).toHaveTextContent('专家节点')
    expect(screen.getByLabelText('专家节点').querySelector('.wb-studio-flow-type')).toBeNull()
  })

  it('creates a workflow draft with accepted expert result as its input', () => {
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'taskhome',
      expertRoom: {
        id: 'expert-task-7',
        name: '研究专家',
        goal: '形成发布方案',
        log: [],
        messages: [],
        skills: [],
        connectors: [],
        knowledgeRefs: [],
      },
    })
    useAppStore.getState().enterStudioFromExpertTask({
      mode: 'reuse',
      taskId: 'expert-task-7',
      expertName: '研究专家',
      goal: '形成发布方案',
      resultLabel: '竞品分析报告',
      resultSummary: '已验收的关键结论',
    })

    const state = useAppStore.getState()
    expect(state.workbenchSurface).toBe('studio')
    expect(state.expertRoom).toBeNull()
    expect(state.studioDraft?.name).toBe('研究专家成果后续工作流')
    expect(state.studioDraft?.goal).toContain('竞品分析报告')
    expect(state.studioDraft?.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'expert-result', label: '竞品分析报告', example: '已验收的关键结论' }),
    ]))
    expect(state.studioDraft?.dirty).toBe(true)
  })

  it('opens expert picker from palette', async () => {
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'expert-local-1', kind: 'expert', name: '需求专家', description: '整理需求' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        modes: [{ id: 'm1', bindings: [{ expertId: 'expert-local-1' }] }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
    await mountStudio()
    await waitFor(() => expect(useAppStore.getState().hubItems.length).toBeGreaterThan(0))
    fireEvent.click(screen.getByTestId('studio-add-node'))
    expect(screen.getByTestId('studio-expert-picker')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看专家 需求专家' }))
    fireEvent.click(screen.getByTestId('studio-expert-picker-confirm'))
    await waitFor(() => expect(screen.queryByTestId('studio-expert-picker')).not.toBeInTheDocument())
    expect(useAppStore.getState().studioDraft?.nodes.some((n) => n.agentPackageId === 'expert-local-1')).toBe(true)
  })

  it('shows validation issues when save without binding', async () => {
    await mountStudio()
    await addUnboundAgent()
    fireEvent.click(screen.getByTestId('studio-save'))
    await waitFor(() => expect(screen.getByTestId('studio-issues')).toBeInTheDocument())
    expect(screen.getAllByText(/需要绑定本地专家/).length).toBeGreaterThan(0)
  })

  it('inspects graph from toolbar', async () => {
    await mountStudio()
    expect(screen.getByTestId('studio-inspect')).toHaveAttribute('title', '检查流程（不会真正运行）')
    fireEvent.click(screen.getByTestId('studio-inspect'))
    await waitFor(() => expect(screen.getByTestId('studio-issues')).toBeInTheDocument())
    expect(screen.getByTestId('studio-issues')).toHaveTextContent(/请至少添加一个可执行节点/)
    await waitFor(() => {
      expect(String(useAppStore.getState().overlayToast || '')).toMatch(/请至少添加一个可执行节点|开始检查流程/)
    })
  })

  it('toggles simple step list', async () => {
    await mountStudio()
    fireEvent.click(screen.getByTestId('studio-toggle-mode'))
    expect(screen.getByTestId('studio-step-list')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-canvas')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/第 1 步 开始/)).toBeInTheDocument()
    expect(screen.getByLabelText(/结束/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-inspect'))
    await waitFor(() => expect(useAppStore.getState().overlayToast).toBe('请切换到画布模式后再检查流程'))
  })

  it('saves via workbenchWorkflowPackageSave when graph is valid', async () => {
    const save = vi.fn(async () => ({
      ok: true,
      package: {
        id: 'my-flow',
        name: '我的专家协作',
        graph: { nodes: [], edges: [], members: [] },
      },
    }))
    mockApi({ workbenchWorkflowPackageSave: save })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
    await mountStudio()
    await addUnboundAgent()
    const draft = useAppStore.getState().studioDraft
    if (!draft) throw new Error('missing draft')
    const agent = draft.nodes.find((n) => n.kind === 'agent')
    if (!agent) throw new Error('missing agent node')
    useAppStore.setState({
      studioDraft: {
        ...draft,
        nodes: draft.nodes.map((n) =>
          n.id === agent.id ? { ...n, agentPackageId: 'expert-local-1' } : n,
        ),
      },
    })
    fireEvent.click(screen.getByTestId('studio-save'))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(screen.queryByTestId('studio-dirty')).not.toBeInTheDocument()
  })

  it('edits selected node in inspector', async () => {
    await mountStudio()
    await addUnboundAgent()
    expect(screen.queryByTestId('studio-inspector')).not.toBeInTheDocument()
    expect(screen.queryByTestId('studio-inspector-form')).not.toBeInTheDocument()
    const node = await screen.findByLabelText('专家节点')
    fireEvent.click(node)
    await waitFor(() => expect(screen.getByTestId('studio-inspector-form')).toBeInTheDocument())
    expect(screen.getByTestId('studio-inspector')).toBeInTheDocument()
    expect(screen.getAllByText('执行专家').length).toBeGreaterThan(0)
    expect(screen.getByText('本步骤目标')).toBeInTheDocument()
    expect(screen.getByText('更多设置')).toBeInTheDocument()
    expect(screen.getByText('步骤角色')).not.toBeVisible()
    expect(screen.getByText('本步骤技能')).not.toBeVisible()
    fireEvent.click(screen.getByText('更多设置'))
    expect(screen.getByText('步骤角色')).toBeVisible()
    expect(screen.getByText('本步骤输入')).toBeVisible()
    expect(screen.getByText('本步骤输出')).toBeVisible()
    expect(screen.queryByText('进入下一步前')).not.toBeInTheDocument()
    expect(screen.getByText('本步骤技能')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去专家库调优' })).toBeInTheDocument()
    const nameInput = screen.getByLabelText('步骤名称')
    fireEvent.change(nameInput, { target: { value: '需求专家' } })
    expect(useAppStore.getState().studioDraft?.nodes.some((n) => n.name === '需求专家')).toBe(true)
    expect(screen.getByTestId('studio-canvas')).toHaveAttribute('data-pan-x', '0')
  })

  it('stores agent skills on profile.skillRefs', async () => {
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'studio',
      assistantSkills: [{ id: 'skill-code-review', kind: 'skill', name: '代码审查', description: '审 PR' }],
    })
    await mountStudio()
    await addUnboundAgent()
    const node = await screen.findByLabelText('专家节点')
    fireEvent.click(node)
    fireEvent.click(await screen.findByText('更多设置'))
    await waitFor(() => expect(screen.getByText('代码审查')).toBeInTheDocument())
    const option = screen.getByText('代码审查').closest('label')
    expect(option).toBeTruthy()
    fireEvent.click(option!.querySelector('input')!)
    const agent = useAppStore.getState().studioDraft?.nodes.find((n) => n.kind === 'agent')
    const refs = Array.isArray(agent?.profile?.skillRefs) ? agent?.profile?.skillRefs as { id?: string }[] : []
    expect(refs.some((item) => item.id === 'skill-code-review')).toBe(true)
  })

  it('uses baseline condition compare values', async () => {
    await mountStudio()
    useAppStore.getState().addStudioNodeFromPalette('condition')
    const node = await screen.findByLabelText('条件判断')
    fireEvent.click(node)
    await waitFor(() => expect(screen.getByText('比较')).toBeInTheDocument())
    const select = screen.getByDisplayValue('等于')
    fireEvent.change(select, { target: { value: 'not_equal' } })
    const condition = useAppStore.getState().studioDraft?.nodes.find((n) => n.kind === 'condition')
    expect(condition?.config?.compare).toBe('not_equal')
  })

  it('renders workflow io rows in inspector', async () => {
    await mountStudio()
    expect(screen.queryByTestId('studio-workflow-fields')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('开始节点'))
    await waitFor(() => expect(screen.getByTestId('studio-workflow-fields')).toBeInTheDocument())
    expect(screen.getByTestId('studio-io-input')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-io-output')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加入参' }))
    const draft = useAppStore.getState().studioDraft
    expect(Array.isArray(draft?.inputs) && draft.inputs.length >= 1).toBe(true)
    fireEvent.click(screen.getByLabelText('结束节点'))
    await waitFor(() => expect(screen.getByTestId('studio-io-output')).toBeInTheDocument())
    expect(screen.queryByTestId('studio-io-input')).not.toBeInTheDocument()
  })

  it('keeps knowledge inspector free of workflow io clutter', async () => {
    await mountStudio()
    useAppStore.getState().addStudioNodeFromPalette('knowledge')
    fireEvent.click(await screen.findByLabelText('知识库'))
    await waitFor(() => expect(screen.getByTestId('studio-inspector-form')).toBeInTheDocument())
    expect(screen.queryByTestId('studio-workflow-fields')).not.toBeInTheDocument()
    expect(screen.getByText('检索目标')).toBeInTheDocument()
    expect(screen.queryByText('流程定义')).not.toBeInTheDocument()
  })

  it('loads knowledge provider select for knowledge node', async () => {
    mockApi({
      knowledgeProviderList: async () => ({
        ok: true,
        providers: [{ id: 'kb-1', displayName: '产品 OKF' }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
    await mountStudio()
    useAppStore.getState().addStudioNodeFromPalette('knowledge')
    await waitFor(() => expect(screen.getByLabelText('知识库')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('知识库'))
    await waitFor(() => expect(screen.getByRole('option', { name: '产品 OKF' })).toBeInTheDocument())
  })

  it('removes node from context menu', async () => {
    await mountStudio()
    await addUnboundAgent()
    const node = await screen.findByLabelText('专家节点')
    fireEvent.contextMenu(node)
    fireEvent.click(screen.getByRole('menuitem', { name: '删除节点' }))
    await waitFor(() => expect(screen.queryByLabelText('专家节点')).not.toBeInTheDocument())
  })

  it('confirms before leaving studio with dirty draft', async () => {
    await mountStudio()
    await addUnboundAgent()
    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '放弃修改' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存后离开' })).toBeInTheDocument()
    expect(useAppStore.getState().workbenchSurface).toBe('studio')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(useAppStore.getState().workbenchSurface).toBe('studio')
    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }))
    await waitFor(() => expect(useAppStore.getState().workbenchSurface).toBe('manage'))
    expect(useAppStore.getState().managePanel).toBe('workflows')
    expect(useAppStore.getState().studioDraft).toBeNull()
  })

  it('shows bound expert avatar on canvas node', async () => {
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{
          id: 'office-partner',
          kind: 'expert',
          name: '办公伙伴',
          description: '办公协作',
          avatar: 'office/collaborator',
        }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
    await mountStudio()
    await waitFor(() => expect(useAppStore.getState().hubItems.some((item) => item.id === 'office-partner')).toBe(true))
    useAppStore.getState().addStudioNode()
    await waitFor(() => expect(screen.getByLabelText('专家节点')).toBeInTheDocument())
    const draft = useAppStore.getState().studioDraft
    if (!draft) throw new Error('missing draft')
    const agent = draft.nodes.find((n) => n.kind === 'agent')
    if (!agent) throw new Error('missing agent node')
    useAppStore.setState({
      studioDraft: {
        ...draft,
        nodes: draft.nodes.map((n) =>
          n.id === agent.id ? { ...n, agentPackageId: 'office-partner', name: '办公伙伴' } : n,
        ),
      },
    })
    const card = await screen.findByLabelText('办公伙伴')
    expect(card.querySelector('.wb-studio-flow-icon.has-photo img')).toBeTruthy()
  })
})
