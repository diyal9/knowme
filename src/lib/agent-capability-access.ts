'use strict'

const drafts = require('./tool-drafts-store')
const { resolveAgentCapabilityScope } = require('./agent-capability-scope')
const { taskCapabilityIdentity, sameTaskCapabilityIdentity, recordTaskCapabilityGrant } = require('./agent-task-capability-grants')
const { markTrustedPreparationHandler } = require('./tool-execution-approval')
const { buildKnowledgeSelectionOptions } = require('../shared/knowledge-selection')
const { resolveCapabilityApprovalCheckpoint } = require('./agent-capability-approval-checkpoint')
const { capabilityDiscoveryScore } = require('./agent-capability-search')

/** Metadata only: do not expose secrets, tool schemas, skill bodies or knowledge contents. */
function listHostCapabilityCatalog(deps) {
  const hub = deps.ensureCapabilityHub?.()
  const skills = hub?.skillRuntime?.().listSkillsL0?.({ invocation: 'model' }) || []
  const connectors = deps.getConnectorsApi?.().loadConnectors?.() || []
  const providers = deps.listProvidersRedacted?.().providers || []
  return [
    ...skills.map(item => ({ ...item, capabilityKind: 'skills' })),
    ...connectors.filter(item => item.enabled !== false).map(item => ({ ...item, capabilityKind: 'connectors' })),
    ...buildKnowledgeSelectionOptions(providers).map(item => ({ ...item, capabilityKind: 'knowledge' })),
  ].map(item => ({
    capabilityKind: item.capabilityKind, id: String(item.id),
    name: String(item.displayName || item.name || item.title || item.id).slice(0, 160),
    description: String(item.description || '').slice(0, 300),
  }))
}

