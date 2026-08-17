import * as AgentIdentity from '@knowme-lib/agent-identity'
import type { CapabilityItem } from '../shared/api'

const DEFAULT_IDENTITY_ICON = AgentIdentity.DEFAULT_IDENTITY_ICON as string
const identityAvatarSrc = AgentIdentity.identityAvatarSrc as (agent: unknown) => string
const identityIcon = AgentIdentity.identityIcon as (agent: unknown) => string
const identitySourceLabel = AgentIdentity.identitySourceLabel as (agent: unknown) => string

export type ExpertLike = Pick<
  CapabilityItem,
  'id' | 'name' | 'description' | 'category' | 'status' | 'enabled' | 'installed'
> & {
  title?: string
  version?: string
  avatar?: string
  skills?: unknown[]
  tags?: string[]
  source?: string
}

function identityPayload(agent: ExpertLike) {
  return {
    id: agent.id,
    name: agent.name || agent.title || agent.id,
    title: agent.title,
    description: agent.description,
    avatar: agent.avatar,
    skills: agent.skills,
    category: agent.category,
    tags: agent.tags,
  }
}

export function expertAvatarSrc(agent: ExpertLike): string {
  return String(identityAvatarSrc(identityPayload(agent)) || '').trim()
}

export function expertAvatarIcon(agent: ExpertLike): string {
  return String(identityIcon(identityPayload(agent)) || DEFAULT_IDENTITY_ICON || 'users')
}

export function expertSourceBadge(agent: ExpertLike): string {
  return String(identitySourceLabel?.({
    origin: agent.source || 'local',
    source: agent.source,
  }) || '我的专家')
}

export function expertQuickVersion(agent: ExpertLike): string {
  return String(agent.version || '1.0.0').replace(/^v/i, '')
}

export function expertQuickSub(agent: ExpertLike): string {
  const category = String(agent.category || '专家').trim()
  const source = agent.source === 'team' ? '团队' : agent.source === 'builtin' ? '内置' : '本地'
  return [category, source].filter(Boolean).join(' · ')
}

export function expertQuickBadge(agent: ExpertLike): { text: string; installed: boolean } {
  const status = String(agent.status || '').trim().toLowerCase()
  if (['missing', 'removed', 'unavailable', 'not_found'].includes(status)) {
    return { text: '已卸载', installed: false }
  }
  if (status === 'disabled' || agent.enabled === false) {
    return { text: '已停用', installed: false }
  }
  if (['installed', 'enabled'].includes(status) || agent.enabled === true || agent.installed) {
    return { text: '已安装', installed: true }
  }
  return { text: '工作台', installed: false }
}

export function expertCardTitle(agent: ExpertLike): string {
  return String(agent.name || agent.title || agent.id || '专家').trim()
}
