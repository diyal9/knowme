import { describe, expect, it } from 'vitest'
import {
  laneHasMessage,
  laneHasStreaming,
  mapMessageById,
  stopStreamingMessages,
} from './live-chat-lanes'
import type { ChatMessage } from '../shared/api'

function msg(partial: Partial<ChatMessage> & { id: string }): ChatMessage {
  return { role: 'assistant', text: '', ...partial }
}

describe('live-chat-lanes', () => {
  it('patches only the matching assistant id', () => {
    const next = mapMessageById(
      [msg({ id: 'wa-1', text: '' }), msg({ id: 'wa-2', text: 'keep' })],
      'wa-1',
      (item) => ({ ...item, text: 'stage' }),
    )
    expect(next[0].text).toBe('stage')
    expect(next[1].text).toBe('keep')
  })

  it('stops streaming bubbles without touching finished ones', () => {
    const next = stopStreamingMessages([
      msg({ id: 'a', streaming: true, thinking: true, text: 'hi' }),
      msg({ id: 'b', streaming: false, text: 'done' }),
    ])
    expect(next[0].streaming).toBe(false)
    expect(next[0].thinking).toBe(false)
    expect(next[0].activity).toBe('已停止生成')
    expect(next[1].text).toBe('done')
  })

  it('detects lane membership', () => {
    const list = [msg({ id: 'wa-9', streaming: true })]
    expect(laneHasMessage(list, 'wa-9')).toBe(true)
    expect(laneHasMessage(list, 'other')).toBe(false)
    expect(laneHasStreaming(list)).toBe(true)
    expect(laneHasStreaming([])).toBe(false)
  })
})
