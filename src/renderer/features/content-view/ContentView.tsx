/**
 * 对话 Markdown 块渲染。caret 挂在末块内，避免流式光标掉到下一行。
 */
import { useMemo, type ReactNode, Fragment } from 'react'
import { parseContentBlocks } from '../../../domain/content-blocks'
import { ContentInlines, ContentTable } from './ContentBlocks'
import './content-view.css'

export function ContentView({
  source,
  className = '',
  caret = null,
}: {
  source: string
  className?: string
  caret?: ReactNode
}) {
  const blocks = useMemo(() => parseContentBlocks(source), [source])
  const last = blocks.length - 1
  return (
    <div className={`km-content agent-md ${className}`.trim()} data-testid="content-view">
      {blocks.map((block, index) => {
        const end = index === last ? caret : null
        if (block.type === 'heading') {
          const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4')
          return <Tag key={index}><ContentInlines nodes={block.inlines} />{end}</Tag>
        }
        if (block.type === 'paragraph') {
          return <p key={index}><ContentInlines nodes={block.inlines} />{end}</p>
        }
        if (block.type === 'quote') {
          return <blockquote key={index}><p><ContentInlines nodes={block.inlines} />{end}</p></blockquote>
        }
        if (block.type === 'code') {
          return <pre key={index}><code>{block.text}</code>{end}</pre>
        }
        if (block.type === 'hr') {
          return (
            <Fragment key={index}>
              <hr />
              {end}
            </Fragment>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={index}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <ContentInlines nodes={item} />
                  {end && i === block.items.length - 1 ? end : null}
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <span key={index}>
            <ContentTable block={block} />
            {end}
          </span>
        )
      })}
      {blocks.length === 0 ? caret : null}
    </div>
  )
}
