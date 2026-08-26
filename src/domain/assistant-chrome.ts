import type { CapabilityItem } from '../shared/api'

export type AssistantModelOption = {
  id: string
  label: string
  contextWindow?: number
  supportsTools?: boolean
  supportsVision?: boolean
}

export type AssistantModelGroup = {
  id: string
  label: string
  models: AssistantModelOption[]
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

function parseModelOption(raw: unknown): AssistantModelOption | null {
  const rec = asRecord(raw)
  const id = String(rec.id || '').trim()
  if (!id) return null
  return {
    id,
    label: String(rec.label || rec.id || ''),
    contextWindow: Number(rec.contextWindow) || undefined,
    supportsTools: rec.supportsTools === false ? false : true,
    supportsVision: rec.supportsVision === true,
  }
}

export function parseAssistantModelCatalog(raw: unknown): {
  groups: AssistantModelGroup[]
  presets: AssistantModelOption[]
  defaultModelId: string
} {
  const catalog = asRecord(raw)
  const groupsRaw = Array.isArray(catalog.groups) ? catalog.groups : []
  const groups = groupsRaw.map((group) => {
    const rec = asRecord(group)
    const modelsRaw = Array.isArray(rec.models) ? rec.models : []
    return {
      id: String(rec.id || ''),
      label: String(rec.label || rec.id || '模型'),
      models: modelsRaw.map(parseModelOption).filter((item): item is AssistantModelOption => Boolean(item)),
    }
  }).filter((group) => group.models.length)
  const presets = (Array.isArray(catalog.presets) ? catalog.presets : groups.flatMap((group) => group.models))
    .map(parseModelOption)
    .filter((item): item is AssistantModelOption => Boolean(item))
  return { groups, presets, defaultModelId: presets[0]?.id || '' }
}

export function parseAssistantProfileModel(raw: unknown, fallbackModelId = ''): string {
  const profileRec = asRecord(raw)
  return String(profileRec.model || fallbackModelId || '').trim()
}

export function parseAssistantSkills(raw: unknown): CapabilityItem[] {
  const result = asRecord(raw)
  return (Array.isArray(result.items) ? result.items : []) as CapabilityItem[]
}
