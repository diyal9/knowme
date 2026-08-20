/**
 * 对话 Markdown 块渲染。流式走纯文本（见 AgentMessageBubble）；此处负责终态 Markdown。
 * 长文首屏不解析，等 Worker；短文只同步一次。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from 'react'
import {
  parseContentBlocks,
  parseContentBlocksStreaming,
  type ContentBlock,
  type StreamingParseCache,
} from '../../../domain/content-blocks'
import {
  CONTENT_BLOCKS_WORKER_THRESHOLD,
  parseContentBlocksAsync,
  warmContentBlocksWorker,
} from '../../../domain/content-blocks-async'
import { ContentInlines, ContentTable } from './ContentBlocks'
import './content-view.css'

warmContentBlocksWorker()

const EMPTY_BLOCKS: ContentBlock[] = []

function useStreamingBlocks(source: string, streaming: boolean): ContentBlock[] {
  const cacheRef = useRef<StreamingParseCache | null>(null)
  const prevStreaming = useRef(streaming)

  return useMemo(() => {
    const text = String(source || '')
    if (!streaming) {
      // 终态解析归 useCommittedBlocks，这里不再全量 parseContentBlocks
      if (prevStreaming.current && cacheRef.current) {
        const cached = parseContentBlocksStreaming(text, cacheRef.current)
        prevStreaming.current = false
        cacheRef.current = null
        return cached.blocks
      }
      prevStreaming.current = false
      cacheRef.current = null
      return EMPTY_BLOCKS
    }
    prevStreaming.current = true
    const parsed = parseContentBlocksStreaming(text, cacheRef.current)
    cacheRef.current = parsed.cache
    return parsed.blocks
  }, [source, streaming])
}

function useCommittedBlocks(source: string, enabled: boolean): {
  blocks: ContentBlock[]
  pending: boolean
} {
  const text = String(source || '')
  const defer = text.length >= CONTENT_BLOCKS_WORKER_THRESHOLD
  const parsedTextRef = useRef<string | null>(null)
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => {
    if (!enabled || defer) return EMPTY_BLOCKS
    parsedTextRef.current = text
    return parseContentBlocks(text)
  })
  const [pending, setPending] = useState(() => Boolean(enabled && defer))

  useEffect(() => {
    if (!enabled) {
      parsedTextRef.current = null
      setBlocks(EMPTY_BLOCKS)
      setPending(false)
      return
    }
    if (!defer) {
      if (parsedTextRef.current === text) return
      parsedTextRef.current = text
      setBlocks(parseContentBlocks(text))
      setPending(false)
      return
    }
    parsedTextRef.current = null
    let cancelled = false
    setPending(true)
    void parseContentBlocksAsync(text).then((parsed) => {
      if (cancelled) return
      parsedTextRef.current = text
      setBlocks(parsed)
      setPending(false)
    })
    return () => {
      cancelled = true
    }
  }, [text, enabled, defer])

  // source 切换后首帧不得展示上一 source 的 blocks（useEffect 之前 blocks 仍可能是旧值）
  const bound = parsedTextRef.current === text
  return {
    blocks: bound ? blocks : EMPTY_BLOCKS,
    pending: enabled && (!bound || pending),
  }
}

function blockKey(block: ContentBlock, index: number): string {
  if (block.type === 'heading') return `h${block.level}-${index}`
  if (block.type === 'code') return `code-${index}-${block.text.length}`
  if (block.type === 'hr') return `hr-${index}`
  if (block.type === 'list') return `list-${block.ordered ? 'o' : 'u'}-${index}-${block.items.length}`
  if (block.type === 'table') return `table-${index}-${block.rows.length}`
  return `${block.type}-${index}`
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
  const text = String(source || '')
  const streamBlocks = useStreamingBlocks(text, streaming)
  const committed = useCommittedBlocks(text, !streaming)
  const blocks = streaming ? streamBlocks : (committed.pending ? EMPTY_BLOCKS : committed.blocks)
  const pending = !streaming && committed.pending

  if (pending) {
    return (
      <div
        className={`km-content agent-md agent-md-fallback agent-md-loading ${className}`.trim()}
        data-testid="content-view"
        data-content-pending="1"
        aria-busy="true"
        aria-label="正在整理内容"
      >
        正在整理内容…
      </div>
    )
  }

  const last = blocks.length - 1
  return (
    <div className={`km-content agent-md ${className}`.trim()} data-testid="content-view">
      {blocks.map((block, index) => {
        const end = index === last ? caret : null
        const key = blockKey(block, index)
        if (block.type === 'heading') {
          const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4')
          return <Tag key={key}><ContentInlines nodes={block.inlines} />{end}</Tag>
        }
        if (block.type === 'paragraph') {
          return <p key={key}><ContentInlines nodes={block.inlines} />{end}</p>
        }
        if (block.type === 'quote') {
          return <blockquote key={key}><p><ContentInlines nodes={block.inlines} />{end}</p></blockquote>
        }
        if (block.type === 'code') {
          return <pre key={key}><code>{block.text}</code>{end}</pre>
        }
        if (block.type === 'hr') {
          return (
            <Fragment key={key}>
              <hr />
              {end}
            </Fragment>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={key}>
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`}><ContentInlines nodes={item} />{index === last && i === block.items.length - 1 ? end : null}</li>
              ))}
            </Tag>
          )
        }
        if (block.type === 'table') {
          return (
            <Fragment key={key}>
              <ContentTable block={block} />
              {end}
            </Fragment>
          )
        }
        return null
      })}
    </div>
  )
}
