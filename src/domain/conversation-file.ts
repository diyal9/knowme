/** 对话附件与产物的轻量类型判定，供不同渲染入口共享。 */
export type ConversationFileKind = 'image' | 'document' | 'table' | 'code' | 'link'

const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:$|[?#])/i
const TABLE_EXTENSIONS = /\.(?:csv|tsv|xls|xlsx|ods)(?:$|[?#])/i
const CODE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|css|scss|html|vue|json|yaml|yml|xml|sql|sh|ps1)(?:$|[?#])/i
const DOCUMENT_EXTENSIONS = /\.(?:md|markdown|txt|pdf|doc|docx|rtf)(?:$|[?#])/i

function extensionMatch(value: unknown, pattern: RegExp): boolean {
  return pattern.test(String(value || '').trim())
}

export function conversationFileKind(type?: unknown, name?: unknown, href?: unknown): ConversationFileKind {
  const normalized = String(type || '').trim().toLowerCase()
  if (normalized === 'image') return 'image'
  if (['table', 'spreadsheet', 'csv'].includes(normalized)) return 'table'
  if (normalized === 'code') return 'code'
  if (['document', 'markdown', 'report', 'brief', 'note', 'plan', 'checklist', 'list', 'editor_patch'].includes(normalized)) return 'document'

  const candidate = `${String(name || '')} ${String(href || '')}`
  if (extensionMatch(candidate, IMAGE_EXTENSIONS)) return 'image'
  if (extensionMatch(candidate, TABLE_EXTENSIONS)) return 'table'
  if (extensionMatch(candidate, CODE_EXTENSIONS)) return 'code'
  if (extensionMatch(candidate, DOCUMENT_EXTENSIONS)) return 'document'
  return href ? 'link' : 'document'
}

export function conversationFileKindLabel(kind: ConversationFileKind): string {
  if (kind === 'image') return '图片'
  if (kind === 'table') return '表格'
  if (kind === 'code') return '代码'
  if (kind === 'link') return '链接'
  return '文档'
}

/** 从路径或 URL 提取适合放在紧凑卡片里的文件名。 */
export function conversationFileName(value: unknown, fallback = '未命名文件'): string {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  const withoutQuery = raw.split(/[?#]/, 1)[0] || raw
  const last = withoutQuery.replace(/\\/g, '/').split('/').filter(Boolean).pop()
  if (!last) return fallback
  try { return decodeURIComponent(last) || fallback } catch { return last }
}
