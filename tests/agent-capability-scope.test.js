const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')
const { recordTaskCapabilityGrant, revokeTaskCapabilityGrant, loadTaskCapabilityGrants } = require('../src/lib/agent-task-capability-grants')
const { createCapabilityAccessService, approveCapabilityAccessDraft, buildCapabilityAccessTools } = require('../src/lib/agent-capability-access')
const { guardCapabilityToolSurface } = require('../src/lib/agent-capability-surface-guard')
const { registerConnectorsIpc } = require('../src/ipc/connectors')
const { assembleCapabilityContext, buildSkillL1Block } = require('../src/lib/agent-context-assembly')
const { buildRunGovernancePolicy } = require('../src/lib/tool-surface-builder')
const drafts = require('../src/lib/tool-drafts-store')

function fixture(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-scope-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const session = { id: 'session-a', taskRef: { id: 'task-a' }, expertId: 'expert-a' }
  const snapshot = { ok: true, bindings: { skills: ['bound-skill'], connectors: ['bound-connector'] } }
  const expertRuntime = { getSessionPersona: () => snapshot }
  const catalog = [{ capabilityKind: 'connectors', id: 'feishu', name: '飞书', description: '读取协作资料' }]
  const deps = {
    app: { getPath: () => userData }, loadAgentSessions: () => [session],
    ensureCapabilityHub: () => ({ expertRuntime: () => expertRuntime, skillRuntime: () => ({ listSkillsL0: () => [] }) }),
    getConnectorsApi: () => ({ loadConnectors: () => catalog.map(item => ({ id: item.id, enabled: true })) }),
    resolveTestSeamOpts: payload => ({ clean: payload, seam: {} }), connectorToolRuntime: { getDraft: drafts.getDraft },
  }
  const scope = () => resolveAgentCapabilityScope({ session, expertRuntime, userData })
  const service = createCapabilityAccessService({ userData, getSession: () => session, getScope: scope, getCatalog: () => catalog })
  return { userData, session, snapshot, expertRuntime, catalog, deps, scope, service }
}

test('bindings are soft defaults; host grant extends only exact task and is revoked on fresh reads/restart', t => {
  const f = fixture(t)
  assert.deepEqual(f.scope().allowedConnectorIds, ['bound-connector'])
  assert.deepEqual(f.scope().decision('connectors', 'feishu'), { allowed: false, requestable: true, reason: 'unbound' })
  f.session.taskGrants = [{ capabilityKind: 'connectors', capabilityId: 'feishu', approvedBy: 'user' }]
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, false)
  const grant = recordTaskCapabilityGrant(f.userData, f.session, 'connectors', 'feishu', 'host-draft')
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, true)
  for (const session of [ { ...f.session, id: 'other' }, { ...f.session, taskRef: { id: 'other' } }, { ...f.session, expertId: 'other' } ]) {
    assert.equal(resolveAgentCapabilityScope({ session, userData: f.userData, expertRuntime: f.expertRuntime }).decision('connectors', 'feishu').allowed, false)
  }
  revokeTaskCapabilityGrant(f.userData, f.session, grant.id)
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, false)
  assert.ok(loadTaskCapabilityGrants(f.userData, f.session)[0].revokedAt)
})

test('grants cannot bypass hard allow/deny, org, parent, no-tools or missing expert', t => {
  const f = fixture(t)
  recordTaskCapabilityGrant(f.userData, f.session, 'connectors', 'feishu', 'host')
  for (const options of [
    { permissions: { connectors: { allowedConnectorIds: [] } } },
    { permissions: { capabilities: { connectors: { denylist: ['feishu'] } } } },
    { orgPolicy: { allowedConnectorIds: [] } }, { parentScope: { allowedConnectorIds: [] } },
    { executionPolicy: 'no-tools' }, { expertRuntime: { getSessionPersona: () => ({ ok: false }) } },
  ]) {
    const scope = resolveAgentCapabilityScope({ session: f.session, userData: f.userData, expertRuntime: f.expertRuntime, ...options })
    assert.equal(scope.decision('connectors', 'feishu').allowed, false)
    assert.equal(scope.decision('connectors', 'feishu').requestable, false)
  }
  const policy = buildRunGovernancePolicy({ capabilityScope: f.scope(), permissions: { tools: { denylist: ['feishu.read_doc'] } } })
  assert.ok(policy.denylist.includes('feishu.read_doc'))
})

test('same scope applies to skills and exact knowledge collection refs', t => {
  const f = fixture(t)
  f.session.knowledgeRefs = [{ id: 'rag:provider:dataset-a' }]
  assert.deepEqual(f.scope().allowedKnowledgeIds, ['rag:provider:dataset-a'])
  assert.equal(f.scope().decision('knowledge', 'rag:provider:dataset-b').allowed, false)
  recordTaskCapabilityGrant(f.userData, f.session, 'knowledge', 'rag:provider:dataset-b', 'host')
  recordTaskCapabilityGrant(f.userData, f.session, 'skills', 'extra-skill', 'host')
  assert.deepEqual(f.scope().allowedKnowledgeIds, ['rag:provider:dataset-a', 'rag:provider:dataset-b'])
  assert.deepEqual(f.scope().allowedSkillIds, ['bound-skill', 'extra-skill'])
})

