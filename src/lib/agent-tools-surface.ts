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

const { normalizeRunGovernancePolicy, ORCHESTRATION_TOOL_NAMES, isRegistryToolHandler } = require('./tool-contract-registry')
const { isTrustedPreDispatchFailure } = require('./tool-dispatch-outcome')

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
    const projected = options.registry.projectToSurface(parseToolArguments, {
      ...(options.deps || {}), governancePolicy: options.governancePolicy,
    })
    return createToolSurface({
      ...options,
      registry: null,
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
  const governancePolicy = normalizeRunGovernancePolicy(options.governancePolicy || {})
  const builtins = includeBuiltins
    ? [SEARCH_KNOWLEDGE_TOOL, FABRIC_SEARCH_TOOL, KB_QUERY_TOOL, KB_GET_TOOL].filter(Boolean)
    : []
  // Legacy builtins can have partial contracts. Keep their real metadata intact;
  // contract registration/schema enforcement still belongs to the v1 registry.
  // These permission gates apply to EVERY candidate, regardless of its source.
  const authorized = (definition) => {
    const name = String(definition?.function?.name || definition?.name || '').trim()
    const contract = definition?._knowme || {}
    const connectorId = String(contract.connectorId || contract.mcpConnectorId || '').trim()
    return Boolean(name)
      && !governancePolicy.denylist.includes(name)
      && (governancePolicy.allowlist === null || governancePolicy.allowlist.includes(name))
      && (governancePolicy.expertToolNames === null || governancePolicy.expertToolNames.includes(name))
      && (!connectorId || governancePolicy.allowedConnectorIds === null || governancePolicy.allowedConnectorIds.includes(connectorId))
      && (!ORCHESTRATION_TOOL_NAMES.has(name) || governancePolicy.orchestration.allowDelegate)
  }
  const extraCandidates = Array.isArray(options.extraDefinitions) ? options.extraDefinitions : []
  const candidates = new Map([...extraCandidates, ...builtins].map(def => [def?.function?.name || def?.name, def]))
  // Filter before budgeting: denied candidates must not displace authorized tools.
  const extras = normalizeExtraDefinitions(extraCandidates.filter(authorized), {
    requiredTools: options.requiredTools,
    budget: options.toolBudget,
  })
  const handlers = options.handlers && typeof options.handlers === 'object' ? options.handlers : {}
  const records = [...builtins.filter(authorized), ...extras]
  const allowed = new Set(records.map(def => def.function.name))

  function getToolDefinitions() {
    return records.map(({ type, function: fn }) => ({ type, function: fn }))
  }

  function getToolRecords() {
    return records.map(def => ({
      type: def.type,
      function: { ...def.function },
      _knowme: { ...(def._knowme || {}) },
    }))
  }

  function isAllowedTool(name) {
    const toolName = String(name || '').trim()
    return allowed.has(toolName) && authorized(candidates.get(toolName))
  }

  function validateToolCall(name, rawArgs) {
    const toolName = String(name || '').trim()
    if (!toolName) {
      return { ok: false, code: 'invalid_args', message: '缺少工具名称' }
    }
    if (!isAllowedTool(toolName)) {
      if (candidates.has(toolName) && !authorized(candidates.get(toolName))) {
        return { ok: false, code: 'scope_denied', message: `工具未授权: ${toolName}` }
      }
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
    function assertEntryBudget() {
      // Admission only: positive deadlines/cancellation remain caller governed.
      // Read trusted host dependencies at entry, never model arguments.
      const remaining = deps.getRemainingTimeoutMs || options.deps?.getRemainingTimeoutMs
      const budget = typeof remaining === 'function' ? remaining() : undefined
      if (typeof budget === 'number' && budget <= 0) {
        throw Object.assign(new Error('工具执行预算已耗尽，未开始执行'), { code: 'tool_timeout' })
      }
    }
    async function executeToolCall(toolCall = {}) {
      // Host-owned invocation state. Neither model arguments nor arbitrary
      // handler results can prove that an entered handler did not execute.
      let executionStarted = false
      let signal, validation, argsSummary
      try {
        // Control fields come from the trusted invocation envelope, never model args.
        // The caller relays parent cancellation into its per-invocation signal.
        signal = toolCall.signal || deps.signal
        if (signal?.aborted || deps.signal?.aborted) {
          return { ...formatToolError('cancelled', '工具执行已取消'), executionStarted: false }
        }
        const name = toolCall.name || toolCall.function?.name
        const rawArgs = toolCall.arguments ?? toolCall.function?.arguments
        validation = validateToolCall(name, rawArgs)
        if (!validation.ok) {
          return {
            ...formatToolError(validation.code, validation.message),
            executionStarted: false,
            toolName: String(name || ''),
            argsSummary: '',
          }
        }
        argsSummary = summarizeToolArgs(validation.name, validation.args)
      } catch (err) {
        // Coercion/formatting is host preparation, not handler execution.
        return {
          ...formatToolError(err?.code || 'tool_failed', String(err?.message || err).slice(0, 500)),
          executionStarted: false,
        }
      }
      if (validation.name === 'search_knowledge' || validation.name === 'fabric_search') {
        const runner = fabricSearch || searchKnowledge
        if (!runner) {
          return {
            ...formatToolError('tool_unavailable', '知识检索执行器未配置'),
            executionStarted: false,
            toolName: validation.name,
            argsSummary,
          }
        }
        try {
          assertEntryBudget()
          executionStarted = true
          const providerResult = await runner(validation.args.query, signal)
          const formatted = formatProviderResult(providerResult)
          return { ...formatted, code: providerResult?.code, executionStarted, toolName: validation.name, argsSummary }
        } catch (err) {
          const msg = String(err?.message || '知识检索失败').slice(0, 500)
          return { ...formatToolError(err?.code || 'tool_failed', msg), executionStarted, toolName: validation.name, argsSummary }
        }
      }

      if (validation.name === 'kb_query') {
        if (!kbQuery) {
          return { ...formatToolError('tool_unavailable', 'kb_query 未配置'), executionStarted: false, toolName: validation.name, argsSummary }
        }
        try {
          assertEntryBudget()
          executionStarted = true
          const providerResult = await kbQuery(validation.args.collection, validation.args.query, signal)
          const formatted = formatProviderResult(providerResult)
          return { ...formatted, code: providerResult?.code, executionStarted, toolName: validation.name, argsSummary }
        } catch (err) {
          return { ...formatToolError(err?.code || 'tool_failed', String(err?.message || err).slice(0, 500)), executionStarted, toolName: validation.name, argsSummary }
        }
      }

      if (validation.name === 'kb_get') {
        if (!kbGet) {
          return { ...formatToolError('tool_unavailable', 'kb_get 未配置'), executionStarted: false, toolName: validation.name, argsSummary }
        }
        try {
          assertEntryBudget()
          executionStarted = true
          const doc = await kbGet(validation.args.ref, signal)
          const text = doc?.content || doc?.text || doc?.snippet || JSON.stringify(doc)
          const truncated = truncateText(String(text || ''), MAX_TOOL_RESULT_CHARS)
          return {
            ok: doc?.ok !== false,
            code: doc?.code,
            executionStarted,
            text: truncated.text,
            preview: truncated.text.slice(0, MAX_UI_PREVIEW_CHARS),
            toolName: validation.name,
            argsSummary,
          }
        } catch (err) {
          return { ...formatToolError(err?.code || 'tool_failed', String(err?.message || err).slice(0, 500)), executionStarted, toolName: validation.name, argsSummary }
        }
      }

      const handler = handlers[validation.name]
      if (typeof handler === 'function') {
        try {
          const handlerCtx = { signal }
          if (Number.isFinite(toolCall.timeoutMs) && toolCall.timeoutMs > 0) {
            handlerCtx.timeoutMs = toolCall.timeoutMs
            const startedAt = Date.now()
            const remaining = deps.getRemainingTimeoutMs || options.deps?.getRemainingTimeoutMs
            // Registry execution computes its own deadline. Bound that calculation
            // too, without replacing a shorter inherited run budget.
            handlerCtx.getRemainingTimeoutMs = () => {
              const inherited = typeof remaining === 'function' ? remaining() : Infinity
              return Math.max(0, Math.min(toolCall.timeoutMs - (Date.now() - startedAt),
                Number.isFinite(inherited) ? inherited : Infinity))
            }
          }
          // Trusted registry wrappers already check admission after schema/ACL;
          // preserve their validation order and shorter effective deadline.
          if (!(typeof isRegistryToolHandler === 'function' && isRegistryToolHandler(handler))) assertEntryBudget()
          executionStarted = true
          const result = await handler(validation.args, signal, handlerCtx)
          if (result && typeof result === 'object') {
            const text = String(result.text || result.message || '')
            // Skill instruction/page boundaries are semantic: cutting a page
            // while retaining its nextOffset would silently skip instructions.
            const skillPayload = ['load_skill', 'read_skill_resource'].includes(validation.name)
            if (skillPayload && (result.truncated === true || text.length > 65536)) {
              return { ...formatToolError('skill_context_budget_exceeded', '技能内容无法完整传递，请缩小资源分页后重试。'),
                executionStarted, toolName: validation.name }
            }
            const truncated = skillPayload ? { text, truncated: false } : truncateText(text, MAX_TOOL_RESULT_CHARS)
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
              // Trust only a host wrapper or the original local rejection object.
              // Neither provider fields nor a JSON copy carries that identity.
              executionStarted: !(isTrustedPreDispatchFailure(result)
                || (typeof isRegistryToolHandler === 'function'
                  && isRegistryToolHandler(handler) && result.executionStarted === false)),
              text: truncated.text,
              preview,
              truncated: result.truncated === true || truncated.truncated,
              // Artifact refs are part of the shared tool-result contract. Dropping
              // them here makes a successful file/image tool look text-only to the
              // agent runtime and causes downstream delivery validation to fail.
              artifactRefs: Array.isArray(result.artifactRefs) ? result.artifactRefs : [],
              receipt: result.receipt || null,
              toolName: validation.name,
              argsSummary,
              draft: result.draft || null,
              draftId: result.draftId || result.draft?.id || null,
              requiresApproval: Boolean(result.requiresApproval),
              code: result.code,
              meta: result.meta && typeof result.meta === 'object' ? result.meta : null,
              ...(skillPayload ? { pagination: result.pagination } : {}),
              ...(validation.name === 'load_skill' && result.ok === true
                && result.activation?.complete === true && result.activation?.status === 'active'
                ? { activation: result.activation, groundingContract: result.groundingContract,
                    executionContract: result.executionContract, dependencies: result.dependencies } : {}),
              sources,
            }
          }
          if (result == null) return { ...formatToolError('empty_tool_result', '工具未返回执行结果，无法确认操作完成。'), executionStarted }
          const text = String(result || '')
          const truncated = truncateText(text, MAX_TOOL_RESULT_CHARS)
          return {
            ok: true,
            executionStarted,
            text: truncated.text,
            preview: truncated.text.slice(0, MAX_UI_PREVIEW_CHARS),
            toolName: validation.name,
            argsSummary,
          }
        } catch (err) {
          return {
            ...formatToolError(err?.code || 'tool_failed', String(err?.message || err).slice(0, 500)),
            executionStarted,
            toolName: validation.name,
            argsSummary,
          }
        }
      }

      return {
        ...formatToolError('unknown_tool', `未注册工具: ${validation.name}`),
        executionStarted: false,
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
    // Rebuild the lexical validator/executor together, never override public methods.
    withGovernancePolicy: policy => createToolSurface({ ...options, governancePolicy: policy }),
    extras,
  }
}

const defaultSurface = createToolSurface()

module.exports = {
  createToolSurface,
}
