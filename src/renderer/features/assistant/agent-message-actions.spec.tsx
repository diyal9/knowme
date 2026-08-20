import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'
import { AgentMessageActions } from './AgentMessageActions'

describe('assistant message actions', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })

  afterEach(() => {
    cleanup()
    resetAppStore()
  })

  it('renders the four icon-only actions in the requested order', () => {
    render(<AgentMessageActions text="已完成的回答" />)
    const actions = screen.getByLabelText('回答操作')
    expect(within(actions).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      '复制',
      '回复优秀',
      '回复不佳',
      '分支到新聊天',
    ])
    expect(actions).not.toHaveTextContent('复制')
  })

  it('keeps positive and negative feedback mutually exclusive', () => {
    render(<AgentMessageActions text="已完成的回答" />)
    const good = screen.getByRole('button', { name: '回复优秀' })
    const bad = screen.getByRole('button', { name: '回复不佳' })

    fireEvent.click(good)
    expect(good).toHaveAttribute('aria-pressed', 'true')
    expect(bad).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(bad)
    expect(good).toHaveAttribute('aria-pressed', 'false')
    expect(bad).toHaveAttribute('aria-pressed', 'true')
  })

  it('forks the active session into a new chat', async () => {
    const forkSession = vi.fn(async () => undefined)
    useAppStore.setState({ activeSessionId: 'session-1', forkSession })
    render(<AgentMessageActions text="已完成的回答" />)

    fireEvent.click(screen.getByRole('button', { name: '分支到新聊天' }))
    await waitFor(() => expect(forkSession).toHaveBeenCalledWith('session-1'))
  })
})
