/** Shared display-boundary rule for configured assistant identity. */
export function stripLeadingAssistantIdentity(text: string, displayName?: string): string {
  const name = String(displayName || '').trim()
  if (!name) return text
  const lines = String(text || '').split('\n')
  const first = lines[0]?.trim() || ''
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const marker = new RegExp(`^${escaped}[。.!！?？:：,，]?\\s*$`, 'u')
  return marker.test(first) ? lines.slice(1).join('\n').replace(/^\n+/, '') : text
}
