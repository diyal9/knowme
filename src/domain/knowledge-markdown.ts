import { parseContentBlocks, type ContentBlock } from './content-blocks'
import type { InlineNode } from './content-inlines'

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function serializeInlines(nodes: InlineNode[]): string {
  return nodes.map((node) => {
    if (node.kind === 'text') return escapeHtml(node.text)
    if (node.kind === 'strong') return `<strong>${escapeHtml(node.text)}</strong>`
    if (node.kind === 'em') return `<em>${escapeHtml(node.text)}</em>`
    if (node.kind === 'code') return `<code>${escapeHtml(node.text)}</code>`
    if (node.kind === 'link') {
      return `<a href="${escapeHtml(node.href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(node.label)}</a>`
    }
    if (node.kind !== 'feishu') return escapeHtml('')
    const card = node.card
    if (card.resourceType === 'chat') {
      return `<a href="${escapeHtml(card.href)}" class="feishu-chat-open">${escapeHtml(card.title)}</a>`
    }
    const meet = card.meeting ? ' feishu-meeting-card' : ''
    const kind = card.meeting ? `${escapeHtml(card.kindLabel)} · 第${escapeHtml(card.meeting.session)}场` : escapeHtml(card.kindLabel)
    const meta = card.meeting?.meta ? `<span class="feishu-link-meta">${escapeHtml(card.meeting.meta)}</span>` : ''
    return `<a class="feishu-link-card${meet}" href="${escapeHtml(card.href)}"><span class="feishu-link-mark" aria-hidden="true">${escapeHtml(card.glyph)}</span><span class="feishu-link-copy"><span class="feishu-link-kind">${kind}</span><span class="feishu-link-title">${escapeHtml(card.title)}</span>${meta}</span><span class="feishu-link-open"><span class="feishu-link-open-label">预览</span><span aria-hidden="true">↗</span></span></a>`
  }).join('')
}

function serializeBlock(block: ContentBlock): string {
  if (block.type === 'heading') return `<h${block.level}>${serializeInlines(block.inlines)}</h${block.level}>`
  if (block.type === 'paragraph') return `<p>${serializeInlines(block.inlines)}</p>`
  if (block.type === 'quote') return `<blockquote><p>${serializeInlines(block.inlines)}</p></blockquote>`
  if (block.type === 'code') return `<pre><code>${escapeHtml(block.text)}</code></pre>`
  if (block.type === 'hr') return '<hr>'
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul'
    return `<${tag}>${block.items.map((item) => `<li>${serializeInlines(item)}</li>`).join('')}</${tag}>`
  }
  const th = block.headers.map((cell, i) => {
    const align = block.alignments[i]
    const style = align ? ` style="text-align:${align}"` : ''
    return `<th${style}>${serializeInlines(cell)}</th>`
  }).join('')
  const body = block.rows.map((row) => `<tr>${row.map((cell, i) => {
    const align = block.alignments[i]
    const style = align ? ` style="text-align:${align}"` : ''
    return `<td${style}>${serializeInlines(cell)}</td>`
  }).join('')}</tr>`).join('')
  return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`
}

export function serializeContentBlocks(blocks: ContentBlock[]): string {
  return blocks.map(serializeBlock).join('')
}

export function renderKnowledgeMarkdown(src: string): string {
  return serializeContentBlocks(parseContentBlocks(src))
}
