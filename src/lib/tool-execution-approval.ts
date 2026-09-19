'use strict'

const crypto = require('crypto')
const path = require('path')
const drafts = require('./tool-drafts-store')
const { writeToolExecutionReceipt } = require('./tool-execution-receipts')

// These capabilities never cross IPC or the model tool schema. JSON booleans,
// copied tokens, tool names and mutable handler properties confer no authority.
const preparationHandlers = new WeakSet()
const authorizations = new WeakMap()
const pendingExecutions = new Map()
const preparedDraftScopes = new Map()
const executionTargetDescriptions = new WeakMap()
const APPROVAL_TTL_MS = 30 * 60 * 1000

// Display metadata only; registering a destination does not grant authority.
function setToolExecutionTargetDescription(handler, describe) {
  executionTargetDescriptions.set(handler, describe)
}

function markTrustedPreparationHandler(handler) {
  preparationHandlers.add(handler)
  return handler
}

function isTrustedPreparationHandler(handler) {
  return typeof handler === 'function' && preparationHandlers.has(handler)
}

// Pure validation only: this preserves the import contract's existing guidance
// without entering its handler or treating a model trust flag as host consent.
function validateToolApprovalPreconditions(name, args = {}) {
  if (name !== 'import_external_project') return { ok: true }
  if (!String(args.plan_token || '').trim() && !String(args.preview_token || '').trim()) {
    return { ok: false, code: 'invalid_args', text: '缺少 plan_token，请先预览并设计导入包' }
  }
  if (args.trust_confirmed !== true) {
    return { ok: false, code: 'trust_required', requiresApproval: true, text: '尚未获得用户对当前预览的明确导入确认。请先展示导入内容与风险摘要。' }
  }
  return { ok: true }
}

function snapshotToolArgs(args) {
  return JSON.parse(JSON.stringify(args ?? {}))
}

function executionFingerprint(value) {
  const canonical = item => {
    if (Array.isArray(item)) return item.map(canonical)
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]))
    return item
  }
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function invocationBinding(entry, args, ctx) {
  return executionFingerprint({
    name: entry.definition.function.name, contract: entry.contract, args,
    runId: ctx.runId || '', sessionId: ctx.sessionId || '',
    userData: path.resolve(ctx.userData || '.'),
  })
}

/** Host approval adapters may mint a one-use capability for an exact call. */
function createToolExecutionAuthorization(entry, args, ctx = {}) {
  const token = Object.freeze({})
  authorizations.set(token, { entry, handler: entry.handler, binding: invocationBinding(entry, args, ctx), expires: Date.now() + APPROVAL_TTL_MS })
  return token
}

function consumeToolExecutionAuthorization(token, entry, args, ctx = {}) {
  const record = token && typeof token === 'object' ? authorizations.get(token) : null
  if (!record || record.expires < Date.now() || record.entry !== entry || record.handler !== entry.handler
    || record.binding !== invocationBinding(entry, args, ctx)) return false
  authorizations.delete(token)
  return true
}

function pendingKey(userData, draftId) {
  return `${path.resolve(userData)}\0${draftId}`
}

