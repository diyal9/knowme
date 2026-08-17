'use strict'

const FEISHU_AUTH_DOMAIN_LIST = [
  'drive',
  'docs',
  'wiki',
  'base',
  'contact',
  'im',
  'vc',
  'minutes',
  'calendar',
  'task',
]
const FEISHU_AUTH_DOMAINS = FEISHU_AUTH_DOMAIN_LIST.join(',')
// Every scope here must be able to satisfy at least one FEISHU_PERMISSION_PROFILE
// prefix, and every profile category must be covered by at least one scope here.
// Otherwise `permissions.complete` can never turn true and the settings card gets
// stuck offering "补充扩展权限" forever. `assertScopeProfileConsistency` locks this.
const FEISHU_AUTH_SCOPE_LIST = [
  'auth:user.id:read',
  'contact:user:search',
  'im:chat:read',
  'im:message:readonly',
  'im:message.send_as_user',
  'drive:drive:readonly',
  'search:docs:read',
  'docx:document:readonly',
  'docx:document:create',
  'docx:document:write_only',
  'wiki:node:read',
  'wiki:space:read',
  'bitable:app:readonly',
  'calendar:calendar:readonly',
  'task:task:read',
  'vc:meeting.search:read',
  'minutes:minutes.search:read',
  'minutes:permission:apply',
]
const FEISHU_AUTH_SCOPES = FEISHU_AUTH_SCOPE_LIST.join(',')
const FEISHU_PERMISSION_PROFILE = [
  { id: 'drive', label: '云盘文件', requiredPrefixes: ['drive:'] },
  {
    id: 'docs',
    label: '文档读写',
    requiredPrefixes: ['search:docs:', 'docx:document:readonly', 'docx:document:create'],
  },
  { id: 'wiki', label: '知识库', requiredPrefixes: ['wiki:node:read', 'wiki:space:read'] },
  // Feishu names the Bitable scopes `bitable:app*`; `base` is only the lark-cli
  // domain alias and never appears in a granted token scope.
  { id: 'base', label: '多维表格', requiredPrefixes: ['bitable:app'] },
  { id: 'contact', label: '通讯录', requiredPrefixes: ['contact:user:search'] },
  {
    id: 'im',
    label: '聊天读写',
    requiredPrefixes: ['im:chat:read', 'im:message:readonly', 'im:message.send_as_user'],
  },
  { id: 'vc', label: '视频会议', requiredPrefixes: ['vc:meeting.search:read'] },
  {
    id: 'minutes',
    label: '妙记与会议纪要',
    requiredPrefixes: ['minutes:minutes.search:read', 'minutes:permission:apply'],
  },
  { id: 'calendar', label: '日程', requiredPrefixes: ['calendar:'] },
  { id: 'task', label: '待办', requiredPrefixes: ['task:task:read'] },
]
const FEISHU_CAPABILITY_PROFILE = {
  docs_kb: {
    label: '文档/知识库',
    categoryIds: ['drive', 'docs', 'wiki'],
  },
  office_core: {
    label: '办公基础能力',
    categoryIds: ['drive', 'docs', 'wiki', 'base', 'contact', 'im', 'vc', 'minutes', 'task'],
  },
  today_priority: {
    label: '今日进度',
    categoryIds: ['calendar', 'task', 'im'],
  },
}
const INVALID_SCOPE_RE = /invalid or malformed scopes|scope list contains invalid|invalid scope|malformed scope/i
const SCOPE_TOKEN_RE = /^[a-z][a-z0-9_]*(?::[a-z0-9_.*-]+){1,3}$/i

/**
 * A stable fingerprint of the granted scope set. Lets the UI detect "this round
 * actually granted something new" without ever exposing raw token scopes, which
 * is the only reliable way to tell an incremental grant from a no-op.
 */
function scopeSignature(granted) {
  const sorted = [...granted].sort().join(' ')
  let hash = 5381
  for (let i = 0; i < sorted.length; i += 1) {
    hash = ((hash * 33) ^ sorted.charCodeAt(i)) >>> 0
  }
  return `${granted.size}:${hash.toString(36)}`
}

