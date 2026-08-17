/**
 * 对话 Markdown 块渲染。caret 挂在末块内，避免流式光标掉到下一行。
 * 流式时节流源文 + 稳定前缀缓存，避免每 token 全量重解析。
 */
import { useEffect, useRef, useState, type ReactNode, Fragment } from 'react'
import {
  parseContentBlocks,
  parseContentBlocksStreaming,
  type ContentBlock,
  type StreamingParseCache,
} from '../../../domain/content-blocks'
import { ContentInlines, ContentTable } from './ContentBlocks'
import './content-view.css'

const STREAM_PARSE_MS = 100

function useStreamingBlocks(source: string, streaming: boolean): ContentBlock[] {
  const cacheRef = useRef<StreamingParseCache | null>(null)
  const [blocks, setBlocks] = useState(() => parseContentBlocks(source))
  const latestRef = useRef(source)
  latestRef.current = source

  useEffect(() => {
    if (!streaming) {
      cacheRef.current = null
      setBlocks(parseContentBlocks(source))
      return
    }
    const id = window.setTimeout(() => {
      const text = latestRef.current
      const parsed = parseContentBlocksStreaming(text, cacheRef.current)
      cacheRef.current = parsed.cache
      setBlocks(parsed.blocks)
    }, STREAM_PARSE_MS)
    return () => window.clearTimeout(id)
  }, [source, streaming])

  return blocks
}

export function ContentView({
  source,
  className = '',
  caret = null,
  streaming = false,
}: {
  source: string
  className?: string
  caret?: ReactNode
  streaming?: boolean
}) {
  const blocks = useStreamingBlocks(source, streaming)
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
