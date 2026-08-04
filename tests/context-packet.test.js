const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const contextPacket = require('../src/lib/context-packet')

describe('context packet', () => {
  it('keeps only explicit and confirmed items in light mode', () => {
    const packet = contextPacket.buildContextPacket({
      mode: 'light',
      items: [
        {
          id: 'profile',
          type: 'profile',
          text: 'Windows 产品开发者',
          confidence: 'explicit',
          source: { type: 'profile', id: 'user' },
        },
        {
          id: 'pref',
          type: 'preference',
          text: '先给结论',
          confidence: 'confirmed',
          source: { type: 'pattern', id: 'p1' },
        },
        {
          id: 'activity',
          type: 'work_memory',
          text: '最近打开 KnowMe',
          confidence: 'activity',
          source: { type: 'event', id: 'e1' },
        },
      ],
    })
    assert.deepEqual(packet.items.map(item => item.id), ['profile', 'pref'])
    assert.doesNotMatch(contextPacket.formatForPrompt(packet), /最近打开/)
  })

  it('drops stale items, deduplicates, and preserves source metadata', () => {
    const packet = contextPacket.buildContextPacket({
      mode: 'work',
      now: Date.parse('2026-07-31T00:00:00.000Z'),
      items: [
        {
          id: 'old',
          type: 'work_memory',
          text: '已过期目标',
          confidence: 'derived',
          staleAt: '2026-07-30T00:00:00.000Z',
          source: { type: 'event', id: 'old-event', label: '旧事件' },
        },
        {
          id: 'w1',
          type: 'work_memory',
          text: '当前项目目标',
          confidence: 'derived',
          source: { type: 'event', id: 'e1', label: '工作事件' },
        },
        {
          id: 'w2',
          type: 'work_memory',
          text: '当前项目目标',
          confidence: 'derived',
          source: { type: 'event', id: 'e2', label: '重复事件' },
        },
      ],
    })
    assert.equal(packet.items.length, 1)
    assert.equal(packet.items[0].source.label, '工作事件')
    assert.match(contextPacket.formatForPrompt(packet), /工作上下文（非知识库事实）/)
    assert.match(contextPacket.formatForPrompt(packet), /工作事件/)
  })

  it('honors off mode and fixed item limits', () => {
    const packet = contextPacket.buildContextPacket({
      mode: 'off',
      maxItems: 1,
      items: [{ type: 'profile', text: '不会注入', confidence: 'explicit' }],
    })
    assert.deepEqual(packet.items, [])
    assert.equal(packet.policy.memoryMode, 'off')
  })
})
