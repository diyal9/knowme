'use strict'

const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')
const feishuCli = require('./feishu-cli')
const normalize = require('./normalize')
const runtimeConfig = require('./runtime-config')
const connectorCaps = require('../connector-capabilities')
const { createToolSurface } = require('../agent-tools')
const { createUnifiedConnectorStore } = require('./unified-store')
const toolDrafts = require('../tool-drafts-store')
const agentFileTools = require('../agent-file-tools')
const { appendAuditLog, createRegistry } = require('../tool-contract-registry')
const { isTestSeamEnabled } = require('../test-seam')
const { attachKnowmeContract, BUILTIN_CONTRACT } = require('../tool-surface-builder')
const execFileAsync = promisify(execFile)
const { resolveConnectorHttpTarget, connectorHttpHeaders, fetchConnectorHttp } = require('./http-boundary')
const { markTrustedPreparationHandler, applyToolExecutionApproval, discardToolExecutionApproval, snapshotToolArgs, executionFingerprint } = require('../tool-execution-approval')
const { buildLazyMcpProjection } = require('./lazy-mcp-projection')
const { validatePreparedDraftScope, bindPreparedDraftScope } = require('../tool-execution-approval')
const { setToolExecutionTargetDescription } = require('../tool-execution-approval')
const { createDynamicRegistryToolSurface } = require('../dynamic-registry-tool-surface')

function externalToolFailure(err, fallbackCode = 'tool_failed') {
  const code = String(err?.code || '').trim()
  const signal = String(err?.signal || '').trim()
  const stdout = String(err?.stdout || '').trim()
  const stderr = String(err?.stderr || '').trim()
  const detail = (stderr || stdout || String(err?.message || '')).replace(/\s+/g, ' ').trim().slice(0, 500)
  let failureCode = fallbackCode
  let label = '外部工具执行失败'
  if (code === 'ENOENT') {
    failureCode = 'cli_not_found'
    label = '找不到 CLI 命令'
  } else if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || signal === 'SIGTERM') {
    failureCode = 'cli_timeout'
    label = 'CLI 执行超时'
  } else if (/^\d+$/.test(code) && Number(code) !== 0) {
    failureCode = 'cli_exit_nonzero'
    label = `CLI 退出失败（${code}）`
  }
  const text = detail ? `${label}：${detail}` : label
  return {
    ok: false,
    code: failureCode,
    message: text,
    text,
    preview: text.slice(0, 1200),
    meta: {
      exitCode: /^\d+$/.test(code) ? Number(code) : null,
      signal: signal || null,
    },
  }
}

const FEISHU_READ_CONTRACT = {
  source: 'feishu',
  capability: 'feishu-read',
  risk: 'read',
  sideEffects: false,
  requiresApproval: false,
  scope: 'external',
  timeoutMs: 60000,
  idempotencySupported: false,
  rollbackSupported: false,
}

const FEISHU_WRITE_CONTRACT = {
  source: 'feishu',
  capability: 'feishu-write',
  risk: 'write',
  sideEffects: true,
  requiresApproval: true,
  scope: 'external',
  timeoutMs: 90000,
  idempotencySupported: true,
  rollbackSupported: false,
}

const MCP_CONTRACT = {
  source: 'mcp',
  capability: 'mcp',
  risk: 'network',
  sideEffects: true,
  requiresApproval: false,
  scope: 'external',
  timeoutMs: 30000,
  idempotencySupported: false,
  rollbackSupported: false,
}

function loadDrafts(userData) {
  return toolDrafts.loadDrafts(userData)
}

function rememberDraft(userData, draft) {
  return toolDrafts.rememberDraft(userData, draft)
}

function getDraft(userData, draftId) {
  return toolDrafts.getDraft(userData, draftId)
}

function markDraft(userData, draftId, patch) {
  return toolDrafts.markDraft(userData, draftId, patch)
}

