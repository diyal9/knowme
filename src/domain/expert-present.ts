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

const EXPERT_NAME_ALIASES: Record<string, string> = {
  'office-partner': '办公伙伴',
  personal: '我的 KnowMe',
}

export function expertDisplayName(value: unknown): string {
  const name = String(value || '').trim()
  return EXPERT_NAME_ALIASES[name] || name || '专业专家'
}

export function expertDeliverableTitle(value: unknown): string {
  const title = String(value || '').trim()
  if (!title || /^[a-z0-9-]+任务成果$/i.test(title)) return '任务交付物'
  return title.replace(/office-partner/gi, '办公伙伴')
}

const TASK_EVENT_LABELS: Record<string, string> = {
  task_created: '已创建任务',
  preflight_started: '开始预检',
  preflight_passed: '预检完成',
  preflight_failed: '预检未通过',
  task_started: '专家已开始工作',
  input_requested: '等待补充信息',
  input_provided: '已补充信息',
  deliverable_created: '已生成交付物',
  deliverable_submitted: '交付物等待验收',
  deliverable_accepted: '已接受交付物',
  changes_requested: '你退回并提出修改意见',
  revision_ready: '专家提交了修改版本',
  task_completed: '任务已完成',
  task_failed: '任务执行失败',
  task_cancelled: '任务已取消',
}

export function expertTaskEventLabel(type: unknown, summary?: unknown): string {
  const key = String(type || '').trim()
  if (TASK_EVENT_LABELS[key]) return TASK_EVENT_LABELS[key]
  const text = String(summary || '').trim()
  return text ? text.replace(/office-partner/gi, '办公伙伴').replace(/任务成果/g, '交付物') : '任务状态已更新'
}
