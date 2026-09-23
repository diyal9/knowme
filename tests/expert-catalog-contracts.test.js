'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { createExpertRuntime, parseExpertFrontmatter, validateExpertPackage } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const executionProfile = require('../src/lib/expert-execution-profile')

const catalogRoot = path.join(__dirname, '..', 'src', 'catalog')
const expertsRoot = path.join(catalogRoot, 'experts')

function expertIds() {
  const catalog = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'catalog.json'), 'utf8'))
  return catalog.entries
    .filter(entry => entry.kind === 'expert')
    .map(entry => entry.id)
    .sort()
}

describe('bundled expert capability contracts', () => {
  it('ships business insight methods through the retained 数据靓仔 Agent', () => {
    const id = 'operations-data-analyst'
    const dir = path.join(expertsRoot, id)
    const source = fs.readFileSync(path.join(dir, 'EXPERT.md'), 'utf8')
    const parsed = parseExpertFrontmatter(source)
    const canonical = JSON.parse(fs.readFileSync(path.join(dir, 'capability.manifest.json'), 'utf8'))
    const legacy = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    const methods = ['business-metrics-analysis', 'business-cause-analysis', 'business-insight-report']
    assert.ok(methods.every(method => parsed.skills.includes(method)))
    assert.ok(methods.every(method => canonical.dependencies.some(dep => dep.kind === 'skill' && dep.id === method)))
    assert.ok(methods.every(method => legacy.skills.includes(method)))
    assert.equal(source.match(/^version:\s*(\S+)/m)?.[1], canonical.version)
    assert.equal(legacy.version, canonical.version)
    for (const skill of methods) {
      assert.ok(fs.existsSync(path.join(catalogRoot, 'skills', skill, 'SKILL.md')), `missing method: ${skill}`)
    }
    const report = fs.readFileSync(path.join(catalogRoot, 'skills/business-insight-report/SKILL.md'), 'utf8')
    const manifest = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'skills/business-insight-report/capability.manifest.json'), 'utf8'))
    assert.equal(report.match(/^version:\s*(\S+)/m)?.[1], manifest.version)
  })

  it('keeps every bundled expert structurally actionable through its SOP and required methods', () => {
    for (const id of expertIds()) {
      const source = fs.readFileSync(path.join(expertsRoot, id, 'EXPERT.md'), 'utf8')
      const expert = parseExpertFrontmatter(source)
      assert.ok((expert.useCases || []).length >= 2, `${id}: needs concrete use cases`)
      assert.ok((expert.boundaries || []).length >= 2, `${id}: needs explicit professional boundaries`)
      assert.ok((expert.inputContract || []).length >= 2, `${id}: needs an actionable input contract`)
      assert.ok((expert.outputContract || []).length >= 1, `${id}: needs an actionable output contract`)
      const sop = String(expert.sop || '').trim()
      assert.ok(sop, `${id}: missing SOP routing`)
      const canonical = JSON.parse(fs.readFileSync(path.join(expertsRoot, id, 'capability.manifest.json'), 'utf8'))
      const execution = canonical.metadata?.knowme?.execution || {}
      const requiredMethods = [...new Set([
        ...(execution.requiredSkills || []),
        ...executionProfile.declaredDeliverables({ capabilityManifest: canonical })
          .flatMap(item => item.requiredSkills || []),
      ])]
      const methodBodies = requiredMethods.map(method => {
        assert.match(method, /^[a-z0-9][a-z0-9-]*$/, `${id}: invalid method id`)
        assert.ok(expert.skills.includes(method), `${id}: required method missing from expert binding`)
        assert.ok(canonical.dependencies.some(dep => dep.kind === 'skill' && dep.id === method), `${id}: missing method dependency`)
        const methodSource = fs.readFileSync(path.join(catalogRoot, 'skills', method, 'SKILL.md'), 'utf8')
        const body = methodSource.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim()
        assert.ok(body, `${id}: empty required method`)
        return body
      })
      // Keep a minimal structural-content check, but do not force shared
      // method text to be duplicated in the persona. Optional/unloaded skills
      // do not count. Professional correctness requires separate real evals.
      assert.ok([sop, ...methodBodies].join('\n').length >= 220, `${id}: insufficient SOP and required method content`)
      assert.ok(String(expert.systemPrompt || '').trim().length >= 60, `${id}: system prompt is too thin`)
    }
  })

  it('gives every bundled expert a valid explicit v3 manifest and usable output contract', () => {
    const ids = expertIds()
    assert.equal(ids.length, 3)
    for (const id of ids) {
      const expertSource = fs.readFileSync(path.join(expertsRoot, id, 'EXPERT.md'), 'utf8')
      const parsedExpert = parseExpertFrontmatter(expertSource)
      const expertValidation = validateExpertPackage(parsedExpert)
      assert.equal(expertValidation.ok, true, `${id}: ${expertValidation.issues?.[0]?.message || 'invalid EXPERT.md'}`)

      const manifestPath = path.join(expertsRoot, id, 'capability.manifest.json')
      assert.equal(fs.existsSync(manifestPath), true, `${id}: missing capability.manifest.json`)
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      assert.equal(raw.schemaVersion, 3, `${id}: capability manifest must be v3`)
      const normalized = validateAndNormalizeManifest(raw, { id, kind: 'expert' })
      assert.equal(normalized.ok, true, `${id}: ${normalized.issues?.[0]?.message || 'invalid manifest'}`)
      assert.equal(normalized.manifest.id, id)
      assert.ok(normalized.manifest.inputs.length > 0, `${id}: inputs must be declared`)
      assert.ok(normalized.manifest.outputs.length > 0, `${id}: outputs must be declared`)

      const snapshot = { capabilityManifest: normalized.manifest }
      const deliverables = executionProfile.declaredDeliverables(snapshot)
      assert.ok(deliverables.length > 0, `${id}: executable deliverables must be declared`)
      for (const output of deliverables) {
        assert.ok(String(output.id || '').trim(), `${id}: deliverable id missing`)
        assert.ok(String(output.title || '').trim(), `${id}: deliverable title missing`)
        assert.ok(String(output.type || '').trim(), `${id}: deliverable type missing`)
        const hydrated = executionProfile.hydrateDeliverableContracts({ deliverables: [output] }, snapshot).deliverables[0]
        if (executionProfile.expectsArtifact(hydrated)) {
          assert.ok(hydrated.minArtifacts > 0, `${id}/${output.id}: file output must require an artifact`)
          assert.ok(hydrated.completionConditions.some(item => item.type === 'artifact_present'), `${id}/${output.id}: file output must gate completion on an artifact`)
        }
      }
    }
  })

  it('loads and freezes every bundled expert without falling back to a legacy capability manifest', () => {
    const runtime = createExpertRuntime({ capabilitiesRoot: catalogRoot })
    for (const id of expertIds()) {
      const loaded = runtime.loadExpert(id)
      assert.equal(loaded.ok, true, `${id}: ${loaded.message || 'load failed'}`)
      assert.notEqual(loaded.capabilityManifest?.metadata?.legacy, true, `${id}: legacy adapter still active`)
      const snapshot = runtime.createSessionSnapshot(`catalog-contract-${id}`, id)
      assert.equal(snapshot.ok, true, `${id}: ${snapshot.message || 'snapshot failed'}`)
      assert.equal(snapshot.snapshot.capabilityManifest.id, id)
    }
  })

  it('keeps normal platform execution free of concrete expert identity branches', () => {
    const genericFiles = [
      'src/lib/expert-task-runtime.ts',
      'src/lib/agent-run-executor/phases-model-tool.ts',
      'src/lib/agent-generate-tool-surface.ts',
      'src/renderer/features/expert/ExpertTaskRoom.tsx',
    ]
    for (const relative of genericFiles) {
      const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
      assert.doesNotMatch(source, /(?:image-producer|office-partner)/, `${relative}: concrete expert identity branch`)
    }
  })
})
