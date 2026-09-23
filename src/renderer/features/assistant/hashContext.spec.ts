import { describe, expect, it } from 'vitest'
import { getHashContext, insertHashAgent, removeHashAgentMarker } from './hashContext'

describe('hashContext', () => {
  it('recognizes an Agent query at the caret', () => {
    const value = '请优化 #舆情'
    expect(getHashContext(value, value.length)).toEqual({
      start: 4,
      end: value.length,
      query: '舆情',
    })
  })

  it('does not treat an inline hash as an Agent query', () => {
    const value = '版本v1#候选'
    expect(getHashContext(value, value.length)).toBeNull()
  })

  it('inserts and removes an Agent marker without losing the request', () => {
    const value = '请优化 #舆情'
    const context = getHashContext(value, value.length)!
    const inserted = insertHashAgent(value, context, '舆情专家')
    expect(inserted).toEqual({ next: '请优化 #舆情专家 ', caret: 10 })
    expect(removeHashAgentMarker(`${inserted.next}并评估`, '舆情专家')).toEqual({
      next: '请优化 并评估',
      caret: 4,
    })
  })
})
