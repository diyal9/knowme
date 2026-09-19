import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

function openLibraries() {
  fireEvent.click(screen.getByRole('tab', { name: '知识库' }))
}

describe('knowledge-os surface', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ route: 'knowledge' })
  })
  afterEach(() => cleanup())

  it('shows the focused Brain / 知识库 / RAG information architecture', async () => {
    mockApi({ knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }) })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Brain' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: '知识库' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'RAG' })).toBeInTheDocument()
  })

  it('loads only the Brain snapshot on first entry and defers unrelated knowledge work', async () => {
    const brainSnapshot = vi.fn(async () => ({
      ok: true,
      nodes: [{ id: 'self:me', kind: 'self' as const, label: '我', tags: [], scope: 'global' as const }],
      claims: [],
      proposals: [],
      stats: { nodes: 1, claims: 0, proposals: 0 },
    }))
    const brainNeighborhood = vi.fn(async () => ({ ok: true, rootId: 'self:me', nodes: [], claims: [] }))
    const knowledgeOsList = vi.fn(async () => ({ ok: true, wiki: [], okf: [] }))
    const knowledgeProviderList = vi.fn(async () => ({ ok: true, providers: [] }))
    const knowledgeStewardTaskList = vi.fn(async () => ({ ok: true, tasks: [], proposals: [] }))
    mockApi({ brainSnapshot, brainNeighborhood, knowledgeOsList, knowledgeProviderList, knowledgeStewardTaskList })

    render(<AppShell />)
    await waitFor(() => expect(brainSnapshot).toHaveBeenCalledTimes(1))

    expect(brainNeighborhood).not.toHaveBeenCalled()
    expect(knowledgeOsList).not.toHaveBeenCalled()
    expect(knowledgeProviderList).not.toHaveBeenCalled()
    expect(knowledgeStewardTaskList).not.toHaveBeenCalled()
  })

  it('lists mounted knowledge files outside the local Brain', async () => {
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers: [{ id: 'local-default', kind: 'qmd-local', displayName: '团队知识库', sourceId: 'src-default' }] }),
      sourcesList: async () => ({ sources: [{ id: 'src-default', type: 'local', displayName: '团队知识库', rootPath: 'D:/wiki' }] }),
      sourcesTree: async () => ({ ok: true, rootPath: 'D:/wiki', nodes: [
        { type: 'file', name: '团队约定.md', path: '团队约定.md' },
        { type: 'file', name: '入职指南.md', path: '入职指南.md' },
      ] }),
    })
    render(<AppShell />)
    openLibraries()
    await waitFor(() => {
      expect(screen.getByText('团队约定.md')).toBeInTheDocument()
      expect(screen.getByText('入职指南.md')).toBeInTheDocument()
    })
    expect(screen.getByText(/目录内容不会全量导入 Brain/)).toBeInTheDocument()
  })

  it('expands nested folders in a mounted knowledge library', async () => {
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers: [{ id: 'local-default', kind: 'qmd-local', displayName: '团队知识库', sourceId: 'src-default' }] }),
      sourcesList: async () => ({ sources: [{ id: 'src-default', type: 'local', displayName: '团队知识库', rootPath: 'D:/wiki' }] }),
      sourcesTree: async () => ({ ok: true, rootPath: 'D:/wiki', nodes: [{ type: 'dir', name: '10_深度思考', path: '10_深度思考' }] }),
      sourcesTreeChildren: async () => ({ ok: true, nodes: [{ type: 'file', name: '嵌套笔记.md', path: '10_深度思考/嵌套笔记.md' }] }),
    })
    render(<AppShell />)
    openLibraries()
    await waitFor(() => expect(screen.getByText('10_深度思考')).toBeInTheDocument())
    expect(screen.queryByText('嵌套笔记.md')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('10_深度思考'))
    expect(await screen.findByText('嵌套笔记.md')).toBeInTheDocument()
  })

  it('switches mounted knowledge libraries from the compact header', async () => {
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'team-wiki', providers: [
        { id: 'team-wiki', kind: 'qmd-local', displayName: '团队 Wiki', sourceId: 'src-team' },
        { id: 'project-wiki', kind: 'qmd-local', displayName: '项目 Wiki', sourceId: 'src-project' },
      ] }),
      sourcesList: async () => ({ sources: [
        { id: 'src-team', type: 'local', displayName: '团队 Wiki', rootPath: 'D:/team' },
        { id: 'src-project', type: 'local', displayName: '项目 Wiki', rootPath: 'D:/project' },
      ] }),
      sourcesTree: async (sourceId?: string) => ({ ok: true, rootPath: sourceId === 'src-project' ? 'D:/project' : 'D:/team', nodes: [] }),
    })
    const { container } = render(<AppShell />)
    openLibraries()
    const selector = await screen.findByLabelText('切换知识库')
    expect(selector).toHaveValue('team-wiki')
    expect(container.querySelector('.library-list-panel')).not.toBeInTheDocument()
    fireEvent.change(selector, { target: { value: 'project-wiki' } })
    await waitFor(() => expect(selector).toHaveValue('project-wiki'))
    expect(await screen.findByText('D:/project')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('知识库操作'))
    expect(screen.getByRole('menuitem', { name: /添加知识库/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /设为默认检索/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /刷新索引/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /打开原目录/ })).toBeInTheDocument()
  })

  it('creates a local-first Brain home even when the library is empty', async () => {
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      brainSnapshot: async () => ({ ok: true, nodes: [{ id: 'self:me', kind: 'self', label: '我', tags: [], scope: 'global' }], claims: [], proposals: [], stats: { nodes: 1, claims: 0, proposals: 0 } }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes: [{ id: 'self:me', kind: 'self', label: '我', tags: [], scope: 'global' }], claims: [] }),
    })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByLabelText('搜索 Brain')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^知识版图：/ })).toBeInTheDocument()
    })
    expect(document.querySelector('.brain-layout')).toHaveClass('compact-rail', 'inspector-collapsed')
    expect(screen.getByLabelText('Brain 工具栏').querySelectorAll(':scope > button')).toHaveLength(6)
  })

  it('filters project-scoped Brain cognition by the active project while retaining global cognition', async () => {
    const nodes = [
      { id: 'self:me', kind: 'self' as const, label: '我', tags: [], scope: 'global' as const },
      { id: 'goal:global', kind: 'goal' as const, label: '长期目标', tags: [], scope: 'global' as const },
      { id: 'project:p1', projectId: 'p1', kind: 'project' as const, label: '产品项目决策', tags: [], scope: 'project' as const },
      { id: 'project:p2', projectId: 'p2', kind: 'project' as const, label: '研发项目决策', tags: [], scope: 'project' as const },
    ]
    mockApi({
      projectsList: async () => ({ ok: true, projects: [{ id: 'p1', name: '产品项目', workspaceSourceId: 's1', status: 'active' }], activeProjectId: 'p1' }),
      sourcesList: async () => ({ sources: [], activeSourceId: null }),
      brainSnapshot: async () => ({ ok: true, nodes, claims: [], proposals: [], stats: { nodes: 4, claims: 0, proposals: 0 } }),
    })
    render(<AppShell />)
    fireEvent.click(await screen.findByRole('button', { name: /当前工作：/ }))
    expect(await screen.findByRole('button', { name: '项目：研发项目决策' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '筛选 Brain' }))
    fireEvent.click(screen.getByRole('button', { name: '产品项目' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: '项目：研发项目决策' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '目标：长期目标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '产品项目' })).toHaveClass('active')
  })

  it('shows the fixed role taxonomy even before the user has learned cognition', async () => {
    const categories = ['测试策略', '用例与数据', '缺陷与回归', '自动化与工具', '质量与验收', '性能与兼容', '版本与发布', '协作与复盘'].map((label, index) => ({
      id: `taxonomy:software:qa-engineer:${index}`,
      kind: 'concept' as const,
      label,
      tags: ['brain-taxonomy', 'brain-taxonomy-category', `taxonomy-order:${index}`, ...(index === 7 ? ['taxonomy-catchall'] : [])],
      scope: 'global' as const,
      authority: 5,
    }))
    const nodes = [{ id: 'self:me', kind: 'self' as const, label: '我', tags: [], scope: 'global' as const }, ...categories]
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      brainSnapshot: async () => ({ ok: true, nodes, claims: [], proposals: [], state: { taxonomyRoleLabel: '测试' }, stats: { nodes: nodes.length, claims: 0, proposals: 0 } }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes, claims: [] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('button', { name: '主题：测试策略，0 项' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '主题：协作与复盘，0 项' })).toBeInTheDocument()
  })

  it('clusters local Brain cognition while keeping mounted Wiki content outside the graph', async () => {
    const concepts = Array.from({ length: 36 }, (_, index) => ({
      id: `brain-concept:${index}`,
      kind: 'concept' as const,
      label: index < 24 ? `架构认知 ${index + 1}` : `产品认知 ${index + 1}`,
      tags: [index < 24 ? 'architecture' : 'product'],
      scope: 'global' as const,
      authority: 4,
    }))
    const mountedWikiDocument = { id: 'external:wiki:doc', kind: 'concept' as const, label: '不应进入 Brain 的 Wiki 文档', tags: ['wiki'], sourceRef: 'raw/external/doc.md', scope: 'global' as const, authority: 2, external: true, providerId: 'local-default' }
    const nodes = [
      { id: 'self:me', kind: 'self' as const, label: '我', tags: [], scope: 'global' as const },
      { id: 'provider:local-default', kind: 'source' as const, label: '本地 LLM Wiki', tags: ['provider', 'qmd-local'], scope: 'global' as const, authority: 2, external: true, providerId: 'local-default' },
      { id: 'collection:local-default:root', kind: 'collection' as const, label: '外挂资料库', tags: ['collection', 'llmwiki'], scope: 'global' as const, authority: 2, external: true, providerId: 'local-default', collectionId: 'root' },
      mountedWikiDocument,
      ...concepts,
    ]
    const claims = [{ id: 'provider:contains:root', subjectId: 'provider:local-default', predicate: 'contains', objectNodeId: 'collection:local-default:root', status: 'confirmed' as const, evidenceRefs: [] }]
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      brainSnapshot: async () => ({ ok: true, nodes, claims, proposals: [], stats: { nodes: nodes.length, claims: claims.length, proposals: 0 } }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes, claims }),
    })
    const { container } = render(<AppShell />)
    await waitFor(() => expect(within(screen.getByLabelText('知识统计')).getByText('37')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: /主题：架构设计，24 项/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /主题：产品与体验，12 项/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /主题：其他知识/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '来源：本地 LLM Wiki' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.brain-radial-card')).toHaveLength(3)
    const spokes = [...container.querySelectorAll<SVGPathElement>('.brain-edge.flow-spoke')]
    expect(spokes).toHaveLength(2)
    expect(spokes.every((path) => !path.getAttribute('d')?.startsWith('M 500 340'))).toBe(true)
    expect(container.querySelectorAll('.brain-edge.flow-cycle')).toHaveLength(0)
    expect(container.querySelector('.brain-radial-orbit')).toBeInTheDocument()
    expect(screen.getByText(/知识版图 \/ 归类/)).toBeInTheDocument()
    expect(screen.getByLabelText('图谱密度 100')).toBeInTheDocument()
    expect(screen.queryByText(/双击展开/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '切换星图' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '切换归类图' })).not.toBeInTheDocument()

    fireEvent.doubleClick(screen.getByRole('button', { name: /主题：架构设计，24 项/ }))
    await waitFor(() => expect(container.querySelector('.brain-radial-orbit')).not.toBeInTheDocument())
    expect(container.querySelectorAll('.brain-node-core').length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: /Brain \/ 知识版图 \/ 架构设计/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Brain \/ 知识版图 \/ 架构设计/ }))
    await waitFor(() => expect(container.querySelector('.brain-radial-orbit')).toBeInTheDocument())
    expect(screen.getByText(/知识版图 \/ 归类/)).toBeInTheDocument()
  })

  it('selects two nodes and highlights their explainable relation path', async () => {
    const nodes = [
      { id: 'self:me', kind: 'self' as const, label: '我', tags: [], scope: 'global' as const },
      { id: 'project:brain', kind: 'project' as const, label: 'Local Brain', tags: [], scope: 'project' as const },
      { id: 'decision:json', kind: 'decision' as const, label: '使用原子 JSON', tags: [], scope: 'project' as const },
    ]
    const claims = [
      { id: 'claim:self-project', subjectId: 'self:me', predicate: 'worksOn', objectNodeId: 'project:brain', status: 'confirmed' as const, evidenceRefs: ['e1'] },
      { id: 'claim:project-decision', subjectId: 'project:brain', predicate: 'madeDecision', objectNodeId: 'decision:json', status: 'confirmed' as const, evidenceRefs: ['e1'] },
    ]
    const path = vi.fn(async () => ({ ok: true, nodeIds: nodes.map(item => item.id), claimIds: claims.map(item => item.id), distance: 2, explanation: '我 → Local Brain → 使用原子 JSON' }))
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      brainSnapshot: async () => ({ ok: true, nodes, claims, proposals: [], layout: { positions: {} }, stats: { nodes: 3, claims: 2, proposals: 0 } }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes, claims }),
      brainPath: path,
    })
    const { container } = render(<AppShell />)
    fireEvent.click(await screen.findByRole('button', { name: /懂我/ }))
    fireEvent.click(await screen.findByRole('button', { name: '关系链' }))
    fireEvent.click(screen.getByRole('button', { name: '你：我' }))
    fireEvent.click(screen.getByRole('button', { name: '决策：使用原子 JSON' }))
    await waitFor(() => expect(path).toHaveBeenCalledWith(expect.objectContaining({ fromId: 'self:me', toId: 'decision:json' })))
    expect(screen.getByText('我 → Local Brain → 使用原子 JSON')).toBeInTheDocument()
    expect(container.querySelectorAll('.brain-edge.path-active')).toHaveLength(2)
  })

  it('previews an external knowledge file via its mounted source', async () => {
    const read = vi.fn(async () => ({
      ok: true,
      path: 'raw/note.md',
      content: '会议先写结论',
    }))
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers: [{ id: 'local-default', kind: 'qmd-local', displayName: '团队知识库', sourceId: 'src-default' }] }),
      sourcesList: async () => ({ sources: [{ id: 'src-default', type: 'local', displayName: '团队知识库', rootPath: 'D:/wiki' }] }),
      sourcesTree: async () => ({ ok: true, rootPath: 'D:/wiki', nodes: [{ type: 'file', name: '团队约定.md', path: 'raw/note.md' }] }),
      sourcesReadFile: read,
    })
    render(<AppShell />)
    openLibraries()
    fireEvent.click(await screen.findByText('团队约定.md'))
    await waitFor(() => expect(read).toHaveBeenCalledWith({ sourceId: 'src-default', path: 'raw/note.md' }))
    expect(screen.getByText('会议先写结论')).toBeInTheDocument()
  })

  it('runs health check from the more menu', async () => {
    const lint = vi.fn(async () => ({ ok: true, issues: [{ type: 'orphan', path: 'wiki/a.md', message: '断链' }] }))
    mockApi({
      knowledgeOsList: async () => ({
        ok: true,
        wiki: [{ kind: 'wiki', path: 'raw/note.md', title: '团队约定' }],
        okf: [],
      }),
      knowledgeOsLint: lint,
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByLabelText('更多知识操作')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('更多知识操作'))
    fireEvent.click(screen.getByRole('button', { name: '检查问题' }))
    await waitFor(() => expect(lint).toHaveBeenCalled())
    expect(screen.getByTestId('knowledge-lint-list')).toHaveTextContent('断链')
  })

  it('mounts an additional LLM Wiki as an independent local Provider', async () => {
    const save = vi.fn(async () => ({ ok: true, id: 'wiki-two' }))
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers: [] }),
      sourcesList: async () => ({ sources: [] }),
      sourcesAddLocal: async () => ({ ok: true, source: { id: 'src-two', type: 'local', displayName: '项目 Wiki', rootPath: 'D:/wiki-two' } }),
      knowledgeProviderSave: save,
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('tab', { name: '知识库' }))
    fireEvent.click(await screen.findByLabelText('知识库操作'))
    fireEvent.click(screen.getByRole('menuitem', { name: /添加知识库/ }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'qmd-local', displayName: '项目 Wiki', sourceId: 'src-two' })))
  })

  it('manages an external Provider without changing the default on selection', async () => {
    const setActive = vi.fn(async () => ({ ok: true }))
    const save = vi.fn(async () => ({ ok: true, id: 'rf' }))
    const providers = [
      { id: 'local-default', kind: 'qmd-local', displayName: '本地 LLM Wiki', collections: [{ id: 'root', name: '外挂资料库', documentCount: 318 }] },
      { id: 'rf', kind: 'ragflow', displayName: '团队 RAGFlow', endpoint: 'https://rag.example.com', collectionIds: ['rules'], collections: [{ id: 'rules', name: '制度库', documentCount: 42 }, { id: 'product', name: '产品库', documentCount: 81 }] },
    ]
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers }),
      knowledgeProviderSetActive: setActive,
      knowledgeProviderSave: save,
      brainSnapshot: async () => ({ ok: true, nodes: [{ id: 'self:me', kind: 'self', label: '我', tags: [], scope: 'global' }], claims: [], proposals: [], providers, stats: { nodes: 1, claims: 0, proposals: 0 } }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes: [{ id: 'self:me', kind: 'self', label: '我', tags: [], scope: 'global' }], claims: [] }),
    })
    const { container } = render(<AppShell />)
    fireEvent.click(screen.getByRole('tab', { name: 'RAG' }))
    const providerLabel = await screen.findByText('团队 RAGFlow')
    fireEvent.click(providerLabel.closest('button') as HTMLButtonElement)
    expect(setActive).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '设为默认' }))
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('rf'))
    const collection = screen.getByText('产品库').closest('label') as HTMLLabelElement
    expect(container.querySelectorAll('.source-collection-card')).toHaveLength(2)
    fireEvent.click(within(collection).getByRole('checkbox'))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'rf', collectionIds: ['rules', 'product'] })))
  })

  it('adds a RAG source without importing its document bodies', async () => {
    const save = vi.fn(async () => ({ ok: true, id: 'rf1' }))
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeProviderSave: save,
      brainProviderSync: async () => ({ ok: true, collections: [] }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('tab', { name: 'RAG' }))
    fireEvent.click((await screen.findAllByRole('button', { name: '添加 RAG' }))[0])
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://rag.example.com' } })
    fireEvent.change(screen.getByLabelText('RAG API Key'), { target: { value: 'secret' } })
    expect(screen.getByText(/只读取当前身份可见的知识库目录/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存并读取目录' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ragflow', endpoint: 'https://rag.example.com', apiKey: 'secret' })))
  })

  it('shows steward proposals on 待我确认', async () => {
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeStewardTaskList: async () => ({
        ok: true,
        tasks: [{ id: 't1', title: 'lint wiki', status: 'done' }],
        proposals: [{ id: 'p1', title: '升格入职指南', status: 'draft', sourcePath: 'raw/note.md' }],
      }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /待我确认/ }))
    await waitFor(() => expect(screen.getByTestId('knowledge-steward-list')).toHaveTextContent('升格入职指南'))
  })

  it('explains, edits, confirms and reverses a cognition proposal in one review surface', async () => {
    const confirm = vi.fn(async () => ({ ok: true }))
    const undo = vi.fn(async () => ({ ok: true }))
    const proposal = {
      id: 'observation:pref',
      kind: 'behavior',
      targetType: 'partner_profile' as const,
      status: 'pending' as const,
      summary: '我的偏好是先给结论',
      rationale: '你在当前对话中明确表达了这项偏好。',
      impact: '确认后，伙伴会在后续协作中稳定采用这项偏好。',
      category: 'about' as const,
      confidence: .95,
      observationCount: 3,
      sourceLabel: '你在伙伴对话中的明确表达',
      evidenceRefs: ['evidence:pref'],
      effects: [],
    }
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      brainSnapshot: async () => ({
        ok: true,
        nodes: [{ id: 'self:me', kind: 'self', label: '我', tags: [], scope: 'global' }],
        claims: [],
        proposals: [proposal],
        evidence: [{ id: 'evidence:pref', title: '伙伴对话', snippet: '我的偏好是先给结论', persistence: 'local' as const }],
        stats: { nodes: 1, claims: 0, proposals: 1 },
      }),
      brainNeighborhood: async () => ({ ok: true, rootId: 'self:me', nodes: [], claims: [] }),
      brainProposalList: async () => ({ ok: true, proposals: [proposal] }),
      brainProposalConfirm: confirm,
      brainGrowthList: async () => ({ ok: true, events: [{ id: 'growth:pref', targetType: 'brain', summary: '保持简洁', status: 'applied', reversible: true }] }),
      brainGrowthUndo: undo,
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /待我确认/ }))
    await waitFor(() => expect(screen.getByText('近期出现 3 次')).toBeInTheDocument())
    expect(screen.getByText('你在当前对话中明确表达了这项偏好。')).toBeInTheDocument()
    expect(screen.getByText('确认后，伙伴会在后续协作中稳定采用这项偏好。')).toBeInTheDocument()
    expect(screen.getByText('伙伴对话')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('KnowMe 将记住'), { target: { value: '回答时先给结论，再补充依据' } })
    fireEvent.click(screen.getByRole('button', { name: '确认并记住' }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith({ id: 'observation:pref', patch: { summary: '回答时先给结论，再补充依据' } }))
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => expect(undo).toHaveBeenCalledWith('growth:pref'))
    fireEvent.click(screen.getByRole('button', { name: /关于我/ }))
    expect(screen.getAllByText('我的偏好是先给结论').length).toBeGreaterThan(0)
  })
})
