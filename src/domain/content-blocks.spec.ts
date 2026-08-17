import { describe, expect, it } from 'vitest'
import { parseContentBlocks } from './content-blocks'
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

  it('serializes lists without raw asterisks', () => {
    const html = renderKnowledgeMarkdown('1. **Data Server Host**\n2. **Hit**')
    expect(html).toContain('<ol>')
    expect(html).toContain('<strong>Data Server Host</strong>')
    expect(html).not.toContain('**Data')
  })
})
