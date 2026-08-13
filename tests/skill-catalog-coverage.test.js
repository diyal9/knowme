'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { listOfficialWorkflowPackages } = require('../src/lib/official-workflows')
const { SIDECAR_FILE } = require('../src/lib/capability-manifest-v2')

const ROOT = path.join(__dirname, '..')
const CATALOG_SKILLS = path.join(ROOT, 'src', 'catalog', 'skills')

const GAME_SKILL_IDS = [
  'game-requirement-doc',
  'game-dev-delivery',
  'game-qa-acceptance',
  'game-production',
]

describe('skill catalog coverage', () => {
  it('game-* skills ship capability sidecars', () => {
    for (const id of GAME_SKILL_IDS) {
      const sidecar = path.join(CATALOG_SKILLS, id, SIDECAR_FILE)
      assert.ok(fs.existsSync(sidecar), `${id} missing sidecar`)
      const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8'))
      assert.equal(parsed.id, id)
      assert.equal(parsed.schemaVersion, 2)
    }
  })

  it('enabled packs load writing-polish, code-review, knowledge-steward', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-load-'))
    const packRt = createCapabilityPackRuntime({ userData: tmpDir })
    packRt.ensureDefaultPacks()

    const runtime = createSkillRuntime({
      capabilitiesRoot: path.join(tmpDir, 'capabilities'),
      knowledgeDir: path.join(tmpDir, 'knowledge'),
      getInstallStore: () => ({ skills: {} }),
      getPackSkillSources: () => packRt.listSkillSources(),
    })

    for (const skillId of ['writing-polish', 'code-review', 'knowledge-steward']) {
      const loaded = runtime.loadSkillL1(skillId)
      assert.equal(loaded.ok, true, `${skillId}: ${loaded.message || loaded.code}`)
    }
  })

  it('official visual workflow references bundled visual-brief-prompt', () => {
    const visual = listOfficialWorkflowPackages().find(p => p.id === 'official-visual-brief-review')
    assert.ok(visual)
    const refs = visual.skillRefs.map(r => r.id)
    assert.ok(refs.includes('writing-polish'))
    assert.ok(refs.includes('visual-brief-prompt'))
    assert.ok(!refs.some(id => id.includes('th-art')))
  })

  it('official engineering workflow references code-review', () => {
    const eng = listOfficialWorkflowPackages().find(p => p.id === 'official-engineering-team-delivery')
    assert.ok(eng)
    assert.ok(eng.skillRefs.some(r => r.id === 'code-review'))
  })
})
