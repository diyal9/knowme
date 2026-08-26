'use strict'

const path = require('path')
const feishuCli = require('./feishu-cli')
const normalize = require('./normalize')
const connectorCaps = require('../connector-capabilities')
const { createToolSurface } = require('../agent-tools')
const { createUnifiedConnectorStore } = require('./unified-store')
const toolDrafts = require('../tool-drafts-store')
const agentFileTools = require('../agent-file-tools')
const { appendAuditLog } = require('../tool-contract-registry')
const { isTestSeamEnabled } = require('../test-seam')
const { attachKnowmeContract, BUILTIN_CONTRACT } = require('../tool-surface-builder')

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

function buildFeishuDraftHandler(toolName, userData) {
  return async (args) => {
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
    const draft = rememberDraft(userData, { ...built.draft, kind: 'feishu' })
    return {
      ok: true,
      text: built.text,
      draft,
      draftId: draft.id,
      requiresApproval: true,
      code: 'approval_required',
    }
  }
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

async function collectConnectorTools(userData, opts = {}) {
  const connectorStore = opts.connectorStore || createUnifiedConnectorStore({
    userData,
    mode: opts.connectorStoreMode,
  })
  connectorStore.migrateLegacy()
  let connectors = connectorStore.loadConnectors()
  if (Array.isArray(opts.allowedConnectorIds)) {
    const allow = new Set(opts.allowedConnectorIds)
    connectors = connectors.filter((c) => allow.has(c.id))
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

  const feishu = connectors.find((c) => c.id === 'feishu' && c.type === 'feishu')
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
        handlers[def.function.name] = buildFeishuDraftHandler(def.function.name, userData)
      }
    }
  }

  if (opts.includeMcp !== false) {
    const mcpProjection = await connectorCaps.buildMcpAgentProjection(connectors, {
      registry: opts.mcpRegistry,
      spawnImpl: opts.spawnImpl,
      timeoutMs: opts.mcpTimeoutMs,
      ephemeralSessions: opts.ephemeralMcpSessions === true,
      fetchImpl: opts.fetchImpl,
      userData,
      resolveRuntimeOptions: opts.resolveRuntimeOptions,
    })
    if (!mcpProjection.ok) {
      mcpProjectionError = {
        code: mcpProjection.code,
        message: mcpProjection.message,
        conflicts: mcpProjection.conflicts || [],
      }
    } else {
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
  const collected = await collectConnectorTools(userData, opts)
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

  const surface = createToolSurface({
    extraDefinitions: collected.definitions,
    handlers: collected.handlers,
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
    if (draft.kind === 'file') {
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
