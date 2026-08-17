'use strict'

/**
 * agent-tools — 受限工具定义、参数校验、结果格式化与 allowlist 分发。
 *
 * 内置 search_knowledge；可通过 createToolSurface({ extraDefinitions, handlers })
 * 投影 Connector / MCP 工具。
 */

let logger = null
try { logger = require('./logger') } catch { /* logger optional */ }

const MAX_TOOL_RESULT_CHARS = 24000
const MAX_UI_PREVIEW_CHARS = 1200
const TRUNCATION_SUFFIX = '\n\n[结果已截断]'

// 投影预算需容纳完整 v1 内建工具面 + 已启用连接器工具；超限时按优先级裁剪并告警。
const EXTRA_TOOL_BUDGET = 64

// 预算不足时最先让位的工具：多 Agent 编排与子 Run 管理，单轮对话极少用到。
const DEFERRABLE_TOOLS = new Set([
  'delegate_to_expert',
  'spawn_sub_run',
  'await_sub_run',
  'get_sub_run_status',
  'cancel_sub_run',
  'send_run_message',
  'handoff_artifact',
])

const CONNECTOR_SOURCES = new Set(['feishu', 'mcp', 'connector', 'skill'])

const FABRIC_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'fabric_search',
    description: 'Root-first Knowledge Fabric search: queries the root graph, routes to mounted libraries, merges results with authority weighting.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Non-empty search query.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin',
    capability: 'knowledge-search',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'content-source',
    timeoutMs: 30000,
    research: { kind: 'knowledge-search', scope: 'knowledge', label: '知识织网检索' },
  },
}

const KB_QUERY_TOOL = {
  type: 'function',
  function: {
    name: 'kb_query',
    description: 'Query a specific knowledge library collection by id.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'KB id or qmd collection id.' },
        query: { type: 'string', description: 'Search query.' },
      },
      required: ['collection', 'query'],
      additionalProperties: false,
    },
  },
  _knowme: { source: 'builtin', capability: 'knowledge-search', risk: 'read', sideEffects: false },
}

const KB_GET_TOOL = {
  type: 'function',
  function: {
    name: 'kb_get',
    description: 'Fetch full text for a knowledge anchor/ref.',
    parameters: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Anchor id, path, or external ref.' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  _knowme: { source: 'builtin', capability: 'knowledge-search', risk: 'read', sideEffects: false },
}

const SEARCH_KNOWLEDGE_TOOL = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: 'Search the active knowledge base (Fabric-aware root-first retrieval). Prefer when you need factual context from the user knowledge library.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Non-empty search query describing what to look up.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin',
    capability: 'knowledge-search',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'content-source',
    timeoutMs: 30000,
    idempotencySupported: false,
    rollbackSupported: false,
    research: {
      kind: 'knowledge-search',
      scope: 'knowledge',
      label: '当前知识库检索',
    },
  },
}

const ALLOWED_TOOL_NAMES = new Set(['search_knowledge', 'fabric_search', 'kb_query', 'kb_get'])

function parseToolArguments(raw) {
  if (raw == null || raw === '') return { ok: true, args: {} }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ok: true, args: raw }
  const text = String(raw)
  try {
    const parsed = JSON.parse(text)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, code: 'invalid_args', message: '工具参数必须是 JSON 对象' }
    }
    return { ok: true, args: parsed }
  } catch {
    return { ok: false, code: 'invalid_args', message: '工具参数不是合法 JSON' }
  }
}

function truncateText(text, maxChars, suffix = TRUNCATION_SUFFIX) {
  const src = String(text || '')
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : MAX_TOOL_RESULT_CHARS
  if (src.length <= limit) {
    return { text: src, truncated: false }
  }
  const keep = Math.max(0, limit - suffix.length)
  return { text: src.slice(0, keep) + suffix, truncated: true }
}

