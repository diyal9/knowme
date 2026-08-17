export type FeishuTarget = { id: string; name?: string }

export type AutomationPushTargets = {
  miniApp?: boolean
  bot?: boolean
  userTargets?: FeishuTarget[]
  groupTargets?: FeishuTarget[]
}

export function targetDisplayById(
  id: string,
  options: FeishuTarget[],
  fallback: FeishuTarget[] = [],
): string {
  const key = String(id || '').trim()
  if (!key) return ''
  const pool = [...options, ...fallback]
  const match = pool.find((item) => item.id === key)
  return match?.name || key
}

export function resolveTargetId(
  label: string,
  options: FeishuTarget[],
  fallback: FeishuTarget[] = [],
): string {
  const text = String(label || '').trim()
  if (!text) return ''
  const pool = [...options, ...fallback]
  const exact = pool.find((item) => item.name === text || item.id === text)
  return exact?.id || text
}

export function normalizePushTargets(raw: unknown): AutomationPushTargets {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const mapTargets = (list: unknown): FeishuTarget[] => {
    if (!Array.isArray(list)) return []
    const out: FeishuTarget[] = []
    for (const item of list) {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const id = String(row.id || '').trim()
      if (!id) continue
      out.push({ id, name: String(row.name || '').trim() || undefined })
    }
    return out
  }
  return {
    miniApp: rec.miniApp === true,
    bot: rec.bot === true,
    userTargets: mapTargets(rec.userTargets),
    groupTargets: mapTargets(rec.groupTargets),
  }
}
