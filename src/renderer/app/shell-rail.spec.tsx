import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { useAppStore } from './store'
import { mockApi, resetAppStore } from '../test/helpers'

describe('shell-rail', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })
  afterEach(() => cleanup())

  it('shows 项目 and toggles the project sidebar without changing the active route', () => {
    useAppStore.setState({ filesOpen: false })
    render(<AppShell />)
    const route = useAppStore.getState().route
    const filesButton = screen.getByRole('button', { name: '收起或展开项目栏' })
    expect(filesButton).toHaveTextContent('项目')
    expect(filesButton).toHaveAttribute('title', '展开项目空间')
    expect(filesButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(filesButton)
    expect(filesButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: '项目空间' })).toBeVisible()
    expect(useAppStore.getState().route).toBe(route)

    fireEvent.click(filesButton)
    expect(filesButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('complementary', { name: '项目空间' })).not.toBeInTheDocument()
    expect(useAppStore.getState().route).toBe(route)
  })

  it('switches the shared workbench project context without using the project sidebar', async () => {
    let activeProjectId = 'p1'
    const projects = [
      { id: 'p1', name: '产品项目', workspaceSourceId: 's1', status: 'active' as const, workspace: { id: 's1', sourceId: 's1', type: 'local', displayName: '产品项目', rootPath: 'D:/product' } },
      { id: 'p2', name: '研发项目', workspaceSourceId: 's2', status: 'active' as const, workspace: { id: 's2', sourceId: 's2', type: 'gitlab', displayName: '研发项目', rootPath: 'D:/engineering' } },
    ]
    const setActive = vi.fn(async (id: string) => {
      activeProjectId = id
      return { ok: true, projects, activeProjectId }
    })
    mockApi({
      projectsList: async () => ({ ok: true, projects, activeProjectId }),
      projectsSetActive: setActive,
      sourcesList: async () => ({
        sources: projects.map((project) => project.workspace),
        activeSourceId: activeProjectId === 'p2' ? 's2' : 's1',
      }),
    })
    useAppStore.setState({ filesOpen: false })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))

    const trigger = await screen.findByRole('button', { name: '当前项目：产品项目' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /研发项目/ }))

    await waitFor(() => expect(setActive).toHaveBeenCalledWith('p2'))
    await waitFor(() => expect(screen.getByRole('button', { name: '当前项目：研发项目' })).toBeInTheDocument())
    expect(useAppStore.getState().activeProjectId).toBe('p2')
  })

  it('keeps the workbench project selector focused on switching only', async () => {
    const projects = [
      { id: 'p1', name: 'knowme-space', workspaceSourceId: 's1', status: 'active' as const, workspace: { id: 's1', sourceId: 's1', type: 'local', displayName: 'knowme-space', rootPath: 'D:/knowme-space' } },
    ]
    mockApi({
      projectsList: async () => ({ ok: true, projects, activeProjectId: 'p1' }),
      sourcesList: async () => ({ sources: projects.map((project) => project.workspace), activeSourceId: 's1' }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))

    const projectTrigger = await screen.findByRole('button', { name: '当前项目：knowme-space' })
    expect(projectTrigger.closest('.wb-head-tools')).toBeInTheDocument()
    fireEvent.click(projectTrigger)
    const menu = screen.getByRole('menu', { name: '切换项目' })
    expect(within(menu).getByText('切换项目')).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: '打开本地项目' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: '克隆 Git 项目' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: '项目设置' })).not.toBeInTheDocument()
  })

  it('opens search below an icon placed before the project switcher', async () => {
    const projects = [
      { id: 'p1', name: 'knowme-space', workspaceSourceId: 's1', status: 'active' as const, workspace: { id: 's1', sourceId: 's1', type: 'local', displayName: 'knowme-space', rootPath: 'D:/knowme-space' } },
    ]
    mockApi({
      projectsList: async () => ({ ok: true, projects, activeProjectId: 'p1' }),
      sourcesList: async () => ({ sources: projects.map((project) => project.workspace), activeSourceId: 's1' }),
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))

    const searchTrigger = screen.getByRole('button', { name: '搜索：专家或任务' })
    const projectTrigger = await screen.findByRole('button', { name: '当前项目：knowme-space' })
    const tools = projectTrigger.closest('.wb-head-tools')
    expect(tools?.firstElementChild).toContainElement(searchTrigger)
    expect(searchTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()

    fireEvent.click(searchTrigger)
    const search = screen.getByRole('search', { name: '搜索专家或任务' })
    const input = within(search).getByRole('searchbox')
    expect(search).toHaveClass('wb-search-popover')
    expect(searchTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('placeholder', '搜索专家或任务')
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: '数据' } })
    expect(useAppStore.getState().shelfQuery).toBe('数据')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(searchTrigger).toHaveFocus()

    fireEvent.click(screen.getByRole('tab', { name: '工作流' }))
    expect(screen.getByRole('button', { name: '搜索：工作流' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '管线服务' }))
    expect(screen.queryByRole('button', { name: /搜索：/ })).not.toBeInTheDocument()
  })

  it('presses 工作台 exclusively when clicked', () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))
    expect(screen.getByRole('button', { name: '工作台' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '伙伴' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('returns to 伙伴 when assistant rail is clicked', () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))
    fireEvent.click(screen.getByRole('button', { name: '伙伴' }))
    expect(screen.getByRole('button', { name: '伙伴' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '工作台' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the automation center from the rail', async () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '自动化' }))
    expect(screen.getByRole('button', { name: '自动化' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.getElementById('wbHead')).toHaveTextContent('自动化')
    expect(screen.getByRole('tab', { name: '任务' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { name: '按你的节奏自动推进工作' })).toBeInTheDocument()
  })

  it('returns to 专家协作 after visiting automation via 伙伴', async () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '自动化' }))
    expect(await screen.findByRole('heading', { name: '按你的节奏自动推进工作' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '伙伴' }))
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))
    expect(screen.getByRole('button', { name: '工作台' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: '专家任务' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '按你的节奏自动推进工作' })).not.toBeInTheDocument()
  })

  it('clears a stale automation panel when opening 工作台 directly', async () => {
    render(<AppShell />)
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'automation' })
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))
    expect(useAppStore.getState().workbenchSurface).toBe('taskhome')
    expect(useAppStore.getState().managePanel).toBe('daemon')
    expect(await screen.findByRole('heading', { name: '专家任务' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '按你的节奏自动推进工作' })).not.toBeInTheDocument()
  })

  it('opens settings in the main window instead of a secondary window', async () => {
    const openSettingsWindow = vi.fn()
    mockApi({ openSettingsWindow })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(await screen.findByTestId('settings-surface')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-pressed', 'true')
    expect(openSettingsWindow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.queryByTestId('settings-surface')).not.toBeInTheDocument()
  })
})
