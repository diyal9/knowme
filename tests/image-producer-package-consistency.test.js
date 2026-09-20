'use strict'

// RQA26 structural contracts only: no installed profile, model or visual QA.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { parseExpertFrontmatter } = require('../src/lib/expert-runtime')

const root = path.join(__dirname, '../src/catalog')
const directory = path.join(root, 'experts/image-producer')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

const { createExpertRuntime, validateExpertPackage } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const profile = require('../src/lib/expert-execution-profile')
const generationSkills = ['th-art-intake', 'th-art-prompt-enrich', 'th-art-pango-generate']
const requiredSkills = ['creative-concept-method', 'visual-brief-prompt', ...generationSkills]
const skills = [...requiredSkills, 'writing-polish']
const connectors = ['pango-image-mcp']
const optionalConnectors = ['photoshop-mcp']
const allConnectors = [...connectors, ...optionalConnectors]
const permissions = {
  connectors: { allowedConnectorIds: allConnectors },
  tools: { allowlist: ['list_paint_models', 'generate_image'] },
  network: true, write: true, externalWrite: false,
}

function packageContracts() {
  const runtime = createExpertRuntime({ capabilitiesRoot: root })
  const loaded = runtime.loadExpert('image-producer')
  assert.equal(loaded.ok, true, loaded.error)
  return { loaded, canonical: readJson(path.join(directory, 'capability.manifest.json')),
    legacy: readJson(path.join(directory, 'manifest.json')) }
}

function assertImageContract(spec) {
  assert.equal(spec.id, 'generated-image')
  assert.equal(spec.title, '生成图片')
  assert.equal(spec.type, 'image')
  assert.equal(spec.required, true)
  assert.deepEqual([...spec.requiredSkills].sort(), [...generationSkills].sort())
  assert.deepEqual(spec.requiredTools, ['generate_image'])
  assert.deepEqual(spec.requiredEvidence, [{ kind: 'tool_result', tool: 'generate_image' }])
  assert.deepEqual(spec.requiredArtifacts, [{ type: 'image' }])
  assert.equal(spec.minArtifacts, 1)
  assert.deepEqual(spec.completionConditions, [
    { type: 'tool_success', tool: 'generate_image' }, { type: 'artifact_present' },
  ])
  assert.deepEqual(spec.requiredConnectorIds || [], ['pango-image-mcp'], 'the image route must declare its required provider')
  assert.equal(profile.expectsArtifact(spec), true)
}

it('RQA26 image-producer EXPERT, legacy, canonical and catalog versions agree at 4.0.2', () => {
  const expert = parseExpertFrontmatter(fs.readFileSync(path.join(directory, 'EXPERT.md'), 'utf8'))
  assert.equal(expert.ok, true)
  const entries = readJson(path.join(root, 'catalog.json')).entries
    .filter(entry => entry.id === 'image-producer' && entry.kind === 'expert')
  assert.equal(entries.length, 1)
  assert.deepEqual({
    expert: expert.frontmatter.version,
    legacy: readJson(path.join(directory, 'manifest.json')).version,
    canonical: readJson(path.join(directory, 'capability.manifest.json')).version,
    catalog: entries[0].version,
  }, { expert: '4.0.2', legacy: '4.0.2', canonical: '4.0.2', catalog: '4.0.2' })
})

it('RQA26 actual expert and canonical packages pass their real validators', () => {
  const parsed = parseExpertFrontmatter(fs.readFileSync(path.join(directory, 'EXPERT.md'), 'utf8'))
  assert.equal(validateExpertPackage(parsed).ok, true)
  const { loaded, canonical } = packageContracts()
  const normalized = validateAndNormalizeManifest(canonical, { id: 'image-producer', kind: 'expert' })
  assert.equal(normalized.ok, true)
  assert.equal(loaded.capabilityManifest.id, 'image-producer')
  assert.equal(loaded.capabilityManifest.kind, 'expert')
  assert.deepEqual(loaded.capabilityManifest.metadata.knowme.execution, canonical.metadata.knowme.execution)
})

it('RQA26 visual planning, generation skills and optional bindings stay aligned', () => {
  const { loaded, canonical, legacy } = packageContracts()
  assert.deepEqual(loaded.skills, skills)
  assert.deepEqual(legacy.skills, skills)
  assert.deepEqual(loaded.connectors, connectors)
  assert.deepEqual(loaded.optionalConnectors, optionalConnectors)
  assert.deepEqual(legacy.connectors, connectors)
  assert.deepEqual(legacy.optionalConnectors, optionalConnectors)
  for (const manifest of [canonical, loaded.capabilityManifest]) {
    assert.deepEqual(manifest.dependencies, [
      ...requiredSkills.map(id => ({ id, kind: 'skill', required: true })),
      { id: 'writing-polish', kind: 'skill', required: false },
       { id: 'pango-image-mcp', kind: 'connector', required: true },
       { id: 'photoshop-mcp', kind: 'connector', required: false },
    ])
    assert.deepEqual(profile.requiredDependencyIds({ capabilityManifest: manifest }, 'skill'), requiredSkills)
    assert.deepEqual(profile.requiredDependencyIds({ capabilityManifest: manifest }, 'connector'), ['pango-image-mcp'])
  }
})

it('RQA26 raw and loaded permissions preserve the pre-change authority without expansion', () => {
  const { loaded, canonical } = packageContracts()
  assert.deepEqual(canonical.permissions, permissions)
  assert.deepEqual(loaded.capabilityManifest.permissions, permissions)
})

for (const [scenario, brief, history] of [
  ['default', { goal: '生成图片' }, []],
  ['confirmed image output', { goal: '生成图片', deliverables: [
    { id: 'generated-image', title: '生成图片', type: 'image', required: true },
  ] }, []],
  ['revision', { goal: '修改已生成图片' }, [
    { deliverableId: 'generated-image', acceptanceStatus: 'changes_requested' },
  ]],
]) {
  it(`RQA26 ${scenario}: real output selection retains image, tool and evidence obligations`, () => {
    const { loaded, canonical } = packageContracts()
    for (const manifest of [canonical, loaded.capabilityManifest]) {
      const snapshot = { capabilityManifest: manifest }
      assert.equal(profile.executionMetadata(snapshot).strategy, 'confirm-then-generate')
      const declared = profile.declaredDeliverables(snapshot)
      assert.equal(declared.length, 1)
      assertImageContract(declared[0])
      const before = JSON.stringify({ snapshot, brief, history })
      assertImageContract(profile.resolveOutputSpec({ brief, deliverables: history }, snapshot))
      assert.equal(JSON.stringify({ snapshot, brief, history }), before)
    }
  })
}