function formatSearchHits(hits = []) {
  const list = Array.isArray(hits) ? hits : []
  if (list.length === 0) return '未找到相关知识条目。'
  const lines = [`共 ${list.length} 条命中：`]
  list.forEach((hit, i) => {
    const title = String(hit.title || hit.name || `结果 ${i + 1}`).trim()
    const path = String(hit.path || hit.url || hit.source || '').trim()
    const kb = hit.provenance?.kbId || hit.kbId || ''
    const auth = hit.provenance?.authority ?? hit.authority
    const snippet = String(hit.snippet || hit.text || hit.content || '')
      .replace(/\s+/g, ' ')
      .trim()
    const tags = [kb ? `库:${kb}` : '', Number.isFinite(auth) ? `authority:${auth}` : ''].filter(Boolean).join(' · ')
    const head = path ? `${i + 1}. ${title} (${path})` : `${i + 1}. ${title}`
    lines.push(tags ? `${head} [${tags}]` : head)
    if (hit.conflict?.message) lines.push(`   ⚠ ${hit.conflict.message}`)
    if (snippet) lines.push(`   ${snippet}`)
  })
  return lines.join('\n')
}

function formatProviderResult(providerResult = {}) {
  if (providerResult.ok === false) {
    const msg = String(providerResult.message || '知识检索失败').trim()
    return { ok: false, text: msg, preview: msg.slice(0, MAX_UI_PREVIEW_CHARS), sources: [] }
  }
  const hits = Array.isArray(providerResult.hits) ? providerResult.hits : []
  const sources = hits.slice(0, 8).map((hit, i) => ({
    title: String(hit?.title || hit?.name || `结果 ${i + 1}`).trim().slice(0, 120),
    path: String(hit?.path || hit?.url || hit?.source || '').trim().slice(0, 260),
    snippet: String(hit?.snippet || hit?.text || hit?.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280),
  }))
  const body = formatSearchHits(hits)
  const truncated = truncateText(body, MAX_TOOL_RESULT_CHARS)
  const preview = truncateText(truncated.text, MAX_UI_PREVIEW_CHARS, '…').text
  return {
    ok: true,
    text: truncated.text,
    preview,
    truncated: truncated.truncated,
    hitCount: hits.length,
    sources,
  }
}

function formatToolError(code, message) {
  const safe = String(message || code || '工具执行失败').slice(0, 500)
  return { ok: false, code: String(code || 'tool_error'), text: safe, preview: safe.slice(0, MAX_UI_PREVIEW_CHARS) }
}

