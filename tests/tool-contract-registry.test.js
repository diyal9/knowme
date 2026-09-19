'use strict'

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const registry = require('../src/lib/tool-contract-registry')

const baseContract = {
  source: 'builtin',
  capability: 'test',
  risk: 'read',
  sideEffects: false,
  requiresApproval: false,
  scope: 'content-source',
  timeoutMs: 1000,
  idempotencySupported: false,
  rollbackSupported: false,
}

describe('tool-contract-registry', () => {
  it('validateContract rejects missing risk', () => {
    const r = registry.validateContract({ ...baseContract, risk: undefined })
    assert.equal(r.ok, false)
  })

  it('validateContract accepts valid contract', () => {
    assert.equal(registry.validateContract(baseContract).ok, true)
  })

  it('accepts user-data scope without treating a scope label as tool authorization', async () => {
    const contract = { ...baseContract, scope: 'user-data' }
    const reg = registry.createRegistry()
    let calls = 0
    const definition = { function: { name: 'read_user_asset', parameters: { type: 'object', properties: {} } } }
    assert.equal(reg.registerTool(definition, contract, async () => { calls += 1; return { ok: true } }).ok, true)
    assert.equal(registry.validateContract({ ...contract, scope: 'arbitrary-root' }).ok, false)
    for (const policy of [{ allowlist: [] }, { allowlist: ['read_user_asset'], denylist: ['read_user_asset'] }, { expertToolNames: [] }]) {
      assert.equal((await reg.execute('read_user_asset', {}, { governancePolicy: policy })).code, 'scope_denied')
    }
    assert.equal(calls, 0)
    assert.equal((await reg.execute('read_user_asset', {}, { governancePolicy: { allowlist: ['read_user_asset'] } })).ok, true)
    assert.equal(calls, 1)
  })

  it('registers actual import contracts and preserves explicit trust and ACL checks', async () => {
    const builder = require('../src/lib/tool-surface-builder')
    const { buildCapabilityImportTools } = require('../src/lib/agent-capability-import-tools')
    const calls = []
    const bundle = buildCapabilityImportTools({ hub: { importCursorRepository: async payload => {
      calls.push(payload); return { ok: true, counts: { installed: 1 } }
    } } })
    const reg = builder.buildV1Registry({ includeWrite: false, fileAdapter: {}, extraTools: bundle })
    assert.deepEqual(reg.getRegistrationIssues(), [])
    for (const def of bundle.definitions) assert.ok(reg.has(def.function.name))
    const ctx = { userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-import-registry-')),
      governancePolicy: { allowlist: ['import_external_project'] } }
    assert.equal(reg.get('import_external_project').contract.requiresApproval, true)
    assert.equal(reg.get('import_external_project').contract.sideEffects, true)
    assert.equal((await reg.execute('import_external_project', { plan_token: 'shown-plan', trust_confirmed: false }, ctx)).code, 'trust_required')
    assert.equal(calls.length, 0)
    assert.equal((await reg.execute('import_external_project', { plan_token: 'shown-plan', trust_confirmed: true },
      { ...ctx, governancePolicy: { allowlist: [] } })).code, 'scope_denied')
    assert.equal(calls.length, 0)
    const { createToolExecutionAuthorization } = require('../src/lib/tool-execution-approval')
    const untrustedArgs = { plan_token: 'shown-plan', trust_confirmed: false }
    assert.equal((await reg.execute('import_external_project', untrustedArgs, { ...ctx,
      executionAuthorization: createToolExecutionAuthorization(reg.get('import_external_project'), untrustedArgs, ctx) })).code, 'trust_required')
    const acceptedArgs = { plan_token: 'shown-plan', trust_confirmed: true }
    const accepted = await reg.execute('import_external_project', acceptedArgs, { ...ctx,
      executionAuthorization: createToolExecutionAuthorization(reg.get('import_external_project'), acceptedArgs, ctx) })
    assert.equal(accepted.ok, true)
    assert.equal(accepted.requiresApproval, false)
    assert.deepEqual(calls, [{ planToken: 'shown-plan', previewToken: '', trustConfirmed: true, riskConfirmed: true }])
  })

  it('createAuditId returns unique ids', () => {
    const a = registry.createAuditId()
    const b = registry.createAuditId()
    assert.notEqual(a, b)
    assert.match(a, /^audit_/)
  })

  it('wrapEnvelope includes auditId and preview', () => {
    const env = registry.wrapEnvelope({ ok: true, text: 'hello world' })
    assert.ok(env.auditId)
    assert.equal(env.preview, 'hello world')
    assert.equal(env.ok, true)
  })

  it('wrapEnvelope preserves failure code', () => {
    const env = registry.wrapEnvelope({ ok: false, code: 'scope_denied', text: 'denied' })
    assert.equal(env.code, 'scope_denied')
    assert.equal(env.ok, false)
  })

  it('validateArgsAgainstSchema checks required fields', () => {
    const schema = { required: ['query'], properties: { query: { type: 'string' } }, additionalProperties: false }
    assert.equal(registry.validateArgsAgainstSchema({}, schema).ok, false)
    assert.equal(registry.validateArgsAgainstSchema({ query: 'x' }, schema).ok, true)
  })

  it('validateArgsAgainstSchema rejects unknown properties when additionalProperties false', () => {
    const schema = { properties: { a: {} }, additionalProperties: false }
    const r = registry.validateArgsAgainstSchema({ a: 1, b: 2 }, schema)
    assert.equal(r.ok, false)
  })

  it('registerTool rejects missing name', () => {
    const reg = registry.createRegistry()
    const r = reg.registerTool({ function: {} }, baseContract, () => ({}))
    assert.equal(r.ok, false)
  })

  it('registerTool rejects invalid contract', () => {
    const reg = registry.createRegistry()
    const r = reg.registerTool({ function: { name: 't' } }, { source: 'bad' }, () => ({}))
    assert.equal(r.ok, false)
    assert.equal(reg.getRegistrationIssues()[0].code, 'invalid_contract')
  })

  it('accepts skill contracts and preserves registration diagnostics', () => {
    const reg = registry.createRegistry()
    const skillContract = { ...baseContract, source: 'skill', capability: 'skill-runtime' }
    assert.equal(reg.registerTool({ function: { name: 'load_skill' } }, skillContract, () => ({})).ok, true)
    assert.equal(reg.has('load_skill'), true)
    assert.deepEqual(reg.getRegistrationIssues(), [])
  })

  it('registerTool stores tool and projects definitions', () => {
    const reg = registry.createRegistry()
    reg.registerTool({ function: { name: 'echo', description: 'd', parameters: { type: 'object', properties: {} } } }, baseContract, async () => ({ ok: true, text: 'ok' }))
    assert.equal(reg.has('echo'), true)
    assert.equal(reg.getDefinitions().length, 1)
  })

  it('rejects duplicate tool names instead of silently replacing semantics', () => {
    const reg = registry.createRegistry()
    assert.equal(reg.registerTool({ function: { name: 'echo' } }, baseContract, () => ({ ok: true })).ok, true)
    const duplicate = reg.registerTool({ function: { name: 'echo' } }, { ...baseContract, capability: 'other' }, () => ({ ok: true }))
    assert.equal(duplicate.ok, false)
    assert.equal(duplicate.code, 'tool_conflict')
    assert.equal(reg.get('echo').contract.capability, 'test')
    assert.equal(reg.getRegistrationIssues()[0].code, 'tool_conflict')
  })

  it('validateToolCall returns unknown_tool for unregistered', () => {
    const reg = registry.createRegistry()
    const r = reg.validateToolCall('nope', '{}', registry.validateArgsAgainstSchema)
    assert.equal(r.ok, false)
    assert.equal(r.code, 'unknown_tool')
  })

  it('execute runs handler and wraps envelope', async () => {
    const reg = registry.createRegistry()
    reg.registerTool({ function: { name: 'echo', parameters: { type: 'object', properties: {} } } }, baseContract, async () => ({ ok: true, text: 'pong' }))
    const r = await reg.execute('echo', {})
    assert.equal(r.ok, true)
    assert.match(r.text, /pong/)
    assert.ok(r.auditId)
  })

  it('execute validates schema before handler', async () => {
    const reg = registry.createRegistry()
    let called = false
    reg.registerTool({ function: { name: 'need_q', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } } }, baseContract, async () => { called = true; return { ok: true, text: 'x' } })
    const r = await reg.execute('need_q', {})
    assert.equal(r.ok, false)
    assert.equal(called, false)
  })

  it('appendAuditLog writes jsonl line', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'))
    registry.appendAuditLog(dir, { auditId: 'a1', toolName: 'write_file', outcome: 'applied', target: 'a.txt' })
    const content = fs.readFileSync(path.join(dir, 'audit', 'tool-audit.jsonl'), 'utf8')
    assert.match(content, /write_file/)
    assert.match(content, /applied/)
  })

  it('isToolSurfaceV1 defaults true unless legacy', () => {
    const prev = process.env.KNOWME_TOOL_SURFACE
    delete process.env.KNOWME_TOOL_SURFACE
    assert.equal(registry.isToolSurfaceV1(), true)
    process.env.KNOWME_TOOL_SURFACE = 'legacy'
    assert.equal(registry.isToolSurfaceV1(), false)
    if (prev == null) delete process.env.KNOWME_TOOL_SURFACE
    else process.env.KNOWME_TOOL_SURFACE = prev
  })

  it('contractCoverage via builder helper', () => {
    const builder = require('../src/lib/tool-surface-builder')
    const reg = builder.buildV1Registry({ includeWrite: false, fileAdapter: {} })
    const report = builder.contractCoverageReport(reg)
    assert.equal(report.coverage, 1)
    assert.ok(report.total >= 3)
  })

  it('registers sandbox tools with complete contracts on the production surface', () => {
    const builder = require('../src/lib/tool-surface-builder')
    const sandbox = require('../src/lib/agent-sandbox')
    const reg = builder.buildV1Registry({
      includeWrite: false,
      fileAdapter: {},
      processTools: sandbox.buildSandboxTools({ workdir: '/tmp/knowme-test' }),
    })
    assert.equal(reg.get('run_python')?.contract.capability, 'process')
    assert.equal(reg.get('run_shell')?.contract.scope, 'sandbox')
    assert.deepEqual(reg.getRegistrationIssues(), [])
  })

  it('registers plan tools with a valid built-in contract', () => {
    const builder = require('../src/lib/tool-surface-builder')
    const plan = require('../src/lib/agent-plan-tools')
    const reg = builder.buildV1Registry({
      includeWrite: false,
      fileAdapter: {},
      extraTools: plan.buildPlanTools({}),
    })
    assert.equal(reg.get('update_plan')?.contract.capability, 'planning')
    assert.equal(reg.get('update_plan')?.contract.scope, 'ephemeral')
    assert.deepEqual(reg.getRegistrationIssues(), [])
  })
})
