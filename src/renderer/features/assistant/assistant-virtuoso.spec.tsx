/**
 * 100 条消息必须走 Virtuoso，作为长列表滚动对照证据。
 */
import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import type { ChatMessage } from '../../../shared/api'
import {
  ASSISTANT_VIRTUOSO_THRESHOLD,
  AssistantMessageVirtuoso,
} from './AssistantMessageVirtuoso'

afterEach(() => cleanup())

function makeMessages(n: number): ChatMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    text: `msg-${i}`,
  }))
}

function mountLog() {
  const el = document.createElement('div')
  el.style.height = '480px'
  el.style.overflow = 'auto'
  document.body.appendChild(el)
  const chatLogRef = createRef<HTMLDivElement>()
  Object.defineProperty(chatLogRef, 'current', { value: el, writable: true })
  return { el, chatLogRef }
}

describe('assistant message virtuoso threshold', () => {
  it('keeps short threads on a static list', () => {
    const { chatLogRef } = mountLog()
    render(
      <AssistantMessageVirtuoso
        messages={makeMessages(ASSISTANT_VIRTUOSO_THRESHOLD)}
        chatLogRef={chatLogRef}
        lastAssistantId="m1"
        isGenerating={false}
        onFollowUp={() => undefined}
        onStructuredPick={() => undefined}
        onImageOpen={() => undefined}
      />,
    )
    expect(screen.getByTestId('agent-message-static-list')).toBeInTheDocument()
  })

  it('uses virtuoso for 100 messages so scroll cost stays viewport-bound', () => {
    const { chatLogRef } = mountLog()
    render(
      <AssistantMessageVirtuoso
        messages={makeMessages(100)}
        chatLogRef={chatLogRef}
        lastAssistantId="m99"
        isGenerating={false}
        onFollowUp={() => undefined}
        onStructuredPick={() => undefined}
        onImageOpen={() => undefined}
      />,
    )
    expect(screen.getByTestId('agent-message-virtuoso')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-message-static-list')).not.toBeInTheDocument()
  })
})
