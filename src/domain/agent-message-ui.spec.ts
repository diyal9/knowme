import { describe, expect, it } from 'vitest'
import {
  enrichChatMessage,
  extractStructuredChoiceFromText,
  parseStructuredChoiceBars,
} from './agent-message-ui'

describe('agent-message-ui', () => {
  it('normalizes bare action arrays to a clickable choice bar', () => {
    const bars = parseStructuredChoiceBars([
      { label: '生成清单', action: 'send', payload: '请生成清单' },
    ])
    expect(bars).toEqual([{
      kind: 'choice',
      title: '下一步建议',
      items: [{
        id: undefined,
        label: '生成清单',
        description: undefined,
        action: 'send',
        payload: '请生成清单',
      }],
    }])
  })

  it('recovers a legacy raw suggestion from a completed assistant message', () => {
    const raw = [
      '下一步建议（您可直接点选）',
      '[{"label":"生成清单","action":"send","payload":"请生成清单"}]',
      '',
      '可继续告诉我你的目标。',
    ].join('\n')
    const extracted = extractStructuredChoiceFromText(raw)
    expect(extracted?.text).toContain('下一步建议')
    expect(extracted?.text).toContain('可继续告诉我')
    expect(extracted?.text).not.toContain('"label"')
    expect(extracted?.bars[0].items[0].label).toBe('生成清单')

    const message = enrichChatMessage({ id: 'a1', role: 'assistant', text: raw }, {})
    expect(message.structuredUi?.[0].items[0].label).toBe('生成清单')
    expect(message.text).not.toContain('"action"')
  })

  it('does not recover unrelated configuration JSON', () => {
    const message = enrichChatMessage({
      id: 'a2',
      role: 'assistant',
      text: '配置如下：\n{"host":"localhost","port":8080}',
    }, {})
    expect(message.structuredUi).toBeUndefined()
    expect(message.text).toContain('"host"')
  })
})