function summarizeToolArgs(name, args) {
  if ((name === 'search_knowledge' || name === 'fabric_search') && args?.query) {
    const q = String(args.query).replace(/\s+/g, ' ').trim()
    return q.length > 80 ? `${q.slice(0, 77)}…` : q
  }
  if (name === 'kb_query' && args?.query) {
    const c = String(args.collection || '').slice(0, 24)
    const q = String(args.query).replace(/\s+/g, ' ').trim().slice(0, 40)
    return `${c} · ${q}`
  }
  if (name === 'kb_get' && args?.ref) {
    return String(args.ref).slice(0, 80)
  }
  if (name === 'search_web' && args?.query) {
    const q = String(args.query).replace(/\s+/g, ' ').trim()
    const mode = args.mode === 'news' ? '新闻' : '网页'
    const recency = Number(args.recency_days)
    const suffix = Number.isFinite(recency) ? ` · 近 ${recency} 天` : ''
    const label = `${mode} · ${q}${suffix}`
    return label.length > 100 ? `${label.slice(0, 97)}…` : label
  }
  if (name === 'fetch_web_page' && args?.url) {
    const raw = String(args.url).trim()
    try {
      const parsed = new URL(raw)
      const label = `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
      return label.length > 80 ? `${label.slice(0, 77)}…` : label
    } catch {
      return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw
    }
  }
  if (name === 'feishu.search_docs' && args?.query) {
    const q = String(args.query).replace(/\s+/g, ' ').trim()
    return q.length > 80 ? `${q.slice(0, 77)}…` : q
  }
  if (name === 'feishu.draft_write_doc' && args?.title) {
    return String(args.title).slice(0, 80)
  }
  if (name === 'feishu.draft_minute_permission') {
    const locator = String(args?.minute_token || args?.url || '').slice(0, 80)
    const perm = args?.perm === 'edit' ? '可编辑' : '可阅读'
    return locator ? `申请妙记${perm}权限 · ${locator}` : `申请妙记${perm}权限`
  }
  if (name === 'feishu.meeting_candidates') {
    const days = Math.max(1, Math.min(30, Math.floor(Number(args?.days || 3) || 3)))
    return `最近 ${days} 天 · 查找本人参与的会议纪要`
  }
  if (name === 'feishu.meeting_read') {
    const locator = args?.minute_token || args?.token || args?.url || args?.doc_token || args?.document_id
    return locator ? `读取指定会议纪要 · ${String(locator).slice(0, 80)}` : '读取指定会议纪要'
  }
  if (name === 'feishu.related_chats') {
    const days = Math.max(1, Math.min(30, Math.floor(Number(args?.days || 3) || 3)))
    return `最近 ${days} 天 · 分析 @我 的聊天`
  }
  if (name === 'feishu.today_priority') {
    return '今天 · 日程+待办优先级事实'
  }
  if (name === 'feishu.doc_kb_suggest') {
    const days = Math.max(1, Math.min(90, Math.floor(Number(args?.days || 30) || 30)))
    return `近 ${days} 天 · 整理文档/知识库候选`
  }
  if (name === 'update_plan') {
    if (Array.isArray(args?.replace)) return `替换计划 · ${args.replace.length} 项`
    if (Array.isArray(args?.upsert) && args.upsert.length) return `更新计划 · ${args.upsert.length} 项`
    if (args?.set_status?.id) return `标记 ${String(args.set_status.status || '')} · ${String(args.set_status.id).slice(0, 40)}`
    return '更新执行计划'
  }
  if (args && typeof args === 'object') {
    const keys = Object.keys(args).slice(0, 3).join(',')
    return keys ? `{${keys}}` : ''
  }
  return ''
}

/**
 * 投影优先级：越小越先入选。必需工具 > 连接器/技能工具 > 普通内建 > 可延后的编排工具。
 */
function extraToolPriority(name, contract, requiredTools) {
  if (requiredTools.has(name)) return 0
  if (DEFERRABLE_TOOLS.has(name)) return 3
  const source = String(contract?.source || '').trim().toLowerCase()
  if (CONNECTOR_SOURCES.has(source) || name.includes('.')) return 1
  return 2
}

/**
 * @param {object[]} [extraDefinitions]
 * @param {{ requiredTools?: string[], budget?: number }} [options]
 */
function normalizeExtraDefinitions(extraDefinitions = [], options = {}) {
  const list = Array.isArray(extraDefinitions) ? extraDefinitions : []
  const required = new Set(
    (Array.isArray(options.requiredTools) ? options.requiredTools : [])
      .map(item => String(item || '').trim())
      .filter(Boolean),
  )
  const budget = Number.isFinite(Number(options.budget)) && Number(options.budget) > 0
    ? Math.floor(Number(options.budget))
    : EXTRA_TOOL_BUDGET
  const candidates = []
  const seen = new Set(['search_knowledge', 'fabric_search', 'kb_query', 'kb_get'])
  for (const def of list) {
    const name = String(def?.function?.name || def?.name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const contract = def._knowme || {}
    candidates.push({
      priority: extraToolPriority(name, contract, required),
      order: candidates.length,
      def: {
        type: 'function',
        function: {
          name,
          description: String(def.function?.description || name).slice(0, 500),
          parameters: def.function?.parameters || { type: 'object', properties: {} },
        },
        _knowme: contract,
      },
    })
  }
  if (candidates.length <= budget) return candidates.map(item => item.def)

  candidates.sort((a, b) => a.priority - b.priority || a.order - b.order)
  const kept = candidates.slice(0, budget)
  const dropped = candidates.slice(budget)
  const keptNames = new Set(kept.map(item => item.def.function.name))
  const droppedNames = dropped.map(item => item.def.function.name)
  logger?.warn?.('system', 'tool-surface-truncated', '工具面超出投影预算，已裁剪低优先级工具', {
    budget,
    total: candidates.length,
    dropped: droppedNames.slice(0, 32),
    missingRequired: [...required].filter(name => !keptNames.has(name)),
  })
  // 保持原始注册顺序输出，避免下游依赖排序语义。
  return candidates
    .filter(item => keptNames.has(item.def.function.name))
    .sort((a, b) => a.order - b.order)
    .map(item => item.def)
}

/**
 * @param {{
 *   extraDefinitions?: object[],
 *   handlers?: Record<string, (args: object) => Promise<object>>,
 *   requiredTools?: string[],
 *   toolBudget?: number,
 * }} [options]
 */

module.exports = {
  MAX_UI_PREVIEW_CHARS,
  parseToolArguments,
  truncateText,
  formatSearchHits,
  formatProviderResult,
  formatToolError,
  summarizeToolArgs,
  extraToolPriority,
  normalizeExtraDefinitions,
}
