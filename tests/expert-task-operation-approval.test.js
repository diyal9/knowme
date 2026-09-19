const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { registerConnectorsIpc } = require('../src/ipc/connectors')
const connectorToolRuntime = require('../src/lib/connectors/tool-runtime')
const toolDraftsStore = require('../src/lib/tool-drafts-store')
const { discardToolExecutionApproval } = require('../src/lib/tool-execution-approval')
const { listToolExecutionReceipts } = require('../src/lib/tool-execution-receipts')
const { readExpertApprovalRecovery } = require('../src/lib/expert-task-approval-recovery')
const agentRun = require('../src/lib/agent-run')

async function operationFixture(t, outcome = { ok: true, text: '保存完成，结果编号 record-7' }) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-operation-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const taskFile = path.join(userData, 'tasks.json')
  const sessionFile = path.join(userData, 'sessions.json')
  const store = createStore(taskFile)
  const task = store.create({ kind: 'expert', expertId: 'expert', status: 'needs_input', goal: '保存批准的数据',
    brief: { goal: '保存批准的数据', deliverables: [{ id: 'answer', type: 'answer' }] },
    execRef: { kind: 'session', id: 'operation-session' } }).task
  const originalRunId = `original-${task.id}`
  const session = { id: task.execRef.id, expertId: task.expertId, taskRef: { id: task.id, kind: 'expert-task' },
    messages: [], run: { ...agentRun.createEmptyRun(), id: originalRunId, status: 'needs_input' } }
  fs.writeFileSync(sessionFile, JSON.stringify([session]))
  const registry = createRegistry()
  let effects = 0
  registry.registerTool({ function: { name: 'write', parameters: { type: 'object', properties: {} } } }, {
    source: 'connector', capability: 'fixture', risk: 'write', sideEffects: true, requiresApproval: true,
    scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false,
  }, async () => { effects++; return outcome })
  const args = { path: '/records/7', body: '批准的数据' }
  const ctx = { userData, sessionId: session.id, runId: originalRunId, validateExecutionApproval: async () => ({ ok: true }) }
  const pending = await registry.execute('write', args, ctx)
  store.update(task.id, { attention: { kind: 'approval_required', action: 'provide_input', draftId: pending.draftId, runId: originalRunId } })
  const requests = []
  const deps = {
    app: { getPath: () => userData }, getWorkbenchTaskStore: () => store,
    loadAgentSessions: () => JSON.parse(fs.readFileSync(sessionFile, 'utf8')),
    saveAgentSessions: sessions => fs.writeFileSync(sessionFile, JSON.stringify(sessions)),
    ensureAgentSession: () => { const sessions = deps.loadAgentSessions(); return { sessions, session: sessions[0] } },
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://fixture.invalid' }), normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
    connectorToolRuntime, toolDraftsStore, resolveTestSeamOpts: clean => ({ clean, seam: {} }), agentRun,
    runAgentGenerate: async (_deps, request) => {
      requests.push(request)
      const result = await registry.execute('write', args, { ...ctx, runId: request.runId,
        executionApprovalRecoveryRunId: request.executionApprovalRecoveryRunId })
      if (result.code === 'approval_required') return { text: '需要重新审批', attention: {
        kind: 'approval_required', action: 'provide_input', draftId: result.draftId, runId: request.runId,
      } }
      assert.equal(result.ok, true)
      return { text: result.text }
    },
  }
  const handles = new Map()
  registerConnectorsIpc({ handle: (name, handler) => handles.set(name, handler) }, deps)
  const runtime = createExpertTaskRuntime(deps)
  const approve = () => handles.get('tool-approve-draft')(null, { draftId: pending.draftId, sessionId: session.id })
  return { userData, taskFile, task, session, store, deps, runtime, pending, approve, requests, effects: () => effects }
}