function requestToolExecutionApproval(entry, args, ctx, execute) {
  const result = { ok: false, code: 'approval_required', requiresApproval: true, text: '此工具调用需要用户批准，尚未执行。' }
  if (!ctx.userData) return result
  const snapshot = snapshotToolArgs(args)
  const originalHandler = entry.handler
  const originalBinding = invocationBinding(entry, snapshot, ctx)
  const { redactSensitiveFields } = require('./tool-contract-governance')
  const preview = JSON.stringify(redactSensitiveFields(snapshot), null, 2)
    .replace(/((?:password|secret|token|api[_-]?key|authorization)\s*[=:]\s*)[^\s&;,"']+/gi, '$1[REDACTED]')
    .slice(0, 12000)
  const target = String(executionTargetDescriptions.get(entry.handler)?.(snapshot)
    || snapshot.path || snapshot.title || entry.definition.function.name).slice(0, 1000)
  const draft = drafts.rememberDraft(ctx.userData, {
    kind: 'tool-execution', action: entry.definition.function.name,
    title: entry.definition.function.name, preview, target,
    runId: ctx.runId || '', sessionId: ctx.sessionId || '',
    invocationHash: invocationBinding(entry, snapshot, ctx),
    replayHash: executionFingerprint({ toolName: entry.definition.function.name, contract: entry.contract, args: snapshot }),
    contractHash: executionFingerprint(entry.contract),
    recoveryRunId: ctx.executionApprovalRecoveryRunId || null,
  })
  for (const [key, value] of pendingExecutions) if (value.expires < Date.now()) pendingExecutions.delete(key)
  while (pendingExecutions.size >= 100) pendingExecutions.delete(pendingExecutions.keys().next().value)
  pendingExecutions.set(pendingKey(ctx.userData, draft.id), {
    expires: Date.now() + APPROVAL_TTL_MS,
    draftHash: executionFingerprint({ action: draft.action, preview: draft.preview, target: draft.target, replayHash: draft.replayHash,
      contractHash: draft.contractHash, recoveryRunId: draft.recoveryRunId, invocationHash: draft.invocationHash, runId: draft.runId, sessionId: draft.sessionId }),
    async apply(approvalCtx) {
      if (entry.handler !== originalHandler || invocationBinding(entry, snapshot, ctx) !== originalBinding) {
        return { ok: false, code: 'approval_mismatch', text: '工具配置或目标已改变，请重新发起工具调用。' }
      }
      if (ctx.signal?.aborted) return { ok: false, code: 'cancelled', text: '原工具调用已取消，不能批准执行。' }
      if (typeof ctx.validateExecutionApproval !== 'function') {
        return { ok: false, code: 'approval_revalidation_required', text: '缺少当前会话与权限校验，请重新发起工具调用。' }
      }
      const current = await ctx.validateExecutionApproval({ toolName: entry.definition.function.name,
        args: snapshotToolArgs(snapshot), contract: { ...entry.contract }, runId: ctx.runId || '', sessionId: ctx.sessionId || '' })
      if (current?.ok !== true) return { ok: false, code: current?.code || 'scope_denied', text: current?.text || current?.message || '当前任务或权限已不允许执行此调用。' }
      if (ctx.signal?.aborted) return { ok: false, code: 'cancelled', text: '原工具调用已取消。' }
      if (entry.handler !== originalHandler || invocationBinding(entry, snapshot, ctx) !== originalBinding) {
        return { ok: false, code: 'approval_mismatch', text: '批准期间工具目标已改变。' }
      }
      // Fresh host scope validation permits a new approval invocation budget.
      // Preserve cancellation; never resurrect a failed/cancelled run blindly.
      const approvedCtx = { ...ctx, getRemainingTimeoutMs: () => Number(entry.contract.timeoutMs), remainingTimeoutMs: undefined,
        approverId: approvalCtx.approverId || 'user' }
      approvedCtx.executionAuthorization = createToolExecutionAuthorization(entry, snapshot, approvedCtx)
      // Write-ahead evidence: a crash after entering the operation is uncertain,
      // never equivalent to permission to repeat the side effect.
      writeToolExecutionReceipt(ctx.userData, draft, { ok: false, code: 'operation_status_unknown' }, 'uncertain')
      const executed = await execute(snapshot, approvedCtx)
      const outcome = executed.ok === true && !executed.pendingReview ? 'executed'
        : executed.executionStarted === false ? 'not_executed' : 'uncertain'
      writeToolExecutionReceipt(ctx.userData, draft, executed, outcome)
      return executed
    },
  })
  return { ...result, draft, draftId: draft.id, preview }
}

function discardToolExecutionApproval(userData, draftId) {
  pendingExecutions.delete(pendingKey(userData, draftId))
  preparedDraftScopes.delete(pendingKey(userData, draftId))
}

function preparedDraftFingerprint(draft) {
  const { status, applyingAt, reviewedAt, applyResult, failed, ...binding } = draft
  return executionFingerprint(binding)
}

/** Host binding only. A serialized stamp alone never confers approval. */
function bindPreparedDraftScope(draftId, ctx) {
  if (!ctx.userData || !ctx.runId || !ctx.sessionId) return null
  const original = drafts.getDraft(ctx.userData, draftId)
  if (!original || !['file', 'feishu'].includes(original.kind)) return null
  // Idempotency can return a previous draft. Never rebind it to another task,
  // a different argument set, or a changed payload after it was shown to users.
  if (original.approvalScope || preparedDraftScopes.has(pendingKey(ctx.userData, draftId))) return original
  const draft = drafts.markDraft(ctx.userData, draftId, { runId: ctx.runId, sessionId: ctx.sessionId,
    approvalScope: { runId: ctx.runId, sessionId: ctx.sessionId, toolName: ctx.toolName } })
  const args = snapshotToolArgs(ctx.args)
  const contract = snapshotToolArgs({ ...ctx.contract,
    ...(original.kind === 'feishu' ? { connectorId: 'feishu' } : {}) })
  for (const [key, value] of preparedDraftScopes) if (value.expires < Date.now()) preparedDraftScopes.delete(key)
  while (preparedDraftScopes.size >= 100) preparedDraftScopes.delete(preparedDraftScopes.keys().next().value)
  preparedDraftScopes.set(pendingKey(ctx.userData, draftId), {
    ctx: { ...ctx }, args, contract, expires: Date.now() + APPROVAL_TTL_MS, hash: preparedDraftFingerprint(draft),
  })
  return draft
}

async function validatePreparedDraftScope(userData, draft, approvalCtx = {}) {
  const key = pendingKey(userData, draft.id)
  const binding = preparedDraftScopes.get(key)
  // Existing manual, host-created drafts have no task scope. Removing the
  // serialized stamp from a bound draft does not remove its private binding.
  if (!draft.approvalScope && !binding) return { ok: true }
  if (!binding || binding.expires < Date.now()) {
    preparedDraftScopes.delete(key)
    return { ok: false, code: 'approval_expired', text: '草稿任务授权已过期或应用已重启，请重新生成草稿。' }
  }
  const { ctx, args, contract } = binding
  if (preparedDraftFingerprint(draft) !== binding.hash || (approvalCtx.sessionId && approvalCtx.sessionId !== ctx.sessionId)
    || (approvalCtx.runId && approvalCtx.runId !== ctx.runId)) {
    return { ok: false, code: 'approval_mismatch', text: '草稿内容或任务身份已改变。' }
  }
  if (ctx.signal?.aborted) return { ok: false, code: 'cancelled', text: '原草稿任务已取消。' }
  if (draft.kind === 'file' && ctx.approvalFileRoot
    && path.resolve(approvalCtx.fileAdapter?.rootPath || '.') !== path.resolve(ctx.approvalFileRoot)) {
    return { ok: false, code: 'approval_mismatch', text: '草稿绑定的文件来源已改变。' }
  }
  if (typeof ctx.validateExecutionApproval !== 'function') return { ok: false, code: 'approval_revalidation_required', text: '缺少当前任务授权校验，请重新生成草稿。' }
  const current = await ctx.validateExecutionApproval({ toolName: ctx.toolName, args: snapshotToolArgs(args),
    contract: snapshotToolArgs(contract), runId: ctx.runId, sessionId: ctx.sessionId })
  if (current?.ok !== true) return { ok: false, code: current?.code || 'scope_denied', text: current?.text || current?.message || '草稿任务授权已撤销。' }
  if (ctx.signal?.aborted) return { ok: false, code: 'cancelled', text: '原草稿任务已取消。' }
  preparedDraftScopes.delete(key)
  return { ok: true }
}

/** Called only after the existing host draft store CAS has begun approval. */
async function applyToolExecutionApproval(userData, draft, ctx = {}) {
  const key = pendingKey(userData, draft.id)
  const pending = pendingExecutions.get(key)
  if (!pending || pending.expires < Date.now()) {
    pendingExecutions.delete(key)
    return { ok: false, executionStarted: false, code: 'approval_expired', text: '调用批准已过期或应用已重启，请重新发起工具调用以生成新的批准请求。' }
  }
  const hash = executionFingerprint({ action: draft.action, preview: draft.preview, target: draft.target, replayHash: draft.replayHash,
    contractHash: draft.contractHash, recoveryRunId: draft.recoveryRunId, invocationHash: draft.invocationHash, runId: draft.runId, sessionId: draft.sessionId })
  if (hash !== pending.draftHash || (ctx.sessionId && ctx.sessionId !== draft.sessionId)
    || (ctx.runId && ctx.runId !== draft.runId)) {
    return { ok: false, executionStarted: false, code: 'approval_mismatch', text: '批准请求与原始工具调用不匹配。' }
  }
  pendingExecutions.delete(key)
  return { executionStarted: false, ...await pending.apply(ctx) }
}

module.exports = { markTrustedPreparationHandler, isTrustedPreparationHandler, validateToolApprovalPreconditions, snapshotToolArgs,
  executionFingerprint, createToolExecutionAuthorization, consumeToolExecutionAuthorization,
  requestToolExecutionApproval, discardToolExecutionApproval, applyToolExecutionApproval,
  bindPreparedDraftScope, validatePreparedDraftScope, setToolExecutionTargetDescription }
