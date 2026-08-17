import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
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
    expect(screen.getByRole('button', { name: '办公助理' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('returns to 助理 when assistant rail is clicked', () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '工作台' }))
    fireEvent.click(screen.getByRole('button', { name: '办公助理' }))
    expect(screen.getByRole('button', { name: '办公助理' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '工作台' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the automation center from the rail', async () => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '自动化' }))
    expect(screen.getByRole('button', { name: '自动化' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: '按你的节奏自动推进工作' })).toBeInTheDocument()
  })

  it('opens settings in the main window instead of a secondary window', () => {
    const openSettingsWindow = vi.fn()
    mockApi({ openSettingsWindow })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.getByTestId('settings-surface')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-pressed', 'true')
    expect(openSettingsWindow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.queryByTestId('settings-surface')).not.toBeInTheDocument()
  })
})
