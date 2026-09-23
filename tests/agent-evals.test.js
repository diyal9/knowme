'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { evaluateAgents, scoreRuntimeTasks, toMarkdown } = require('./lib/agent-evals')

test('AgentEvals scores only the focused production expert roster', () => {
  const root = path.join(__dirname, '..')
  const governance = JSON.parse(fs.readFileSync(path.join(
    root, 'openspec', 'changes', 'production-qualify-all-experts', 'expert-portfolio-governance.json',
  ), 'utf8'))
  const retainedIds = governance.entries
    .filter(item => item.disposition === 'keep')
    .map(item => item.id)
    .sort()
  const report = evaluateAgents({
    expertsRoot: path.join(root, 'src', 'catalog', 'experts'),
    catalogPath: path.join(root, 'src', 'catalog', 'catalog.json'),
  })
  assert.equal(report.total, retainedIds.length)
  assert.deepEqual(report.agents.map(item => item.agentId).sort(), retainedIds)
  assert.equal(report.agents.some(item => item.agentId === 'developer'), false)
  assert.equal(report.agents.some(item => item.agentId === 'business-insight-analyst'), false)
  assert.equal(report.legacyAgents.some(item => item.agentId === 'business-insight-analyst'), false)
  assert.equal(report.portfolioSummary.legacyPackages, 0)
  assert.equal(report.portfolioSummary.legacyPackagesInstalled, 0)
  assert.ok(report.agents.every(item => item.designScore >= 0 && item.designScore <= 100))
  assert.ok(report.agents.every(item => item.overallScore === null))
  assert.ok(report.agents.every(item => item.qualification.state === 'unverified'))
  assert.ok(report.agents.every(item => item.expertTitle.state === 'pending_evidence' && item.expertTitle.eligible === false))
  assert.deepEqual(report.expertTitleSummary, { eligible: 0, notEligible: 0, pendingEvidence: report.total })
  assert.equal(report.agents.find(item => item.agentId === 'image-producer')?.dimensions.skills, 100)
  assert.equal(report.agents.find(item => item.agentId === 'agent-operations')?.dimensions.skills, 100)
  assert.equal(report.averageOverallScore, null)
  assert.equal(report.version, '3.2.0')
})

test('AgentEvals treats catalog entries without lifecycle metadata as active', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-evals-active-default-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const expertsRoot = path.join(root, 'experts')
  const expertRoot = path.join(expertsRoot, 'custom-expert')
  fs.mkdirSync(expertRoot, { recursive: true })
  fs.writeFileSync(path.join(expertRoot, 'EXPERT.md'), [
    '---',
    'name: Custom Expert',
    'description: A custom expert remains eligible by default.',
    'inputContract:',
    '  - request',
    'outputContract:',
    '  - result',
    'boundaries:',
    '  - cite evidence',
    '---',
    'Use evidence and cite sources.',
  ].join('\n'))
  fs.writeFileSync(path.join(expertRoot, 'manifest.json'), JSON.stringify({
    id: 'custom-expert',
    kind: 'expert',
    skills: ['custom-method'],
  }))
  const catalogPath = path.join(root, 'catalog.json')
  fs.writeFileSync(catalogPath, JSON.stringify({ entries: [
    { id: 'custom-expert', kind: 'expert' },
    { id: 'custom-method', kind: 'skill' },
  ] }))

  const report = evaluateAgents({ expertsRoot, catalogPath })
  assert.equal(report.total, 1)
  assert.equal(report.agents[0].agentId, 'custom-expert')
  assert.deepEqual(report.legacyAgents, [])
})

test('AgentEvals shrinks small runtime samples toward the neutral prior', () => {
  const one = scoreRuntimeTasks([{ completion: 100, quality: 100, evidence: 100, efficiency: 100, fit: 100 }])
  const six = scoreRuntimeTasks(Array.from({ length: 6 }, () => ({ completion: 100, quality: 100, evidence: 100, efficiency: 100, fit: 100 })))
  assert.equal(one.rawScore, 100)
  assert.ok(one.displayScore < six.displayScore)
  assert.equal(one.confidence, 'low')
  assert.equal(six.confidence, 'high')
})

test('AgentEvals does not invent missing runtime dimensions', () => {
  const result = scoreRuntimeTasks([{ completion: 80 }])
  assert.equal(result.rawScore, 80)
  assert.deepEqual(result.missing.sort(), ['efficiency', 'evidence', 'fit', 'quality'])
  assert.equal(result.qualification.state, 'insufficient_evidence')
})

