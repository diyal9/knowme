const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')
const { capabilityDiscoveryScore } = require('../src/lib/agent-capability-search')
const { createCapabilityAccessService } = require('../src/lib/agent-capability-access')
const { createCapabilityExecutionCheck } = require('../src/lib/agent-capability-execution-check')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { buildToolSurfaceFromRegistry } = require('../src/lib/tool-surface-builder')
const { approveToolDraft } = require('../src/lib/connectors/tool-runtime')
const { resolveCapabilityApprovalCheckpoint } = require('../src/lib/agent-capability-approval-checkpoint')

test('knowledge hard scope intersection understands provider containment and collection aliases', () => {
  const scope = (refs, permissions) => resolveAgentCapabilityScope({
    session: { id: 's', knowledgeRefs: refs.map(id => ({ id })) }, permissions,
  })
  assert.deepEqual(scope(['rag:p:a'], { knowledge: { allowedKnowledgeIds: ['p'] } }).allowedKnowledgeIds, ['rag:p:a'])
  assert.deepEqual(scope(['p'], { knowledge: { allowedKnowledgeIds: ['rag:p:a'] } }).allowedKnowledgeIds, ['rag:p:a'])
  assert.deepEqual(scope(['ragflow:p:a'], { knowledge: { allowedKnowledgeIds: ['rag:p:a'] } }).allowedKnowledgeIds, ['rag:p:a'])
  assert.deepEqual(scope(['rag:p:a'], { knowledge: { allowedKnowledgeIds: ['rag:p:b'] } }).allowedKnowledgeIds, [])
  assert.deepEqual(scope(['rag:p:a'], { knowledge: { denylist: ['p'] } }).allowedKnowledgeIds, [])
  assert.deepEqual(scope(['rag:p:a'], { knowledge: { denylist: ['ragflow:p:a'] } }).allowedKnowledgeIds, [])
})

test('capability discovery matches Chinese phrases and English tokens, paginates and never falls back for zero matches', () => {
  const catalog = [
    { capabilityKind: 'connectors', id: 'feishu', name: '飞书', description: 'Read documents and collaboration materials' },
    { capabilityKind: 'skills', id: 'doc-review', name: '文档核对', description: 'Review documents using evidence' },
    { capabilityKind: 'skills', id: 'spreadsheet', name: '电子表格', description: 'Analyze spreadsheets' },
  ]
  const service = createCapabilityAccessService({ userData: '', getSession: () => ({ id: 's' }),
    getScope: () => ({ decision: () => ({ allowed: false, requestable: true }) }), getCatalog: () => catalog })
  assert.equal(service.discover({ query: '查找飞书文档能力' }).items[0].id, 'feishu')
  assert.equal(service.discover({ query: 'Feishu documents' }).items[0].id, 'feishu')
  const page = service.discover({ query: 'documents', limit: 1 })
  assert.equal(page.items.length, 1)
  assert.equal(page.nextOffset, 1)
  assert.equal(service.discover({ query: 'documents', offset: page.nextOffset, limit: 1 }).nextOffset, null)
  assert.deepEqual(service.discover({ query: '火星量子引擎' }).items, [])
  assert.equal(capabilityDiscoveryScore('quasar', catalog[0]), 0)
})

test('deferred registry approvals consume a fresh host scope check through the production builder context', async t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-scope-approval-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const session = { id: 's', expertId: 'expert', run: { id: 'run-a', status: 'running' } }
  const expertRuntime = { getSessionPersona: () => ({ ok: true, bindings: { connectors: ['feishu'] } }) }
  let connectors = [{ id: 'feishu', enabled: true }]
  let liveSession = session
  let calls = 0
  const getState = () => ({ scope: resolveAgentCapabilityScope({ session, expertRuntime }), governancePolicy: {} })
  const check = createCapabilityExecutionCheck({ session, runId: 'run-a', getSession: () => liveSession,
    getState, getConnectors: () => connectors })
  const registry = createRegistry()
  const contract = { source: 'connector', connectorId: 'feishu', capability: 'write-doc', risk: 'external',
    sideEffects: true, requiresApproval: true, scope: 'external', timeoutMs: 10000,
    idempotencySupported: false, rollbackSupported: false }
  registry.registerTool({ type: 'function', function: { name: 'send_doc', parameters: { type: 'object' } } }, contract,
    async () => { calls++; return { ok: true, text: 'sent' } })
  const { surface } = buildToolSurfaceFromRegistry(registry, { userData, runId: 'run-a', sessionId: 's', validateExecutionApproval: check })
  const executor = surface.createToolExecutor({})
  const pending = await executor.executeToolCall({ name: 'send_doc', arguments: '{}' })
  assert.equal(pending.requiresApproval, true)
  assert.equal(calls, 0)
  connectors = []
  const blocked = await approveToolDraft(userData, pending.draftId, { sessionId: 's' })
  assert.equal(blocked.ok, false)
  assert.equal(calls, 0)
  connectors = [{ id: 'feishu', enabled: true }]
  const next = await executor.executeToolCall({ name: 'send_doc', arguments: '{"title":"new"}' })
  assert.equal((await approveToolDraft(userData, next.draftId, { sessionId: 's' })).ok, true)
  assert.equal(calls, 1)
  liveSession = null
  const denied = check({ toolName: 'send_doc', contract, runId: 'run-a', sessionId: 's' })
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, 'session_identity_changed')
})

test('grant resolution only advances its exact approval checkpoint and preserves unrelated input requests', t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-scope-checkpoint-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const session = { id: 's', taskRef: { id: 'task' } }
  const task = { id: 'task', expertId: 'expert', execRef: { id: 's' }, status: 'needs_input', attention: { kind: 'missing_material', action: 'provide_input' } }
  const patches = []
  const deps = { getWorkbenchTaskStore: () => ({ get: () => ({ task }), update: (id, patch) => patches.push({ id, patch }) }) }
  const draft = { id: 'draft', meta: { taskId: 'task', agentId: 'expert' } }
  resolveCapabilityApprovalCheckpoint(userData, session, draft, deps)
  assert.equal(patches.length, 0)
  task.attention = { kind: 'approval_required', action: 'provide_input' }
  resolveCapabilityApprovalCheckpoint(userData, session, draft, deps)
  assert.equal(patches[0].patch.attention.kind, 'authorization_required')
  assert.equal(patches[0].patch.attention.action, 'open_capability')
  assert.deepEqual(Object.keys(patches[0].patch), ['attention'])
})
