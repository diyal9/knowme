'use strict'

const BUILTIN_IDS = new Set(['feishu', 'mcp-default', 'photoshop-mcp', 'cocos-creator-mcp'])
const MCP_TRANSPORTS = new Set(['stdio', 'streamable-http', 'sse'])

function clampStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max)
}

function clampArgs(args) {
  if (!Array.isArray(args)) return []
  return args.map((a) => clampStr(a, 400)).filter(Boolean).slice(0, 32)
}

function clampAllowlist(list) {
  if (!Array.isArray(list)) return []
  const out = []
  const seen = new Set()
  for (const item of list) {
    const name = clampStr(item, 120)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= 64) break
  }
  return out
}

function clampRecord(raw, maxEntries = 32, maxValue = 600) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw).slice(0, maxEntries)) {
    const cleanKey = clampStr(key, 100)
    if (!cleanKey || value == null || typeof value === 'object') continue
    out[cleanKey] = clampStr(value, maxValue)
  }
  return out
}

function normalizeSecretSlots(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const item of raw.slice(0, 32)) {
    const key = clampStr(item?.key || item?.id || item, 100)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const target = ['env', 'header', 'bearer'].includes(item?.target) ? item.target : 'env'
    out.push({
      key,
      label: clampStr(item?.label || key, 120),
      required: item?.required !== false,
      target,
      name: clampStr(item?.name || (target === 'header' ? key : key), 120),
      prefix: clampStr(item?.prefix || (target === 'bearer' ? 'Bearer ' : ''), 40),
    })
  }
  return out
}

function normalizeToolPolicies(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 96).map((item) => ({
    match: clampStr(item?.match || item?.name || '*', 160) || '*',
    risk: ['read', 'write', 'destructive', 'network', 'external'].includes(item?.risk) ? item.risk : 'network',
    sideEffects: item?.sideEffects !== false,
    requiresApproval: item?.requiresApproval === true,
    timeoutMs: Math.max(1000, Math.min(300000, Number(item?.timeoutMs) || 30000)),
    description: clampStr(item?.description, 300),
  }))
}

function projectFeishuToolNames(list) {
  const base = clampAllowlist(list)
  const allow = new Set(base)
  const projected = new Set(base)
  const canRunMeetingWorkflow = allow.has('feishu.search_docs') && allow.has('feishu.read_doc')
  const canRunRelatedChats = canRunMeetingWorkflow || allow.has('feishu.list_chats')
  const canRunTodayPriority = canRunRelatedChats || allow.has('feishu.today_priority')
  const canRunDocKbSuggest = canRunMeetingWorkflow || allow.has('feishu.doc_kb_suggest')
  if (canRunMeetingWorkflow) {
    projected.add('feishu.meeting_candidates')
    projected.add('feishu.meeting_read')
  }
  if (canRunRelatedChats) projected.add('feishu.related_chats')
  if (canRunTodayPriority) projected.add('feishu.today_priority')
  if (canRunDocKbSuggest) projected.add('feishu.doc_kb_suggest')
  return [...projected]
}

function feishuToolNeedsUserIdentity(name) {
  return new Set([
    'feishu.search_docs',
    'feishu.read_doc',
    'feishu.query_bitable',
    'feishu.get_wiki_node',
    'feishu.list_wiki_nodes',
    'feishu.list_wiki_spaces',
    'feishu.list_chats',
    'feishu.search_chats',
    'feishu.meeting_candidates',
    'feishu.meeting_read',
    'feishu.related_chats',
    'feishu.today_priority',
    'feishu.doc_kb_suggest',
  ]).has(String(name || '').trim())
}

function defaultConnectors() {
  return [
    {
      id: 'feishu',
      type: 'feishu',
      title: '飞书',
      enabled: false,
      agentVisible: true,
      allowlist: [],
      meta: { identityHint: '使用本机 lark-cli 登录态，KnowMe 不保存飞书 Token' },
    },
    {
      id: 'mcp-default',
      type: 'mcp',
      title: '公司 MCP',
      enabled: false,
      agentVisible: true,
      allowlist: [],
      mcp: { transport: 'stdio', command: '', args: [], cwd: '', url: '', envKeys: [], env: {} },
      secretSlots: [],
      toolPolicies: [],
      meta: { identityHint: 'stdio MCP Server；仅保存命令与参数，不保存密钥值' },
    },
  ]
}

