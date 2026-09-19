'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { recordTaskCapabilityGrant, revokeTaskCapabilityGrant } = require('../src/lib/agent-task-capability-grants')

const handlers = new Map()
const originalLoad = Module._load
let registerCapabilityHubIpc
try {
  Module._load = function (id, ...args) {
    if (id === 'electron') return { ipcMain: { handle: (name, handler) => handlers.set(name, handler) } }
    return originalLoad.call(this, id, ...args)
  }
  ;({ registerCapabilityHubIpc } = require('../src/lib/capability-hub/ipc'))
} finally {
  Module._load = originalLoad
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-ipc-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'skills', 'user-only')
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: User method\ndescription: A user-only method\ndisable-model-invocation: true\nrequiredTools: [search_knowledge]\n---\nComplete instructions.')
  const resource = '甲😀abcd'.repeat(20)
  fs.writeFileSync(path.join(dir, 'references', 'guide.md'), resource)
  fs.writeFileSync(path.join(dir, 'scripts', 'run.js'), 'must use injected sandbox')
  const session = { id: 's', expertId: 'expert', taskRef: { id: 'task' }, run: { permissions: { network: false, write: false } } }
  const state = { sessions: [session], bound: ['user-only'], enabled: true, scriptCalls: [] }
  const runtime = createSkillRuntime({ capabilitiesRoot: root,
    getInstallStore: () => ({ skills: { 'user-only': { enabled: state.enabled } } }),
    runScript: async ctx => { state.scriptCalls.push(ctx); return { ok: true, text: 'sandbox result' } },
  })
  const deps = { getUserData: () => root, loadAgentStore: () => ({ sessions: state.sessions }),
    skillRuntime: () => runtime,
    expertRuntime: () => ({ getSessionPersona: () => ({ ok: true, bindings: { skills: state.bound } }) }),
  }
  handlers.clear()
  registerCapabilityHubIpc(deps)
  const invoke = (channel, payload = {}) => handlers.get(channel)({}, {
    skillId: 'user-only', sessionId: 's', path: 'references/guide.md', script: 'scripts/run.js', ...payload,
  })
  return { root, dir, session, state, runtime, deps, invoke, resource }
}

test('explicit host IPC rereads replaced persisted session authority on every access', async t => {
  const { state, session, invoke } = fixture(t)
  assert.equal((await invoke('skill-load')).activation.invocation, 'explicit-user')
  state.sessions = [{ ...session, run: { permissions: { allowedSkillIds: [] } } }]
  assert.equal(session.run.permissions.allowedSkillIds, undefined)
  for (const channel of ['skill-load', 'skill-check', 'skill-read-resource', 'skill-run-script', 'skill-package-file', 'skill-package-files']) {
    const result = await invoke(channel, { permissions: { allowedSkillIds: ['user-only'] }, invocation: 'explicit-user' })
    assert.equal(result.code, 'not_allowed', channel)
    assert.equal(result.activation, undefined)
  }
})

test('registered host IPC explicitly loads user-only Skills without changing model invocation', async t => {
  const { runtime, invoke } = fixture(t)
  assert.equal(runtime.loadSkillL1('user-only').code, 'model_invocation_disabled')
  const loaded = await invoke('skill-load')
  assert.equal(loaded.ok, true)
  assert.equal(loaded.activation.invocation, 'explicit-user')
  assert.equal(loaded.activation.complete, true)
  assert.equal(loaded.body, 'Complete instructions.')
  assert.deepEqual(loaded.executionContract.requiredTools, ['search_knowledge'])
  assert.equal((await invoke('skill-check')).ok, true)
  assert.equal(runtime.loadSkillL1('user-only').code, 'model_invocation_disabled')
  assert.equal((await invoke('skill-load', { sessionId: '' })).ok, true)
})

test('registered resource IPC forwards both pagination aliases and reconstructs full UTF-8 text', async t => {
  const { invoke, resource } = fixture(t)
  let offset = 0
  let reconstructed = ''
  do {
    const page = await invoke('skill-read-resource', { offset, max_bytes: 12 })
    assert.equal(page.ok, true)
    assert.ok(page.pagination.returnedBytes <= 12)
    reconstructed += page.content
    offset = page.pagination.nextOffset
  } while (offset !== null)
  assert.equal(reconstructed, resource)
  assert.equal((await invoke('skill-read-resource', { maxBytes: 16 })).pagination.returnedBytes <= 16, true)
  assert.equal((await invoke('skill-read-resource', { max_bytes: 32769 })).code, 'invalid_args')
  assert.equal((await invoke('skill-read-resource', { path: '../SKILL.md' })).code, 'invalid_path')
})

