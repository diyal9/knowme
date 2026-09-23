'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { evaluateMatrix, scenarioOf, toMarkdown } = require('../scripts/expert-qualification-matrix')
const { selectExecutionRouteWithMatch } = require('../src/lib/expert-execution-profile')

test('qualification matrix maps lifecycle cases to required scenarios', () => {
  assert.equal(scenarioOf({ lifecycle: 'cancel_then_retry' }), 'retry')
  assert.equal(scenarioOf({ lifecycle: 'request_changes' }), 'revision')
  assert.equal(scenarioOf({ lifecycle: 'accept_then_reopen' }), 'reopen')
  assert.equal(scenarioOf({}), 'normal')
})

test('qualification matrix accepts expert and legacy expert field names', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-matrix-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'suites'), { recursive: true })
  fs.writeFileSync(path.join(root, 'suites', 'a.json'), JSON.stringify({ evals: [
    { id: 'A1', expertId: 'example', scenario: 'normal', assertions: ['one'] },
    { id: 'A2', expert: 'example', scenario: 'normal', assertions: ['two'] },
    { id: 'A3', expertId: 'example', scenario: 'edge', assertions: ['three'] },
    { id: 'A4', expertId: 'example', lifecycle: 'cancel_then_retry', assertions: ['four'] },
    { id: 'A5', expertId: 'example', lifecycle: 'request_changes', assertions: ['five'] },
    { id: 'A6', expertId: 'example', lifecycle: 'accept_then_reopen', assertions: ['six'] },
  ] }))
  const report = evaluateMatrix({ root, matrixDir: root, matrix: {
    requiredScenarios: { normal: 2, edge: 1, retry: 1, revision: 1, reopen: 1 },
    experts: [{ id: 'example', sourceSuites: ['suites/a.json'] }],
  } })
  assert.equal(report.complete, true)
  assert.equal(report.experts[0].state, 'ready_for_live_execution')
  assert.match(toMarkdown(report), /ready_for_live_execution/)
})

test('qualification matrix exposes missing lifecycle evidence instead of treating package tests as qualification', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-matrix-incomplete-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'suites'), { recursive: true })
  fs.writeFileSync(path.join(root, 'suites', 'a.json'), JSON.stringify({ evals: [
    { id: 'A1', expertId: 'example', scenario: 'normal', assertions: ['one'] },
  ] }))
  const report = evaluateMatrix({ root, matrixDir: root, matrix: {
    requiredScenarios: { normal: 2, edge: 1, retry: 1, revision: 1, reopen: 1 },
    experts: [{ id: 'example', sourceSuites: ['suites/a.json'] }, { id: 'missing', sourceSuites: [] }],
  } })
  assert.equal(report.complete, false)
  assert.deepEqual(report.incompleteExperts, 2)
  assert.match(report.experts[0].missingScenarios.join(','), /edge:1 missing/)
  assert.match(report.experts[1].missingScenarios.join(','), /normal:2 missing/)
})

test('qualification matrix audits the retained expert package contract when a catalog is present', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-matrix-contract-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const expertRoot = path.join(root, 'src', 'catalog', 'experts', 'example')
  const skillRoot = path.join(root, 'src', 'catalog', 'skills', 'example-skill')
  fs.mkdirSync(expertRoot, { recursive: true })
  fs.mkdirSync(skillRoot, { recursive: true })
  fs.writeFileSync(path.join(expertRoot, 'manifest.json'), JSON.stringify({ id: 'example', kind: 'expert', skills: ['missing-skill'] }))
  fs.writeFileSync(path.join(expertRoot, 'EXPERT.md'), 'skills:\n- missing-skill\ninputContract:\noutputContract:\nsop:\n')
  const report = evaluateMatrix({ root, matrixDir: root, matrix: {
    requiredScenarios: {},
    experts: [{ id: 'example', sourceSuites: [] }],
  } })
  assert.equal(report.complete, false)
  assert.equal(report.experts[0].state, 'insufficient_evidence')
  assert.match(report.experts[0].contract.errors.join(','), /skill missing-skill manifest not found/)
})