test('discover and request never grant; real host IPC approval extends scope and IPC revoke removes it', async t => {
  const f = fixture(t)
  const discovery = f.service.discover({ query: '飞书' })
  assert.equal(discovery.items[0].requestable, true)
  const request = f.service.request({ kind: 'connectors', capability_id: 'feishu', reason: '本任务需要读文档', approved: true })
  assert.equal(request.requiresApproval, true)
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, false)
  const handlers = {}
  registerConnectorsIpc({ handle: (name, handler) => { handlers[name] = handler } }, f.deps)
  const approved = await handlers['tool-approve-draft']({}, { draftId: request.draftId, sessionId: f.session.id })
  assert.equal(approved.ok, true)
  assert.equal(approved.restartRequired, true)
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, true)
  assert.equal((await handlers['tool-approve-draft']({}, { draftId: request.draftId })).ok, false)
  assert.equal(handlers['task-capability-grants-list']({}, f.session.id).grants.length, 1)
  assert.equal(handlers['task-capability-grant-revoke']({}, { sessionId: 'other', grantId: approved.grantId }).ok, false)
  assert.equal(handlers['task-capability-grant-revoke']({}, { sessionId: f.session.id, grantId: approved.grantId }).ok, true)
  assert.equal(f.scope().decision('connectors', 'feishu').allowed, false)
})

test('approval rechecks current policy, availability and identity; rejected request never grants', t => {
  const f = fixture(t)
  const request = () => f.service.request({ kind: 'connectors', capability_id: 'feishu', reason: '需要资料' })
  const pending = request()
  f.session.executionPolicy = 'no-tools'
  assert.equal(approveCapabilityAccessDraft(f.userData, pending.draftId, f.deps).ok, false)
  delete f.session.executionPolicy
  f.session.taskRef.id = 'changed-task'
  assert.equal(approveCapabilityAccessDraft(f.userData, pending.draftId, f.deps).ok, false)
  f.session.taskRef.id = 'task-a'
  f.catalog.length = 0
  assert.equal(approveCapabilityAccessDraft(f.userData, pending.draftId, f.deps).ok, false)
  assert.equal(approveCapabilityAccessDraft(f.userData, pending.draftId, f.deps, { reject: true }).ok, true)
  assert.deepEqual(loadTaskCapabilityGrants(f.userData, f.session), [])
})

test('revocation removes catalog entries and rejects cached executor before dispatch', async t => {
  const f = fixture(t)
  const grant = recordTaskCapabilityGrant(f.userData, f.session, 'connectors', 'feishu', 'host')
  let calls = 0
  const def = { type: 'function', function: { name: 'feishu.read_doc' }, _knowme: { connectorId: 'feishu' } }
  const surface = guardCapabilityToolSurface({
    getToolRecords: () => [def], getToolDefinitions: () => [def], isAllowedTool: () => true,
    createToolExecutor: () => ({ executeToolCall: async () => { calls++; return { ok: true } } }),
  }, () => ({ scope: f.scope() }))
  const executor = surface.createToolExecutor({})
  assert.equal((await executor.executeToolCall({ name: 'feishu.read_doc' })).ok, true)
  revokeTaskCapabilityGrant(f.userData, f.session, grant.id)
  assert.deepEqual(surface.getToolRecords(), [])
  assert.equal((await executor.executeToolCall({ name: 'feishu.read_doc' })).executionStarted, false)
  assert.equal(calls, 1)
})

test('access tools expose only request, never a grant or approval handler', t => {
  const f = fixture(t)
  const tools = buildCapabilityAccessTools({ userData: f.userData, getSession: () => f.session, getScope: f.scope, getCatalog: () => f.catalog })
  assert.deepEqual(Object.keys(tools.handlers), ['discover_capabilities', 'request_capability_access'])
  assert.equal(tools.definitions[1].function.parameters.additionalProperties, false)
})

test('assembly filters bound/unbound and legacy skill context through same scope; full L1 never truncates', t => {
  const f = fixture(t)
  const loaded = []
  const runtime = {
    autoMatchSkills: () => [{ id: 'bound-skill' }, { id: 'unbound-skill' }],
    findSkillRecord: id => ({ id, name: id }),
    loadSkillL1: (id, opts) => { loaded.push({ id, invocation: opts.invocation }); return { ok: true, id, body: 'full method' } },
  }
  const result = assembleCapabilityContext({ session: f.session, expertRuntime: f.expertRuntime, skillRuntime: runtime,
    userData: f.userData, tier: 'agent', slashRefs: ['bound-skill', 'unbound-skill'], legacySkillContext: 'SECRET unbound legacy' })
  assert.deepEqual(loaded, [{ id: 'bound-skill', invocation: 'explicit-user' }])
  assert.equal(result.skillL0Block.includes('unbound-skill'), false)
  assert.equal(result.skillL1Block.includes('SECRET'), false)
  assert.throws(() => buildSkillL1Block([{ id: 'large', body: 'x'.repeat(9000) }]), { code: 'skill_l1_budget_exceeded' })
})
