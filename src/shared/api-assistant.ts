export interface PackEmptyScene {
  id: string
  title?: string
  subtitle?: string
  prompt?: string
}

export interface PackEmptyGroup {
  packId: string
  hero?: string
  kicker?: string
  scenes?: PackEmptyScene[]
}

export interface StructuredChoiceItem {
  id?: string
  label: string
  description?: string
  action?: string
  payload?: string
}

export interface StructuredChoiceBar {
  kind?: string
  title?: string
  items: StructuredChoiceItem[]
}

export interface GroundingStatusDto {
  status?: string
  sources?: { tool?: string; status?: string }[]
  violations?: unknown[]
}

export interface AgentTraceItemDto {
  id: string
  kind?: 'stage' | 'tool' | 'subrun' | string
  title?: string
  status?: string
  summary?: string
  durationMs?: number
  toolName?: string
  round?: number
}
