import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('workbench-taskhome-surface', () => {
  beforeEach(() => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [{ id: 't1', title: '跟进会议纪要', status: 'open' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [{ expertId: 'action-owner' }] }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
  })
  afterEach(() => cleanup())

  it('lists tasks from workbenchTaskList', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    expect(screen.getByText('跟进会议纪要')).toBeInTheDocument()
    expect(screen.getByText('草稿')).toBeInTheDocument()
  })

  it('shows empty state when there are no tasks', async () => {
    mockApi({ workbenchTaskList: async () => ({ items: [] }) })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('wbTaskRecentEmpty')).toBeInTheDocument())
  })

  it('opens task manage modal and archives selected tasks', async () => {
    const archive = vi.fn(async () => ({ ok: true }))
    mockApi({
      workbenchTaskList: async () => ({
        items: [
          { id: 't1', title: '跟进会议纪要', status: 'done' },
          { id: 't2', title: '周报整理', status: 'open' },
        ],
      }),
      workbenchTaskArchive: archive,
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '管理最近协作' }))
    expect(screen.getByTestId('task-manage-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /跟进会议纪要/ }))
    fireEvent.click(screen.getByRole('button', { name: '删除所选' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith('t1'))
  })

  it('opens the arrange-collaboration modal instead of studio', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [] }),
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'action-owner', kind: 'expert', name: 'action-owner', description: '专业 Agent' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [{ expertId: 'action-owner' }] }],
      }),
    })
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'taskhome',
      hubItems: [{ id: 'action-owner', kind: 'expert', name: 'action-owner', description: '专业 Agent' }],
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '+ 新建协作' }))
    expect(screen.getByTestId('task-composer-modal')).toBeInTheDocument()
    expect(screen.getByText('创建并开始')).toBeInTheDocument()
    expect(screen.queryByTestId('studio-surface')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('描述你希望这位专家完成什么'), {
      target: { value: '整理本周待办' },
    })
    fireEvent.click(screen.getByRole('button', { name: '创建并开始' }))
    await waitFor(() => expect(screen.getByTestId('expert-room')).toBeInTheDocument())
  })

  it('collapses extra experts and recent collabs until expanded', async () => {
    mockApi({
      workbenchTaskList: async () => ({
        items: [
          { id: 't1', title: '协作甲', status: 'open' },
          { id: 't2', title: '协作乙', status: 'open' },
          { id: 't3', title: '协作丙', status: 'open' },
          { id: 't4', title: '协作丁', status: 'open' },
        ],
      }),
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'e1', kind: 'expert', name: '专家一' },
          { id: 'e2', kind: 'expert', name: '专家二' },
          { id: 'e3', kind: 'expert', name: '专家三' },
          { id: 'e4', kind: 'expert', name: '专家四' },
          { id: 'test1', kind: 'expert', name: 'test1' },
        ],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{
          id: 'office',
          bindings: [
            { expertId: 'e1' },
            { expertId: 'e2' },
            { expertId: 'e3' },
            { expertId: 'e4' },
            { expertId: 'test1' },
          ],
        }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('专家一')).toBeInTheDocument())
    expect(screen.queryByText('专家四')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbTaskQuickToggle'))
    expect(screen.getByText('专家四')).toBeInTheDocument()
    expect(screen.queryByText('test1')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('协作甲')).toBeInTheDocument())
    expect(screen.queryByText('协作丁')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbTaskRecentToggle'))
    expect(screen.getByText('协作丁')).toBeInTheDocument()
  })

  it('does not dump unbound catalog experts onto the home grid', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [] }),
      capabilityList: async () => ({
        ok: true,
        items: [{ id: 'producer', kind: 'expert', name: '制作人' }],
      }),
      workbenchModeList: async () => ({
        ok: true,
        activeModeId: 'office',
        modes: [{ id: 'office', bindings: [] }],
      }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'taskhome' })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument())
    expect(screen.queryByText('制作人')).not.toBeInTheDocument()
    expect(screen.getByText(/还没有添加到工作台的专家/)).toBeInTheDocument()
  })

  it('opens expert task room from a recent collab', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    fireEvent.click(screen.getByText('跟进会议纪要'))
    expect(screen.getByTestId('expert-room')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '开始协作' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回专家协作' }))
    expect(screen.getByTestId('taskhome-surface')).toBeInTheDocument()
  })

  it('opens a catalog picker from expert-room manage', async () => {
    mockApi({
      workbenchTaskList: async () => ({ items: [{ id: 't1', title: '跟进会议纪要', status: 'open' }] }),
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'action-owner', kind: 'expert', name: '办公伙伴' },
          { id: 'skill-1', kind: 'skill', name: '会议纪要' },
          { id: 'feishu', kind: 'connector', name: '飞书' },
        ],
      }),
      expertGet: async () => ({ ok: true, expert: { id: 'action-owner', skills: ['skill-1'], connectors: [] } }),
    })
    resetAppStore()
    useAppStore.setState({
      route: 'workbench',
      workbenchSurface: 'taskhome',
      hubItems: [
        { id: 'action-owner', kind: 'expert', name: '办公伙伴' },
        { id: 'skill-1', kind: 'skill', name: '会议纪要' },
        { id: 'feishu', kind: 'connector', name: '飞书' },
      ],
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('跟进会议纪要')).toBeInTheDocument())
    fireEvent.click(screen.getByText('跟进会议纪要'))
    await waitFor(() => expect(screen.getByTestId('expert-room')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('expert-side-manage-skills'))
    expect(screen.getByTestId('hub-picker-dialog')).toBeInTheDocument()
    expect(screen.getByText('选择 Skills')).toBeInTheDocument()
  })
})
