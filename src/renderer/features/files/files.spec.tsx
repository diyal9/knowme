import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('workspace file tree', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ filesOpen: true })
  })
  afterEach(() => cleanup())

  it('shows setup guidance when no sources configured', async () => {
    mockApi({ sourcesList: async () => ({ sources: [], activeSourceId: null }) })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByText('前往设置添加本地文件夹或 Git 仓库。')).toBeInTheDocument()
    })
    expect(screen.getByRole('toolbar', { name: '文件中心操作' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加内容源' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '管理内容源' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新文件中心' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索文件…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '新建或打开项目' })).not.toBeInTheDocument()
  })

  it('renders file tree from active source', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'Docs' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [
          { type: 'dir', name: 'notes', path: 'notes', depth: 0 },
          { type: 'file', name: 'readme.md', path: 'readme.md', depth: 0 },
        ],
      }),
    })
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByText('readme.md')).toBeInTheDocument()
    })
    expect(screen.getByText('Docs')).toBeInTheDocument()
  })

  it('filters visible files by search query', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'Docs' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [
          { type: 'file', name: 'readme.md', path: 'readme.md', depth: 0 },
          { type: 'file', name: 'todo.txt', path: 'todo.txt', depth: 0 },
        ],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('readme.md')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('搜索文件'), { target: { value: 'todo' } })
    expect(screen.getByText('todo.txt')).toBeInTheDocument()
    expect(screen.queryByText('readme.md')).not.toBeInTheDocument()
  })

  it('switches active content source', async () => {
    let active = 's1'
    mockApi({
      sourcesList: async () => ({
        sources: [
          { id: 's1', type: 'local', displayName: 'Docs' },
          { id: 's2', type: 'gitlab', displayName: 'Repo' },
        ],
        activeSourceId: active,
      }),
      sourcesSetActive: async (id) => {
        active = id
        return { ok: true }
      },
      sourcesTree: async (id) => ({
        ok: true,
        nodes: id === 's2'
          ? [{ type: 'file', name: 'main.ts', path: 'main.ts', depth: 0 }]
          : [{ type: 'file', name: 'readme.md', path: 'readme.md', depth: 0 }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('readme.md')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('切换内容源'), { target: { value: 'legacy-project:s2' } })
    await waitFor(() => expect(screen.getByText('main.ts')).toBeInTheDocument())
  })

  it('previews file content via sourcesReadFile IPC', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'Docs' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [{ type: 'file', name: 'readme.md', path: 'readme.md', depth: 0 }],
      }),
      sourcesReadFile: async () => ({ ok: true, content: '# Hello KnowMe' }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('readme.md')).toBeInTheDocument())
    fireEvent.click(screen.getByText('readme.md'))
    await waitFor(() => expect(screen.getByTestId('files-preview-panel')).toHaveTextContent('Hello KnowMe'))
  })

  it('sets assistant apply target when previewing a file', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'Docs' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [{ type: 'file', name: 'notes.md', path: 'notes.md', depth: 0 }],
      }),
      sourcesReadFile: async () => ({ ok: true, content: 'body' }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('notes.md')).toBeInTheDocument())
    fireEvent.click(screen.getByText('notes.md'))
    await waitFor(() => {
      expect(useAppStore.getState().assistantApplyTarget).toEqual({
        sourceId: 's1',
        path: 'notes.md',
      })
    })
  })

  it('opens a second read-only split preview', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'Docs' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [
          { type: 'file', name: 'a.md', path: 'a.md', depth: 0 },
          { type: 'file', name: 'b.md', path: 'b.md', depth: 0 },
        ],
      }),
      sourcesReadFile: async ({ path }) => ({ ok: true, content: path === 'b.md' ? 'split-b' : 'main-a' }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('a.md')).toBeInTheDocument())
    fireEvent.click(screen.getByText('a.md'))
    await waitFor(() => expect(screen.getByTestId('files-preview-panel')).toHaveTextContent('main-a'))
    fireEvent.click(screen.getByLabelText('文件操作'))
    expect(screen.getByRole('menu', { name: '文件操作菜单' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '打开源目录' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: '归档项目（保留文件）' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: '分屏预览' }))
    fireEvent.click(screen.getByText('b.md'))
    await waitFor(() => expect(screen.getByTestId('files-preview-split')).toHaveTextContent('split-b'))
  })

  it('uses project identity while deriving the physical source tree', async () => {
    let activeProjectId = 'p1'
    mockApi({
      projectsList: async () => ({
        ok: true,
        projects: [
          { id: 'p1', name: '产品项目', workspaceSourceId: 's1', status: 'active' },
          { id: 'p2', name: '研发项目', workspaceSourceId: 's2', status: 'active' },
        ],
        activeProjectId,
      }),
      projectsSetActive: async (id) => {
        activeProjectId = id
        return { ok: true, activeProjectId, projects: [] }
      },
      sourcesList: async () => ({
        sources: [
          { id: 's1', type: 'local', displayName: 'Folder A' },
          { id: 's2', type: 'local', displayName: 'Folder B' },
        ],
        activeSourceId: activeProjectId === 'p2' ? 's2' : 's1',
      }),
      sourcesTree: async (id) => ({
        ok: true,
        nodes: [{ type: 'file', name: id === 's2' ? 'project-b.md' : 'project-a.md', path: id === 's2' ? 'project-b.md' : 'project-a.md', depth: 0 }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('project-a.md')).toBeInTheDocument())
    const sourceSwitcher = screen.getByLabelText('切换内容源')
    expect(within(sourceSwitcher).getByRole('option', { name: 'Folder A' })).toHaveValue('p1')
    expect(within(sourceSwitcher).getByRole('option', { name: 'Folder B' })).toHaveValue('p2')
    fireEvent.change(sourceSwitcher, { target: { value: 'p2' } })
    await waitFor(() => expect(screen.getByText('project-b.md')).toBeInTheDocument())
    expect(useAppStore.getState().activeProjectId).toBe('p2')
    expect(useAppStore.getState().activeSourceId).toBe('s2')
  })

  it('offers relinking when a project workspace is missing', async () => {
    let relinked = false
    mockApi({
      projectsList: async () => ({
        ok: true,
        projects: [{ id: 'p1', name: '离线项目', workspaceSourceId: 's1', status: relinked ? 'active' : 'missing' }],
        activeProjectId: 'p1',
      }),
      projectsRelink: async () => {
        relinked = true
        return { ok: true, projects: [], activeProjectId: 'p1' }
      },
      sourcesList: async () => ({ sources: [{ id: 's1', type: 'local', displayName: 'Folder' }], activeSourceId: 's1' }),
      sourcesTree: async () => ({ ok: false, nodes: [] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('文件目录不可用。')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '重新定位' }))
    await waitFor(() => expect(relinked).toBe(true))
  })

  it('projects recent Agent artifacts into the bound project without duplicating files', async () => {
    mockApi({
      projectsList: async () => ({
        ok: true,
        projects: [{ id: 'p1', name: 'KnowMe', workspaceSourceId: 's1', status: 'active' }],
        activeProjectId: 'p1',
      }),
      sourcesList: async () => ({ sources: [{ id: 's1', type: 'local', displayName: 'KnowMe' }], activeSourceId: 's1' }),
      sourcesTree: async () => ({ ok: true, nodes: [] }),
      agentSessionList: async () => ({
        sessions: [{
          id: 'session-output', title: '产出报告', projectId: 'p1',
          run: { artifacts: [{ id: 'artifact-1', projectId: 'p1', type: 'markdown', title: '项目方案', body: '# Project plan' }] },
        }],
        ui: { openSessionIds: ['session-output'], activeSessionId: 'session-output' },
      }),
    })
    render(<AppShell />)

    const recent = await screen.findByTestId('project-recent-artifacts')
    expect(within(recent).getByText('项目方案')).toBeInTheDocument()
    fireEvent.click(within(recent).getByText('项目方案'))
    expect(await screen.findByTestId('files-preview-panel')).toHaveTextContent('Project plan')
  })
})
