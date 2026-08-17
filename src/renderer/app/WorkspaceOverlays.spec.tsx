import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { resolveFabInset } from './WorkspaceFab'
import { mockApi, resetAppStore, useAppStore } from '../test/helpers'

describe('workspace overlays', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })
  afterEach(() => cleanup())

  it('opens log center from compact FAB icon actions', () => {
    const openLogsWindow = vi.fn()
    mockApi({ openLogsWindow })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '通知' }))
    expect(screen.queryByText('日志中心')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: '日志中心' }))
    expect(openLogsWindow).toHaveBeenCalled()
  })

  it('shows attention notify items from store', () => {
    mockApi()
    useAppStore.getState().upsertAttention({ id: 'n1', title: '待审核任务', urgency: 'input', body: 'HITL' })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '通知，有待处理事项' }))
    expect(screen.getByTestId('km-fab-notify')).toBeInTheDocument()
    expect(screen.getByText('待审核任务')).toBeInTheDocument()
  })

  it('adapts FAB inset for studio canvas while staying right-edge aligned', async () => {
    expect(resolveFabInset('workbench', 'studio')).toEqual({ right: 6, bottom: 52 })
    expect(resolveFabInset('assistant', 'taskhome')).toEqual({ right: 6, bottom: 6 })
    expect(resolveFabInset('workbench', 'taskhome')).toEqual({ right: 6, bottom: 6 })

    render(<AppShell />)
    const fab = document.getElementById('km-fab-root')
    expect(fab?.getAttribute('data-fab-right')).toBe('6')
    expect(fab?.getAttribute('data-fab-bottom')).toBe('6')

    useAppStore.setState({ route: 'workbench', workbenchSurface: 'studio' })
    await waitFor(() => {
      const node = document.getElementById('km-fab-root')
      expect(node?.getAttribute('data-fab-right')).toBe('6')
      expect(node?.getAttribute('data-fab-bottom')).toBe('52')
    })

    useAppStore.setState({ route: 'assistant', workbenchSurface: 'taskhome' })
    await waitFor(() => {
      const node = document.getElementById('km-fab-root')
      expect(node?.getAttribute('data-fab-right')).toBe('6')
      expect(node?.getAttribute('data-fab-bottom')).toBe('6')
    })
  })

  it('closes drawer on Escape', async () => {
    render(<AppShell />)
    expect(typeof useAppStore.getState().openDrawer).toBe('function')
    useAppStore.getState().openDrawer({ title: '详情', body: '内容' })
    await waitFor(() => expect(screen.getByTestId('workspace-drawer')).toBeInTheDocument())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('workspace-drawer')).not.toBeInTheDocument())
  })
})