function normalizeMcp(raw = {}) {
  const envKeys = Array.isArray(raw.envKeys)
    ? raw.envKeys.map((k) => clampStr(k, 80)).filter(Boolean).slice(0, 32)
    : []
  return {
    transport: MCP_TRANSPORTS.has(String(raw.transport || '').toLowerCase())
      ? String(raw.transport).toLowerCase()
      : (raw.url ? 'streamable-http' : 'stdio'),
    command: clampStr(raw.command, 260),
    args: clampArgs(raw.args),
    cwd: clampStr(raw.cwd, 500),
    url: clampStr(raw.url || raw.baseUrl, 1000),
    envKeys,
    env: clampRecord(raw.env),
  }
}

function normalizeConnector(raw = {}, fallbackId = '') {
  const id = clampStr(raw.id || fallbackId, 80) || `conn_${Date.now()}`
  // The built-in Feishu connector must never be downgraded to MCP when an
  // enable/disable patch omits `type`, or when an older config was corrupted.
  const type = id === 'feishu'
    ? 'feishu'
    : raw.type === 'mcp' ? 'mcp' : raw.type === 'feishu' ? 'feishu' : 'mcp'
  const base = {
    id,
    type,
    title: id === 'feishu' ? '飞书' : (clampStr(raw.title, 80) || (type === 'feishu' ? '飞书' : 'MCP')),
    enabled: Boolean(raw.enabled),
    agentVisible: raw.agentVisible !== false,
    allowlist: clampAllowlist(raw.allowlist),
    secretSlots: normalizeSecretSlots(raw.secretSlots || raw.requiredSecrets),
    toolPolicies: normalizeToolPolicies(raw.toolPolicies),
    healthCheck: raw.healthCheck && typeof raw.healthCheck === 'object'
      ? {
          tool: clampStr(raw.healthCheck.tool, 120),
          timeoutMs: Math.max(1000, Math.min(120000, Number(raw.healthCheck.timeoutMs) || 15000)),
        }
      : null,
    capabilities: clampAllowlist(raw.capabilities),
    configState: ['ready', 'needs_configuration'].includes(raw.configState) ? raw.configState : 'ready',
    meta: {
      identityHint: clampStr(raw.meta?.identityHint, 300),
    },
  }
  if (type === 'mcp') {
    base.mcp = normalizeMcp(raw.mcp || {})
  }
  return base
}

function mergeWithDefaults(storedList) {
  const defaults = defaultConnectors()
  const byId = new Map()
  for (const d of defaults) byId.set(d.id, d)
  const list = Array.isArray(storedList) ? storedList : []
  for (const raw of list) {
    const n = normalizeConnector(raw)
    const prev = byId.get(n.id)
    byId.set(n.id, prev ? { ...prev, ...n, meta: { ...prev.meta, ...n.meta } } : n)
  }
  return Array.from(byId.values())
}

function publicConnectorView(conn, status = null, configuredKeys = []) {
  const configured = new Set(configuredKeys || [])
  const view = {
    id: conn.id,
    type: conn.type,
    title: conn.title,
    enabled: conn.enabled,
    agentVisible: conn.agentVisible,
    allowlist: [...(conn.allowlist || [])],
    secretSlots: (conn.secretSlots || []).map((slot) => ({ ...slot, configured: configured.has(slot.key) })),
    toolPolicies: (conn.toolPolicies || []).map((policy) => ({ ...policy })),
    healthCheck: conn.healthCheck ? { ...conn.healthCheck } : null,
    capabilities: [...(conn.capabilities || [])],
    configState: conn.configState || 'ready',
    meta: { ...(conn.meta || {}) },
  }
  if (conn.type === 'mcp' && conn.mcp) {
    view.mcp = {
      command: conn.mcp.command || '',
      transport: conn.mcp.transport || 'stdio',
      args: [...(conn.mcp.args || [])],
      cwd: conn.mcp.cwd || '',
      url: conn.mcp.url || '',
      envKeys: [...(conn.mcp.envKeys || [])],
      env: { ...(conn.mcp.env || {}) },
    }
  }
  if (status) view.status = status
  return view
}

function projectedToolNames(conn) {
  if (!conn || !conn.enabled || conn.agentVisible === false) return []
  if (conn.type === 'feishu' || conn.id === 'feishu') {
    return projectFeishuToolNames(conn.allowlist)
  }
  return clampAllowlist(conn.allowlist)
}

module.exports = {
  BUILTIN_IDS,
  defaultConnectors,
  normalizeConnector,
  normalizeMcp,
  mergeWithDefaults,
  publicConnectorView,
  projectedToolNames,
  projectFeishuToolNames,
  feishuToolNeedsUserIdentity,
  clampAllowlist,
  normalizeSecretSlots,
  normalizeToolPolicies,
  MCP_TRANSPORTS,
}
