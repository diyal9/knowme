'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const runtime = require('../src/lib/connectors/tool-runtime')
const drafts = require('../src/lib/tool-drafts-store')
const { createStore } = require('../src/lib/workbench-task-store')
const { registerConnectorsIpc } = require('../src/ipc/connectors')
const { listToolExecutionReceipts } = require('../src/lib/tool-execution-receipts')
const { buildToolSurfaceFromRegistry } = require('../src/lib/tool-surface-builder')
const { resolveToolExecutionApprovalCheckpoint } = require('../src/lib/tool-execution-approval-checkpoint')

async function fixture(t, operation = () => ({ ok: true, text: 'created resource 42' })) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-approval-checkpoint-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const store = createStore(path.join(userData, 'tasks.json'))
  const task = store.create({ goal: 'create one resource', expertId: 'expert',
    execRef: { kind: 'session', id: 'session' } }).task
  const session = { id: 'session', expertId: 'expert', taskRef: { id: task.id }, run: { id: 'run', status: 'completed' } }
  let calls = 0
  let allowed = true
  const registry = createRegistry()
  const contract = { source: 'connector', capability: 'write', risk: 'write', sideEffects: true,
    requiresApproval: true, scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false }
  registry.registerTool({ type: 'function', function: { name: 'write', parameters: { type: 'object' } } }, contract,
    async args => { calls++; return operation(args) })
  const ctx = { userData, runId: 'run', sessionId: session.id,
    validateExecutionApproval: async () => ({ ok: allowed }) }
  const pending = await registry.execute('write', { target: '42' }, ctx)
  store.update(task.id, { status: 'needs_input', attention: { kind: 'approval_required', action: 'provide_input',
    draftId: pending.draftId, runId: 'run' } })
  const handlers = {}
  const deps = { app: { getPath: () => userData }, loadAgentSessions: () => [session],
    getWorkbenchTaskStore: () => store, connectorToolRuntime: runtime,
    resolveTestSeamOpts: clean => ({ clean, seam: {} }) }
  registerConnectorsIpc({ handle: (name, handler) => { handlers[name] = handler } }, deps)
  return { userData, task, session, store, registry, ctx, pending, calls: () => calls,
    revoke: () => { allowed = false },
    approve: payload => handlers['tool-approve-draft']({}, { draftId: pending.draftId, ...payload }) }
}

test('generic IPC saves real execution evidence and releases only its exact checkpoint across reopen', async t => {
  const f = await fixture(t)
  assert.equal(f.calls(), 0)
  const result = await f.approve()
  assert.equal(result.ok, true)
  assert.equal(result.executed, true)
  assert.equal(result.resumeRequired, true)
  assert.equal(f.calls(), 1)
  const reopened = createStore(path.join(f.userData, 'tasks.json')).get(f.task.id).task
  assert.equal(reopened.status, 'needs_input')
  assert.equal(reopened.attention.kind, 'tool_execution_completed')
  assert.equal(reopened.attention.action, 'retry')
  assert.equal(reopened.attention.draftId, f.pending.draftId)
  assert.equal(reopened.executionEvidence[0].toolCalls[0].status, 'ok')
  assert.equal(reopened.executionEvidence[0].gateStatus, 'blocked', 'one operation is not full task verification')
  assert.equal(listToolExecutionReceipts(f.userData, 'session')[0].result.text, 'created resource 42')
  const duplicate = await f.approve()
  assert.equal(duplicate.code, 'duplicate_apply')
  assert.equal(f.calls(), 1)
  assert.equal(f.store.get(f.task.id).task.executionEvidence.length, 1)
})

