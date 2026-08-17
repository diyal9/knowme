import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('knowledge-os surface', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ route: 'knowledge' })
  })
  afterEach(() => cleanup())

  it('shows baseline tabs 我的知识 / 待我确认 / 来源', async () => {
    mockApi({ knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }) })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('tab', { name: '我的知识' })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: '待我确认' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '来源' })).toBeInTheDocument()
  })

  it('lists wiki and okf entries in the folder tree', async () => {
    mockApi({
      knowledgeOsList: async () => ({
        ok: true,
        wiki: [{ kind: 'wiki', path: 'raw/note.md', title: '团队约定' }],
        okf: [{ kind: 'okf', path: 'concepts/onboarding.md', title: '入职指南' }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getAllByText('团队约定').length).toBeGreaterThan(0)
      expect(screen.getAllByText('入职指南').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('资料').length).toBeGreaterThan(0)
    expect(screen.getByText('已整理知识')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '我的知识' })).not.toBeInTheDocument()
  })

  it('collapses nested folders until searched', async () => {
    mockApi({
      knowledgeOsList: async () => ({
        ok: true,
        wiki: [{ kind: 'wiki', path: 'raw/10_深度思考/101_技术/note.md', title: '嵌套笔记' }],
        okf: [],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('10_深度思考')).toBeInTheDocument())
    expect(screen.queryByText('嵌套笔记')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索知识'), { target: { value: '嵌套' } })
    expect(screen.getByText('嵌套笔记')).toBeInTheDocument()
  })

  it('filters the tree by title', async () => {
    mockApi({
      knowledgeOsList: async () => ({
        ok: true,
        wiki: [
          { kind: 'wiki', path: 'raw/deploy.md', title: '部署流程' },
          { kind: 'wiki', path: 'raw/other.md', title: '其他笔记' },
        ],
        okf: [],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('部署流程')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('搜索知识'), { target: { value: '部署' } })
    expect(screen.getByText('部署流程')).toBeInTheDocument()
    expect(screen.queryByText('其他笔记')).not.toBeInTheDocument()
  })

  it('shows first-touch welcome when knowledge root has no entries', async () => {
    mockApi({ knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }) })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByText('你的知识网')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '+ 添加第一份资料' })).toBeInTheDocument()
    })
  })

  it('opens an entry reader via knowledgeOsRead', async () => {
    const read = vi.fn(async () => ({
      ok: true,
      path: 'raw/note.md',
      title: '团队约定',
      content: '会议先写结论',
    }))
    mockApi({
      knowledgeOsList: async () => ({
        ok: true,
        wiki: [{ kind: 'wiki', path: 'raw/note.md', title: '团队约定' }],
        okf: [],
      }),
      knowledgeOsRead: read,
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getAllByText('团队约定').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('团队约定')[0])
    await waitFor(() => expect(read).toHaveBeenCalledWith({ kind: 'wiki', path: 'raw/note.md' }))
    expect(screen.getByTestId('knowledge-reader')).toHaveTextContent('会议先写结论')
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

  it('exports and imports knowledge packs on the sources tab', async () => {
    const exp = vi.fn(async () => ({ ok: true }))
    const imp = vi.fn(async () => ({ ok: true }))
    mockApi({
      knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
      knowledgeExport: exp,
      knowledgeImport: imp,
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('tab', { name: '来源' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '导出知识包' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '导出知识包' }))
    await waitFor(() => expect(exp).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '导入知识包' }))
    await waitFor(() => expect(imp).toHaveBeenCalled())
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
    fireEvent.click(screen.getByRole('tab', { name: '待我确认' }))
    await waitFor(() => expect(screen.getByTestId('knowledge-steward-list')).toHaveTextContent('升格入职指南'))
  })
})
