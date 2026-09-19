import { describe, expect, it } from 'vitest'
import { normalizeMessageLinkBoundaries, splitMessageLinks } from './message-links'

describe('message-links', () => {
  it('stops a Feishu URL before directly adjacent Chinese prose', () => {
    const href = 'https://example.feishu.cn/wiki/BdKrdR019oCv5bxpnFlc4TTnpkh'
    expect(splitMessageLinks(`帮我总结下${href}这个飞书文档`)).toEqual([
      { kind: 'text', text: '帮我总结下' },
      { kind: 'link', href },
      { kind: 'text', text: '这个飞书文档' },
    ])
    expect(normalizeMessageLinkBoundaries(`${href}这个飞书文档`)).toBe(`${href} 这个飞书文档`)
  })

  it('keeps punctuation outside the link and preserves non-Feishu Unicode URLs', () => {
    expect(splitMessageLinks('查看 https://example.feishu.cn/docx/abc。')).toEqual([
      { kind: 'text', text: '查看 ' },
      { kind: 'link', href: 'https://example.feishu.cn/docx/abc' },
      { kind: 'text', text: '。' },
    ])
    expect(splitMessageLinks('查看 https://example.com/中文')).toEqual([
      { kind: 'text', text: '查看 ' },
      { kind: 'link', href: 'https://example.com/中文' },
    ])
  })
})
