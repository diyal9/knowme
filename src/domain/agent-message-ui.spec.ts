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

  it('recovers choices/options protocol emitted in a fenced JSON block', () => {
    const raw = [
      '补齐路径二选一：',
      '',
      '```json',
      '{"type":"choices","title":"如何继续？","multi":false,"allowCustom":true,"options":[{"kind":"send","label":"改用知识库检索替代","value":"检索今天的更新文档"},{"kind":"open_knowledge","label":"打开本机知识库主页","value":"检查本地/Ragflow"}]}',
      '```',
    ].join('\n')
    const extracted = extractStructuredChoiceFromText(raw)
    expect(extracted?.text).toBe('补齐路径二选一：')
    expect(extracted?.bars).toEqual([{
      kind: 'choice',
      title: '如何继续？',
      items: [
        {
          id: undefined,
          label: '改用知识库检索替代',
          description: undefined,
          action: 'send',
          payload: '检索今天的更新文档',
        },
        {
          id: undefined,
          label: '打开本机知识库主页',
          description: undefined,
          action: 'open_knowledge',
          payload: '检查本地/Ragflow',
        },
      ],
    }])
  })

  it('renders the suggest/options single-pick protocol as structured choices', () => {
    const raw = [
      '下一步建议二选一：',
      '',
      '```json',
      '{"type":"suggest","multiple":false,"allowCustom":true,"options":[{"kind":"send","label":"在飞书文档中搜索“知识库 问答”","value":"搜索知识库 问答"},{"kind":"send","label":"继续基于现有资料回答","value":"基于现有资料回答"}]}',
      '```',
    ].join('\n')
    const message = enrichChatMessage({ id: 'suggest-1', role: 'assistant', text: raw }, {})

    expect(message.text).toBe('下一步建议二选一：')
    expect(message.text).not.toContain('"type":"suggest"')
    expect(message.structuredUi).toEqual([{
      kind: 'choice',
      title: '下一步建议',
      items: [
        {
          id: undefined,
          label: '在飞书文档中搜索“知识库 问答”',
          description: undefined,
          action: 'send',
          payload: '搜索知识库 问答',
        },
        {
          id: undefined,
          label: '继续基于现有资料回答',
          description: undefined,
          action: 'send',
          payload: '基于现有资料回答',
        },
      ],
    }])
  })

  it('does not coerce multi-select suggestions into single-pick buttons', () => {
    const message = enrichChatMessage({
      id: 'suggest-multi',
      role: 'assistant',
      text: '选择需要的项：\n{"type":"suggest","multiple":true,"options":[{"kind":"send","label":"A","value":"A"}]}',
    }, {})
    expect(message.structuredUi).toBeUndefined()
    expect(message.text).toContain('"multiple":true')
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

  it('recovers a plain numbered single-choice clarification without hardcoded topics', () => {
    const raw = [
      '我需要先确认一个范围。',
      '问题：你希望先深入哪一类？',
      '选项：1. 方案设计（明确边界）；2. 实现验证（检查行为）；3. 其他（请补充）',
    ].join('\n')
    const extracted = extractStructuredChoiceFromText(raw)
    expect(extracted?.text).toBe('我需要先确认一个范围。')
    expect(extracted?.bars[0].title).toBe('你希望先深入哪一类？')
    expect(extracted?.bars[0].items.map((item) => item.label)).toEqual(['方案设计', '实现验证', '其他'])
    expect(extracted?.bars[0].items[2].action).toBe('fill')
  })
})
