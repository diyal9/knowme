export type MessageLinkSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; href: string }

const URL_CANDIDATE_RE = /https?:\/\/[^\s<>]+/gi
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const TRAILING_URL_PUNCTUATION_RE = /[),.;，。；！？、）】》」』]+$/

function isFeishuHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase()
  return host === 'feishu.cn'
    || host.endsWith('.feishu.cn')
    || host === 'larksuite.com'
    || host.endsWith('.larksuite.com')
}

/**
 * Feishu document tokens are ASCII. When Chinese prose is pasted directly
 * after one, a permissive URL regex otherwise consumes the prose as pathname.
 * Scope that boundary rule to Feishu/Lark so legitimate Unicode URLs elsewhere
 * keep working.
 */
function splitCandidate(raw: string): { href: string; suffix: string } {
  let end = raw.length
  try {
    const parsed = new URL(raw)
    if (isFeishuHost(parsed.hostname)) {
      const protocolEnd = raw.indexOf('://') + 3
      const pathStart = raw.indexOf('/', protocolEnd)
      const scanStart = pathStart >= 0 ? pathStart : protocolEnd
      const cjkOffset = raw.slice(scanStart).search(CJK_RE)
      if (cjkOffset >= 0) end = scanStart + cjkOffset
    }
  } catch {
    // Keep the broad candidate; trailing punctuation cleanup below is safe.
  }

  const candidate = raw.slice(0, end)
  const href = candidate.replace(TRAILING_URL_PUNCTUATION_RE, '')
  return { href, suffix: raw.slice(href.length) }
}

export function splitMessageLinks(text: string): MessageLinkSegment[] {
  const source = String(text || '')
  const segments: MessageLinkSegment[] = []
  let cursor = 0

  for (const match of source.matchAll(URL_CANDIDATE_RE)) {
    const raw = String(match[0] || '')
    const start = Number(match.index) || 0
    if (start > cursor) segments.push({ kind: 'text', text: source.slice(cursor, start) })
    const { href, suffix } = splitCandidate(raw)
    if (href) segments.push({ kind: 'link', href })
    if (suffix) segments.push({ kind: 'text', text: suffix })
    cursor = start + raw.length
  }

  if (cursor < source.length) segments.push({ kind: 'text', text: source.slice(cursor) })
  return segments.length ? segments : [{ kind: 'text', text: source }]
}

/** Give downstream intent/tool parsing an unambiguous boundary without changing the displayed user text. */
export function normalizeMessageLinkBoundaries(text: string): string {
  const segments = splitMessageLinks(text)
  return segments.map((segment, index) => {
    if (segment.kind !== 'link') return segment.text
    const next = segments[index + 1]
    const needsBoundary = next?.kind === 'text' && CJK_RE.test(next.text.charAt(0))
    return `${segment.href}${needsBoundary ? ' ' : ''}`
  }).join('')
}
