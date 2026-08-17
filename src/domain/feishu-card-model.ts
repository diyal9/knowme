import * as FeishuLink from '@knowme-lib/feishu-link'

const parseOpenLink = (FeishuLink as any).parseOpenLink as (href: string) => {
  isFeishu?: boolean
  href?: string
  feishuResource?: { type?: string; label?: string; glyph?: string }
} | null

export type FeishuCardModel = {
  href: string
  title: string
  kindLabel: string
  glyph: string
  resourceType: string
  meeting?: { session: string; meta: string }
}

function cleanLinkLabel(label: string, fallback = '飞书文档'): string {
  const cleaned = String(label || '')
    .trim()
    .replace(/^(?:<code>|&lt;code&gt;)([\s\S]*?)(?:<\/code>|&lt;\/code&gt;)$/i, '$1')
    .replace(/<\/?(?:code|strong|em)>/gi, '')
    .trim()
  return cleaned || fallback
}

export function buildFeishuCard(href: string, label: string): FeishuCardModel | null {
  const parsed = parseOpenLink(href)
  if (!parsed?.isFeishu) return null
  const resource = parsed.feishuResource || { type: 'resource', label: '飞书资源', glyph: '飞' }
  const rawTitle = cleanLinkLabel(label)
  const meeting = resource.type === 'minutes'
    ? rawTitle.match(/^(\d{1,2})\.\s*(.+?)｜([^｜]+)(?:｜组织者：(.+))?$/)
    : null
  const title = meeting ? String(meeting[2] || '').trim() : rawTitle
  const meetingMeta = meeting
    ? [String(meeting[3] || '').trim(), meeting[4] ? `组织者：${String(meeting[4]).trim()}` : '']
      .filter(Boolean)
      .join(' ｜ ')
    : ''
  return {
    href: String(parsed.href || href),
    title,
    kindLabel: String(resource.label || '飞书资源'),
    glyph: String(resource.glyph || '飞'),
    resourceType: String(resource.type || 'resource'),
    meeting: meeting
      ? { session: String(meeting[1] || ''), meta: meetingMeta }
      : undefined,
  }
}
