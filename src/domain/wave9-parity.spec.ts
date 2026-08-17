import { describe, expect, it } from 'vitest'
import { buildConversationTopics } from './agent-topics'
import { normalizeAttentionItem } from './attention'
import { resolveTargetId, targetDisplayById } from './automation-push'

describe('attention domain', () => {
  it('normalizes attention payload', () => {
    const item = normalizeAttentionItem({ id: 'a1', title: '待审核', urgency: 'input', body: 'HITL' })
    expect(item?.id).toBe('a1')
    expect(item?.urgency).toBe('input')
  })
})

describe('agent topics', () => {
  it('groups more than two user turns into topics', () => {
    const topics = buildConversationTopics([
      { id: '1', role: 'user', text: '写一份完整的需求文档' },
      { id: '2', role: 'assistant', text: '好的' },
      { id: '3', role: 'user', text: '补充测试范围与验收标准' },
      { id: '4', role: 'assistant', text: '收到' },
      { id: '5', role: 'user', text: '导出会议纪要给团队' },
    ])
    expect(topics.length).toBeGreaterThan(2)
  })
})

describe('automation push targets', () => {
  it('resolves feishu target id by label', () => {
    const options = [{ id: 'ou_1', name: '张三' }]
    expect(targetDisplayById('ou_1', options)).toBe('张三')
    expect(resolveTargetId('张三', options)).toBe('ou_1')
  })
})
