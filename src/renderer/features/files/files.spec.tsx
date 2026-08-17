import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      expect(screen.getByText('前往设置添加本地文件夹或 GitLab 项目。')).toBeInTheDocument()
    })
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
    fireEvent.change(screen.getByLabelText('切换内容源'), { target: { value: 's2' } })
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
})
