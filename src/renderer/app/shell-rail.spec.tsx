import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
