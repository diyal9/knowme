'use strict'

/**
 * agent-tools — 受限工具定义、参数校验、结果格式化与 allowlist 分发。
 *
 * 内置 search_knowledge；可通过 createToolSurface({ extraDefinitions, handlers })
 * 投影 Connector / MCP 工具。
 */

const MAX_TOOL_RESULT_CHARS = 24000
const MAX_UI_PREVIEW_CHARS = 1200
const TRUNCATION_SUFFIX = '\n\n[结果已截断]'

const SEARCH_KNOWLEDGE_TOOL = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: 'Search the active knowledge base for relevant passages. Use when you need factual context from the user knowledge library.',
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
}

const ALLOWED_TOOL_NAMES = new Set(['search_knowledge'])

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
    const snippet = String(hit.snippet || hit.text || hit.content || '')
      .replace(/\s+/g, ' ')
      .trim()
    const head = path ? `${i + 1}. ${title} (${path})` : `${i + 1}. ${title}`
    lines.push(head)
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
  if (name === 'search_knowledge' && args?.query) {
    const q = String(args.query).replace(/\s+/g, ' ').trim()
    return q.length > 80 ? `${q.slice(0, 77)}…` : q
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

function normalizeExtraDefinitions(extraDefinitions = []) {
  const list = Array.isArray(extraDefinitions) ? extraDefinitions : []
  const out = []
  const seen = new Set(['search_knowledge'])
  for (const def of list) {
    const name = String(def?.function?.name || def?.name || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({
      type: 'function',
      function: {
        name,
        description: String(def.function?.description || name).slice(0, 500),
        parameters: def.function?.parameters || { type: 'object', properties: {} },
      },
      _knowme: def._knowme || {},
    })
    if (out.length >= 32) break
  }
  return out
}

/**
 * @param {{
 *   extraDefinitions?: object[],
 *   handlers?: Record<string, (args: object) => Promise<object>>,
 * }} [options]
 */
function createToolSurface(options = {}) {
  const extras = normalizeExtraDefinitions(options.extraDefinitions)
  const handlers = options.handlers && typeof options.handlers === 'object' ? options.handlers : {}
  const allowed = new Set(['search_knowledge', ...extras.map((d) => d.function.name)])

  function getToolDefinitions() {
    return [SEARCH_KNOWLEDGE_TOOL, ...extras.map(({ type, function: fn }) => ({ type, function: fn }))]
  }

  function isAllowedTool(name) {
    return allowed.has(String(name || '').trim())
  }

  function validateToolCall(name, rawArgs) {
    const toolName = String(name || '').trim()
    if (!toolName) {
      return { ok: false, code: 'invalid_args', message: '缺少工具名称' }
    }
    if (!isAllowedTool(toolName)) {
      return { ok: false, code: 'unknown_tool', message: `未注册工具: ${toolName}` }
    }
    const parsed = parseToolArguments(rawArgs)
    if (!parsed.ok) return parsed

    if (toolName === 'search_knowledge') {
      const query = String(parsed.args.query || '').trim()
      if (!query) {
        return { ok: false, code: 'invalid_args', message: 'search_knowledge 需要非空 query' }
      }
      return { ok: true, name: toolName, args: { query } }
    }

    if (toolName === 'fetch_web_page') {
      const url = String(parsed.args.url || parsed.args.link || '').trim()
      if (!url) {
        return { ok: false, code: 'invalid_args', message: 'fetch_web_page 需要非空 url' }
      }
      return { ok: true, name: toolName, args: { url } }
    }

    if (toolName === 'feishu.search_docs') {
      const query = String(parsed.args.query || '').trim()
      if (!query) {
        return { ok: false, code: 'invalid_args', message: 'feishu.search_docs 需要非空 query' }
      }
      return { ok: true, name: toolName, args: { ...parsed.args, query } }
    }

    if (toolName === 'feishu.draft_minute_permission') {
      const minuteToken = String(parsed.args.minute_token || '').trim()
      const url = String(parsed.args.url || '').trim()
      if (!minuteToken && !url) {
        return { ok: false, code: 'invalid_args', message: 'feishu.draft_minute_permission 需要 minute_token 或妙记链接' }
      }
      const perm = String(parsed.args.perm || 'view').trim().toLowerCase()
      return {
        ok: true,
        name: toolName,
        args: {
          minute_token: minuteToken,
          url,
          perm: perm === 'edit' ? 'edit' : 'view',
        },
      }
    }

    if (toolName === 'feishu.draft_write_doc') {
      const body = String(parsed.args.body || parsed.args.content || '').trim()
      if (!body) {
        return { ok: false, code: 'invalid_args', message: 'feishu.draft_write_doc 需要 body' }
      }
      return {
        ok: true,
        name: toolName,
        args: {
          title: String(parsed.args.title || '未命名文档').trim(),
          body,
        },
      }
    }

    return { ok: true, name: toolName, args: parsed.args }
  }

  function createToolExecutor(deps = {}) {
    const searchKnowledge = typeof deps.searchKnowledge === 'function' ? deps.searchKnowledge : null
    const signal = deps.signal

    async function executeToolCall(toolCall = {}) {
      if (signal?.aborted) {
        return formatToolError('cancelled', '工具执行已取消')
      }
      const name = toolCall.name || toolCall.function?.name
      const rawArgs = toolCall.arguments ?? toolCall.function?.arguments
      const validation = validateToolCall(name, rawArgs)
      if (!validation.ok) {
        return {
          ...formatToolError(validation.code, validation.message),
          toolName: String(name || ''),
          argsSummary: '',
        }
      }

      const argsSummary = summarizeToolArgs(validation.name, validation.args)
      if (validation.name === 'search_knowledge') {
        if (!searchKnowledge) {
          return {
            ...formatToolError('tool_unavailable', '知识检索执行器未配置'),
            toolName: validation.name,
            argsSummary,
          }
        }
        try {
          const providerResult = await searchKnowledge(validation.args.query, signal)
          const formatted = formatProviderResult(providerResult)
          return { ...formatted, toolName: validation.name, argsSummary }
        } catch (err) {
          const msg = String(err?.message || '知识检索失败').slice(0, 500)
          return { ...formatToolError('tool_failed', msg), toolName: validation.name, argsSummary }
        }
      }

      const handler = handlers[validation.name]
      if (typeof handler === 'function') {
        try {
          const result = await handler(validation.args, signal)
          if (result && typeof result === 'object') {
            const text = String(result.text || result.message || '')
            const truncated = truncateText(text, MAX_TOOL_RESULT_CHARS)
            const preview = truncateText(truncated.text, MAX_UI_PREVIEW_CHARS, '…').text
            const candidates = Array.isArray(result.meta?.candidates) ? result.meta.candidates : []
            const sources = candidates.slice(0, 8).map((candidate, index) => ({
              title: String(candidate?.title || candidate?.name || `结果 ${index + 1}`).trim().slice(0, 120),
              path: String(candidate?.url || candidate?.path || candidate?.token || '').trim().slice(0, 260),
              snippet: String(candidate?.updatedAt || candidate?.time || candidate?.summary || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 280),
            }))
            return {
              ok: result.ok !== false,
              text: truncated.text,
              preview,
              truncated: truncated.truncated,
              toolName: validation.name,
              argsSummary,
              draft: result.draft || null,
              requiresApproval: Boolean(result.requiresApproval),
              code: result.code,
              meta: result.meta && typeof result.meta === 'object' ? result.meta : null,
              sources,
            }
          }
          const text = String(result || '')
          const truncated = truncateText(text, MAX_TOOL_RESULT_CHARS)
          return {
            ok: true,
            text: truncated.text,
            preview: truncated.text.slice(0, MAX_UI_PREVIEW_CHARS),
            toolName: validation.name,
            argsSummary,
          }
        } catch (err) {
          return {
            ...formatToolError('tool_failed', String(err?.message || err).slice(0, 500)),
            toolName: validation.name,
            argsSummary,
          }
        }
      }

      return {
        ...formatToolError('unknown_tool', `未注册工具: ${validation.name}`),
        toolName: validation.name,
        argsSummary,
      }
    }

    return { executeToolCall, validateToolCall, isAllowedTool }
  }

  return {
    getToolDefinitions,
    isAllowedTool,
    validateToolCall,
    createToolExecutor,
    extras,
  }
}

const defaultSurface = createToolSurface()

function getToolDefinitions() {
  return defaultSurface.getToolDefinitions()
}

function isAllowedTool(name) {
  return defaultSurface.isAllowedTool(name)
}

function validateToolCall(name, rawArgs) {
  return defaultSurface.validateToolCall(name, rawArgs)
}

function createToolExecutor(deps = {}) {
  return defaultSurface.createToolExecutor(deps)
}

async function dispatchToolCall(toolCall, deps = {}) {
  const { executeToolCall } = createToolExecutor(deps)
  return executeToolCall(toolCall)
}

module.exports = {
  SEARCH_KNOWLEDGE_TOOL,
  ALLOWED_TOOL_NAMES,
  MAX_TOOL_RESULT_CHARS,
  MAX_UI_PREVIEW_CHARS,
  TRUNCATION_SUFFIX,
  getToolDefinitions,
  isAllowedTool,
  validateToolCall,
  parseToolArguments,
  truncateText,
  formatSearchHits,
  formatProviderResult,
  formatToolError,
  summarizeToolArgs,
  createToolExecutor,
  dispatchToolCall,
  createToolSurface,
  normalizeExtraDefinitions,
}
