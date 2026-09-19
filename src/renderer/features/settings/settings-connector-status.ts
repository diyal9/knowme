/**
 * 设置页连接器状态 helpers：飞书卡片文案 / 主 CTA 决策与列表解包。
 * 不负责发起授权 IPC 或渲染 DOM。
 */
import type { ConnectorRecord, ConnectorStatus, FeishuPermissionPlan } from '../../../shared/api-extended'

export const DEFAULT_FEISHU_ALLOWLIST = [
  'feishu.search_docs',
  'feishu.read_doc',
  'feishu.query_bitable',
  'feishu.list_wiki_spaces',
  'feishu.list_wiki_nodes',
  'feishu.get_wiki_node',
  'feishu.meeting_candidates',
  'feishu.meeting_read',
  'feishu.related_chats',
  'feishu.today_priority',
  'feishu.doc_kb_suggest',
  'feishu.draft_write_doc',
  'feishu.draft_minute_permission',
  'feishu.draft_send_message',
  'feishu.draft_create_task',
  'feishu.draft_update_doc',
  'feishu.draft_calendar_event',
  'feishu.draft_drive_upload',
  'feishu.draft_wiki_node',
  'feishu.draft_bitable_record',
]

const DOC_KB_CATEGORY_IDS = new Set(['drive', 'docs', 'wiki'])

export type FeishuPrimaryMode = 'none' | 'full-auth' | 'topup' | 'done'

export type FeishuCardModel = {
  statusText: string
  primaryLabel: string
  primaryDisabled: boolean
  primaryMode: FeishuPrimaryMode
  /** 点主按钮前是否弹出权限确认 */
  needsConfirm: boolean
  missingLabels: string[]
  categories: { id: string; label?: string; state?: string }[]
}

export function connectorList(payload?: { items?: ConnectorRecord[]; connectors?: ConnectorRecord[] }) {
  return payload?.connectors || payload?.items || []
}

/** 把 connectorsStatus 返回的 nested connector.status 摊平到顶层只读视图。 */
export function unwrapFeishuStatus(payload?: ConnectorStatus | null): ConnectorStatus {
  if (!payload) return {}
  const nested = payload.connector?.status
  const base: ConnectorStatus = {
    ...payload,
    enabled: payload.enabled ?? payload.connector?.enabled,
  }
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return {
      ...base,
      ...nested,
      connector: payload.connector,
      // plan 可能挂在嵌套 status 或外壳上
      permissionPlan: nested.permissionPlan || payload.permissionPlan || base.permissionPlan,
      permissions: nested.permissions || payload.permissions || base.permissions,
      capabilities: nested.capabilities || payload.capabilities || base.capabilities,
    }
  }
  return base
}

export function feishuUserReady(payload?: ConnectorStatus | null) {
  const status = unwrapFeishuStatus(payload)
  const state = String(status.state || '').toLowerCase()
  if (state === 'auth_required') return false
  // lark-cli may report the connector as connected while its user token is
  // stale. Keep the CLI auth CTA available instead of showing a disabled
  // "已连接" button.
  const message = String(status.message || '').toLowerCase()
  if (/(needs?\s+refresh|refresh.*user|user.*refresh|需要刷新|刷新.*用户|用户.*刷新)/i.test(message)) return false
  if (status.userReady === false) return false
  if (status.connected === true || status.userReady === true) return true
  return state === 'online' || state === 'ready' || state === 'connected'
}

export function feishuPermissionsComplete(payload?: ConnectorStatus | null): boolean | null {
  const permissions = unwrapFeishuStatus(payload).permissions
  if (!permissions?.known) return null
  return permissions.complete === true
}

export function feishuMissingCategoryIds(payload?: ConnectorStatus | null) {
  const permissions = unwrapFeishuStatus(payload).permissions
  if (!permissions?.known) {
    return (feishuPermissionPlan(payload).missingCategories || []).map((item) => item.id).filter(Boolean)
  }
  return (permissions.categories || [])
    .filter((item) => item.state === 'missing')
    .map((item) => item.id)
    .sort()
}

export function feishuMissingCategoryLabels(payload?: ConnectorStatus | null) {
  const permissions = unwrapFeishuStatus(payload).permissions
  if (!permissions?.known) {
    return (feishuPermissionPlan(payload).missingCategories || [])
      .map((item) => item.label || item.id)
      .filter(Boolean) as string[]
  }
  return (permissions.categories || [])
    .filter((item) => item.state === 'missing')
    .map((item) => item.label || item.id)
    .filter(Boolean) as string[]
}