test('AgentEvals treats present but unscored task records as insufficient evidence', () => {
  const result = scoreRuntimeTasks([{ scenario: 'normal', status: 'completed' }])
  assert.equal(result.sampleCount, 1)
  assert.equal(result.confidence, 'low')
  assert.equal(result.qualification.state, 'insufficient_evidence')
})

test('AgentEvals requires scenario coverage, not only six high numeric rows, for expert qualification', () => {
  const result = scoreRuntimeTasks(Array.from({ length: 6 }, () => ({
    completion: 100,
    quality: 100,
    evidence: 100,
    efficiency: 100,
    fit: 100,
  })))
  assert.equal(result.confidence, 'high')
  assert.equal(result.qualification.state, 'insufficient_evidence')
  assert.ok(result.qualification.missingScenarios.includes('normal:2'))
})

test('AgentEvals qualifies only strong repeated normal, edge, retry, revision and reopen evidence', () => {
  const base = { configurationId: 'expert-config-v1:stable', completion: 92, quality: 90, evidence: 94, efficiency: 88, fit: 91 }
  const result = scoreRuntimeTasks([
    { ...base, scenario: 'normal' },
    { ...base, scenario: 'normal' },
    { ...base, scenario: 'edge' },
    { ...base, scenario: 'retry' },
    { ...base, scenario: 'revision' },
    { ...base, scenario: 'reopen' },
  ])
  assert.equal(result.qualification.state, 'qualified')
  assert.deepEqual(result.qualification.missingScenarios, [])
})

test('AgentEvals keeps a hard-red task disqualified even when averages are high', () => {
  const base = { configurationId: 'expert-config-v1:stable', completion: 100, quality: 100, evidence: 100, efficiency: 100, fit: 100 }
  const result = scoreRuntimeTasks([
    { ...base, scenario: 'normal' },
    { ...base, scenario: 'normal' },
    { ...base, scenario: 'edge', hardFailure: true },
    { ...base, scenario: 'retry' },
    { ...base, scenario: 'revision' },
    { ...base, scenario: 'reopen' },
  ])
  assert.equal(result.qualification.state, 'failed')
  assert.equal(result.qualification.hardFailures, 1)
})

test('AgentEvals never qualifies strong rows without immutable configuration identity', () => {
  const base = { completion: 95, quality: 95, evidence: 95, efficiency: 95, fit: 95 }
  const result = scoreRuntimeTasks(['normal', 'normal', 'edge', 'retry', 'revision', 'reopen']
    .map(scenario => ({ ...base, scenario })))
  assert.equal(result.rawScore, 95, 'legacy rows remain descriptively scoreable')
  assert.equal(result.qualification.state, 'insufficient_evidence')
  assert.equal(result.qualification.unscopedSamples, 6)
  assert.equal(result.qualification.configurationId, null)
})

test('AgentEvals does not pool evidence from different Agent Skill or model configurations', () => {
  const base = { completion: 95, quality: 95, evidence: 95, efficiency: 95, fit: 95 }
  const scenarios = ['normal', 'normal', 'edge', 'retry', 'revision', 'reopen']
  const result = scoreRuntimeTasks(scenarios.map((scenario, index) => ({
    ...base,
    scenario,
    qualificationContext: { configurationId: index < 3 ? 'expert-config-v1:flash' : 'expert-config-v1:max' },
  })))
  assert.equal(result.rawScore, null)
  assert.equal(result.qualification.state, 'insufficient_evidence')
  assert.equal(result.qualification.mixedConfigurations, true)
  assert.deepEqual(result.qualification.configurationIds, ['expert-config-v1:flash', 'expert-config-v1:max'])
  assert.equal(result.configurationSummaries.length, 2)
})

test('AgentEvals preserves an old configuration failure without contaminating the upgraded current configuration', () => {
  const result = scoreRuntimeTasks([
    { configurationId: 'expert-config-v1:old', scenario: 'normal', hardAssertionsPassed: false },
    { configurationId: 'expert-config-v1:new', scenario: 'normal', hardAssertionsPassed: true },
  ], { currentConfigurationId: 'expert-config-v1:new' })

  assert.equal(result.qualification.state, 'insufficient_evidence')
  assert.equal(result.qualification.configurationId, 'expert-config-v1:new')
  assert.equal(result.qualification.hardFailures, 0)
  assert.equal(result.qualification.observedHardFailures, 1)
  assert.equal(result.configurationSummaries.find(item => item.configurationId.endsWith(':old')).state, 'failed')
  assert.equal(result.configurationSummaries.find(item => item.configurationId.endsWith(':new')).state, 'insufficient_evidence')
})