test('file draft approval and rejection advance the same task checkpoint', t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-file-approval-checkpoint-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const store = createStore(path.join(userData, 'tasks.json'))
  const task = store.create({ goal: 'write one file', expertId: 'expert',
    execRef: { kind: 'session', id: 'session' } }).task
  const session = { id: 'session', expertId: 'expert', taskRef: { id: task.id }, run: { id: 'run', status: 'completed' } }
  const deps = { loadAgentSessions: () => [session], getWorkbenchTaskStore: () => store }
  const makeDraft = id => drafts.rememberDraft(userData, { id, kind: 'file', action: 'write_file',
    path: 'outputs/index.html', content: '<h1>KnowMe</h1>', preview: '+ <h1>KnowMe</h1>',
    sessionId: 'session', runId: 'run' })

  const approved = makeDraft('file-approved')
  store.update(task.id, { status: 'needs_input', attention: { kind: 'approval_required',
    action: 'provide_input', draftId: approved.id, runId: 'run' } })
  drafts.applyDraftMark(userData, approved.id, { ok: true, text: '已写入 outputs/index.html' })
  const approvedResult = resolveToolExecutionApprovalCheckpoint(userData, approved,
    { ok: true, text: '已写入 outputs/index.html' }, deps)
  assert.equal(approvedResult.executed, true)
  assert.equal(approvedResult.resumeRequired, true)
  assert.equal(store.get(task.id).task.attention.kind, 'tool_execution_completed')

  const rejected = makeDraft('file-rejected')
  store.update(task.id, { status: 'needs_input', attention: { kind: 'approval_required',
    action: 'provide_input', draftId: rejected.id, runId: 'run' } })
  drafts.rejectDraft(userData, rejected.id)
  const rejectedResult = resolveToolExecutionApprovalCheckpoint(userData, rejected,
    { ok: true, rejected: true, message: '已拒绝草稿' }, deps)
  assert.equal(rejectedResult.executed, false)
  assert.equal(rejectedResult.resumeRequired, false)
  assert.equal(store.get(task.id).task.attention.kind, 'tool_approval_expired')
  assert.equal(store.get(task.id).task.attention.action, 'retry')
})

for (const scenario of ['other-draft', 'missing-input', 'new-run', 'other-session', 'cancelled-task', 'other-pending']) {
  test(`approval result never releases ${scenario} checkpoint`, async t => {
    const f = await fixture(t)
    if (scenario === 'other-draft') f.store.update(f.task.id, { attention: { kind: 'approval_required', action: 'provide_input', draftId: 'other' } })
    if (scenario === 'missing-input') f.store.update(f.task.id, { attention: { kind: 'missing_input', action: 'provide_input', draftId: f.pending.draftId } })
    if (scenario === 'new-run') f.session.run.id = 'new-run'
    if (scenario === 'other-session') f.store.update(f.task.id, { execRef: { kind: 'session', id: 'other' } })
    if (scenario === 'cancelled-task') f.store.update(f.task.id, { status: 'cancelled', attention: null })
    if (scenario === 'other-pending') drafts.rememberDraft(f.userData, { kind: 'tool-execution', sessionId: 'session', runId: 'run', action: 'other' })
    const before = f.store.get(f.task.id).task.attention
    const result = await f.approve()
    assert.equal(result.resumeRequired, false)
    assert.deepEqual(f.store.get(f.task.id).task.attention, before)
  })
}

test('known pre-entry revocation and expired callback permit regenerate, never claim executed', async t => {
  const f = await fixture(t)
  f.revoke()
  const result = await f.approve()
  assert.equal(result.executionOutcome, 'not_executed')
  assert.equal(result.executed, false)
  assert.equal(result.task.attention.kind, 'tool_approval_expired')
  assert.equal(f.calls(), 0)
  const expired = await fixture(t)
  require('../src/lib/tool-execution-approval').discardToolExecutionApproval(expired.userData, expired.pending.draftId)
  const expiredResult = await expired.approve()
  assert.equal(expiredResult.code, 'approval_expired')
  assert.equal(expiredResult.task.attention.action, 'retry')
})

test('post-entry failure stays uncertain and exact invocation is never replayed on recovery', async t => {
  const f = await fixture(t, () => { throw new Error('connection lost after send') })
  const result = await f.approve()
  assert.equal(result.executionOutcome, 'uncertain')
  assert.equal(result.task.attention.kind, 'operation_status_unknown')
  assert.equal(result.resumeRequired, false)
  const recovery = await f.registry.execute('write', { target: '42' }, { ...f.ctx, runId: 'retry', executionApprovalRecoveryRunId: 'run' })
  assert.equal(recovery.code, 'operation_status_unknown')
  assert.equal(f.calls(), 1)
})

test('approved exact call reuses evidence within recovery, changed args/new independent run require fresh approval', async t => {
  const f = await fixture(t)
  await f.approve()
  const recoveryCtx = { ...f.ctx, runId: 'retry', executionApprovalRecoveryRunId: 'run' }
  const replay = await f.registry.execute('write', { target: '42' }, recoveryCtx)
  assert.equal(replay.ok, true)
  assert.equal(replay.executionStarted, false)
  assert.equal(replay.receipt.deduplicated, true)
  assert.equal(f.calls(), 1)
  assert.equal((await f.registry.execute('write', { target: '43' }, recoveryCtx)).code, 'approval_required')
  assert.equal((await f.registry.execute('write', { target: '42' }, { ...f.ctx, runId: 'independent' })).code, 'approval_required')
  f.revoke()
  assert.equal((await f.registry.execute('write', { target: '42' }, recoveryCtx)).code, 'scope_denied')
  assert.equal(f.calls(), 1)
})

