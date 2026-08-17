export type AttentionUrgency = 'info' | 'input'

export type AttentionDeepLink = {
  type?: string
  slug?: string
  runId?: string
}

export type AttentionItem = {
  id: string
  kind?: string
  title: string
  body?: string
  urgency: AttentionUrgency
  source?: string
  deepLink?: AttentionDeepLink | null
}

export function normalizeAttentionItem(raw: unknown): AttentionItem | null {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const id = String(rec.id || '').trim()
  if (!id) return null
  const deep = rec.deepLink && typeof rec.deepLink === 'object'
    ? rec.deepLink as Record<string, unknown>
    : null
  return {
    id,
    kind: String(rec.kind || 'task').trim() || 'task',
    title: String(rec.title || '需要关注').trim().slice(0, 80) || '需要关注',
    body: String(rec.body || '').trim().slice(0, 160) || undefined,
    urgency: String(rec.urgency || 'info') === 'input' ? 'input' : 'info',
    source: String(rec.source || '').trim() || undefined,
    deepLink: deep ? {
      type: String(deep.type || '').trim() || undefined,
      slug: String(deep.slug || '').trim() || undefined,
      runId: String(deep.runId || '').trim() || undefined,
    } : null,
  }
}

export function attentionKicker(item: AttentionItem): string {
  return item.urgency === 'input' ? '待你处理' : '提醒'
}
