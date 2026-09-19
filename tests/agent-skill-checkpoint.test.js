'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { normalizeSession } = require('../src/lib/agent-sessions')
const { readSkillActivationRefs, revalidateSkillActivations, MAX_RESOURCE_PAGES } = require('../src/lib/agent-run-executor/skill-checkpoint')

const def = name => ({ type: 'function', function: { name, description: name,
  parameters: { type: 'object', properties: {} } }, _knowme: { risk: 'read', sideEffects: false } })
const loaded = (hash = 'hash-v2') => ({ ok: true, text: 'COMPLETE_FRESH_SKILL_BODY',
  activation: { skillId: 'asset', contentHash: hash, status: 'active', complete: true },
  executionContract: { requiredTools: ['verify_asset'] } })
const call = (name, args = {}) => ({ response: { toolCalls: [{ name, arguments: args }] } })
const oldSession = () => ({ id: 'resume', messages: [], run: {}, skillActivationRefs: [{ skillId: 'asset', contentHash: 'hash-v1' }] })

function makePorts(script, session = oldSession()) {
  const fixture = { input: { prompt: 'load_skill then verify_asset and read_skill_resource', tier: 'assist' }, session,
    toolRecords: ['load_skill', 'verify_asset', 'read_skill_resource'].map(def), llmScript: script }
  const ports = createMockRunPorts(fixture)
  const complete = ports.llm.complete
  let index = 0
  ports.llm.complete = request => {
    for (const entry of script[index++]?.response?.toolCalls || []) {
      assert.ok(request.tools?.some(tool => tool.function.name === entry.name), `${entry.name} must have an offered schema`)
    }
    return complete(request)
  }
  return { ports, input: fixture.input }
}

test('serialized session checkpoint retains IDs/hash only and requires fresh activation before operation', async () => {
  const session = normalizeSession(JSON.parse(JSON.stringify(oldSession())))
  assert.deepEqual(session.skillActivationRefs, oldSession().skillActivationRefs)
  const { ports, input } = makePorts([call('verify_asset')], session)
  let effects = 0
  ports.tools.execute = async () => { effects++; return { ok: true, text: 'must not execute' } }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(effects, 0)
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.equal(result.attention.kind, 'skill_reactivation_required')
})

test('resume loads current hash and complete user instructions, then freshly revalidates before operation', async () => {
  const { ports, input } = makePorts([call('load_skill', { skill_id: 'asset' }), call('verify_asset'), { response: { text: 'Verified.' } }])
  const executed = []
  ports.tools.execute = async entry => { executed.push(entry.name); return entry.name === 'load_skill' ? loaded() : { ok: true, text: 'Verified asset' } }
  const checkpoints = []
  ports.session.checkpoint = async ({ session }) => checkpoints.push(JSON.parse(JSON.stringify(session)))
  const complete = ports.llm.complete
  ports.llm.complete = request => {
    if (executed.length) {
      assert.ok(request.messages.some(message => message.role === 'user' && message.content.includes('COMPLETE_FRESH_SKILL_BODY')))
      assert.ok(!request.messages.some(message => message.role === 'system' && message.content.includes('COMPLETE_FRESH_SKILL_BODY')))
    }
    return complete(request)
  }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.terminal, 'DONE', result.error)
  assert.deepEqual(executed, ['load_skill', 'load_skill', 'verify_asset'])
  assert.deepEqual(checkpoints[0].skillActivationRefs, [{ skillId: 'asset', contentHash: 'hash-v2' }])
  assert.doesNotMatch(JSON.stringify(checkpoints[0].skillActivationRefs), /COMPLETE|active|permission|contract/)
})

for (const reason of ['revoked', 'changed']) test(`fresh ${reason} activation blocks dependent tool even after earlier successful load`, async () => {
  const { ports, input } = makePorts([call('load_skill'), call('verify_asset')])
  let loads = 0
  let effects = 0
  ports.tools.execute = async entry => {
    if (entry.name !== 'load_skill') { effects++; return { ok: true, text: 'unexpected' } }
    return ++loads === 1 ? loaded() : reason === 'revoked' ? { ok: false, code: 'scope_denied' } : loaded('hash-v3')
  }
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(effects, 0)
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.equal(result.attention.kind, 'skill_reactivation_required')
})

test('resume cannot silently answer success without reactivating required skill', async () => {
  const { ports, input } = makePorts([{ response: { text: 'Everything is done.' } }])
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.equal(result.executionEvidence.gateStatus, 'blocked')
})

test('resource page count is bounded with explicit error before requesting another page', async () => {
  const script = Array.from({ length: MAX_RESOURCE_PAGES + 1 }, (_, offset) => call('read_skill_resource', { offset }))
  const { ports, input } = makePorts(script, { id: 'pages', messages: [], run: {} })
  let pages = 0
  ports.tools.execute = async () => { pages++; return { ok: true, text: 'Full page', pagination: { complete: false, nextOffset: pages } } }
  const build = ports.context.build
  ports.context.build = async () => ({ ...await build(), budget: { maxRounds: 16, maxToolCalls: 20 } })
  const result = await AgentRunExecutor.run(input, ports, () => {})
  assert.equal(pages, MAX_RESOURCE_PAGES)
  assert.equal(result.code, 'skill_context_budget_exceeded')
  assert.equal(result.terminal, 'ERROR')
})

test('malformed or overflowing activation refs fail closed, no fields confer authorization', async () => {
  assert.throws(() => readSkillActivationRefs(Array(17).fill({ skillId: 's', contentHash: 'h' })), /checkpoint/)
  assert.deepEqual(readSkillActivationRefs([{ skillId: 's', contentHash: 'h', permissions: ['all'], content: 'evil' }]), [{ skillId: 's', contentHash: 'h' }])
  let executed = false
  assert.equal((await revalidateSkillActivations([{ skillId: 's', contentHash: 'h' }], {
    validate: () => ({ ok: false }), execute: async () => { executed = true },
  })).ok, false)
  assert.equal(executed, false)
})