test('recovery surface reads host receipts only and sanitizes stored evidence', async t => {
  const f = await fixture(t, () => ({ ok: true, text: 'Bearer secret-value password=secret-password', token: 'secret-token' }))
  await f.approve()
  const built = buildToolSurfaceFromRegistry(f.registry, { ...f.ctx, runId: 'retry', executionApprovalRecoveryRunId: 'run' })
  const receipts = await built.surface.getExecutionApprovalReceipts()
  assert.equal(receipts.length, 1)
  assert.doesNotMatch(JSON.stringify(receipts), /secret-value|secret-password|secret-token/)
  f.revoke()
  await assert.rejects(async () => built.surface.getExecutionApprovalReceipts())
})

test('consecutive approvals retain their host recovery lineage without replaying either operation', async t => {
  const f = await fixture(t)
  await f.approve()
  const secondCtx = { ...f.ctx, runId: 'run-two', executionApprovalRecoveryRunId: 'run' }
  const second = await f.registry.execute('write', { target: '43' }, secondCtx)
  assert.equal(second.code, 'approval_required')
  assert.equal((await runtime.approveToolDraft(f.userData, second.draftId, secondCtx)).ok, true)
  const receipts = listToolExecutionReceipts(f.userData, 'session', { runId: 'run-two' })
  assert.equal(receipts.length, 2)
  const thirdCtx = { ...f.ctx, runId: 'run-three', executionApprovalRecoveryRunId: 'run-two' }
  for (const target of ['42', '43']) {
    const replay = await f.registry.execute('write', { target }, thirdCtx)
    assert.equal(replay.ok, true)
    assert.equal(replay.executionStarted, false)
    assert.equal(replay.receipt.deduplicated, true)
  }
  assert.equal(f.calls(), 2)
  const { writeToolExecutionReceipt } = require('../src/lib/tool-execution-receipts')
  writeToolExecutionReceipt(f.userData, { ...second.draft, recoveryRunId: 'run-two' }, { ok: true }, 'executed')
  assert.throws(() => listToolExecutionReceipts(f.userData, 'session', { runId: 'run-two' }), /lineage/i)
  assert.equal((await f.registry.execute('write', { target: '42' }, thirdCtx)).code, 'operation_status_unknown')
  assert.equal(f.calls(), 2)
})

test('cold process has no callable approval closure and reports not executed', async t => {
  const f = await fixture(t)
  const { execFileSync } = require('node:child_process')
  const script = "require('./src/lib/connectors/tool-runtime').approveToolDraft(process.argv[1],process.argv[2]).then(result=>process.stdout.write(JSON.stringify(result)))"
  const result = JSON.parse(execFileSync(process.execPath,
    ['-r', './scripts/register-ts.js', '-e', script, f.userData, f.pending.draftId],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' }))
  assert.equal(result.code, 'approval_expired')
  assert.equal(result.executionStarted, false)
  assert.equal(f.calls(), 0)
  assert.equal(drafts.getDraft(f.userData, f.pending.draftId).status, 'failed')
})

test('HTTP approval shows host destination and bound sanitized parameters before effects', async t => {
  const f = await fixture(t)
  const connector = { id: 'api', type: 'http', enabled: true, agentVisible: true,
    http: { baseUrl: 'https://approved.invalid/api?token=configuration-secret', method: 'POST' } }
  const collected = await runtime.collectConnectorTools(f.userData, { includeMcp: false,
    connectorStore: { migrateLegacy() {}, loadConnectors: () => [connector] },
    fetchImpl: () => { throw new Error('no HTTP call before approval') } })
  for (const def of collected.definitions) f.registry.registerTool(def, def._knowme, collected.handlers[def.function.name])
  const pending = await f.registry.execute('connector_api_call', {
    path: '/records?token=query-secret', method: 'POST', body: 'record 42', headers: { Authorization: 'Bearer header-secret' },
  }, f.ctx)
  assert.equal(pending.draft.target, 'POST https://approved.invalid/records')
  assert.match(pending.preview, /record 42/)
  assert.doesNotMatch(JSON.stringify(pending.draft), /configuration-secret|query-secret|header-secret/)
  drafts.markDraft(f.userData, pending.draftId, { target: 'POST https://different.invalid/records' })
  assert.equal((await runtime.approveToolDraft(f.userData, pending.draftId, f.ctx)).code, 'approval_mismatch')
})
