'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createCapabilitySessionContext } = require('../src/lib/capability-hub/session-context')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { resolveChildCapabilityState } = require('../src/lib/agent-child-capability-scope')
const { assembleCapabilityContext } = require('../src/lib/agent-context-assembly')
const productKnowledge = require('../src/lib/product-knowledge')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-fresh-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'capabilities', 'skills', 'method')
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts'))
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: Method\ndescription: User method\ndisable-model-invocation: true\n---\nComplete method')
  fs.writeFileSync(path.join(dir, 'references', 'guide.md'), 'Resource contents')
  fs.writeFileSync(path.join(dir, 'scripts', 'run.js'), 'console.log(1)')
  const file = path.join(root, 'sessions.json')
  const initial = { id: 's', taskRef: { id: 'task' }, run: { permissions: {} } }
  const save = session => fs.writeFileSync(file, JSON.stringify({ sessions: session ? [session] : [] }))
  const load = () => JSON.parse(fs.readFileSync(file, 'utf8'))
  save(initial)
  const runtime = createSkillRuntime({ capabilitiesRoot: path.join(root, 'capabilities') })
  const scriptCalls = []
  const deps = { getUserData: () => root, getKnowledgeDir: () => path.join(root, 'knowledge'),
    capabilitiesRoot: () => path.join(root, 'capabilities'), buildInstallStoreMap: () => ({}),
    skillRuntime: () => runtime, expertRuntime: () => ({}),
    getCurrentSession: id => load().sessions.find(session => session.id === id) || null,
    runSkillScriptInSandbox: async value => { scriptCalls.push(value); return { ok: true, text: 'ran' } },
  }
  return { root, initial, save, load, deps, scriptCalls }
}

async function assertAccess(tools, allowed) {
  assert.equal((await tools.handlers.list_skills()).skills.length, allowed ? 1 : 0)
  for (const [name, args] of [
    ['load_skill', { skill_id: 'method' }],
    ['read_skill_resource', { skill_id: 'method', path: 'references/guide.md' }],
  ]) {
    const result = await tools.handlers[name](args)
    assert.equal(result.ok, allowed, name)
    if (!allowed) { assert.equal(result.code, 'not_allowed', name); assert.equal(result.activation, undefined) }
  }
}

test('production hub rereads persisted sessions for existing L0/L1/L2 tools', async t => {
  const f = fixture(t)
  const hub = createCapabilityHubService({ getUserData: () => f.root, loadAgentStore: f.load })
  const captured = f.load().sessions[0]
  const tools = hub.buildSkillToolsForSession(captured, {}, { explicitUserSkillIds: ['method'] })
  await assertAccess(tools, true)
  f.save({ ...f.initial, run: { permissions: { allowedSkillIds: [] } } })
  assert.deepEqual(captured.run.permissions, {})
  await assertAccess(tools, false)
  f.save(f.initial)
  await assertAccess(tools, true)
  f.save({ ...f.initial, executionPolicy: 'no-tools' })
  await assertAccess(tools, false)
  f.save(null)
  await assertAccess(tools, false)
})

test('host lookup errors and task identity changes cannot reuse explicit Skill authority', async t => {
  const f = fixture(t)
  let broken = false
  const tools = createCapabilitySessionContext(f.deps).buildSkillToolsForSession(f.initial, {}, {
    explicitUserSkillIds: ['method'], getCurrentSession: () => {
      if (broken) throw new Error('store unreadable')
      return f.deps.getCurrentSession('s')
    },
  })
  await assertAccess(tools, true)
  broken = true
  await assertAccess(tools, false)
  broken = false
  f.save({ ...f.initial, taskRef: { id: 'new-task' } })
  await assertAccess(tools, false)
})

test('child persisted allow cannot bypass current parent scope or captured child ceiling', async t => {
  const f = fixture(t)
  let parent = { id: 'parent', run: { permissions: {} } }
  const captured = f.load().sessions[0]
  const tools = createCapabilitySessionContext(f.deps).buildSkillToolsForSession(captured, {}, {
    explicitUserSkillIds: ['method'],
    getCapabilityState: () => resolveChildCapabilityState({ parentSession: parent,
      childSession: f.deps.getCurrentSession('s'), expertRuntime: {}, userData: f.root }),
  })
  await assertAccess(tools, true)
  parent = { ...parent, capabilityPolicy: { skills: { denylist: ['method'] } } }
  await assertAccess(tools, false)
  parent = { id: 'parent', run: { permissions: {} } }
  captured.run.permissions.allowedSkillIds = []
  await assertAccess(tools, false)
  delete captured.run.permissions.allowedSkillIds
  await assertAccess(tools, true)
  parent = null
  await assertAccess(tools, false)
})

test('script sandbox permissions also refresh without widening the run ceiling', async t => {
  const f = fixture(t)
  const tools = createCapabilitySessionContext(f.deps).buildSkillToolsForSession(f.initial,
    { network: true, write: false }, { explicitUserSkillIds: ['method'] })
  f.save({ ...f.initial, run: { permissions: { network: false, write: true } } })
  const run = await tools.handlers.run_skill_script({ skill_id: 'method', script: 'scripts/run.js' })
  assert.equal(run.ok, true)
  assert.deepEqual(f.scriptCalls[0].permissions, { network: false, write: false })
  f.save(f.initial)
  await tools.handlers.run_skill_script({ skill_id: 'method', script: 'scripts/run.js' })
  assert.deepEqual(f.scriptCalls[1].permissions, { network: false, write: false })
  f.save({ ...f.initial, run: { permissions: { allowedSkillIds: [] } } })
  assert.equal((await tools.handlers.run_skill_script({ skill_id: 'method', script: 'scripts/run.js' })).code, 'not_allowed')
})

test('formal slash loads a complete knowledge concept without legacy context injection', t => {
  const f = fixture(t)
  const knowledgeDir = path.join(f.root, 'knowledge')
  const body = 'Full concept method. '.repeat(90) + 'END-OF-METHOD'
  const created = productKnowledge.createSkill(knowledgeDir, { title: 'Concept Method', slash: 'concept-method', body })
  assert.equal(created.ok, true)
  const runtime = createSkillRuntime({ capabilitiesRoot: path.join(f.root, 'capabilities'), knowledgeDir })
  const record = runtime.listSlashPickerItems().find(item => item.slash === 'concept-method')
  assert.equal(record.source, 'legacy-okf')
  const assembled = assembleCapabilityContext({ session: f.initial, prompt: '/concept-method',
    slashRefs: ['concept-method'], tier: 'retrieval', expertRuntime: {}, skillRuntime: runtime })
  assert.ok(assembled.skillL1Block.includes(body))
  assert.deepEqual(assembled.resolvedSlashIds, [record.id])
  const denied = assembleCapabilityContext({ session: { ...f.initial, run: { permissions: { allowedSkillIds: [] } } },
    prompt: '/concept-method', slashRefs: ['concept-method'], tier: 'retrieval', expertRuntime: {}, skillRuntime: runtime })
  assert.equal(denied.skillL1Block, '')
})
