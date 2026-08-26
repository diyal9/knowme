import { describe, expect, it } from 'vitest'
import {
  findStableContentPrefixEnd,
  normalizeDisplayCodeTags,
  parseContentBlocks,
  parseContentBlocksStreaming,
} from './content-blocks'
import { renderKnowledgeMarkdown } from './knowledge-markdown'

describe('content-blocks', () => {
  it('parses GFM tables and emphasis', () => {
    const blocks = parseContentBlocks('| 项 | 状态 |\n| --- | --- |\n| **A** | `ok` |')
    expect(blocks[0]).toMatchObject({ type: 'table' })
    const table = blocks[0]
    if (table.type !== 'table') throw new Error('expected table')
    expect(table.headers[0][0]).toEqual({ kind: 'text', text: '项' })
    expect(table.rows[0][0]).toEqual([{ kind: 'strong', text: 'A' }])
  })

  it('renders model-emitted tool-shaped text as display-only code', () => {
    const source = '正在执行搜索…\n<tool_code>\nprint(search_web(query="上海天气"))\n</tool_code>'
    expect(normalizeDisplayCodeTags(source)).toContain('```text')
    const blocks = parseContentBlocks(source)
    expect(blocks).toContainEqual({ type: 'code', text: 'print(search_web(query="上海天气"))' })
  })

  it('parses feishu markdown links into card nodes', () => {
    const blocks = parseContentBlocks('见 [纪要](https://sample.feishu.cn/docx/abc123)')
    const para = blocks[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    const card = para.inlines.find((node) => node.kind === 'feishu')
    expect(card?.kind).toBe('feishu')
    if (card?.kind !== 'feishu') throw new Error('expected feishu')
    expect(card.card.resourceType).toBe('doc')
    expect(card.card.title).toBe('纪要')
  })

  it('parses relative markdown documents into link nodes', () => {
    const blocks = parseContentBlocks('见 [技术架构](tech/ActivityScheduler.md)')
    const para = blocks[0]
    if (para.type !== 'paragraph') throw new Error('expected paragraph')
    expect(para.inlines).toContainEqual({
      kind: 'link',
      href: 'tech/ActivityScheduler.md',
      label: '技术架构',
    })
  })

  it('serializes lists without raw asterisks', () => {
    const html = renderKnowledgeMarkdown('1. **Data Server Host**\n2. **Hit**')
    expect(html).toContain('<ol>')
    expect(html).toContain('<strong>Data Server Host</strong>')
    expect(html).not.toContain('**Data')
  })

  it('finds fence-balanced stable prefix ends', () => {
    const src = 'hello\n\nworld\n\nmore'
    expect(findStableContentPrefixEnd(src)).toBe('hello\n\nworld\n\n'.length)
    const openFence = 'before\n\n```js\ncode\n'
    expect(findStableContentPrefixEnd(openFence)).toBe('before\n\n'.length)
  })

  it('reuses streaming prefix cache for growing tails', () => {
    const prefix = 'para one\n\n'
    const first = parseContentBlocksStreaming(`${prefix}tail`)
    expect(first.cache.prefix).toBe(prefix)
    const second = parseContentBlocksStreaming(`${prefix}tail grows`, first.cache)
    expect(second.cache.blocks).toBe(first.cache.blocks)
    expect(second.blocks.length).toBeGreaterThanOrEqual(first.blocks.length)
  })
})
