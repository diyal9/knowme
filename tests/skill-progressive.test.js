'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { buildSkillTools, validateSkillToolCall } = require('../src/lib/agent-skill-tools')

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-progressive-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'skills', 'demo')
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: Demo\ndescription: Demo task\n${options.frontmatter || ''}\n---\n${options.body || 'Complete instructions.'}`)
  fs.writeFileSync(path.join(dir, 'references', 'guide.md'), options.resource || '参考材料😀'.repeat(10000))
  fs.writeFileSync(path.join(dir, 'scripts', 'run.js'), 'console.log(1)')
  if (options.manifest) fs.writeFileSync(path.join(dir, 'capability.manifest.json'), JSON.stringify({ schemaVersion: 2, id: 'demo', kind: 'skill', name: 'Demo', version: '1.0.0', ...options.manifest }))
  return { root, dir, runtime: createSkillRuntime({ capabilitiesRoot: root, ...options.deps }) }
}

test('activation carries complete instructions, grounding, execution and dependency metadata', async t => {
  const { runtime } = fixture(t, {
    frontmatter: 'requiredTools: [search_docs]\nrequiredEvidence:\n  - kind: tool_result\n    tool: search_docs\ncompletionConditions:\n  - type: tool_success\n    tool: search_docs',
    manifest: { dependencies: [{ id: 'docs', kind: 'connector', required: true }], permissions: { filesystem: ['read'] } },
  })
  const result = await buildSkillTools({ runtime }).handlers.load_skill({ skill_id: 'demo' })
  assert.equal(result.ok, true)
  assert.equal(result.truncated, false)
  assert.equal(result.activation.status, 'active')
  assert.equal(result.activation.complete, true)
  assert.equal(result.activation.invocation, 'model')
  assert.match(result.text, /Complete instructions\./)
  assert.match(result.text, /search_docs/)
  assert.deepEqual(result.executionContract.requiredTools, ['search_docs'])
  assert.deepEqual(result.groundingContract.requiredEvidence.map(rule => rule.tool), ['search_docs'])
  assert.equal(result.executionContract.completionConditions[0].tool, 'search_docs')
  assert.equal(result.dependencies[0].id, 'docs')
  assert.equal(result.activation.allowedConnectorIds, undefined)
})

test('L1 rejects truncation, zero budgets and metadata overflow without activation', async t => {
  const { runtime } = fixture(t, { body: 'x'.repeat(200), deps: { l1Budget: 80 } })
  for (const result of [runtime.loadSkillL1('demo'), runtime.loadSkillL1('demo', { maxChars: 0 }), await buildSkillTools({ runtime }).handlers.load_skill({ skill_id: 'demo' })]) {
    assert.equal(result.ok, false)
    assert.equal(result.code, 'skill_l1_budget_exceeded')
    assert.equal(result.activation, undefined)
    assert.match(result.message, /预算/)
  }
  const exact = fixture(t, { body: 'x'.repeat(80), deps: { l1Budget: 80 } })
  assert.equal(exact.runtime.loadSkillL1('demo').body.length, 80)
  const overflow = await buildSkillTools({ runtime: exact.runtime }).handlers.load_skill({ skill_id: 'demo' })
  assert.equal(overflow.code, 'skill_l1_budget_exceeded')
  assert.equal(overflow.activation, undefined)
})

test('invalid required grounding cannot activate even with readable body', async t => {
  const { runtime } = fixture(t, { frontmatter: 'requiredEvidence:\n  - kind: tool_result' })
  const result = await buildSkillTools({ runtime }).handlers.load_skill({ skill_id: 'demo' })
  assert.equal(result.code, 'invalid_grounding_contract')
  assert.equal(result.activation, undefined)
})

test('disable-model-invocation gates direct L1/L2/L3 but allows trusted explicit-user route', async t => {
  let runs = 0
  const { runtime } = fixture(t, { frontmatter: 'disable-model-invocation: true', deps: { runScript: async () => { runs++; return { ok: true } } } })
  const model = buildSkillTools({ runtime }).handlers
  assert.equal((await model.list_skills()).skills.length, 0)
  assert.equal(runtime.listSlashPickerItems().length, 1)
  const health = await runtime.checkSkill('demo')
  assert.equal(health.ok, true)
  assert.equal(health.activation, undefined)
  assert.equal(health.body, undefined)
  for (const result of [runtime.loadSkillL1('demo'), runtime.readSkillResource('demo', 'references/guide.md'), await runtime.runSkillScript('demo', 'scripts/run.js'), await model.load_skill({ skill_id: 'demo', invocation: 'explicit-user', explicitUserSkillIds: ['demo'] })]) {
    assert.equal(result.code, 'model_invocation_disabled')
    assert.equal(result.activation, undefined)
  }
  assert.equal(runs, 0)
  const explicit = buildSkillTools({ runtime, explicitUserSkillIds: ['demo'] }).handlers
  const loaded = await explicit.load_skill({ skill_id: 'demo' })
  assert.equal(loaded.activation.invocation, 'explicit-user')
  assert.equal((await explicit.read_skill_resource({ skill_id: 'demo', path: 'references/guide.md' })).ok, true)
  assert.equal((await explicit.run_skill_script({ skill_id: 'demo', script: 'scripts/run.js' })).ok, true)
  assert.equal(runs, 1)
  assert.equal(runtime.loadSkillL1('demo', { invocation: 'explicit-user', allowedIds: [] }).code, 'not_allowed')
})

test('existing tool surface observes allowed-ID revocation and install disable on every call', async t => {
  let enabled = true
  let allowed = ['demo']
  let calls = 0
  const { runtime } = fixture(t, { deps: { getInstallStore: () => ({ skills: { demo: { enabled } } }), runScript: async () => { calls++; return { ok: true } } } })
  const { handlers } = buildSkillTools({ runtime, getAllowedSkillIds: () => allowed })
  assert.equal((await handlers.load_skill({ skill_id: 'demo' })).ok, true)
  allowed = []
  assert.equal((await handlers.list_skills()).skills.length, 0)
  assert.equal((await handlers.load_skill({ skill_id: 'demo' })).code, 'not_allowed')
  assert.equal((await handlers.read_skill_resource({ skill_id: 'demo', path: 'references/guide.md' })).code, 'not_allowed')
  assert.equal((await handlers.run_skill_script({ skill_id: 'demo', script: 'scripts/run.js' })).code, 'not_allowed')
  allowed = null
  enabled = false
  assert.equal((await handlers.load_skill({ skill_id: 'demo' })).code, 'disabled')
  assert.equal(calls, 0)
})

test('resource pages are bounded, UTF-8 exact and terminate with a null continuation', t => {
  const source = '\uFEFF参考😀end'.repeat(200)
  const { runtime } = fixture(t, { resource: source })
  let offset = 0
  let joined = ''
  let count = 0
  do {
    const page = runtime.readSkillResource('demo', 'references/guide.md', { offset, maxBytes: 31 })
    assert.equal(page.ok, true)
    assert.ok(page.pagination.returnedBytes <= 31)
    assert.equal(Buffer.byteLength(page.content), page.pagination.returnedBytes)
    assert.equal(page.pagination.totalBytes, Buffer.byteLength(source))
    assert.ok(page.pagination.nextOffset === null || page.pagination.nextOffset > offset)
    joined += page.content
    offset = page.pagination.nextOffset
    assert.ok(++count < 1000)
  } while (offset !== null)
  assert.equal(joined, source)
  const eof = runtime.readSkillResource('demo', 'references/guide.md', { offset: Buffer.byteLength(source) })
  assert.equal(eof.content, '')
  assert.equal(eof.pagination.complete, true)
})

test('resource validator rejects unbounded, nonintegral and out-of-range pagination', t => {
  const { runtime } = fixture(t, { resource: '😀abc' })
  for (const maxBytes of [0, 3, -1, 32769, Infinity, 4.5, '20']) {
    assert.equal(runtime.readSkillResource('demo', 'references/guide.md', { maxBytes }).code, 'invalid_args')
    assert.equal(validateSkillToolCall('read_skill_resource', { skill_id: 'demo', path: 'references/guide.md', max_bytes: maxBytes }).ok, false)
  }
  for (const offset of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, 99]) assert.equal(runtime.readSkillResource('demo', 'references/guide.md', { offset }).code, 'invalid_args')
  assert.equal(runtime.readSkillResource('demo', 'references/guide.md', { offset: 1 }).ok, false)
})

test('resource tool exposes continuation both in text and structured metadata', async t => {
  const { runtime } = fixture(t)
  const result = await buildSkillTools({ runtime }).handlers.read_skill_resource({ skill_id: 'demo', path: 'references/guide.md', max_bytes: 32 })
  assert.equal(result.meta.pagination.complete, false)
  assert.match(result.text, new RegExp(`offset=${result.pagination.nextOffset}`))
})

test('shared runtime resolves linked/pack sources consistently and deduplicates source collisions', async t => {
  const { root, dir } = fixture(t)
  const linkedRoot = path.join(root, 'linked-repo')
  const linkedDir = path.join(linkedRoot, 'method')
  const packDir = path.join(root, 'pack', 'method')
  for (const target of [linkedDir, packDir]) {
    fs.mkdirSync(target, { recursive: true })
    fs.copyFileSync(path.join(dir, 'SKILL.md'), path.join(target, 'SKILL.md'))
  }
  const runtime = createSkillRuntime({ capabilitiesRoot: root, getInstallStore: () => ({ skills: { shared: { id: 'shared', linked: true, originRoot: linkedRoot, originPath: 'method' } } }), getPackSkillSources: () => [{ id: 'shared', dir: packDir }, { id: 'pack-only', dir: packDir }] })
  const { handlers } = buildSkillTools({ runtime })
  const list = (await handlers.list_skills()).skills
  assert.equal(list.filter(item => item.id === 'shared').length, 1)
  assert.equal(list.find(item => item.id === 'shared').source, 'linked-repo')
  assert.equal((await handlers.load_skill({ skill_id: 'shared' })).activation.source, 'linked-repo')
  assert.equal((await handlers.load_skill({ skill_id: 'pack-only' })).activation.source, 'pack')
})

test('all sources reject a references directory symlink escaping the package', t => {
  const { root, dir, runtime } = fixture(t)
  const outside = path.join(root, 'outside')
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(outside, 'secret.md'), 'secret')
  fs.symlinkSync(outside, path.join(dir, 'references', 'outside'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal(runtime.readSkillResource('demo', 'references/outside/secret.md').code, 'invalid_path')
})

test('shared source runtime keeps session sandbox runner and host permission authority', async t => {
  const { runtime } = fixture(t, { deps: { runScript: async () => { throw new Error('wrong runner') } } })
  let invoked
  const { handlers } = buildSkillTools({ runtime, runScript: async ctx => { invoked = ctx; return { ok: true, text: 'ran' } } })
  assert.equal((await handlers.run_skill_script({ skill_id: 'demo', script: 'scripts/run.js', permissions: { network: true } })).ok, true)
  assert.equal(invoked.skillId, 'demo')
})