test('operation IPC approval persists evidence, clears exact checkpoint, and cold resume reuses result without a second effect', async t => {
  const f = await operationFixture(t)
  assert.equal(f.runtime.retry(f.task.id).ok, false)
  const approved = await f.approve()
  assert.equal(approved.executed, true)
  assert.equal(approved.resumeRequired, true)
  assert.equal(approved.task.attention.kind, 'tool_execution_completed')
  assert.equal(approved.task.status, 'needs_input')
  assert.equal(f.effects(), 1)
  const cold = createStore(f.taskFile).get(f.task.id).task
  assert.equal(cold.executionEvidence[0].toolCalls[0].status, 'ok')
  assert.equal(cold.attention.draftId, f.pending.draftId)
  const reopenedRuntime = createExpertTaskRuntime(f.deps)
  assert.equal(reopenedRuntime.retry(f.task.id).ok, true)
  for (let i = 0; i < 200 && reopenedRuntime.controllers.has(f.task.id); i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].executionApprovalRecoveryRunId, f.session.run.id)
  assert.match(f.requests[0].prompt, /已批准并执行的操作/)
  assert.equal(f.effects(), 1)
  assert.notEqual(f.store.get(f.task.id).task.attention?.kind, 'approval_required')
  assert.equal(listToolExecutionReceipts(f.userData, f.session.id).length, 1)
})

test('expired approval never executes and releases only its exact checkpoint for a fresh approval', async t => {
  const f = await operationFixture(t)
  discardToolExecutionApproval(f.userData, f.pending.draftId)
  const result = await f.approve()
  assert.equal(result.code, 'approval_expired')
  assert.equal(result.executed, false)
  assert.equal(result.task.attention.kind, 'tool_approval_expired')
  assert.equal(f.effects(), 0)
  assert.equal(f.runtime.retry(f.task.id).ok, true)
  for (let i = 0; i < 200 && f.runtime.controllers.has(f.task.id); i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(f.effects(), 0)
  assert.equal(f.store.get(f.task.id).task.attention.kind, 'approval_required')
  assert.notEqual(f.store.get(f.task.id).task.attention.draftId, f.pending.draftId)
})

test('a persisted failed approval is restored as a safe retry instead of an un-actionable approval wait', async t => {
  const f = await operationFixture(t)
  f.deps.toolDraftsStore.finishApply(f.userData, f.pending.draftId, { failed: true })
  const restored = f.runtime.get(f.task.id)
  assert.equal(restored.ok, true)
  assert.equal(restored.task.attention.kind, 'tool_approval_expired')
  assert.equal(restored.task.attention.action, 'retry')
  assert.match(restored.task.attention.detail, /不会执行旧请求/)
  assert.equal(f.runtime.retry(f.task.id).ok, true)
  for (let i = 0; i < 200 && f.runtime.controllers.has(f.task.id); i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(f.effects(), 0)
  assert.equal(f.store.get(f.task.id).task.attention.kind, 'approval_required')
  assert.notEqual(f.store.get(f.task.id).task.attention.draftId, f.pending.draftId)
})

test('successful operation evidence does not clear a different pending input or draft', async t => {
  const f = await operationFixture(t)
  f.store.update(f.task.id, { attention: { kind: 'approval_required', action: 'provide_input', draftId: 'different-draft', runId: f.session.run.id } })
  const result = await f.approve()
  assert.equal(result.executed, true)
  assert.equal(result.resumeRequired, false)
  assert.equal(result.task.attention.draftId, 'different-draft')
  assert.equal(f.runtime.retry(f.task.id).ok, false)
})

test('missing receipt or failed recovery persistence never clears the completed checkpoint', async t => {
  const f = await operationFixture(t)
  await f.approve()
  f.deps.saveAgentSessions = () => { throw new Error('disk full') }
  assert.equal(f.runtime.retry(f.task.id).ok, false)
  assert.equal(f.store.get(f.task.id).task.attention.kind, 'tool_execution_completed')
  assert.equal(f.requests.length, 0)
  assert.equal(readExpertApprovalRecovery(f.deps, f.task, { ...f.session,
    expertTaskApprovalRecovery: { taskId: 'other-task', draftId: f.pending.draftId, runId: f.session.run.id } }).ok, false)
  f.store.update(f.task.id, { attention: { ...f.store.get(f.task.id).task.attention, draftId: 'missing-receipt' } })
  assert.equal(f.runtime.retry(f.task.id).ok, false)
  assert.equal(f.effects(), 1)
})

test('an uncertain operation remains blocked and cannot be retried as a failed read', async t => {
  const f = await operationFixture(t, { ok: false, code: 'operation_status_unknown', text: '响应中断', executionStarted: true })
  const result = await f.approve()
  assert.equal(result.task.attention.kind, 'operation_status_unknown')
  assert.equal(f.runtime.retry(f.task.id).ok, false)
  assert.equal(f.effects(), 1)
  assert.equal(f.requests.length, 0)
})