function buildFeishuDraftHandler(toolName, userData, approvalCtx = {}) {
  return markTrustedPreparationHandler(async (args) => {
    let built
    if (toolName === 'feishu.draft_minute_permission') {
      built = feishuCli.buildDraftMinutePermission(args)
    } else if (toolName === 'feishu.draft_write_doc') {
      built = feishuCli.buildDraftWrite(args)
    } else if (feishuCli.FEISHU_EXTENDED_DRAFT_BUILDERS?.[toolName]) {
      built = feishuCli.FEISHU_EXTENDED_DRAFT_BUILDERS[toolName](args)
    } else {
      return { ok: false, code: 'unknown_tool', text: `未知飞书 draft 工具: ${toolName}` }
    }
    if (!built.ok) return built
    let draft = rememberDraft(userData, { ...built.draft, kind: 'feishu' })
    draft = bindPreparedDraftScope(draft.id, { ...approvalCtx, userData, toolName, args, contract: FEISHU_WRITE_CONTRACT }) || draft
    return {
      ok: true,
      text: built.text,
      draft,
      draftId: draft.id,
      requiresApproval: true,
      code: 'approval_required',
    }
  })
}

function registerConnectorBundle(registry, bundle, contract) {
  if (!registry || !bundle?.definitions) return
  for (const def of bundle.definitions) {
    const name = def?.function?.name
    if (!name) continue
    const c = def._knowme || contract
    registry.registerTool(def, c, bundle.handlers?.[name])
  }
}

function connectorToolName(connector) {
  return `connector_${String(connector.id || '').replace(/[^a-zA-Z0-9_]/g, '_')}_call`
}

function genericConnectorDefinition(connector) {
  const type = connector.type
  const descriptions = {
    cli: '调用已安装连接器配置的本机命令行工具。仅执行包配置的命令，不接受 shell 字符串。',
    http: '调用已安装连接器配置的 HTTP API，可覆盖路径、方法、请求头和请求体。',
    ssh: '通过已安装连接器配置的 SSH 主机执行受控远程命令。',
  }
  return {
    type: 'function',
    function: {
      name: connectorToolName(connector),
      description: descriptions[type],
      parameters: { type: 'object', properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'CLI 参数；SSH 为远程命令参数。' },
        path: { type: 'string', description: 'HTTP 相对路径或同源完整 URL。跨源 URL 和重定向被拒绝。' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        body: { type: ['object', 'string', 'null'] },
      }, additionalProperties: false },
    },
  }
}

