import type {
  AgentManagementRole,
  CapabilityItem,
  ManagedAgentOwnership,
  ManagedAgentTarget,
} from '../shared/api'

export const AGENT_MANAGEMENT_EXPERT_ID = 'agent-operations'
export const CURRENT_AGENT_MANAGEMENT_ROLE: AgentManagementRole = 'admin'

const SYSTEM_SOURCES = new Set(['curated', 'official', 'pack'])
const ORGANIZATION_SOURCES = new Set(['local-repo', 'organization', 'org'])

function sourceOf(item: Pick<CapabilityItem, 'source' | 'provenance'>): string {
  return String(item.source || item.provenance?.source || 'custom').trim().toLowerCase() || 'custom'
}

export function managedAgentOwnership(item: Pick<CapabilityItem, 'source' | 'provenance'>): ManagedAgentOwnership {
  const source = sourceOf(item)
  if (SYSTEM_SOURCES.has(source)) return 'system'
  if (ORGANIZATION_SOURCES.has(source)) return 'organization'
  return 'user'
}

export function canManageAgentTarget(
  item: Pick<CapabilityItem, 'source' | 'provenance'>,
  role: AgentManagementRole = CURRENT_AGENT_MANAGEMENT_ROLE,
): boolean {
  return role === 'admin' || managedAgentOwnership(item) === 'user'
}

export function toManagedAgentTarget(
  item: CapabilityItem,
  role: AgentManagementRole = CURRENT_AGENT_MANAGEMENT_ROLE,
): ManagedAgentTarget {
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || item.id || '').trim(),
    source: sourceOf(item),
    ownership: managedAgentOwnership(item),
    version: String(item.version || '').trim() || undefined,
    contentHash: String(item.contentHash || '').trim() || undefined,
    editable: canManageAgentTarget(item, role),
  }
}

export function manageableAgentTargets(
  items: CapabilityItem[],
  role: AgentManagementRole = CURRENT_AGENT_MANAGEMENT_ROLE,
): ManagedAgentTarget[] {
  return items
    .filter((item) => item.kind === 'expert')
    .filter((item) => item.installed === true || item.enabled === true)
    .filter((item) => canManageAgentTarget(item, role))
    .map((item) => toManagedAgentTarget(item, role))
    .sort((a, b) => {
      const ownershipOrder = { user: 0, organization: 1, system: 2 }
      return ownershipOrder[a.ownership] - ownershipOrder[b.ownership]
        || a.name.localeCompare(b.name, 'zh-CN')
    })
}

export function formatAgentManagementTargetContext(target?: ManagedAgentTarget | null): string {
  if (!target?.id) return ''
  const ownership = target.ownership === 'system' ? '系统 Agent'
    : target.ownership === 'organization' ? '组织 Agent' : '我的 Agent'
  return [
    '【Agent 管理对象】',
    `名称：${target.name}`,
    `Agent ID：${target.id}`,
    `归属：${ownership}`,
    `来源：${target.source}`,
    target.version ? `版本：${target.version}` : '',
    target.contentHash ? `配置哈希：${target.contentHash}` : '',
    `当前操作权限：${target.editable ? '允许调优与评估；任何写入仍须预览和用户确认' : '只读评估'}`,
    '后续诊断、评估、草稿、预览和变更必须始终使用这个 Agent ID，不得改为同名对象。',
  ].filter(Boolean).join('\n')
}

export function buildAgentManagementPrompt(target: ManagedAgentTarget | null | undefined, userText: string): string {
  const context = formatAgentManagementTargetContext(target)
  return context ? `${context}\n\n用户消息：${String(userText || '').trim()}` : String(userText || '').trim()
}
