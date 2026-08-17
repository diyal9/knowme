import { consoleSourceLabel } from './workbench-labels'

export type AutomationPipelineOption = {
  id: string
  name: string
  domain: string
  backend: string
  label: string
}

export type AutomationConnectorOption = {
  id: string
  name: string
  status?: string
}

type WorkflowPackageLike = {
  id?: string
  name?: string
  status?: string
  executionBackends?: string[]
  provenance?: { domain?: string }
}

export function automationScheduleLabel(schedule: {
  type?: string
  dailyTime?: string
  intervalValue?: number
  intervalUnit?: string
  onceAt?: string
}): string {
  if (schedule.type === 'once') {
    return schedule.onceAt ? `单次 ${schedule.onceAt}` : '单次（未设置）'
  }
  if (schedule.type === 'interval') {
    const unit = schedule.intervalUnit === 'day' ? '天' : '小时'
    return `每 ${schedule.intervalValue || 1} ${unit}`
  }
  return `每天 ${schedule.dailyTime || '09:00'}`
}

export function buildAutomationPipelines(
  packages: WorkflowPackageLike[],
  opts: { daemonOnline?: boolean | null; workflowId?: string; backend?: string } = {},
): AutomationPipelineOption[] {
  const daemonOnline = opts.daemonOnline === true
  return packages
    .filter((item) => item?.id && String(item.status || 'published') !== 'unavailable')
    .map((item) => {
      const backends = (Array.isArray(item.executionBackends) ? item.executionBackends : [])
        .filter((backend) => backend === 'daemon' || backend === 'local-team')
      const backend = opts.workflowId === item.id && opts.backend
        ? opts.backend
        : (backends.includes('daemon') && daemonOnline ? 'daemon' : (backends[0] || ''))
      const domain = String(item.provenance?.domain || 'office').trim() || 'office'
      const name = String(item.name || item.id)
      return {
        id: String(item.id),
        name,
        domain,
        backend,
        label: `${name} · ${consoleSourceLabel(backend)}`,
      }
    })
    .filter((item) => item.id && item.backend)
}

export function normalizeAutomationConnectors(raw: unknown): AutomationConnectorOption[] {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const list = Array.isArray(rec.connectors)
    ? rec.connectors
    : Array.isArray(rec.items)
      ? rec.items
      : []
  const out: AutomationConnectorOption[] = []
  for (const item of list) {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const id = String(row.id || '').trim()
    if (!id || row.enabled === false) continue
    const statusRec = row.status && typeof row.status === 'object'
      ? row.status as Record<string, unknown>
      : {}
    const status = String(statusRec.code || row.status || '').trim() || undefined
    out.push({ id, name: String(row.name || id), status })
  }
  return out
}