async function executeGenericConnector(connector, args = {}, runtimeOptions = {}) {
  const type = connector.type
  if (type === 'cli') {
    const command = String(connector.cli?.command || '').trim()
    const configuredArgs = Array.isArray(connector.cli?.args) ? connector.cli.args : []
    const extraArgs = Array.isArray(args.args) ? args.args.map(String) : []
    if (!command) return { ok: false, code: 'unconfigured', text: 'CLI 连接器尚未配置命令' }
    try {
      const result = await execFileAsync(command, [...configuredArgs, ...extraArgs], { cwd: connector.cli?.cwd || undefined, env: { ...process.env, ...(connector.cli?.env || {}), ...(runtimeOptions.env || {}) }, signal: runtimeOptions.signal, timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
      const text = String(result.stdout || result.stderr || '').slice(0, 24000)
      return { ok: true, text: text || 'CLI 执行完成（无输出）' }
    } catch (err) {
      return externalToolFailure(err, 'cli_failed')
    }
  }
  if (type === 'http') {
    const base = String(connector.http?.baseUrl || '').trim()
    if (!base) return { ok: false, code: 'unconfigured', text: 'HTTP 连接器尚未配置默认 URL' }
    try {
      const target = resolveConnectorHttpTarget(base, String(args.path || ''))
      const method = String(args.method || connector.http?.method || 'GET').toUpperCase()
      const headers = connectorHttpHeaders(connector.http?.headers, runtimeOptions.headers, args.headers, runtimeOptions.accessToken)
      const payload = args.body === undefined ? connector.http?.body : args.body
      const response = await fetchConnectorHttp(base, target.href, { method, headers, signal: runtimeOptions.signal, body: method === 'GET' || method === 'HEAD' || payload == null ? undefined : typeof payload === 'string' ? payload : JSON.stringify(payload) }, runtimeOptions.fetchImpl)
      const text = await response.text()
      return { ok: response.ok, status: response.status, text: text.slice(0, 24000), ...(response.ok ? {} : { code: 'http_error', message: `HTTP 请求失败（${response.status}）：${text.slice(0, 500)}` }) }
    } catch (err) {
      if (['http_target_denied', 'http_redirect_denied', 'http_header_denied'].includes(err?.code)) {
        return { ok: false, code: err.code, text: err.message }
      }
      return externalToolFailure(err, 'http_failed')
    }
  }
  if (type === 'ssh') {
    const host = String(connector.ssh?.host || '').trim()
    const username = String(connector.ssh?.username || '').trim()
    if (!host || !username) return { ok: false, code: 'unconfigured', text: 'SSH 连接器尚未配置主机和用户名' }
    const remoteArgs = Array.isArray(args.args) ? args.args.map(String) : []
    const command = String(connector.ssh?.command || '').trim()
    try {
      const result = await execFileAsync('ssh', ['-p', String(connector.ssh?.port || 22), `${username}@${host}`, ...(command ? [command] : remoteArgs)], { signal: runtimeOptions.signal, timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
      const text = String(result.stdout || result.stderr || '').slice(0, 24000)
      return { ok: true, text: text || 'SSH 执行完成（无输出）' }
    } catch (err) {
      return externalToolFailure(err, 'ssh_failed')
    }
  }
  return { ok: false, code: 'unsupported', text: `不支持的连接器类型: ${type}` }
}

async function collectGenericConnectorTools(connectors, opts, definitions, handlers) {
  for (const connector of connectors) {
    if (!connector?.enabled || connector.agentVisible === false || !['cli', 'http', 'ssh'].includes(connector.type)) continue
    const readiness = runtimeConfig.configurationState(connector, [])
    if (!readiness.ready) continue
    const def = genericConnectorDefinition(connector)
    definitions.push(attachKnowmeContract(def, { source: 'connector', connectorType: connector.type, capability: `connector:${connector.type}:${connector.id}`, risk: connector.type === 'http' ? 'network' : 'external', sideEffects: true, requiresApproval: true, scope: 'external', timeoutMs: 120000, idempotencySupported: false, rollbackSupported: false, connectorId: connector.id, executionTarget: executionFingerprint(connector) }))
    const configuredConnector = snapshotToolArgs(connector)
    handlers[def.function.name] = (args, signal) => {
      const current = opts.resolveCurrentConnector?.(configuredConnector.id)
      if (opts.resolveCurrentConnector && (!current || !current.enabled || current.agentVisible === false
        || executionFingerprint(current) !== executionFingerprint(configuredConnector))) {
        return { ok: false, code: 'connector_configuration_changed', text: '连接器配置或权限已改变，请刷新工具列表并重新批准。' }
      }
      return executeGenericConnector(configuredConnector, args, { ...(opts.resolveRuntimeOptions?.(configuredConnector) || {}), fetchImpl: opts.fetchImpl, signal })
    }
    setToolExecutionTargetDescription(handlers[def.function.name], args => {
      if (configuredConnector.type === 'http') {
        try {
          const target = resolveConnectorHttpTarget(configuredConnector.http.baseUrl, String(args.path || ''))
          return `${String(args.method || configuredConnector.http.method || 'GET').toUpperCase()} ${target.origin}${target.pathname}`
        } catch { return '无效的 HTTP 目标（执行前会拒绝）' }
      }
      if (configuredConnector.type === 'cli') return `CLI ${String(configuredConnector.cli?.command || '').split(/[\\/]/).pop()}`
      return `SSH ${configuredConnector.ssh?.host || ''}:${configuredConnector.ssh?.port || 22}`
    })
  }
}

async function collectConnectorTools(userData, opts = {}) {
  const includeSystemFeishu = opts.includeSystemFeishu === true
  const connectorStore = opts.connectorStore || createUnifiedConnectorStore({
    userData,
    mode: opts.connectorStoreMode,
  })
  connectorStore.migrateLegacy()
  opts = { ...opts, resolveCurrentConnector: id => connectorStore.loadConnectors().find(connector => connector.id === id) }
  let connectors = connectorStore.loadConnectors()
  if (Array.isArray(opts.allowedConnectorIds)) {
    const allow = new Set(opts.allowedConnectorIds)
    // Feishu CLI is a built-in system capability. Any tool-enabled run may
    // use it without the Expert having a per-agent connector binding; all
    // other connector types remain strictly binding-scoped.
    connectors = connectors.filter((c) => allow.has(c.id) || (includeSystemFeishu && c.id === 'feishu'))
  }
  const extraDefinitions = []
  const handlers = {}
  let mcpSessions = []
  let mcpProjectionError = null

  if (opts.extraTools && Array.isArray(opts.extraTools.definitions)) {
    for (const def of opts.extraTools.definitions) {
      const name = def?.function?.name
      if (!name) continue
      extraDefinitions.push(def)
      const handler = opts.extraTools.handlers?.[name]
      if (typeof handler === 'function') handlers[name] = handler
    }
  }

  await collectGenericConnectorTools(connectors, opts, extraDefinitions, handlers)

  const configuredFeishu = connectors.find((c) => c.id === 'feishu' && c.type === 'feishu')
  const feishu = includeSystemFeishu
    ? normalize.normalizeConnector({
      ...(configuredFeishu || {
        id: 'feishu',
        type: 'feishu',
        title: '飞书',
        allowlist: normalize.FULL_FEISHU_ALLOWLIST,
      }),
      id: 'feishu',
      type: 'feishu',
      // Projection is the capability boundary; lark-cli auth remains the
      // execution boundary and returns an actionable authorization failure.
      enabled: true,
      agentVisible: configuredFeishu ? configuredFeishu.agentVisible !== false : true,
      allowlist: Array.isArray(configuredFeishu?.allowlist)
        ? configuredFeishu.allowlist
        : normalize.FULL_FEISHU_ALLOWLIST,
    })
    : configuredFeishu
  if (feishu?.enabled && feishu.agentVisible !== false) {
    const allow = new Set(feishu.allowlist || [])
    const canRunMeetingWorkflow = allow.has('feishu.search_docs') && allow.has('feishu.read_doc')
    const projected = new Set(normalize.projectedToolNames(feishu))
    for (const def of feishuCli.FEISHU_READ_TOOL_DEFS) {
      if (projected.has(def.function.name)) {
        extraDefinitions.push(attachKnowmeContract(def, FEISHU_READ_CONTRACT))
        handlers[def.function.name] = async (args) => {
          const feishuOpts = {
            ...(opts.feishu || {}),
            memoryDir: opts.feishu?.memoryDir || path.join(String(userData || ''), 'memory'),
          }
          if (def.function.name === 'feishu.meeting_candidates') {
            return feishuCli.executeMeetingCandidates(args, feishuOpts)
          }
          if (def.function.name === 'feishu.meeting_read') {
            return feishuCli.executeMeetingRead(args, feishuOpts)
          }
          if (def.function.name === 'feishu.related_chats') {
            return feishuCli.executeRelatedChats(args, feishuOpts)
          }
          if (def.function.name === 'feishu.today_priority') {
            return feishuCli.executeTodayPriority(args, feishuOpts)
          }
          if (def.function.name === 'feishu.doc_kb_suggest') {
            return feishuCli.executeDocKbSuggest(args, feishuOpts)
          }
          return feishuCli.executeFeishuRead(def.function.name, args, feishuOpts)
        }
      }
    }
    for (const def of feishuCli.FEISHU_DRAFT_TOOL_DEFS) {
      const isMinutePermission = def.function.name === 'feishu.draft_minute_permission'
      const inAllowlist = allow.has(def.function.name) || (isMinutePermission && canRunMeetingWorkflow)
      if (inAllowlist) {
        extraDefinitions.push(attachKnowmeContract(def, FEISHU_WRITE_CONTRACT))
        handlers[def.function.name] = buildFeishuDraftHandler(def.function.name, userData, opts.executionApprovalContext)
      }
    }
  }

  if (opts.includeMcp !== false) {
    const mcpProjection = await buildLazyMcpProjection(connectors, {
      registry: opts.mcpRegistry,
      spawnImpl: opts.spawnImpl,
      timeoutMs: opts.mcpTimeoutMs,
      ephemeralSessions: opts.ephemeralMcpSessions === true,
      fetchImpl: opts.fetchImpl,
      userData,
      resolveRuntimeOptions: opts.resolveRuntimeOptions,
      resolveCurrentConnector: opts.resolveCurrentConnector,
      onToolsLoaded: bundle => {
        // Preflight the complete selected bundle before touching the shared registry.
        if (opts.registry && bundle.definitions.some(def => opts.registry.has(def.function.name))) {
          return { ok: false, code: 'tool_conflict' }
        }
        if (opts.registry) registerConnectorBundle(opts.registry, bundle, MCP_CONTRACT)
        extraDefinitions.push(...bundle.definitions)
        Object.assign(handlers, bundle.handlers)
        return { ok: true }
      },
    })
    if (!mcpProjection.ok) {
      mcpProjectionError = {
        code: mcpProjection.code,
        message: mcpProjection.message,
        conflicts: mcpProjection.conflicts || [],
      }
    } else {
      if (mcpProjection.partialErrors?.length) {
        mcpProjectionError = { code: 'partial_connector_failure', message: '部分连接器不可用，其余工具仍可使用。', partialErrors: mcpProjection.partialErrors }
      }
      mcpSessions = mcpProjection.sessions || []
      for (const def of mcpProjection.definitions) {
        extraDefinitions.push(def._knowme ? def : attachKnowmeContract(def, MCP_CONTRACT))
      }
      Object.assign(handlers, mcpProjection.handlers)
    }
  }

  return {
    definitions: extraDefinitions,
    handlers,
    mcpSessions,
    mcpProjectionError,
  }
}

/**
 * Build Agent tool surface from enabled connectors + allowlists.
 */
async function buildConnectorToolSurface(userData, opts = {}) {
  const registry = opts.registry || createRegistry()
  const collected = await collectConnectorTools(userData, { ...opts, registry })
  const bundle = { definitions: collected.definitions, handlers: collected.handlers }

  if (opts.registry) {
    registerConnectorBundle(opts.registry, bundle, FEISHU_READ_CONTRACT)
    return {
      registryExtras: bundle,
      mcpProjectionError: collected.mcpProjectionError,
      async close() {
        await connectorCaps.closeMcpSessions(collected.mcpSessions, {
          registry: opts.mcpRegistry,
          keepRegistry: opts.ephemeralMcpSessions !== true,
        })
      },
    }
  }

  registerConnectorBundle(registry, bundle, FEISHU_READ_CONTRACT)
  const { surface } = createDynamicRegistryToolSurface(registry, { ...opts.executionApprovalContext,
    userData, governancePolicy: opts.governancePolicy,
    validateExecutionApproval: opts.validateExecutionApproval || opts.executionApprovalContext?.validateExecutionApproval }, {
    requiredTools: opts.requiredTools,
    toolBudget: opts.toolBudget,
  })
  return {
    surface,
    mcpProjectionError: collected.mcpProjectionError,
    async close() {
      await connectorCaps.closeMcpSessions(collected.mcpSessions, {
        registry: opts.mcpRegistry,
        keepRegistry: opts.ephemeralMcpSessions !== true,
      })
    },
  }
}

async function approveFeishuDraft(userData, draftId, opts = {}) {
  console.warn('[deprecated] approveFeishuDraft → use approveToolDraft')
  return approveToolDraft(userData, draftId, opts)
}

async function approveToolDraft(userData, draftId, opts = {}) {
  const existing = getDraft(userData, draftId)
  if (opts.reject) {
    const rejected = toolDrafts.rejectDraft(userData, draftId)
    if (!rejected.ok) return rejected
    discardToolExecutionApproval(userData, draftId)
    appendAuditLog(userData, {
      toolName: existing?.action || existing?.kind || 'draft',
      outcome: 'rejected',
      target: existing?.path || existing?.title || '',
      runId: existing?.runId || opts.runId || '',
      sessionId: opts.sessionId || '',
      approverId: opts.approverId || '',
      draftId,
    })
    return { ok: true, rejected: true, message: '已拒绝草稿' }
  }

  const seamFake = isTestSeamEnabled() && Boolean(opts.fakeApply)
  const seamDry = Boolean(opts.dryRun) || (isTestSeamEnabled() && Boolean(opts.dryRun))

  if (seamDry || seamFake) {
    const draft = getDraft(userData, draftId)
    if (!draft) return { ok: false, code: 'not_found', message: '草稿不存在' }
    if (draft.status !== toolDrafts.STATUS_PENDING) {
      return { ok: false, code: 'not_pending', message: draft.status === 'applied' ? '草稿已执行' : '草稿已拒绝，不能再次写入' }
    }
    if (draft.kind === 'tool-execution') return { ok: true, dryRun: true, text: draft.preview }
    return feishuCli.applyFeishuWrite(draft, {
      ...opts,
      dryRun: seamDry,
      fakeApply: seamFake,
    })
  }

  const cas = toolDrafts.casBeginApply(userData, draftId)
  if (!cas.ok) return cas
  const draft = cas.draft

  let result
  try {
    if (draft.kind === 'file' || draft.kind === 'feishu' || !draft.kind) {
      const scope = await validatePreparedDraftScope(userData, draft, opts)
      if (!scope.ok) {
        toolDrafts.finishApply(userData, draftId, { failed: true })
        return scope
      }
    }
    if (draft.kind === 'tool-execution') {
      result = await applyToolExecutionApproval(userData, draft, opts)
    } else if (draft.kind === 'file') {
      const adapter = opts.fileAdapter
      if (!adapter) {
        toolDrafts.finishApply(userData, draftId, { failed: true })
        return { ok: false, code: 'tool_unavailable', message: '文件 adapter 未配置' }
      }
      result = await agentFileTools.applyFileDraft(draft, adapter)
    } else if (draft.kind === 'feishu' || !draft.kind) {
      result = await feishuCli.applyFeishuWrite(draft, opts)
    } else {
      toolDrafts.finishApply(userData, draftId, { failed: true })
      return { ok: false, code: 'invalid_draft', message: `未知草稿类型: ${draft.kind}` }
    }

    if (result.ok && !result.dryRun) {
      toolDrafts.applyDraftMark(userData, draftId, result)
      appendAuditLog(userData, {
        toolName: draft.action || draft.kind,
        outcome: 'applied',
        target: draft.path || draft.title || '',
        idempotencyKey: draft.idempotencyKey,
        runId: draft.runId || opts.runId || '',
        sessionId: opts.sessionId || '',
        approverId: opts.approverId || '',
        draftId,
      })
    } else if (!result.ok) {
      toolDrafts.finishApply(userData, draftId, { failed: true, applyResult: result.text || result.message })
    }
    return result
  } catch (err) {
    toolDrafts.finishApply(userData, draftId, { failed: true })
    return { ok: false, code: 'apply_failed', message: String(err?.message || err).slice(0, 500) }
  }
}

async function rollbackToolDraft(userData, draftId, opts = {}) {
  const draft = getDraft(userData, draftId)
  if (!draft || draft.kind !== 'file') {
    return { ok: false, code: 'rollback_unavailable', message: '仅文件草稿可回滚' }
  }
  const adapter = opts.fileAdapter
  if (!adapter) return { ok: false, code: 'tool_unavailable', message: '文件 adapter 未配置' }
  const result = await agentFileTools.rollbackFileDraft(draft, adapter)
  if (result.ok) {
    appendAuditLog(userData, {
      toolName: draft.action,
      outcome: 'rolled_back',
      target: draft.path || '',
      runId: draft.runId || opts.runId || '',
      sessionId: opts.sessionId || '',
      approverId: opts.approverId || '',
      draftId,
    })
  }
  return result
}

module.exports = {
  executeGenericConnector,
  buildConnectorToolSurface,
  collectConnectorTools,
  approveFeishuDraft,
  approveToolDraft,
  rollbackToolDraft,
  loadDrafts,
  getDraft,
  rememberDraft,
  markDraft,
  buildFeishuDraftHandler,
}
