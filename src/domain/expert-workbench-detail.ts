import type { CapabilityItem } from '../shared/api'

export interface ExpertContractItem {
  id: string
  label: string
  required?: boolean
}

export interface ExpertWorkbenchDetail {
  id: string
  name: string
  description: string
  version: string
  source: string
  useCases: string[]
  boundaries: string[]
  inputs: ExpertContractItem[]
  outputs: ExpertContractItem[]
  skills: string[]
  connectors: string[]
  requiresMaterials: boolean
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function strings(value: unknown, max = 8): string[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(typeof item === 'object' && item ? record(item).label || record(item).title || record(item).name : item || '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function contract(value: unknown, fallback: string): ExpertContractItem[] {
  const rows = Array.isArray(value) ? value : []
  const parsed: ExpertContractItem[] = rows.flatMap((item, index) => {
    const row = record(item)
    const label = String(row.label || row.title || row.name || (typeof item === 'string' ? item : '')).trim()
    return label ? [{ id: String(row.id || `item-${index + 1}`), label, required: row.required === true }] : []
  })
  return parsed.length ? parsed.slice(0, 12) : [{ id: 'primary', label: fallback, required: true }]
}

/** 将能力中心的宽泛 expert-get 结果投影为工作台只读能力契约。 */
export function parseExpertWorkbenchDetail(payload: unknown, fallback: CapabilityItem): ExpertWorkbenchDetail {
  const outer = record(payload)
  const loaded = record(outer.expert || outer)
  const frontmatter = record(loaded.frontmatter)
  const workbench = record(frontmatter.workbench || loaded.workbench)
  const name = String(loaded.name || frontmatter.name || fallback.name || fallback.id).trim()
  const description = String(loaded.description || frontmatter.description || fallback.description || '专业 Agent').trim()
  const useCases = strings(workbench.useCases || frontmatter.useCases)
  const inputs = contract(workbench.inputs || frontmatter.inputContract || loaded.inputs, '本次任务目标')
  const outputs = contract(workbench.outputs || frontmatter.outputContract || loaded.outputs, '任务交付物')
  const boundaries = strings(workbench.boundaries || frontmatter.boundaries)
  return {
    id: String(loaded.id || frontmatter.id || fallback.id),
    name,
    description,
    version: String(loaded.version || frontmatter.version || '1.0.0'),
    source: String(loaded.source || fallback.status || '工作台专家'),
    useCases: useCases.length ? useCases : [description],
    boundaries: boundaries.length ? boundaries : ['负责一个边界明确的专业节点', '不在任务中调度或模拟其他专家'],
    inputs,
    outputs,
    skills: strings(loaded.skills || frontmatter.skills, 16),
    connectors: strings(loaded.connectors || frontmatter.connectors, 16),
    requiresMaterials: inputs.some((item) => item.required && item.id !== 'primary'),
  }
}