/** null = 未知；false = 文档/知识库缺口仍在。 */
export function feishuDocKbReadiness(payload?: ConnectorStatus | null): boolean | null {
  const status = unwrapFeishuStatus(payload)
  const ready = status.capabilities?.docsKb?.ready
  if (typeof ready === 'boolean') return ready
  const permissions = status.permissions
  if (!permissions?.known) return null
  const missing = (permissions.categories || []).filter(
    (item) => DOC_KB_CATEGORY_IDS.has(item.id) && item.state === 'missing',
  )
  return missing.length === 0
}

export function feishuStatusLabel(payload?: ConnectorStatus | null) {
  return buildFeishuCardModel(payload).statusText
}

export function feishuPermissionPlan(payload?: ConnectorStatus | null): FeishuPermissionPlan {
  const status = unwrapFeishuStatus(payload)
  return status.permissionPlan || payload?.permissionPlan || {}
}

/**
 * 飞书设置卡片唯一决策入口：组件只渲染，不复制就绪分支。
 * 未就绪主路径统一「授权飞书 CLI」；全就绪主按钮禁用「已连接」。
 */
export function buildFeishuCardModel(
  payload?: ConnectorStatus | null,
  opts?: { polling?: boolean; enabled?: boolean; present?: boolean },
): FeishuCardModel {
  const status = unwrapFeishuStatus(payload)
  const plan = feishuPermissionPlan(status)
  const categories = plan.categories || status.permissions?.categories || []
  const missingLabels = feishuMissingCategoryLabels(status)
  const enabled = opts?.enabled ?? status.enabled !== false
  const ready = feishuUserReady(status)
  const docKbReady = feishuDocKbReadiness(status)
  const permissionsComplete = feishuPermissionsComplete(status)

  if (opts?.present === false) {
    return {
      statusText: '未发现飞书连接器，请先刷新状态。',
      primaryLabel: '刷新后重试',
      primaryDisabled: true,
      primaryMode: 'none',
      needsConfirm: false,
      missingLabels,
      categories,
    }
  }

  if (opts?.polling) {
    return {
      statusText: `${ready ? '已连接' : (status.message || '未连接')}（等待授权…）`,
      primaryLabel: '授权飞书 CLI',
      primaryDisabled: true,
      primaryMode: 'full-auth',
      needsConfirm: false,
      missingLabels,
      categories,
    }
  }

  if (!payload) {
    return {
      statusText: '正在读取连接状态…',
      primaryLabel: '授权飞书 CLI',
      primaryDisabled: true,
      primaryMode: 'full-auth',
      needsConfirm: false,
      missingLabels,
      categories,
    }
  }

  if (enabled && ready && docKbReady === false) {
    const coreMissing = status.capabilities?.docsKb?.missing || []
    return {
      statusText: coreMissing.length
        ? `飞书账号已连接，但文档/知识库仍缺少：${coreMissing.join('、')}。`
        : '飞书账号已连接，但文档/知识库权限仍未完全获得。',
      primaryLabel: '授权飞书 CLI',
      primaryDisabled: false,
      primaryMode: 'full-auth',
      needsConfirm: true,
      missingLabels,
      categories,
    }
  }

  if (enabled && ready) {
    if (permissionsComplete === false && missingLabels.length) {
      return {
        statusText: `已连接，可直接读取飞书文档/知识库；${missingLabels.join('、')}未获批。`,
        primaryLabel: '补充权限',
        primaryDisabled: false,
        primaryMode: 'topup',
        needsConfirm: true,
        missingLabels,
        categories,
      }
    }
    return {
      statusText: status.message || '已连接，可直接在对话中使用飞书能力。',
      primaryLabel: '已连接',
      primaryDisabled: true,
      primaryMode: 'done',
      needsConfirm: false,
      missingLabels,
      categories,
    }
  }

  if (enabled && !ready) {
    return {
      statusText: status.message || '已启用，等待完成飞书 CLI 用户授权。',
      primaryLabel: '授权飞书 CLI',
      primaryDisabled: false,
      primaryMode: 'full-auth',
      needsConfirm: true,
      missingLabels,
      categories,
    }
  }

  return {
    statusText: '未连接，点击一次即可完成连接与授权。',
    primaryLabel: '授权飞书 CLI',
    primaryDisabled: false,
    primaryMode: 'full-auth',
    needsConfirm: true,
    missingLabels,
    categories,
  }
}

export function parseAllowlist(raw: string) {
  return raw.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
}
