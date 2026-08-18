/**
 * 代码工作区 blob 分流：Markdown 排版 / 轻量高亮 / 纯文本。输出必须转义。
 */

export type BlobKind = 'markdown' | 'code' | 'text' | 'binary'

const CODE_EXT: Record<string, string> = {
  go: 'Go', ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  mjs: 'JavaScript', cjs: 'JavaScript', json: 'JSON', css: 'CSS', html: 'HTML',
  py: 'Python', yaml: 'YAML', yml: 'YAML', sh: 'Shell',
}

const KEYWORDS: Record<string, string[]> = {
  go: ['func', 'package', 'import', 'return', 'if', 'for', 'struct', 'type', 'var', 'const'],
  ts: ['function', 'return', 'const', 'let', 'import', 'export', 'from', 'class', 'if', 'else', 'interface', 'type'],
  js: ['function', 'return', 'const', 'let', 'import', 'export', 'from', 'class', 'if', 'else'],
  py: ['def', 'return', 'import', 'from', 'class', 'if', 'else', 'for', 'with', 'async'],
}

export function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] || ch))
}

export function detectKind(path: string, isBinary = false): BlobKind {
  if (isBinary) return 'binary'
  const ext = String(path || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (CODE_EXT[ext]) return 'code'
  return 'text'
}

export function langLabel(path: string): string {
  const ext = String(path || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'md' || ext === 'markdown') return 'Markdown'
  return CODE_EXT[ext] || 'Text'
}

function highlightCode(content: string, ext: string): string {
  const escaped = escapeHtml(content)
  const keys = KEYWORDS[ext] || KEYWORDS.ts
  const kw = new RegExp(`\\b(${keys.join('|')})\\b`, 'g')
  return escaped
    .replace(/(\/\/[^\n]*|#(?!!).*$)/gm, '<span class="tok-cmt">$1</span>')
    .replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="tok-str">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>')
    .replace(kw, '<span class="tok-kw">$1</span>')
}

function markdownHtml(content: string): string {
  const escaped = escapeHtml(content)
  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}

export function renderPreview(input: { path: string; content: string; isBinary?: boolean }): {
  html: string
  kind: BlobKind
  langLabel: string
} {
  const kind = detectKind(input.path, input.isBinary === true)
  const label = langLabel(input.path)
  if (kind === 'binary') {
    return { html: '<p class="wb-ws-empty">二进制文件不可预览</p>', kind, langLabel: label }
  }
  if (kind === 'markdown') {
    return { html: `<div class="wb-ws-md">${markdownHtml(input.content)}</div>`, kind, langLabel: label }
  }
  if (kind === 'code') {
    const ext = String(input.path).split('.').pop()?.toLowerCase() || 'ts'
    const lang = ext === 'tsx' || ext === 'jsx' ? 'ts' : ext === 'mjs' || ext === 'cjs' ? 'js' : ext
    return {
      html: `<pre class="wb-ws-code language-${escapeHtml(ext)}">${highlightCode(input.content, lang)}</pre>`,
      kind,
      langLabel: label,
    }
  }
  return { html: `<pre class="wb-ws-code">${escapeHtml(input.content)}</pre>`, kind, langLabel: label }
}
