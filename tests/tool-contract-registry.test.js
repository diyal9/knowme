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
  })

  it('registerTool stores tool and projects definitions', () => {
    const reg = registry.createRegistry()
    reg.registerTool({ function: { name: 'echo', description: 'd', parameters: { type: 'object', properties: {} } } }, baseContract, async () => ({ ok: true, text: 'ok' }))
    assert.equal(reg.has('echo'), true)
    assert.equal(reg.getDefinitions().length, 1)
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
})
