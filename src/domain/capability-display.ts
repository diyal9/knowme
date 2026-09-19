type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}

export function capabilityStatusLabel(value: unknown): string {
  const labels: Record<string, string> = { enabled: '已启用', disabled: '已停用', installed: '已安装', available: '可添加', missing: '未安装', removed: '已移除', unavailable: '不可用', installing: '安装中', error: '异常', featured: '精选' }
  return labels[String(value || '')] || '状态未知'
}

export function capabilityRiskLabel(value: unknown): string {
  const labels: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '极高' }
  return labels[String(value || '')] || '未评估'
}

export function capabilityPermissionRows(value: unknown): Array<{ label: string; value: string; details?: string[] }> {
  const permissions = record(value)
  const rows: Array<{ label: string; value: string; details?: string[] }> = []
  for (const [key, label] of [['network', '联网'], ['write', '本地写入'], ['externalWrite', '外部系统写入']]) {
    const allowed = permissions[key] ?? record(permissions.sandbox)[key]
    if (allowed !== undefined) rows.push({ label, value: allowed === true ? '允许' : allowed === false ? '禁止' : '未明确声明' })
  }
  for (const [key, label, field] of [['tools', '工具范围', 'allowlist'], ['connectors', '连接器范围', 'allowedConnectorIds']]) {
    if (!(key in permissions)) continue
    const scoped = permissions[key]
    const list = Array.isArray(scoped) ? scoped : record(scoped)[field]
    const names = Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string' && !!item.trim()) : null
    rows.push({ label, value: names ? (names.length ? `已声明 ${names.length} 项` : '不允许调用') : '未明确声明允许范围', ...(names?.length ? { details: names } : {}) })
  }
  if (Object.keys(permissions).some(key => !['network', 'write', 'externalWrite', 'tools', 'connectors', 'sandbox'].includes(key))) {
    rows.push({ label: '其他权限设置', value: '已声明，需结合任务授权检查' })
  }
  return rows
}

/** Missing data and failed probes cannot establish authorization. Used for initial load and retries. */
export function connectorAuthorizationDisplay(payload: unknown): { label: string; ready: boolean } {
  const outer = record(payload)
  const status = record(record(outer.connector).status || outer.status || payload)
  const state = String(status.state || '').toLowerCase()
  const result = (label: string, ready = false) => ({ label, ready })
  if (state === 'auth_required' || status.userReady === false) return result('需授权')
  const permissions = record(status.permissions)
  if (permissions.known === true && permissions.complete === false) return result('需补齐权限')
  if (outer.ok === false || status.ok === false || ['offline', 'error', 'missing', 'not_found', 'disabled', 'unavailable'].includes(state)) return result('不可用')
  if (status.ok !== true || ['unknown', 'checking', 'pending'].includes(state)) return result('状态未知')
  return result('已授权', true)
}
