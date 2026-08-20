import type { ContentBlock } from '../../../domain/content-blocks'
import type { InlineNode } from '../../../domain/content-inlines'
import { ContentResourceLink } from './ContentResourceLink'
import { FeishuResourceCard } from './FeishuResourceCard'

export function ContentInlines({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === 'text') return <span key={index}>{node.text}</span>
        if (node.kind === 'strong') return <strong key={index}>{node.text}</strong>
        if (node.kind === 'em') return <em key={index}>{node.text}</em>
        if (node.kind === 'code') return <code key={index}>{node.text}</code>
        if (node.kind === 'feishu') return <FeishuResourceCard key={index} card={node.card} />
        if (node.kind === 'link') {
          return <ContentResourceLink key={index} href={node.href} label={node.label} />
        }
        return null
      })}
    </>
  )
}

export function ContentTable({ block }: { block: Extract<ContentBlock, { type: 'table' }> }) {
  return (
    <div className="md-table-wrap" data-testid="content-table">
      <table className="md-table">
        <thead>
          <tr>
            {block.headers.map((cell, i) => (
              <th key={i} style={block.alignments[i] ? { textAlign: block.alignments[i] as 'left' | 'right' | 'center' } : undefined}>
                <ContentInlines nodes={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={block.alignments[c] ? { textAlign: block.alignments[c] as 'left' | 'right' | 'center' } : undefined}>
                  <ContentInlines nodes={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
