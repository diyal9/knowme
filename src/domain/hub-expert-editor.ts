export function slugifyExpertId(name: string, fallback = ''): string {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  if (slug) return slug
  return fallback
}

export function catalogRefIds(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((value) => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
    if (value && typeof value === 'object') {
      const rec = value as { id?: string; name?: string }
      return String(rec.id || rec.name || '').trim()
    }
    return ''
  }).filter(Boolean))]
}

export function expertEditorFooterSummary(input: {
  id: string
  name: string
  skills: number
  connectors: number
  knowledge: number
}): string {
  const counts = `已选 ${input.skills} Skill · ${input.connectors} 连接器 · ${input.knowledge} 知识源`
  const id = String(input.id || '').trim()
  if (!id) return counts
  return `${counts} · 将保存为 ${id}`
}

export type LoadedExpertDraft = {
  name: string
  description: string
  avatar: string
  soul: string
  sop: string
  agenticType: string
  agenticConfig: Record<string, unknown>
  skills: string[]
  connectors: string[]
}

export function draftFromExpertGet(payload: unknown, fallbackName = ''): LoadedExpertDraft | null {
  if (!payload || typeof payload !== 'object') return null
  const rec = payload as { ok?: boolean; expert?: Record<string, unknown> }
  const expert = (rec.expert && typeof rec.expert === 'object' ? rec.expert : rec) as Record<string, unknown>
  if (!expert || typeof expert !== 'object') return null
  const cfg = expert.agenticConfig && typeof expert.agenticConfig === 'object'
    ? expert.agenticConfig as Record<string, unknown>
    : {}
  return {
    name: String(expert.name || fallbackName || '').trim(),
    description: String(expert.description || '').trim(),
    avatar: String(expert.avatar || '').trim(),
    soul: String(expert.soul || '').trim(),
    sop: String(expert.sop || expert.systemPrompt || '').trim(),
    agenticType: String(expert.agenticType || 'react').trim() || 'react',
    agenticConfig: cfg,
    skills: catalogRefIds(expert.skills),
    connectors: catalogRefIds(expert.connectors),
  }
}
