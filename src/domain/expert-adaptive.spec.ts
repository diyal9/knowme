import { describe, expect, it } from 'vitest'
import { classifyExpertAdaptiveIntent } from './expert-adaptive'

describe('expert adaptive collaboration intent', () => {
  it('keeps ordinary feedback in dialogue instead of forcing a task transition', () => {
    expect(classifyExpertAdaptiveIntent('为什么这样设计？', 'review').kind).toBe('discuss')
  })

  it('recognizes high-signal acceptance and revision commands', () => {
    expect(classifyExpertAdaptiveIntent('接受成果', 'review')).toMatchObject({ kind: 'accept', confidence: 'high' })
    expect(classifyExpertAdaptiveIntent('只修改异常流程，其他内容不要动', 'review')).toMatchObject({ kind: 'revise', confidence: 'high' })
  })

  it('does not accept a draft before a reviewable result exists', () => {
    expect(classifyExpertAdaptiveIntent('接受', 'running').kind).toBe('discuss')
  })
})
