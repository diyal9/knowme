'use strict'

const fs = require('fs')
const path = require('path')
const feishuCli = require('./feishu-cli')
const normalize = require('./normalize')
const connectorCaps = require('../connector-capabilities')
const { createToolSurface } = require('../agent-tools')
const store = require('./store')

function draftsPath(userData) {
  return path.join(String(userData || ''), 'connector-drafts.json')
}

function loadDrafts(userData) {
  try {
    const raw = JSON.parse(fs.readFileSync(draftsPath(userData), 'utf8'))
    return Array.isArray(raw?.drafts) ? raw.drafts : []
  } catch {
    return []
  }
}

function saveDrafts(userData, drafts) {
  const file = draftsPath(userData)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, drafts: drafts.slice(-50) }, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

function rememberDraft(userData, draft) {
  const drafts = loadDrafts(userData)
  drafts.push(draft)
  saveDrafts(userData, drafts)
  return draft
}

function getDraft(userData, draftId) {
  return loadDrafts(userData).find((d) => d.id === String(draftId || ''))
}

function markDraft(userData, draftId, patch) {
  const drafts = loadDrafts(userData)
  const idx = drafts.findIndex((d) => d.id === String(draftId || ''))
  if (idx < 0) return null
  drafts[idx] = { ...drafts[idx], ...patch }
  saveDrafts(userData, drafts)
  return drafts[idx]
}

/**
 * Build Agent tool surface from enabled connectors + allowlists.
 */
async function buildConnectorToolSurface(userData, opts = {}) {
  let connectors = store.loadConnectors(userData)
  if (Array.isArray(opts.allowedConnectorIds) && opts.allowedConnectorIds.length) {
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
        extraDefinitions.push(def)
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
      if (allow.has(def.function.name) || (isMinutePermission && canRunMeetingWorkflow)) {
        extraDefinitions.push(def)
        handlers[def.function.name] = async (args) => {
          const built = def.function.name === 'feishu.draft_minute_permission'
            ? feishuCli.buildDraftMinutePermission(args)
            : feishuCli.buildDraftWrite(args)
          if (!built.ok) return built
          rememberDraft(userData, built.draft)
          return {
            ok: true,
            text: built.text,
            draft: built.draft,
            requiresApproval: true,
          }
        }
      }
    }
  }

  if (opts.includeMcp !== false) {
    const mcpProjection = await connectorCaps.buildMcpAgentProjection(connectors, {
      registry: opts.mcpRegistry,
      spawnImpl: opts.spawnImpl,
      timeoutMs: opts.mcpTimeoutMs,
      ephemeralSessions: opts.ephemeralMcpSessions === true,
    })
    if (!mcpProjection.ok) {
      mcpProjectionError = {
        code: mcpProjection.code,
        message: mcpProjection.message,
        conflicts: mcpProjection.conflicts || [],
      }
    } else {
      mcpSessions = mcpProjection.sessions || []
      for (const def of mcpProjection.definitions) extraDefinitions.push(def)
      Object.assign(handlers, mcpProjection.handlers)
    }
  }

  const surface = createToolSurface({ extraDefinitions, handlers })
  return {
    surface,
    mcpProjectionError,
    async close() {
      await connectorCaps.closeMcpSessions(mcpSessions, {
        registry: opts.mcpRegistry,
        keepRegistry: opts.ephemeralMcpSessions !== true,
      })
    },
  }
}

async function approveFeishuDraft(userData, draftId, opts = {}) {
  const draft = getDraft(userData, draftId)
  if (!draft) return { ok: false, code: 'not_found', message: '草稿不存在' }
  if (draft.status !== 'pending_review') {
    return {
      ok: false,
      code: 'not_pending',
      message: draft.status === 'applied' ? '草稿已执行' : '草稿已拒绝，不能再次写入',
    }
  }
  if (opts.reject) {
    markDraft(userData, draftId, { status: 'rejected', reviewedAt: new Date().toISOString() })
    return { ok: true, rejected: true, message: '已拒绝写入飞书' }
  }
  const result = await feishuCli.applyFeishuWrite(draft, {
    ...opts,
    dryRun: Boolean(opts.dryRun),
  })
  if (result.ok && !result.dryRun) {
    markDraft(userData, draftId, {
      status: 'applied',
      reviewedAt: new Date().toISOString(),
      applyResult: String(result.text || '').slice(0, 2000),
    })
  }
  return result
}

module.exports = {
  buildConnectorToolSurface,
  approveFeishuDraft,
  loadDrafts,
  getDraft,
  rememberDraft,
}