test('qualification matrix requires evidence for every conditional execution route', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-matrix-routes-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const expertRoot = path.join(root, 'src', 'catalog', 'experts', 'example')
  const skillRoot = path.join(root, 'src', 'catalog', 'skills', 'example-skill')
  fs.mkdirSync(expertRoot, { recursive: true })
  fs.mkdirSync(skillRoot, { recursive: true })
  fs.writeFileSync(path.join(expertRoot, 'manifest.json'), JSON.stringify({
    id: 'example', kind: 'expert', skills: ['example-skill'], connectors: [],
  }))
  fs.writeFileSync(path.join(expertRoot, 'EXPERT.md'), 'skills:\n- example-skill\ninputContract:\noutputContract:\nsop:\n')
  fs.writeFileSync(path.join(expertRoot, 'capability.manifest.json'), JSON.stringify({
    id: 'example',
    kind: 'expert',
    dependencies: [{ id: 'example-skill', kind: 'skill' }],
    metadata: {
      knowme: {
        execution: {
          deliverables: [{ id: 'answer', title: 'Answer', type: 'answer', required: true }],
          routes: [{ id: 'special-route', description: 'A route requiring the specialized skill.', requiredSkills: ['example-skill'] }],
        },
      },
    },
  }))
  fs.writeFileSync(path.join(skillRoot, 'capability.manifest.json'), JSON.stringify({ id: 'example-skill', kind: 'skill' }))
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), '# Example skill\n')
  fs.mkdirSync(path.join(root, 'suites'), { recursive: true })
  const suitePath = path.join(root, 'suites', 'a.json')
  fs.writeFileSync(suitePath, JSON.stringify({ evals: [
    { id: 'A1', expertId: 'example', scenario: 'normal', assertions: ['one'] },
  ] }))
  const matrix = {
    requiredScenarios: {},
    experts: [{ id: 'example', sourceSuites: ['suites/a.json'] }],
  }
  const incomplete = evaluateMatrix({ root, matrixDir: root, matrix })
  assert.equal(incomplete.complete, false)
  assert.deepEqual(incomplete.experts[0].missingRoutes, ['route:special-route missing'])

  fs.writeFileSync(suitePath, JSON.stringify({ evals: [
    { id: 'A1', expertId: 'example', scenario: 'normal', routeId: 'special-route', assertions: ['one'] },
  ] }))
  const complete = evaluateMatrix({ root, matrixDir: root, matrix })
  assert.equal(complete.complete, true)
  assert.deepEqual(complete.experts[0].coveredRouteIds, ['special-route'])
  assert.deepEqual(complete.experts[0].missingRoutes, [])
})

test('retained route qualification prompts select their declared catalog routes', () => {
  const root = path.join(__dirname, '..')
  const suiteDirs = [
    'rqa69-image-producer-qualification',
    'rqa76-image-producer-qualification',
    'rqa180-operations-data-analyst-qualification',
    'rqa181-agent-operations-qualification',
  ]
  for (const suiteDir of suiteDirs) {
    const suite = JSON.parse(fs.readFileSync(path.join(
      root, 'openspec', 'changes', 'production-qualify-all-experts', 'skill-evals', suiteDir, 'evals.json',
    ), 'utf8'))
    for (const item of suite.evals.filter(entry => entry.routeId)) {
      const manifest = JSON.parse(fs.readFileSync(path.join(
        root, 'src', 'catalog', 'experts', item.expertId, 'capability.manifest.json',
      ), 'utf8'))
      const execution = manifest.metadata?.knowme?.execution || {}
      const declaredRoute = execution.routes?.find(route => route.id === item.routeId)
      if (!declaredRoute) {
        const deliverableRoute = execution.deliverables?.find(deliverable => deliverable.executionRoute === item.routeId)
        assert.ok(deliverableRoute, `${item.id} should declare ${item.routeId} on a route or deliverable`)
        continue
      }
      const selected = selectExecutionRouteWithMatch(
        { expertId: item.expertId, goal: item.prompt, brief: {} },
        { capabilityManifest: manifest },
      )
      assert.equal(selected.route?.id, item.routeId, `${item.id} should select ${item.routeId}`)
      assert.equal(selected.match, 'keyword', `${item.id} should use an explicit keyword route`)
    }
  }
})
