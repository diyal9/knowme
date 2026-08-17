import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

const fixture = {
  workflowPackages: [
    {
      id: 'official-office-meeting-loop',
      name: '会议闭环',
      description: '把会议资料整理成可跟进的纪要与待办。',
      source: 'official',
      provenance: { domain: 'office' },
      inputs: [{ label: '会议资料或妙记' }],
      outputs: [{ label: '会议纪要' }],
    },
    {
      id: 'team-shared-flow',
      name: '团队共享流',
      description: '团队编排',
      source: 'team',
      provenance: { domain: 'engineering' },
    },
    {
      id: 'my-fork',
      name: '我的派生',
      description: '个人副本',
      source: 'personal',
      provenance: { domain: 'engineering' },
    },
    {
      id: 'demo-meeting-minutes',
      name: '会议资料 → 纪要与待办',
      source: 'official',
    },
    {
      id: 'demo-test10',
      name: 'demo-test10',
      source: 'team',
    },
  ],
}

describe('workbench-workflow-shelf', () => {
  beforeEach(() => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchLaunchStart: async () => ({ ok: true, intent: { slug: 'official-office-meeting-loop' } }),
    })
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'shelf' })
  })
  afterEach(() => cleanup())

  it('mixes team and personal cards with provenance badges and hides demo seeds', async () => {
    render(<AppShell />)
    await waitFor(() => {
      expect(screen.getByText('会议闭环')).toBeInTheDocument()
    })
    expect(screen.getByText('官方')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbShelfGridToggle'))
    expect(screen.getByText('我的派生')).toBeInTheDocument()
    expect(screen.getByText('我的')).toBeInTheDocument()
    expect(screen.getByText('共享')).toBeInTheDocument()
    expect(screen.queryByText('会议资料 → 纪要与待办')).not.toBeInTheDocument()
    expect(screen.queryByText('demo-test10')).not.toBeInTheDocument()
  })

  it('defaults domain filter to 全部 and filters by domain', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    const allChip = screen.getByRole('button', { name: '全部' })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('团队共享流')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '办公' }))
    expect(screen.getByText('会议闭环')).toBeInTheDocument()
    expect(screen.queryByText('团队共享流')).not.toBeInTheDocument()
  })

  it('starts run when clicking a shelf card', async () => {
    const launch = vi.fn(async () => ({ ok: true, intent: { slug: 'official-office-meeting-loop' } }))
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchLaunchStart: launch,
      workbenchTaskList: async () => ({ items: [{ id: 'r1', title: '上次会议闭环', status: 'done', workflowId: 'official-office-meeting-loop', workflowName: '会议闭环' }] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('打开工作流对话：会议闭环'))
    await waitFor(() => expect(screen.getByTestId('workflow-dialogue')).toBeInTheDocument())
    expect(screen.getByTestId('workflow-room')).toBeInTheDocument()
    expect(screen.queryByTestId('run-input-stage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('daemon-review')).not.toBeInTheDocument()
    expect(launch).not.toHaveBeenCalled()
  })

  it('reopens a recent workflow run from shelf', async () => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({
        items: [{
          id: 'r1',
          title: '上次会议闭环',
          status: 'done',
          workflowId: 'official-office-meeting-loop',
          workflowName: '会议闭环',
          execRef: { id: 'run-slug-1' },
        }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('shelf-recent-list')).toHaveTextContent('上次会议闭环'))
    fireEvent.click(screen.getByTestId('task-open-r1'))
    await waitFor(() => expect(screen.getByTestId('workflow-dialogue')).toBeInTheDocument())
    expect(screen.getByTestId('workflow-room')).toBeInTheDocument()
    expect(screen.queryByTestId('daemon-review')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('管线过程')).not.toBeInTheDocument()
  })

  it('keeps the catalog collapsed and expands more cards', async () => {
    mockApi({
      workbenchLoad: async () => fixture,
      workbenchTaskList: async () => ({ items: [{ id: 'r1', title: '上次会议闭环', status: 'done', workflowId: 'official-office-meeting-loop', workflowName: '会议闭环' }] }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByText('会议闭环')).toBeInTheDocument())
    expect(screen.getByTestId('shelf-recent-list')).toHaveTextContent('上次会议闭环')
    expect(screen.queryByText('我的派生')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('wbShelfGridToggle'))
    expect(screen.getByText('我的派生')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '管理工作流' }))
    await waitFor(() => expect(screen.getByTestId('manage-workflows')).toBeInTheDocument())
  })

  it('shows locked hint when daemon is offline', async () => {
    mockApi({
      workbenchLoad: async () => ({ ...fixture, daemon: { online: false } }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('shelf-locked')).toBeInTheDocument())
  })

  it('offers new workflow from empty shelf', async () => {
    mockApi({
      workbenchLoad: async () => ({ workflowPackages: [], daemon: { online: true } }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('shelf-empty')).toBeInTheDocument())
    expect(screen.getByText('还没有工作流')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 新建工作流' }))
    await waitFor(() => expect(screen.getByTestId('studio-surface')).toBeInTheDocument())
    expect(useAppStore.getState().studioDraft?.name).toBe('我的专家协作')
    expect(useAppStore.getState().studioReturnSurface).toBe('shelf')
    fireEvent.click(screen.getByRole('button', { name: /返回工作流/ }))
    await waitFor(() => expect(screen.getByTestId('shelf-surface')).toBeInTheDocument())
  })
})