test('AgentEvals can qualify an explicitly selected current configuration while retaining older configuration history', () => {
  const scenarios = ['normal', 'normal', 'edge', 'retry', 'revision', 'reopen']
  const result = scoreRuntimeTasks([
    { configurationId: 'expert-config-v1:old', scenario: 'edge', hardAssertionsPassed: false },
    ...scenarios.map(scenario => ({
      configurationId: 'expert-config-v1:new',
      scenario,
      hardAssertionsPassed: true,
      completion: 95,
      quality: 94,
      evidence: 93,
      efficiency: 92,
      fit: 91,
    })),
  ], { currentConfigurationId: 'expert-config-v1:new' })

  assert.equal(result.qualification.mixedConfigurations, true)
  assert.equal(result.qualification.observedHardFailures, 1)
  assert.equal(result.qualification.hardFailures, 0)
  assert.equal(result.qualification.state, 'qualified')
  assert.equal(result.configurationSummaries.find(item => item.configurationId.endsWith(':old')).state, 'failed')
  assert.equal(result.configurationSummaries.find(item => item.configurationId.endsWith(':new')).state, 'qualified')
})

test('AgentEvals report exposes unscoped and mixed configuration evidence', () => {
  const report = {
    rubric: 'AgentEvals v3',
    total: 1,
    averageDesignScore: 100,
    averageOverallScore: null,
    qualificationSummary: { qualified: 0 },
    agents: [{
      agentId: 'example',
      name: 'Example',
      designScore: 100,
      overallScore: null,
      qualification: {
        state: 'insufficient_evidence',
        configurationId: null,
        configurationIds: ['expert-config-v1:flash', 'expert-config-v1:max'],
        unscopedSamples: 1,
        mixedConfigurations: true,
      },
      runtime: {
        observedSampleCount: 7,
        sampleCount: 0,
        configurationSummaries: [
          { configurationId: 'expert-config-v1:flash', current: false, sampleCount: 3, rawScore: 90, missingScenarios: ['revision'], hardFailures: 1, state: 'failed' },
          { configurationId: 'expert-config-v1:max', current: true, sampleCount: 3, rawScore: 91, missingScenarios: ['reopen'], hardFailures: 0, state: 'insufficient_evidence' },
        ],
      },
      confidence: 'unverified',
      skills: [],
      connectors: [],
      issues: [],
    }],
  }
  const markdown = toMarkdown(report)
  assert.match(markdown, /unscoped \/ not recorded/)
  assert.match(markdown, /Mixed configurations \(not pooled\)/)
  assert.match(markdown, /expert-config-v1:flash: 3 samples/)
})

test('AgentEvals cannot qualify a runtime result when the expert package contract is broken', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-evals-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const expertsRoot = path.join(root, 'experts')
  const expertRoot = path.join(expertsRoot, 'broken-expert')
  fs.mkdirSync(expertRoot, { recursive: true })
  fs.writeFileSync(path.join(expertRoot, 'EXPERT.md'), [
    '---',
    'name: Broken Expert',
    'description: Runtime success cannot hide a broken package.',
    'inputContract:',
    '  - request',
    'outputContract:',
    '  - result',
    'boundaries:',
    '  - evidence required',
    '---',
    'Use evidence and cite sources.',
  ].join('\n'))
  fs.writeFileSync(path.join(expertRoot, 'manifest.json'), JSON.stringify({
    id: 'broken-expert',
    kind: 'expert',
    skills: ['missing-skill'],
  }))
  const catalogPath = path.join(root, 'catalog.json')
  fs.writeFileSync(catalogPath, JSON.stringify({ entries: [{ id: 'broken-expert', kind: 'expert' }] }))
  const base = { configurationId: 'expert-config-v1:broken-package', completion: 95, quality: 95, evidence: 95, efficiency: 95, fit: 95 }
  const report = evaluateAgents({
    expertsRoot,
    catalogPath,
    results: {
      agents: [{
        agentId: 'broken-expert',
        tasks: ['normal', 'normal', 'edge', 'retry', 'revision', 'reopen'].map(scenario => ({ ...base, scenario })),
      }],
    },
  })
  assert.equal(report.agents[0].runtime.qualification.state, 'qualified')
  assert.equal(report.agents[0].qualification.state, 'failed')
  assert.equal(report.agents[0].qualification.packageGate.passed, false)
  assert.equal(report.agents[0].qualification.packageGate.errorCount, 1)
  assert.deepEqual(report.agents[0].expertTitle, {
    eligible: false,
    state: 'not_eligible',
    reason: 'The current configuration has a package, professional-quality or lifecycle hard failure.',
  })
})
