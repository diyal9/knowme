import type { AgentRunArtifact } from '../shared/api'

const DOCUMENT_TYPES = new Set(['document', 'markdown', 'report', 'brief', 'note', 'plan'])

const ARTIFACT_KIND_LABELS: Record<string, string> = {
  document: '文档',
  markdown: '文档',
  report: '报告',
  brief: '简报',
  note: '笔记',
  plan: '方案',
  checklist: '清单',
  list: '清单',
  table: '表格',
  spreadsheet: '表格',
  csv: '表格',
  code: '代码',
  image: '图片',
}

export function parseExpertArtifactRef(value: unknown): { sessionId: string; artifactId: string } | null {
  const ref = String(value || '').trim()
  const marker = ref.lastIndexOf('#')
  if (marker <= 0 || marker >= ref.length - 1) return null
  return { sessionId: ref.slice(0, marker), artifactId: ref.slice(marker + 1) }
}

export function expertArtifactKind(type: unknown): string {
  const normalized = String(type || 'document').trim().toLowerCase()
  if (DOCUMENT_TYPES.has(normalized)) return 'document'
  if (['table', 'spreadsheet', 'csv'].includes(normalized)) return 'table'
  if (['checklist', 'list'].includes(normalized)) return 'checklist'
  if (normalized === 'code') return 'code'
  if (normalized === 'image') return 'image'
  return 'document'
}

export function expertArtifactKindLabel(type: unknown): string {
  const normalized = String(type || 'document').trim().toLowerCase()
  return ARTIFACT_KIND_LABELS[normalized] || '文档'
}

/**
 * Older expert prompts sometimes wrapped a real document in model-facing metadata such as
 * “交付物 1：周报（Document）”. The review surface should show the artifact itself, not that envelope.
 */
export function expertArtifactBody(artifact: AgentRunArtifact | null | undefined, fallback = ''): string {
  const source = String(artifact?.body || fallback || '').replace(/\r\n/g, '\n').trim()
  if (!source) return ''
  const lines = source.split('\n')
  while (lines.length) {
    const line = lines[0].trim()
    if (/^#{0,4}\s*交付物\s*\d*\s*[:：].*(?:\(|（)\s*(?:document|markdown|report|brief|note|plan|table|spreadsheet|csv|checklist|list)\s*(?:\)|）)\s*$/i.test(line)) {
      lines.shift()
      while (lines.length && (!lines[0].trim() || /^-{3,}$/.test(lines[0].trim()))) lines.shift()
      continue
    }
    break
  }
  return lines.join('\n').trim()
}