test('script IPC uses stored session permissions and never accepts payload permission escalation', async t => {
  const { invoke, state, session } = fixture(t)
  assert.equal((await invoke('skill-run-script', { permissions: { network: true, write: true, dangerous: true } })).ok, true)
  assert.deepEqual(state.scriptCalls[0].permissions, { network: false, write: false, dangerous: false })
  delete session.run
  await invoke('skill-run-script', { permissions: { network: true, write: true } })
  assert.deepEqual(state.scriptCalls[1].permissions, { network: false, write: false, dangerous: false })
  state.bound = []
  assert.equal((await invoke('skill-run-script')).code, 'not_allowed')
  assert.equal(state.scriptCalls.length, 2)
})

test('all Skill IPC reads and runs fail closed for missing, unknown or unreadable host sessions', async t => {
  const { invoke, deps } = fixture(t)
  const channels = ['skill-load', 'skill-check', 'skill-read-resource', 'skill-run-script', 'skill-package-file', 'skill-package-files']
  for (const channel of channels) assert.equal((await invoke(channel, { sessionId: 'missing' })).code, 'session_not_found')
  deps.loadAgentStore = undefined
  for (const channel of channels) assert.equal((await invoke(channel)).code, 'session_unavailable')
  deps.loadAgentStore = () => { throw new Error('unavailable') }
  for (const channel of channels) assert.equal((await invoke(channel)).code, 'session_unavailable')
  assert.equal(handlers.get('skill-load')({}, null).code, 'invalid_args')
})

test('host IPC rechecks deny/no-tools and ignores forged session scope overrides', async t => {
  const { invoke, session, state } = fixture(t)
  const channels = ['skill-load', 'skill-check', 'skill-read-resource', 'skill-run-script', 'skill-package-file', 'skill-package-files']
  for (const policy of [{ skills: { denylist: ['user-only'] } }, { allowedSkillIds: [] }]) {
    session.capabilityPolicy = policy
    for (const channel of channels) assert.equal((await invoke(channel, { skillId: '/user-only/', allowedIds: ['user-only'], session: {}, permissions: { allowedSkillIds: ['user-only'] } })).code, 'not_allowed')
  }
  session.capabilityPolicy = {}
  session.executionPolicy = 'no-tools'
  for (const channel of channels) assert.equal((await invoke(channel, { executionPolicy: 'tools' })).code, 'not_allowed')
  assert.equal(state.scriptCalls.length, 0)
})

test('registered IPC honors only host task grants and notices revocation, task switches and hard denies', async t => {
  const { root, invoke, session, state } = fixture(t)
  state.bound = []
  assert.equal((await invoke('skill-load', { capabilityGrants: [{ capabilityId: 'user-only', approvedBy: 'user' }] })).code, 'not_allowed')
  const grant = recordTaskCapabilityGrant(root, session, 'skills', 'user-only', 'host-approved-draft')
  assert.equal((await invoke('skill-load')).ok, true)
  assert.equal((await invoke('skill-read-resource')).ok, true)
  session.capabilityPolicy = { skills: { denylist: ['user-only'] } }
  assert.equal((await invoke('skill-load')).code, 'not_allowed')
  session.capabilityPolicy = {}
  revokeTaskCapabilityGrant(root, session, grant.id)
  assert.equal((await invoke('skill-load')).code, 'not_allowed')
  recordTaskCapabilityGrant(root, session, 'skills', 'user-only', 'second-host-draft')
  session.taskRef.id = 'different-task'
  assert.equal((await invoke('skill-load')).code, 'not_allowed')
})

test('explicit host activation retains enabled-state and complete L1 budget failures', async t => {
  const { invoke, state, dir } = fixture(t)
  state.enabled = false
  for (const channel of ['skill-load', 'skill-check', 'skill-read-resource', 'skill-run-script']) assert.equal((await invoke(channel)).code, 'disabled')
  state.enabled = true
  fs.appendFileSync(path.join(dir, 'SKILL.md'), 'x'.repeat(13000))
  const loaded = await invoke('skill-load', { maxChars: 999999 })
  assert.equal(loaded.code, 'skill_l1_budget_exceeded')
  assert.equal(loaded.activation, undefined)
})

test('Hub composition passes the host userData getter into IPC registration', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-ipc-composition-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const servicePath = require.resolve('../src/lib/capability-hub-service')
  const cached = require.cache[servicePath]
  let captured
  try {
    delete require.cache[servicePath]
    Module._load = function (id, ...args) {
      if (id === './capability-hub/ipc') return { IPC_CHANNELS: {}, registerCapabilityHubIpc: deps => { captured = deps } }
      return originalLoad.call(this, id, ...args)
    }
    const { createCapabilityHubService } = require(servicePath)
    createCapabilityHubService({ getUserData: () => root }).registerIpcHandlers()
    assert.equal(captured.getUserData(), root)
  } finally {
    Module._load = originalLoad
    delete require.cache[servicePath]
    if (cached) require.cache[servicePath] = cached
  }
})
