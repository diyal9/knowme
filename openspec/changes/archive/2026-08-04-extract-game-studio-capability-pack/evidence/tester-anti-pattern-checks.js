'use strict'

/**
 * QA anti-pattern checks — extract-game-studio-capability-pack
 * Run: node openspec/changes/extract-game-studio-capability-pack/evidence/tester-anti-pattern-checks.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('node:assert/strict')
const { createCapabilityPackRuntime } = require('../../../../src/lib/capability-pack-runtime')
const { validatePackManifest } = require('../../../../src/lib/capability-pack-schema')
const gameStudio = require('../../../../src/lib/game-studio-scenes')
const {
  resolveScene,
  setPackRuntimeForTests,
} = require('../../../../src/lib/assistant-prompt-router')

const ROOT = path.join(__dirname, '../../../../')
const checks = []

function record(id, ok, detail) {
  checks.push({ id, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${id}: ${detail}`)
}

function tmpUserData(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `knowme-qa-${label}-`))
}

function writeInvalidPackDir(dir, manifest) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(manifest, null, 2))
}

// 1. Invalid manifest variants
;(() => {
  const cases = [
    { id: 'invalid-schema-version', manifest: { schemaVersion: 99, id: 'bad', version: '1.0.0', name: 'x', description: 'y' } },
    { id: 'invalid-semver', manifest: { schemaVersion: 1, id: 'bad-pack', version: 'not-semver', name: 'x', description: 'y' } },
    { id: 'missing-description', manifest: { schemaVersion: 1, id: 'bad-pack', version: '1.0.0', name: 'x' } },
    { id: 'invalid-id-kebab', manifest: { schemaVersion: 1, id: 'Bad_Pack', version: '1.0.0', name: 'x', description: 'y' } },
  ]
  for (const c of cases) {
    const result = validatePackManifest(c.manifest)
    record(`invalid-manifest/${c.id}`, result.ok === false, result.ok ? 'expected rejection' : `rejected: ${result.code || result.error}`)
  }
})()

// 2. Path traversal + directory import confinement
;(() => {
  const userData = tmpUserData('traversal')
  const rt = createCapabilityPackRuntime({ userData })
  rt.installPack('game-studio', 'bundled')
  const bad = rt.readPackFile('game-studio', '../../../package.json')
  record('path-traversal/readPackFile', bad.ok === false, bad.error || 'blocked')

  const evilDir = path.join(userData, 'evil-import')
  writeInvalidPackDir(evilDir, {
    schemaVersion: 1,
    id: 'evil-pack',
    version: '1.0.0',
    name: 'Evil',
    description: 'test',
    scenes: [{ id: 's1', label: 'S', emptyPrompt: 'p' }],
  })
  fs.writeFileSync(path.join(evilDir, 'secret.txt'), 'leak')
  const symlinkTarget = path.join(userData, 'outside-secret.txt')
  fs.writeFileSync(symlinkTarget, 'outside')
  try {
    fs.symlinkSync(symlinkTarget, path.join(evilDir, 'link.txt'))
  } catch {
    /* symlink may fail on some Windows configs */
  }
  const imported = rt.installFromDirectory(evilDir)
  record('third-party/installFromDirectory', imported.ok === true, imported.ok ? `installed ${imported.packId}` : imported.error)
  if (imported.ok) {
    const leak = rt.readPackFile('evil-pack', '../../../outside-secret.txt')
    record('path-traversal/imported-pack', leak.ok === false, leak.error || 'blocked')
  }
})()

// 3. Missing dependency conflict
;(() => {
  const userData = tmpUserData('deps')
  const rt = createCapabilityPackRuntime({
    userData,
    getAvailableCapabilityManifests: () => [],
  })
  const installed = rt.installPack('game-studio', 'installed')
  record(
    'dependency-missing/game-studio',
    installed.ok === false && installed.code === 'dependency_conflict',
    installed.ok ? 'should fail' : `${installed.code}: ${installed.error}`,
  )
})()

// 4. Legacy industry=game migration idempotent
;(() => {
  const userData = tmpUserData('legacy')
  const rt1 = createCapabilityPackRuntime({ userData })
  const first = rt1.migrateLegacyGameIndustry('game')
  const second = rt1.migrateLegacyGameIndustry('game')
  const storePath = path.join(userData, 'capability-packs', 'pack-store.json')
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  const packCount = Object.keys(store.packs || store.entries || store).filter(k => k === 'game-studio' || (store.packs && store.packs['game-studio'])).length
  const entries = store.packs || store.entries || store
  const gameEntries = typeof entries === 'object'
    ? Object.values(entries).filter(e => e && e.id === 'game-studio').length
      || (entries['game-studio'] ? 1 : 0)
    : 0
  const count = entries['game-studio'] ? 1 : gameEntries
  record(
    'legacy-migration/idempotent',
    first.ok === true && second.ok === true && rt1.isPackEnabled('game-studio') && count <= 1,
    `first=${first.ok} second=${second.ok} enabled=${rt1.isPackEnabled('game-studio')}`,
  )
  const noop = rt1.migrateLegacyGameIndustry('software')
  record('legacy-migration/non-game-skip', noop.ok === true && !rt1.discoverPacks().some(p => p.id === 'office-partner' && p.enabled), 'non-game does not enable extra packs')
})()

