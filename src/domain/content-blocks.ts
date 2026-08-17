import { parseInlines, type InlineNode } from './content-inlines'

export type ContentBlock =
  | { type: 'heading'; level: number; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'code'; text: string }
  | { type: 'quote'; inlines: InlineNode[] }
  | { type: 'table'; headers: InlineNode[][]; alignments: string[]; rows: InlineNode[][][] }
  | { type: 'hr' }

function splitTableCells(line: string): string[] {
  let t = String(line || '').trim()
  if (!t) return []
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((cell) => cell.trim())
}

function looksLikeTableRow(line: string): boolean {
  return String(line || '').trim().includes('|') && splitTableCells(line).length >= 2
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableCells(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function alignmentFromSeparator(cell: string): string {
  const t = String(cell || '').trim()
  const left = t.startsWith(':')
  const right = t.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return ''
}

export function parseContentBlocks(src: string): ContentBlock[] {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n')
  const out: ContentBlock[] = []
  let list: { ordered: boolean; items: InlineNode[][] } | null = null
  let inCode = false
  const code: string[] = []

  const flushList = () => {
    if (!list) return
    out.push({ type: 'list', ordered: list.ordered, items: list.items })
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push({ type: 'code', text: code.join('\n') })
        code.length = 0
        inCode = false
      } else {
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      code.push(line)
      continue
    }
    if (!line.trim()) {
      flushList()
      continue
    }
    if (/^\s*-{3,}\s*$/.test(line)) {
      flushList()
      out.push({ type: 'hr' })
      continue
    }
    if (looksLikeTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushList()
      const headers = splitTableCells(line).map((cell) => parseInlines(cell))
      const alignments = splitTableCells(lines[i + 1]).map(alignmentFromSeparator)
      const rows: InlineNode[][][] = []
      i += 2
      while (i < lines.length && looksLikeTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        const cells = splitTableCells(lines[i])
        rows.push(headers.map((_, idx) => parseInlines(cells[idx] == null ? '' : cells[idx])))
        i += 1
      }
      i -= 1
      out.push({ type: 'table', headers, alignments, rows })
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushList()
      out.push({ type: 'heading', level: heading[1].length, inlines: parseInlines(heading[2]) })
      continue
    }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      flushList()
      out.push({ type: 'quote', inlines: parseInlines(quote[1]) })
      continue
    }
    const ordered = line.match(/^\s*\d+[.)、．]\s+(.*)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ordered) {
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(parseInlines(ordered[1]))
      continue
    }
    if (unordered) {
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(parseInlines(unordered[1]))
      continue
    }
    flushList()
    out.push({ type: 'paragraph', inlines: parseInlines(line) })
  }
  if (inCode) out.push({ type: 'code', text: code.join('\n') })
  flushList()
  return out
}

export type StreamingParseCache = {
  prefix: string
  blocks: ContentBlock[]
}

/**
 * 流式增量：找到「围栏成对」的最后一个段落边界，此前视为稳定前缀。
 * 未找到则返回 0（整段都当尾部解析）。
 */
export function findStableContentPrefixEnd(src: string): number {
  const text = String(src || '').replace(/\r\n/g, '\n')
  if (text.length < 2) return 0
  let searchFrom = text.length
  while (searchFrom > 0) {
    const idx = text.lastIndexOf('\n\n', searchFrom - 1)
    if (idx < 0) return 0
    const prefix = text.slice(0, idx + 2)
    const fenceCount = (prefix.match(/^```/gm) || []).length
    if (fenceCount % 2 === 0) return idx + 2
    searchFrom = idx
  }
  return 0
}

/** 流式解析：稳定前缀命中缓存时只重解析尾段。 */
export function parseContentBlocksStreaming(
  src: string,
  cache?: StreamingParseCache | null,
): { blocks: ContentBlock[]; cache: StreamingParseCache } {
  const text = String(src || '').replace(/\r\n/g, '\n')
  const end = findStableContentPrefixEnd(text)
  if (end <= 0) {
    const blocks = parseContentBlocks(text)
    return { blocks, cache: { prefix: '', blocks: [] } }
  }
  const prefix = text.slice(0, end)
  const tail = text.slice(end)
  const prefixBlocks = cache && cache.prefix === prefix
    ? cache.blocks
    : parseContentBlocks(prefix)
  const nextCache: StreamingParseCache = { prefix, blocks: prefixBlocks }
  if (!tail) return { blocks: prefixBlocks.slice(), cache: nextCache }
  return { blocks: prefixBlocks.concat(parseContentBlocks(tail)), cache: nextCache }
}