function createCapabilityAccessService(options) {
  const { userData, getSession, getScope, getCatalog } = options
  const unavailable = () => ({ ok: false, code: 'scope_denied', text: '能力不可用或不允许申请授权' })
  function discover(args = {}) {
    const session = getSession()
    if (!session) return unavailable()
    const scope = getScope(session)
    const query = String(args.query || '').toLowerCase().slice(0, 200)
    const items = getCatalog().filter(item => !args.kind || item.capabilityKind === args.kind)
      .map(item => ({ ...item, score: capabilityDiscoveryScore(query, item) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .map(item => ({ ...item, ...scope.decision(item.capabilityKind, item.id) }))
      .filter(item => item.allowed || item.requestable)
      .map(({ score, ...item }) => item)
    const offset = Math.max(0, Math.floor(Number(args.offset) || 0))
    const limit = Math.max(1, Math.min(30, Math.floor(Number(args.limit) || 15)))
    const page = { items: items.slice(offset, offset + limit), nextOffset: offset + limit < items.length ? offset + limit : null }
    return { ok: true, ...page, text: JSON.stringify(page) }
  }
  function request(args = {}) {
    const session = getSession()
    if (!session) return unavailable()
    const kind = String(args.kind || '')
    const id = String(args.capability_id || '')
    const item = getCatalog().find(row => row.capabilityKind === kind && row.id === id)
    const decision = getScope(session).decision(kind, id)
    if (!item || (!decision.allowed && !decision.requestable)) return unavailable()
    if (decision.allowed) return { ok: true, text: '能力已在当前任务授权范围内' }
    const identity = taskCapabilityIdentity(session)
    const reason = String(args.reason || '').trim().slice(0, 1000)
    const preview = `请求在本任务中使用 ${item.name}（${id}）。${reason}\n批准后重新运行生效，可随时撤销。`
    const draft = drafts.rememberDraft(userData, {
      kind: 'capability-access', action: 'request_capability_access',
      title: `任务能力授权：${item.name}`, body: preview, preview,
      runId: options.runId || session.run?.id || null,
      idempotencyKey: `capability-access:${identity.sessionId}:${identity.taskId}:${identity.agentId}:${kind}:${id}`,
      meta: { ...identity, capabilityKind: kind, capabilityId: id, reason },
    })
    return { ok: true, code: 'approval_required', requiresApproval: true, draftId: draft.id, draft, text: preview }
  }
  return { discover, request }
}

/** Called only by the host's existing user approval IPC, never by a tool handler. */
function approveCapabilityAccessDraft(userData, draftId, deps, payload = {}) {
  const draft = drafts.getDraft(userData, draftId)
  if (!draft || draft.kind !== 'capability-access') return { ok: false, code: 'not_found' }
  if (payload.reject) return drafts.rejectDraft(userData, draftId)
  const session = deps.loadAgentSessions?.().find(row => row.id === draft.meta?.sessionId)
  const task = session?.taskRef?.id ? deps.getWorkbenchTaskStore?.().get(session.taskRef.id)?.task : null
  if (!session || !sameTaskCapabilityIdentity(draft.meta, taskCapabilityIdentity(session))
    || (payload.sessionId && payload.sessionId !== session.id)
    || ['cancelled', 'canceled'].includes(session.run?.status)
    || (task && (task.execRef?.id !== session.id || task.expertId !== draft.meta.agentId
      || ['cancelled', 'archived'].includes(task.status)))) {
    return { ok: false, code: 'scope_denied', message: '授权请求不属于当前任务或任务身份已改变' }
  }
  const scope = resolveAgentCapabilityScope({ session, userData, expertRuntime: deps.ensureCapabilityHub?.().expertRuntime() })
  const { capabilityKind: kind, capabilityId: id } = draft.meta
  const decision = scope.decision(kind, id)
  if ((!decision.allowed && !decision.requestable)
    || !listHostCapabilityCatalog(deps).some(row => row.capabilityKind === kind && row.id === id)) {
    return { ok: false, code: 'scope_denied', message: '能力或授权策略已改变，请重新申请' }
  }
  const begun = drafts.casBeginApply(userData, draftId)
  if (!begun.ok) return begun
  try {
    const grant = recordTaskCapabilityGrant(userData, session, kind, id, draftId)
    const result = { ok: true, grantId: grant.id, restartRequired: true, message: '已授权本任务；重新运行后生效' }
    drafts.applyDraftMark(userData, draftId, result)
    resolveCapabilityApprovalCheckpoint(userData, session, draft, deps)
    return result
  } catch (error) {
    drafts.finishApply(userData, draftId, { failed: true })
    return { ok: false, code: 'grant_failed', message: String(error?.message || error) }
  }
}

function buildCapabilityAccessTools(options) {
  const service = createCapabilityAccessService(options)
  const contract = {
    source: 'builtin', capability: 'capability-discovery', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: false, rollbackSupported: false,
  }
  return {
    definitions: [
      { type: 'function', function: { name: 'discover_capabilities',
        description: '搜索已安装能力的名称摘要及本任务授权状态；不加载正文、不授予访问权。',
        parameters: { type: 'object', properties: {
          query: { type: 'string' }, kind: { type: 'string', enum: ['skills', 'connectors', 'knowledge'] },
          offset: { type: 'integer' }, limit: { type: 'integer' },
        }, additionalProperties: false } }, _knowme: contract },
      { type: 'function', function: { name: 'request_capability_access',
        description: '为未绑定能力创建本任务授权申请，等待用户在审批界面批准；申请本身不会授权，批准后需重新运行。',
        parameters: { type: 'object', properties: {
          kind: { type: 'string', enum: ['skills', 'connectors', 'knowledge'] },
          capability_id: { type: 'string' }, reason: { type: 'string' },
        }, required: ['kind', 'capability_id', 'reason'], additionalProperties: false } },
      _knowme: { ...contract, requiresApproval: true } },
    ],
    handlers: { discover_capabilities: service.discover, request_capability_access: markTrustedPreparationHandler(service.request) },
  }
}

module.exports = { listHostCapabilityCatalog, createCapabilityAccessService, approveCapabilityAccessDraft, buildCapabilityAccessTools }