// 5. Enable/disable persistence across runtime restart
;(() => {
  const userData = tmpUserData('persist')
  const rt1 = createCapabilityPackRuntime({ userData })
  rt1.installPack('game-studio', 'bundled')
  rt1.enablePack('game-studio')
  assert.equal(rt1.isPackEnabled('game-studio'), true)
  rt1.disablePack('game-studio')
  assert.equal(rt1.isPackEnabled('game-studio'), false)

  const rt2 = createCapabilityPackRuntime({ userData })
  record('persistence/disable-survives-restart', rt2.isPackEnabled('game-studio') === false, `enabled=${rt2.isPackEnabled('game-studio')}`)

  rt2.enablePack('game-studio')
  const rt3 = createCapabilityPackRuntime({ userData })
  record('persistence/enable-survives-restart', rt3.isPackEnabled('game-studio') === true, `enabled=${rt3.isPackEnabled('game-studio')}`)
  record(
    'persistence/scenes-after-restart',
    rt3.listScenesForUi('game-studio').length === 4,
    `scenes=${rt3.listScenesForUi('game-studio').length}`,
  )
})()

// 6. Generic assistant not polluted by game-studio when pack disabled or non-game industry
;(() => {
  const userData = tmpUserData('generic')
  const rt = createCapabilityPackRuntime({ userData })
  setPackRuntimeForTests(rt)
  gameStudio.setPackRuntimeForTests(rt)

  // Pack NOT enabled — software user stays generic
  assert.equal(resolveScene({ industry: 'software', mode: 'general', tier: 'chat' }), 'assistant')
  assert.equal(resolveScene({ industry: 'general', mode: 'writing', tier: 'chat' }), 'writing')
  record('generic-routing/pack-disabled', true, 'software/general → assistant, writing unchanged')

  // Pack enabled but non-game industry — still no game scenes
  rt.installPack('game-studio', 'bundled')
  rt.enablePack('game-studio')
  assert.equal(gameStudio.resolveGameScene({ industry: 'software', mode: 'writing' }), null)
  assert.equal(resolveScene({ industry: 'software', mode: 'writing', tier: 'chat' }), 'writing')
  assert.equal(resolveScene({ industry: 'general', mode: 'coding', tier: 'chat' }), 'coding')
  record('generic-routing/pack-enabled-non-game', true, 'no game-design/dev leak for software/general industry')

  // Game industry routes only when pack enabled
  assert.equal(resolveScene({ industry: 'game', mode: 'writing', tier: 'chat' }), 'game-design')
  record('generic-routing/game-when-enabled', true, 'game industry routes to game-design as expected')
})()

// 7. Legacy session mode mapping without agentId rewrite
;(() => {
  const userData = tmpUserData('legacy-map')
  const rt = createCapabilityPackRuntime({ userData })
  rt.installPack('game-studio', 'bundled')
  gameStudio.setPackRuntimeForTests(rt)
  const mappings = [
    ['writing', 'game-design'],
    ['coding', 'game-dev'],
    ['general', 'game-production'],
    ['steward', 'game-knowledge'],
  ]
  let allOk = true
  for (const [mode, expected] of mappings) {
    const got = gameStudio.resolveGameScene({ industry: 'game', mode })
    if (got !== expected) {
      allOk = false
      console.log(`  mapping fail: ${mode} → ${got} (expected ${expected})`)
    }
  }
  record('legacy-session/mode-mapping', allOk, mappings.map(([m, e]) => `${m}→${e}`).join(', '))
})()

// 8. Third-party example-minimal without core branch
;(() => {
  const userData = tmpUserData('third')
  const rt = createCapabilityPackRuntime({ userData })
  const src = path.join(ROOT, 'src/packs/example-minimal')
  const installed = rt.installFromDirectory(src)
  const groups = rt.listEmptyStateGroups()
  record(
    'third-party/example-minimal',
    installed.ok && groups.some(g => g.packId === 'example-minimal'),
    installed.ok ? 'empty state group present' : installed.error,
  )
})()

const outPath = path.join(__dirname, 'tester-anti-pattern-checks.json')
const summary = {
  at: new Date().toISOString(),
  change: 'extract-game-studio-capability-pack',
  total: checks.length,
  pass: checks.filter(c => c.ok).length,
  fail: checks.filter(c => !c.ok).length,
  checks,
}
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log('\n---')
console.log(`QA anti-pattern: ${summary.pass}/${summary.total} PASS`)
if (summary.fail > 0) {
  process.exitCode = 1
}
