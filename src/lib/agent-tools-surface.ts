'use strict'

try { logger = require('./logger') } catch { /* logger optional */ }
const {
  MAX_UI_PREVIEW_CHARS,
  parseToolArguments,
  truncateText,
  formatSearchHits,
  formatProviderResult,
  formatToolError,
  summarizeToolArgs,
  extraToolPriority,
  normalizeExtraDefinitions,
} = require('./agent-tools-format')

let builtinSurfaceTools = null

function createToolSurface(options = {}) {
  const includeBuiltins = options.includeBuiltins !== false
  if (options.SEARCH_KNOWLEDGE_TOOL) {
    builtinSurfaceTools = {
      SEARCH_KNOWLEDGE_TOOL: options.SEARCH_KNOWLEDGE_TOOL,
      FABRIC_SEARCH_TOOL: options.FABRIC_SEARCH_TOOL,
      KB_QUERY_TOOL: options.KB_QUERY_TOOL,
      KB_GET_TOOL: options.KB_GET_TOOL,
      MAX_TOOL_RESULT_CHARS: options.MAX_TOOL_RESULT_CHARS,
    }
  }
  const SEARCH_KNOWLEDGE_TOOL = options.SEARCH_KNOWLEDGE_TOOL || builtinSurfaceTools?.SEARCH_KNOWLEDGE_TOOL
  const FABRIC_SEARCH_TOOL = options.FABRIC_SEARCH_TOOL || builtinSurfaceTools?.FABRIC_SEARCH_TOOL
  const KB_QUERY_TOOL = options.KB_QUERY_TOOL || builtinSurfaceTools?.KB_QUERY_TOOL
  const KB_GET_TOOL = options.KB_GET_TOOL || builtinSurfaceTools?.KB_GET_TOOL
  const MAX_TOOL_RESULT_CHARS = options.MAX_TOOL_RESULT_CHARS || builtinSurfaceTools?.MAX_TOOL_RESULT_CHARS
  if (options.registry && typeof options.registry.projectToSurface === 'function') {
    const projected = options.registry.projectToSurface(parseToolArguments)
    return createToolSurface({
      extraDefinitions: projected.definitions,
      handlers: projected.handlers,
      requiredTools: options.requiredTools,
      toolBudget: options.toolBudget,
      includeBuiltins,
      SEARCH_KNOWLEDGE_TOOL,
      FABRIC_SEARCH_TOOL,
      KB_QUERY_TOOL,
      KB_GET_TOOL,
      MAX_TOOL_RESULT_CHARS,
    })
  }
  const extras = normalizeExtraDefinitions(options.extraDefinitions, {
    requiredTools: options.requiredTools,
    budget: options.toolBudget,
  })
  const handlers = options.handlers && typeof options.handlers === 'object' ? options.handlers : {}
  const builtinNames = includeBuiltins
    ? ['search_knowledge', 'fabric_search', 'kb_query', 'kb_get']
    : []
  const allowed = new Set([...builtinNames, ...extras.map((d) => d.function.name)])

  function getToolDefinitions() {
    return [
      ...(includeBuiltins ? [
        { type: SEARCH_KNOWLEDGE_TOOL.type, function: SEARCH_KNOWLEDGE_TOOL.function },
        { type: FABRIC_SEARCH_TOOL.type, function: FABRIC_SEARCH_TOOL.function },
        { type: KB_QUERY_TOOL.type, function: KB_QUERY_TOOL.function },
        { type: KB_GET_TOOL.type, function: KB_GET_TOOL.function },
      ] : []),
      ...extras.map(({ type, function: fn }) => ({ type, function: fn })),
    ]
  }

  function getToolRecords() {
    return [
      ...(includeBuiltins ? [
        SEARCH_KNOWLEDGE_TOOL,
        FABRIC_SEARCH_TOOL,
        KB_QUERY_TOOL,
        KB_GET_TOOL,
      ] : []),
      ...extras.map(def => ({
        type: def.type,
        function: { ...def.function },
        _knowme: { ...(def._knowme || {}) },
      })),
    ]
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

    if (toolName === 'search_knowledge' || toolName === 'fabric_search') {
      const query = String(parsed.args.query || '').trim()
      if (!query) {
        return { ok: false, code: 'invalid_args', message: `${toolName} 需要非空 query` }
      }
      return { ok: true, name: toolName, args: { query } }
    }

    if (toolName === 'kb_query') {
      const query = String(parsed.args.query || '').trim()
      const collection = String(parsed.args.collection || '').trim()
      if (!query || !collection) {
        return { ok: false, code: 'invalid_args', message: 'kb_query 需要 collection 与 query' }
      }
      return { ok: true, name: toolName, args: { collection, query } }
    }

    if (toolName === 'kb_get') {
      const ref = String(parsed.args.ref || '').trim()
      if (!ref) return { ok: false, code: 'invalid_args', message: 'kb_get 需要 ref' }
      return { ok: true, name: toolName, args: { ref } }
    }

    if (toolName === 'search_web') {
      const query = String(parsed.args.query || '').replace(/\s+/g, ' ').trim()
      if (!query) {
        return { ok: false, code: 'invalid_args', message: 'search_web 需要非空 query' }
      }
      const mode = parsed.args.mode === 'news' ? 'news' : 'web'
      const recencyRaw = Number(parsed.args.recency_days)
      const limitRaw = Number(parsed.args.limit)
      return {
        ok: true,
        name: toolName,
        args: {
          query: query.slice(0, 300),
          mode,
          ...(Number.isFinite(recencyRaw)
            ? { recency_days: Math.max(1, Math.min(365, Math.floor(recencyRaw))) }
            : {}),
          ...(Number.isFinite(limitRaw)
            ? { limit: Math.max(1, Math.min(10, Math.floor(limitRaw))) }
            : {}),
        },
      }
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
    const fabricSearch = typeof deps.fabricSearch === 'function' ? deps.fabricSearch : searchKnowledge
    const kbQuery = typeof deps.kbQuery === 'function' ? deps.kbQuery : null
    const kbGet = typeof deps.kbGet === 'function' ? deps.kbGet : null
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
      if (validation.name === 'search_knowledge' || validation.name === 'fabric_search') {
        const runner = fabricSearch || searchKnowledge
        if (!runner) {
          return {
            ...formatToolError('tool_unavailable', '知识检索执行器未配置'),
            toolName: validation.name,
            argsSummary,
          }
        }
        try {
          const providerResult = await runner(validation.args.query, signal)
          const formatted = formatProviderResult(providerResult)
          return { ...formatted, toolName: validation.name, argsSummary }
        } catch (err) {
          const msg = String(err?.message || '知识检索失败').slice(0, 500)
          return { ...formatToolError('tool_failed', msg), toolName: validation.name, argsSummary }
        }
      }

      if (validation.name === 'kb_query') {
        if (!kbQuery) {
          return { ...formatToolError('tool_unavailable', 'kb_query 未配置'), toolName: validation.name, argsSummary }
        }
        try {
          const providerResult = await kbQuery(validation.args.collection, validation.args.query, signal)
          const formatted = formatProviderResult(providerResult)
          return { ...formatted, toolName: validation.name, argsSummary }
        } catch (err) {
          return { ...formatToolError('tool_failed', String(err?.message || err).slice(0, 500)), toolName: validation.name, argsSummary }
        }
      }

      if (validation.name === 'kb_get') {
        if (!kbGet) {
          return { ...formatToolError('tool_unavailable', 'kb_get 未配置'), toolName: validation.name, argsSummary }
        }
        try {
          const doc = await kbGet(validation.args.ref, signal)
          const text = doc?.content || doc?.text || doc?.snippet || JSON.stringify(doc)
          const truncated = truncateText(String(text || ''), MAX_TOOL_RESULT_CHARS)
          return {
            ok: doc?.ok !== false,
            text: truncated.text,
            preview: truncated.text.slice(0, MAX_UI_PREVIEW_CHARS),
            toolName: validation.name,
            argsSummary,
          }
        } catch (err) {
          return { ...formatToolError('tool_failed', String(err?.message || err).slice(0, 500)), toolName: validation.name, argsSummary }
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
            const resultSources = Array.isArray(result.sources) ? result.sources : []
            const sourceInput = resultSources.length ? resultSources : candidates
            const sources = sourceInput.slice(0, 8).map((candidate, index) => ({
              title: String(candidate?.title || candidate?.name || `结果 ${index + 1}`).trim().slice(0, 120),
              path: String(candidate?.path || candidate?.url || candidate?.token || '').trim().slice(0, 260),
              snippet: String(candidate?.snippet || candidate?.updatedAt || candidate?.time || candidate?.summary || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 280),
              ...(candidate?.publishedAt ? { publishedAt: String(candidate.publishedAt).slice(0, 80) } : {}),
              ...(candidate?.retrievedAt ? { retrievedAt: String(candidate.retrievedAt).slice(0, 80) } : {}),
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
    getToolRecords,
    isAllowedTool,
    validateToolCall,
    createToolExecutor,
    extras,
  }
}

const defaultSurface = createToolSurface()

module.exports = {
  createToolSurface,
}
