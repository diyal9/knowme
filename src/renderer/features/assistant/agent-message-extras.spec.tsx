import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../../shared/api'
import { AgentStructuredUi } from './AgentMessageExtras'

function message(): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    text: '',
    structuredUi: [{ title: '下一步建议', items: [{ label: '继续处理', action: 'send', payload: '继续' }] }],
  }
}

describe('AgentStructuredUi', () => {
  afterEach(() => cleanup())

  it('disables suggestions from completed conversation rounds', () => {
    const onPick = vi.fn()
    render(<AgentStructuredUi message={message()} onPick={onPick} interactive={false} />)

    const group = screen.getByRole('group', { name: /已过期/ })
    const choice = within(group).getByRole('button', { name: /继续处理/ })
    expect((choice as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(choice)
    expect(onPick).not.toHaveBeenCalled()
  })

  it('keeps the latest round actionable', () => {
    const onPick = vi.fn()
    render(<AgentStructuredUi message={message()} onPick={onPick} interactive />)

    const choice = within(screen.getByRole('group', { name: /选择一项/ })).getByRole('button', { name: /继续处理/ })
    expect((choice as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(choice)
    expect(onPick).toHaveBeenCalledWith('继续', false)
  })
})
