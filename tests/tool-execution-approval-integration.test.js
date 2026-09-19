'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRegistry } = require('../src/lib/tool-contract-registry')
const { collectConnectorTools, approveToolDraft } = require('../src/lib/connectors/tool-runtime')
const { createCapabilityExecutionCheck } = require('../src/lib/agent-capability-execution-check')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')
const { recordTaskCapabilityGrant, revokeTaskCapabilityGrant } = require('../src/lib/agent-task-capability-grants')

async function setup(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-approval-integration-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const sessionFile = path.join(userData, 'session.json')
  const connectorFile = path.join(userData, 'connector.json')
  const initial = { id: 'session', expertId: 'expert', run: { id: 'run', status: 'running' } }
  fs.writeFileSync(sessionFile, JSON.stringify(initial))
  fs.writeFileSync(connectorFile, JSON.stringify({ id: 'api', type: 'http', enabled: true, agentVisible: true,
    http: { baseUrl: 'https://approved.invalid/api' } }))
  const getSession = () => JSON.parse(fs.readFileSync(sessionFile, 'utf8'))
  const getConnectors = () => [JSON.parse(fs.readFileSync(connectorFile, 'utf8'))]
  const grant = recordTaskCapabilityGrant(userData, initial, 'connectors', 'api', 'host-grant')
  const getState = () => ({
    scope: resolveAgentCapabilityScope({ userData, session: getSession(), expertSnapshot: { ok: true, bindings: { connectors: [] } } }),
    governancePolicy: { denylist: getSession()?.run?.permissions?.tools?.denylist || [] },
  })
  const validateExecutionApproval = createCapabilityExecutionCheck({ session: initial, runId: 'run', getSession, getState, getConnectors })
  let requests = 0
  const collected = await collectConnectorTools(userData, { includeMcp: false,
    connectorStore: { migrateLegacy() {}, loadConnectors: getConnectors },
    fetchImpl: async () => { requests++; return new Response('done') },
  })
  const registry = createRegistry()
  for (const def of collected.definitions) registry.registerTool(def, def._knowme, collected.handlers[def.function.name])
  const ctx = { userData, sessionId: initial.id, runId: initial.run.id, validateExecutionApproval }
  const pending = await registry.execute('connector_api_call', { path: '/write', method: 'POST', body: 'approved data' }, ctx)
  assert.equal(pending.code, 'approval_required')
  assert.equal(requests, 0)
  return { userData, initial, grant, sessionFile, connectorFile, getSession, getConnectors, ctx, pending, requests: () => requests }
}

for (const mutation of ['cancel', 'fail', 'delete-session', 'replace-run', 'change-agent', 'deny-tool', 'revoke-grant', 'disable-connector', 'change-target']) {
  test(`persisted ${mutation} after draft creation prevents approved HTTP effects`, async t => {
    const fixture = await setup(t)
    const session = fixture.getSession()
    const connector = fixture.getConnectors()[0]
    if (mutation === 'cancel') session.run.status = 'cancelled'
    if (mutation === 'fail') session.run.status = 'failed'
    if (mutation === 'replace-run') session.run.id = 'replacement'
    if (mutation === 'change-agent') session.expertId = 'someone-else'
    if (mutation === 'deny-tool') session.run.permissions = { tools: { denylist: ['connector_api_call'] } }
    if (mutation === 'revoke-grant') revokeTaskCapabilityGrant(fixture.userData, session, fixture.grant.id)
    if (mutation === 'disable-connector') connector.enabled = false
    if (mutation === 'change-target') connector.http.baseUrl = 'https://different.invalid/'
    fs.writeFileSync(fixture.sessionFile, JSON.stringify(mutation === 'delete-session' ? null : session))
    fs.writeFileSync(fixture.connectorFile, JSON.stringify(connector))
    const result = await approveToolDraft(fixture.userData, fixture.pending.draftId, fixture.ctx)
    assert.equal(result.ok, false)
    assert.equal(result.code, mutation === 'change-target' ? 'connector_configuration_changed' : 'scope_denied')
    assert.equal(fixture.requests(), 0)
  })
}

test('unchanged live scope approves exact call once through existing draft endpoint', async t => {
  const fixture = await setup(t)
  const result = await approveToolDraft(fixture.userData, fixture.pending.draftId, fixture.ctx)
  assert.equal(result.ok, true)
  assert.equal(result.requiresApproval, false)
  assert.equal(fixture.requests(), 1)
  assert.equal((await approveToolDraft(fixture.userData, fixture.pending.draftId, fixture.ctx)).ok, false)
  assert.equal(fixture.requests(), 1)
})