function summarizeFeishuPermissions(scope) {
  const raw = String(scope || '').trim()
  if (!raw) {
    return { known: false, complete: null, signature: '', categories: [] }
  }
  const granted = new Set(raw.split(/\s+/).filter(Boolean))
  const categories = FEISHU_PERMISSION_PROFILE.map((item) => {
    const missing = item.requiredPrefixes.filter((prefix) => {
      return ![...granted].some((value) => value === prefix || value.startsWith(prefix))
    })
    return {
      id: item.id,
      label: item.label,
      state: missing.length ? 'missing' : 'ready',
      missing,
    }
  })
  return {
    known: true,
    complete: categories.every((item) => item.state === 'ready'),
    signature: scopeSignature(granted),
    categories,
  }
}

function resolvePermissionSnapshot(input) {
  if (input && typeof input === 'object' && Array.isArray(input.categories)) return input
  return summarizeFeishuPermissions(input)
}

function summarizeFeishuCapabilityReadiness(input, capabilityId) {
  const capability = FEISHU_CAPABILITY_PROFILE[String(capabilityId || '').trim()]
  if (!capability) {
    return { known: false, ready: null, label: '', missing: [], categories: [] }
  }
  const permissions = resolvePermissionSnapshot(input)
  if (!permissions.known) {
    return { known: false, ready: null, label: capability.label, missing: [], categories: [] }
  }
  const categories = capability.categoryIds
    .map((id) => permissions.categories.find((item) => item.id === id))
    .filter(Boolean)
  const missing = categories
    .filter((item) => item.state === 'missing')
    .map((item) => item.label)
  return {
    known: true,
    ready: missing.length === 0,
    label: capability.label,
    missing,
    categories,
  }
}

function scopesForCategory(category) {
  const prefixes = Array.isArray(category?.requiredPrefixes) ? category.requiredPrefixes : []
  return FEISHU_AUTH_SCOPE_LIST.filter((scope) =>
    prefixes.some((prefix) => scope === prefix || scope.startsWith(prefix))
  )
}

/**
 * Profile categories whose required prefixes never appear in the request list.
 * A non-empty result means `permissions.complete` is unreachable: the settings
 * card would keep asking users to grant permissions we never actually request.
 */
function findUnrequestedPermissionCategories() {
  return FEISHU_PERMISSION_PROFILE
    .filter((category) => scopesForCategory(category).length === 0)
    .map((category) => category.id)
}

/**
 * Describe, in user-facing terms, exactly what the next authorization round will
 * ask for. Feeds the settings confirmation dialog so authorizing is never a blind
 * click-through. Feishu accumulates granted scopes, so the request always carries
 * the full list; only the still-missing capabilities are highlighted.
 */
function planFeishuScopeRequest(input, extraScopes = []) {
  const permissions = resolvePermissionSnapshot(input)
  const granted = new Map((permissions.categories || []).map((item) => [item.id, item]))
  const categories = FEISHU_PERMISSION_PROFILE.map((category) => ({
    id: category.id,
    label: category.label,
    state: permissions.known ? (granted.get(category.id)?.state || 'missing') : 'unknown',
    scopes: scopesForCategory(category),
  }))
  const extra = (Array.isArray(extraScopes) ? extraScopes : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  const missingCategories = categories.filter((item) => item.state === 'missing')
  return {
    known: permissions.known,
    mode: permissions.known && missingCategories.length && permissions.complete === false
      ? 'topup'
      : 'full',
    categories,
    missingCategories,
    scopes: Array.from(new Set([...FEISHU_AUTH_SCOPE_LIST, ...extra])),
  }
}

/** Capability ids still missing — the baseline a top-up round must shrink. */
function missingPermissionCategoryIds(input) {
  const permissions = resolvePermissionSnapshot(input)
  if (!permissions.known) return []
  return (permissions.categories || [])
    .filter((item) => item.state === 'missing')
    .map((item) => item.id)
}

module.exports = {
  FEISHU_AUTH_DOMAIN_LIST,
  FEISHU_AUTH_DOMAINS,
  FEISHU_AUTH_SCOPE_LIST,
  FEISHU_AUTH_SCOPES,
  FEISHU_PERMISSION_PROFILE,
  FEISHU_CAPABILITY_PROFILE,
  INVALID_SCOPE_RE,
  SCOPE_TOKEN_RE,
  scopeSignature,
  summarizeFeishuPermissions,
  resolvePermissionSnapshot,
  summarizeFeishuCapabilityReadiness,
  scopesForCategory,
  findUnrequestedPermissionCategories,
  planFeishuScopeRequest,
  missingPermissionCategoryIds,
}
