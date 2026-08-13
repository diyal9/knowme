'use strict'

const path = require('path')
const {
  runConversationSuite,
  summarizeResults,
  loadConversationFixtures,
} = require('../agent-conversation-eval-harness')
const { runAllEvals } = require('../agent-eval-harness')
const { enrichSummary } = require('./eval-report')

const CONVERSATION_DIR = path.join(__dirname, '..', 'fixtures', 'agent-conversation-eval', 'scenarios')
const CONTROLLED_DIR = path.join(__dirname, '..', 'fixtures', 'agent-eval')

const SUITE_REGISTRY = {
  'hard-offline': {
    id: 'hard-offline',
    layer: 'L0',
    title: 'Hard Offline Gate',
    gateLevel: 'blocking',
    runner: 'conversation',
    fixtureDir: CONVERSATION_DIR,
    description: 'Deterministic fixture regression with mock ports; CI hard gate.',
    schedule: 'ci',
  },
  conversation: {
    id: 'hard-offline',
    layer: 'L0',
    title: 'Hard Offline Gate',
    gateLevel: 'blocking',
    runner: 'conversation',
    fixtureDir: CONVERSATION_DIR,
    description: 'Backward-compatible alias for hard-offline.',
    schedule: 'ci',
  },
  'self-e2e-controlled': {
    id: 'self-e2e-controlled',
    layer: 'L1',
    title: 'Self E2E Controlled',
    gateLevel: 'advisory',
    runner: 'controlled',
    fixtureDirs: [CONVERSATION_DIR, CONTROLLED_DIR],
    description: 'Controlled runtime metrics: latency, recovery, cancel cascade.',
    schedule: 'nightly',
  },
  'cross-product-benchmark': {
    id: 'cross-product-benchmark',
    layer: 'L2',
    title: 'Cross Product Benchmark',
    gateLevel: 'advisory',
    runner: 'benchmark',
    description: 'KnowMe vs Cursor vs Workbuddy with unified rubric.',
    schedule: 'weekly',
  },
}

function resolveSuite(suiteName = 'hard-offline') {
  const meta = SUITE_REGISTRY[suiteName] || SUITE_REGISTRY['hard-offline']
  return { ...meta, requestedSuite: suiteName }
}

async function runControlledSuite(options = {}) {
  const conversationResults = await runConversationSuite({
    ...options,
    fixtures: loadConversationFixtures(CONVERSATION_DIR),
  })
  const agentEvalResults = await runAllEvals(options)

  const mappedAgent = agentEvalResults.map(r => ({
    name: r.name,
    passed: r.passed,
    dimensions: {
      taskCompletion: r.passed ? 1 : 0,
      recoveryPassRate: r.name === 'tool-recovery' ? (r.passed ? 1 : 0) : 1,
      cancelCascadeLatency: r.name === 'cancel-mid-model' && r.passed ? 1 : 1,
    },
    metrics: {
      latencyMs: r.report?.durationMs || 0,
      rounds: r.report?.rounds || 0,
      toolCalls: r.report?.toolCalls || 0,
      cancelCascadeLatencyMs: r.report?.cancelCascade?.durationMs ?? null,
      recoveryPass: r.name === 'tool-recovery' ? r.passed : null,
    },
    failReasons: r.passed ? [] : [r.diff || 'agent-eval fixture failed'],
    report: r.report,
    source: 'agent-eval',
  }))

  return [...conversationResults, ...mappedAgent]
}

async function runSuite(suiteName, options = {}) {
  const suiteMeta = resolveSuite(suiteName)
  const startedAt = Date.now()

  if (suiteMeta.runner === 'conversation') {
    const results = await runConversationSuite({
      ...options,
      fixtureDir: suiteMeta.fixtureDir,
    })
    const base = summarizeResults(results, {
      suite: suiteMeta.id,
      baseline: options.baselineName || 'v1',
    })
    return enrichSummary(base, results, {
      suiteMeta,
      layer: suiteMeta.layer,
      gateLevel: suiteMeta.gateLevel,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    })
  }

  if (suiteMeta.runner === 'controlled') {
    const results = await runControlledSuite(options)
    const base = summarizeResults(results, {
      suite: suiteMeta.id,
      baseline: options.baselineName || 'v2',
    })
    return enrichSummary(base, results, {
      suiteMeta,
      layer: suiteMeta.layer,
      gateLevel: suiteMeta.gateLevel,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    })
  }

  throw new Error(`Suite "${suiteName}" must be executed via scripts/agent-benchmark.js`)
}

function listSuites() {
  const seen = new Set()
  return Object.values(SUITE_REGISTRY).filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}

module.exports = {
  SUITE_REGISTRY,
  resolveSuite,
  runSuite,
  runControlledSuite,
  listSuites,
}
