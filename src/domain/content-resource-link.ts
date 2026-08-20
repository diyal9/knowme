/** 对话内容链接分类：网页走浏览器预览，本地 Markdown 走内容源文档预览。 */
export type ContentResourceKind = 'web' | 'markdown'

export function normalizeLocalMarkdownPath(href: string): string | null {
  const raw = String(href || '').trim()
  if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//')) return null
  const withoutSuffix = raw.split(/[?#]/, 1)[0] || ''
  let decoded = withoutSuffix
  try { decoded = decodeURIComponent(withoutSuffix) } catch { /* keep original for validation */ }
  const normalized = decoded.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) return null
  const path = parts.join('/')
  return /\.(?:md|markdown)$/i.test(path) ? path : null
}

export function classifyContentResource(href: string): ContentResourceKind {
  return normalizeLocalMarkdownPath(href) ? 'markdown' : 'web'
}

export function sourceFileUrl(rootPath: string, relativePath: string): string | null {
  const root = String(rootPath || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  const path = normalizeLocalMarkdownPath(relativePath)
  if (!root || !path) return null
  const full = `${root}/${path}`
  const encoded = full.split('/').map((part, index) => {
    if (index === 0 && /^[a-z]:$/i.test(part)) return part
    return encodeURIComponent(part)
  }).join('/')
  return `file:///${encoded}`
}
