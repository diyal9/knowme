'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { createCapabilitySessionContext } = require('../src/lib/capability-hub/session-context')

test('session tools share pack sources, recheck binding/deny changes and use host sandbox permissions', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-session-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'pack-skill')
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: Pack\ndescription: Pack method\ndisable-model-invocation: true\n---\nFull pack instructions')
  fs.writeFileSync(path.join(dir, 'scripts', 'run.js'), 'console.log(1)')
  const runtime = createSkillRuntime({ capabilitiesRoot: root, getPackSkillSources: () => [{ id: 'pack-method', dir }] })
  const session = { id: 's', run: { permissions: {} } }
  let captured
  const ctx = createCapabilitySessionContext({
    getKnowledgeDir: () => root, capabilitiesRoot: () => root, getUserData: () => root,
    buildInstallStoreMap: () => ({}), skillRuntime: () => runtime, expertRuntime: () => ({}),
    runSkillScriptInSandbox: async value => { captured = value; return { ok: true, text: 'ran' } },
  })
  const hostPermissions = { network: false, write: false }
  const tools = ctx.buildSkillToolsForSession(session, hostPermissions, { explicitUserSkillIds: ['pack-method'] })
  assert.equal(tools.runtime, runtime)
  assert.equal((await tools.handlers.list_skills()).skills[0].source, 'pack')
  assert.equal((await tools.handlers.load_skill({ skill_id: 'pack-method' })).activation.invocation, 'explicit-user')
  const run = await tools.handlers.run_skill_script({ skill_id: 'pack-method', script: 'scripts/run.js', permissions: { network: true, write: true } })
  assert.equal(run.ok, true)
  assert.deepEqual(captured.permissions, hostPermissions)
  session.capabilityPolicy = { skills: { denylist: ['pack-method'] }, connectors: { denylist: ['secret'] } }
  assert.equal((await tools.handlers.list_skills()).skills.length, 0)
  for (const id of ['pack-method', '/pack-method/']) assert.equal((await tools.handlers.load_skill({ skill_id: id })).code, 'not_allowed')
  assert.deepEqual(ctx.filterConnectorsForSession(session, [{ id: 'secret' }, { id: 'public' }]), [{ id: 'public' }])
  session.capabilityPolicy = {}
  assert.equal((await tools.handlers.load_skill({ skill_id: 'pack-method' })).ok, true)
  session.executionPolicy = 'no-tools'
  assert.equal((await tools.handlers.load_skill({ skill_id: 'pack-method' })).code, 'not_allowed')
})

test('resources reject absolute paths and scripts cannot escape through a symlinked scripts directory', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-path-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'skills', 'method')
  const outside = path.join(root, 'outside')
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true })
  fs.mkdirSync(outside)
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: Method\ndescription: method\n---\nInstructions')
  fs.writeFileSync(path.join(dir, 'references', 'guide.md'), 'guide')
  fs.writeFileSync(path.join(outside, 'run.js'), 'console.log(1)')
  fs.symlinkSync(outside, path.join(dir, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir')
  let ran = false
  const runtime = createSkillRuntime({ capabilitiesRoot: root, runScript: async () => { ran = true; return { ok: true } } })
  for (const resource of ['/references/guide.md', 'C:references/guide.md', '//server/references/guide.md']) {
    assert.equal(runtime.readSkillResource('method', resource).code, 'invalid_path')
  }
  assert.equal((await runtime.runSkillScript('method', 'scripts/run.js')).code, 'invalid_path')
  assert.equal(ran, false)
})
