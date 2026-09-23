'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  createAgentEvaluationService,
  normalizeSuite,
  scenarioCoverage,
} = require('../src/lib/agent-evaluation')

function cases() {
  return ['normal', 'normal', 'edge', 'retry', 'revision', 'reopen'].map((scenario, index) => ({
    id: `case-${index + 1}`,
    scenario,
    input: `input ${index + 1}`,
    expectedTools: [{ name: 'read_source' }],
    allowedTools: ['read_source'],
    assertions: { mustContain: ['完成'], mustNotContain: ['伪造'] },
  }))
}

function observations() {
  return cases().map(item => ({
    caseId: item.id,
    actualOutput: '已完成，并附真实证据。',
    toolsCalled: [{ name: 'read_source' }],
    evidenceRefs: [`evidence://${item.id}`],
  }))
}

function harness(t, bridge = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-evaluation-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return createAgentEvaluationService({
    store: { resolvePaths: () => ({ root: path.join(root, 'capabilities') }) },
    registry: {
      getAgentDraft: ({ agentId }) => ({ ok: true, draft: { agentId, status: 'draft', definitionHash: 'hash-current' } }),
      listAgentRevisions: () => ({ ok: true, revisions: [] }),
    },
    deepEvalBridge: bridge || {
      status: async () => ({ ok: false, code: 'deepeval_unavailable', error: 'not installed' }),
      evaluate: async () => { throw new Error('must not run') },
    },
  })
}

describe('runtime Agent evaluation', () => {
  it('validates DeepEval-style suite contracts and scenario coverage', () => {
    const invalid = normalizeSuite({
      id: 'quality',
      metrics: [{ id: 'quality', type: 'g_eval' }],
      cases: [{ id: 'one', input: 'x' }],
    }, 'target')
    assert.equal(invalid.ok, false)
    assert.equal(invalid.code, 'missing_eval_criteria')
    assert.deepEqual(scenarioCoverage(cases()).missing, [])
  })

  it('runs deterministic output, tool correctness and least-privilege metrics without DeepEval', async (t) => {
    const service = harness(t)
    const saved = service.saveSuite({
      agentId: 'target-agent',
      suite: {
        id: 'regression',
        metrics: [
          { id: 'assertions', type: 'text_assertions', threshold: 1 },
          { id: 'tools', type: 'tool_correctness', threshold: 1 },
          { id: 'permissions', type: 'tool_permission', threshold: 1 },
        ],
        cases: cases(),
      },
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.suite.coverage.passed, true)

    const result = await service.runEvaluation({
      agentId: 'target-agent',
      suiteId: 'regression',
      engine: 'native',
      observations: observations(),
    })
    assert.equal(result.ok, true)
    assert.equal(result.report.status, 'passed')
    assert.equal(result.report.gate.passed, true)
    assert.equal(result.report.summary.passedCases, 6)
    assert.equal(result.report.summary.passedMetrics, 18)
    assert.equal(result.report.gate.certification, 'scenario-regression-only')

    const latest = service.getReport({ agentId: 'target-agent' })
    assert.equal(latest.ok, true)
    assert.equal(latest.report.runId, result.report.runId)
  })

  it('fails closed for semantic metrics when DeepEval is missing', async (t) => {
    const service = harness(t)
    service.saveSuite({
      agentId: 'target-agent',
      suite: {
        id: 'semantic',
        metrics: [{ id: 'quality', type: 'g_eval', criteria: 'Judge professional correctness.' }],
        cases: cases().map(item => ({ ...item, expectedOutput: '正确结果' })),
      },
    })
    const runtime = await service.checkRuntime()
    assert.equal(runtime.available, false)
    assert.match(runtime.setup, /pip install -U deepeval/)
    const result = await service.runEvaluation({
      agentId: 'target-agent', suiteId: 'semantic', observations: observations(),
    })
    assert.equal(result.report.status, 'blocked')
    assert.equal(result.report.summary.blockedMetrics, 6)
    assert.equal(result.report.cases[0].metrics[0].code, 'deepeval_unavailable')
  })

  it('records real DeepEval semantic scores from the fixed bridge', async (t) => {
    const bridge = {
      status: async () => ({ ok: true, version: 'test-version' }),
      evaluate: async payload => ({
        ok: true,
        results: payload.cases.flatMap(testCase => payload.metrics.map(metric => ({
          caseId: testCase.id,
          metricId: metric.id,
          score: 0.92,
          reason: 'meets the frozen criteria',
        }))),
      }),
    }
    const service = harness(t, bridge)
    service.saveSuite({
      agentId: 'target-agent',
      suite: {
        id: 'semantic',
        metrics: [{ id: 'quality', type: 'g_eval', threshold: 0.8, criteria: 'Judge professional correctness.' }],
        cases: cases().map(item => ({ ...item, expectedOutput: '正确结果' })),
      },
    })
    const result = await service.runEvaluation({
      agentId: 'target-agent', suiteId: 'semantic', observations: observations(), judgeModel: 'judge-test',
    })
    assert.equal(result.report.status, 'passed')
    assert.equal(result.report.deepEval.version, 'test-version')
    assert.equal(result.report.cases[0].metrics[0].engine, 'deepeval@test-version')
    assert.equal(result.report.cases[0].metrics[0].score, 0.92)
  })

  it('keeps DeepEval installation in an isolated runtime and verifies it', async (t) => {
    const service = createAgentEvaluationService({
      store: { resolvePaths: () => ({ root: path.join(os.tmpdir(), 'knowme-eval-install-test') }) },
      registry: null,
      deepEvalBridge: { status: async () => ({ ok: true, version: 'installed' }) },
      deepEvalInstaller: async ({ runtimeRoot }) => ({ ok: true, code: 'deepeval_installed', runtimeRoot, version: 'installed' }),
    })
    const result = await service.setupRuntime()
    assert.equal(result.ok, true)
    assert.match(result.runtimeRoot, /runtimes[\\/]deepeval$/)
  })
})
