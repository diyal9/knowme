'use strict'

const fs = require('fs')
const path = require('path')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts, RunPhase } = require('../src/lib/agent-run-ports')
const groundingRuntime = require('../src/lib/agent-grounding-runtime')

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'agent-conversation-eval', 'scenarios')
const BASELINE_DIR = path.join(__dirname, 'fixtures', 'agent-conversation-eval', 'baselines')
const DEFAULT_BASELINE = path.join(BASELINE_DIR, 'v1-thresholds.json')

const { deriveFailureTaxonomy, buildFailureRecord } = require('./lib/eval-taxonomy')

const HARD_DIMENSIONS = ['toolChoice', 'factFaithfulness', 'refusalWhenUnmet', 'contextContinuity']

function loadJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadConversationFixtures(dir = FIXTURE_DIR) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = loadJson(path.join(dir, f), {})
      return { file: f, ...raw }
    })
}

function loadBaseline(name = 'v1') {
  const file = path.join(BASELINE_DIR, `${name}-thresholds.json`)
  return loadJson(file, loadJson(DEFAULT_BASELINE, {
    version: 'v1',
    hardDimensions: HARD_DIMENSIONS,
    thresholds: {
      toolChoice: 1.0,
      factFaithfulness: 1.0,
      refusalWhenUnmet: 1.0,
      contextContinuity: 0.9,
      toolArgs: 0.8,
      taskCompletion: 0.8,
      formatUx: 0.7,
    },
  }))
}

function normalizeStreamEvent(event) {
  if (!event || typeof event !== 'object') return event
  if (event.version === 2 && event.payload && typeof event.payload === 'object') {
    return {
      ...event.payload,
      type: event.type,
      version: event.version,
      runId: event.runId,
      seq: event.seq,
      lane: event.lane,
      runPhase: event.phase || event.payload.runPhase,
      phase: event.phase,
    }
  }
  return event
}

function findStreamEvent(events, type) {
  return normalizeStreamEvent((events || []).find(e => e?.type === type) || null)
}

function containsForbiddenClaims(text = '', forbidden = []) {
  const src = String(text || '')
  return (Array.isArray(forbidden) ? forbidden : []).filter(token => token && src.includes(token))
}

function scoreToolChoice(expect, report, ports) {
  const required = expect.requiredToolCalls || []
  if (!required.length) return 1
  const calls = ports?._eval?.toolLedger?.calls || []
  const names = calls.filter(c => c.status === 'ok').map(c => c.name)
  const missing = required.filter(name => !names.includes(name))
  return missing.length ? 0 : 1
}

function scoreFactFaithfulness(expect, report) {
  const forbidden = containsForbiddenClaims(report.text || report.fullText || '', expect.forbiddenClaims)
  if (forbidden.length) return 0
  if (expect.requiredToolCalls?.length && !expect.allowUngroundedFacts) {
    const text = String(report.text || '')
    if (groundingRuntime.EXTERNAL_FACT_RE.test(text)) {
      const sources = report.grounding?.sources || []
      const hasEvidence = sources.some(s => s.status === 'ok')
      if (!hasEvidence) return 0
    }
  }
  return 1
}

function scoreRefusalWhenUnmet(expect, report) {
  if (!expect.requiredToolCalls?.length) return 1
  const required = expect.requiredToolCalls
  const calls = report.metrics?.toolCalls || report.toolCalls || 0
  const text = String(report.text || '')
  const hasForbidden = containsForbiddenClaims(text, expect.forbiddenClaims)
  if (calls >= required.length && !hasForbidden.length) return 1
  if (hasForbidden.length) return 0
  if (groundingRuntime.EXECUTION_CLAIM_RE.test(text) && calls < required.length) return 0
  if (groundingRuntime.EXTERNAL_FACT_RE.test(text) && calls < required.length) return 0
  return text.includes('尚未') || text.includes('不能') || text.includes('需要先') || text.includes('证据不足') ? 1 : 0
}

function scoreContextContinuity(fixture, ports) {
  if (!fixture.sessionScript?.length) return 1
  const ref = ports?._eval?.referenceState
  if (fixture.expect?.bindRef && ref?.activeRefId !== fixture.expect.bindRef) return 0
  if (fixture.input?.bindRef && ref?.activeRefId && ref.activeRefId !== fixture.input.bindRef) {
    return ref.activeRefId ? 0.8 : 0
  }
  return 1
}

function scoreToolSuccessRate(_expect, _report, ports) {
  const calls = ports?._eval?.toolLedger?.calls || []
  if (!calls.length) return 1
  const ok = calls.filter(c => c.status === 'ok').length
  return ok / calls.length
}

function scoreLatencyMs(report, baseline) {
  const ms = report.durationMs || 0
  const budget = baseline?.latencyBudgetMs ?? 8000
  if (ms <= budget) return 1
  return Math.max(0, 1 - (ms - budget) / budget)
}

function scoreRecoveryPassRate(fixture, report) {
  if (!fixture.expect?.requiresRecovery) return 1
  const phases = report.runPhases || []
  if (phases.includes('RECOVER') && report.terminal === RunPhase.DONE) return 1
  if (report.terminal === RunPhase.DONE && (report.toolCalls || 0) >= 2) return 1
  return 0
}

function scoreUngroundedClaimRate(expect, report) {
  const forbidden = containsForbiddenClaims(report.text || '', expect.forbiddenClaims)
  if (forbidden.length) return 0
  const text = String(report.text || '')
  if (groundingRuntime.EXTERNAL_FACT_RE.test(text) && !(report.grounding?.sources || []).some(s => s.status === 'ok')) {
    return 0
  }
  return 1
}

function extractRuntimeMetrics(report, ports) {
  const calls = ports?._eval?.toolLedger?.calls || []
  return {
    latencyMs: report.durationMs || 0,
    rounds: report.rounds || report.metrics?.rounds || 0,
    toolCalls: report.toolCalls || calls.length,
    cancelCascadeLatencyMs: report.cancelCascade?.durationMs ?? null,
    recoveryPass: report.runPhases?.includes('RECOVER') ? true : null,
  }
}

function scoreDimensions(fixture, report, ports, baseline) {
  const expect = fixture.expect || {}
  return {
    toolChoice: scoreToolChoice(expect, report, ports),
    factFaithfulness: scoreFactFaithfulness(expect, report),
    refusalWhenUnmet: scoreRefusalWhenUnmet(expect, report),
    contextContinuity: scoreContextContinuity(fixture, ports),
    toolArgs: 1,
    taskCompletion: report.terminal === (expect.terminal || RunPhase.DONE) ? 1 : 0,
    formatUx: report.text ? 1 : 0,
    toolSuccessRate: scoreToolSuccessRate(expect, report, ports),
    latencyMs: scoreLatencyMs(report, baseline),
    recoveryPassRate: scoreRecoveryPassRate(fixture, report),
    ungroundedClaimRate: scoreUngroundedClaimRate(expect, report),
  }
}

function evaluateAgainstBaseline(dimensions, baseline) {
  const thresholds = baseline.thresholds || {}
  const hard = baseline.hardDimensions || HARD_DIMENSIONS
  const advisory = baseline.advisoryDimensions || []
  const failReasons = []
  for (const dim of Object.keys(thresholds)) {
    const score = dimensions[dim]
    if (score == null) continue
    if (score < thresholds[dim]) {
      const level = advisory.includes(dim) ? 'advisory' : 'hard'
      failReasons.push(`${dim}: ${score} < ${thresholds[dim]} (${level})`)
    }
  }
  const hardFailed = hard.some(dim => (dimensions[dim] ?? 1) < (thresholds[dim] ?? 1))
  return { passed: failReasons.filter(r => !r.includes('(advisory)')).length === 0 && !hardFailed, failReasons, hardFailed }
}

async function runConversationScenario(fixture, options = {}) {
  const startedAt = Date.now()
  const sessionScript = Array.isArray(fixture.sessionScript) ? fixture.sessionScript : []
  let referenceState = groundingRuntime.deserializeReferenceState(fixture.referenceState || {})

  for (const step of sessionScript) {
    if (step.refs) referenceState.refs = step.refs
    if (step.pendingSelection) {
      referenceState = groundingRuntime.setPendingSelection(referenceState, step.pendingSelection.options || step.pendingSelection, step.pendingSelection.refSetId)
    }
    if (step.taskFrame) referenceState = groundingRuntime.setTaskFrame(referenceState, step.taskFrame)
  }

  const mergedFixture = {
    ...fixture,
    referenceState: groundingRuntime.serializeReferenceState(referenceState),
    session: {
      ...(fixture.session || {}),
      referenceState: groundingRuntime.serializeReferenceState(referenceState),
    },
  }

  const ports = createMockRunPorts(mergedFixture, options.signal)
  const events = []
  let result
  try {
    result = await AgentRunExecutor.run(fixture.input || {}, ports, (e) => events.push(e))
  } catch (err) {
    result = {
      terminal: RunPhase.ERROR,
      error: err.message,
      report: { terminal: RunPhase.ERROR, error: { message: err.message } },
    }
  }

  const report = {
    terminal: result.terminal || result.report?.terminal,
    runPhases: result.runPhases || result.report?.runPhases || [],
    toolCalls: result.metrics?.toolCalls || result.report?.toolCalls || 0,
    rounds: result.metrics?.rounds || result.report?.rounds || 0,
    text: result.text || '',
    durationMs: Date.now() - startedAt,
    grounding: findStreamEvent(events, 'grounding-status'),
    subRuns: Array.isArray(result.metrics?.subRuns) ? result.metrics.subRuns : [],
    handoffs: Array.isArray(result.metrics?.handoffs) ? result.metrics.handoffs : [],
    cancelCascade: result.metrics?.cancelCascade || null,
    receipts: Array.isArray(result.metrics?.receipts) ? result.metrics.receipts : [],
  }

  const baseline = options.baseline || loadBaseline(options.baselineName || 'v1')
  const dimensions = scoreDimensions(fixture, report, ports, baseline)
  const evalResult = evaluateAgainstBaseline(dimensions, baseline)
  const metrics = extractRuntimeMetrics(report, ports)

  const expect = fixture.expect || {}
  let scenarioPassed = evalResult.passed
  if (expect.terminal && report.terminal !== expect.terminal) scenarioPassed = false
  if (expect.requiredToolCalls?.length) {
    const names = (ports._eval?.toolLedger?.calls || []).filter(c => c.status === 'ok').map(c => c.name)
    for (const tool of expect.requiredToolCalls) {
      if (!names.includes(tool)) scenarioPassed = false
    }
  }
  if (expect.forbiddenClaims?.length) {
    const hits = containsForbiddenClaims(report.text, expect.forbiddenClaims)
    if (hits.length) scenarioPassed = false
  }
  if (expect.mustFail === true) {
    const unsafe = containsForbiddenClaims(report.text, expect.forbiddenClaims || []).length > 0
    scenarioPassed = !unsafe
  }

  return {
    name: fixture.name || fixture.file,
    passed: scenarioPassed,
    dimensions,
    metrics,
    baseline: baseline.version || 'v1',
    failReasons: evalResult.failReasons,
    taxonomy: deriveFailureTaxonomy({ name: fixture.name, passed: scenarioPassed, dimensions, failReasons: evalResult.failReasons, report }),
    failureRecord: buildFailureRecord({ name: fixture.name || fixture.file, passed: scenarioPassed, dimensions, failReasons: evalResult.failReasons, report }),
    report,
    events,
    ports: {
      referenceState: ports._eval?.referenceState,
      toolLedger: ports._eval?.toolLedger,
      evidenceLedger: ports._eval?.evidenceLedger,
    },
  }
}

async function runConversationSuite(options = {}) {
  const fixtures = options.fixtures || loadConversationFixtures(options.fixtureDir)
  const results = []
  for (const fixture of fixtures) {
    results.push(await runConversationScenario(fixture, options))
  }
  return results
}

function buildMarkdownReport(summary) {
  const lines = [
    `# Conversation Eval Report`,
    '',
    `- Suite: ${summary.suite}`,
    `- Baseline: ${summary.baseline}`,
    `- Passed: ${summary.passed}/${summary.total}`,
    `- Duration: ${summary.durationMs}ms`,
    '',
    '## Scenarios',
    '',
  ]
  for (const item of summary.results) {
    lines.push(`### ${item.name} — ${item.passed ? 'PASS' : 'FAIL'}`)
    lines.push('')
    lines.push('| Dimension | Score |')
    lines.push('|---|---|')
    for (const [dim, score] of Object.entries(item.dimensions || {})) {
      lines.push(`| ${dim} | ${score} |`)
    }
    if (item.failReasons?.length) lines.push('', `Fail reasons: ${item.failReasons.join('; ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

function summarizeResults(results, { suite = 'conversation', baseline = 'v1' } = {}) {
  const startedAt = results.reduce((min, r) => Math.min(min, r.report?.durationMs || 0), Infinity)
  const durationMs = results.reduce((sum, r) => sum + (r.report?.durationMs || 0), 0)
  return {
    suite,
    baseline,
    total: results.length,
    passed: results.filter(r => r.passed).length,
    durationMs: Number.isFinite(startedAt) ? durationMs : 0,
    results,
  }
}

module.exports = {
  FIXTURE_DIR,
  BASELINE_DIR,
  HARD_DIMENSIONS,
  loadConversationFixtures,
  loadBaseline,
  normalizeStreamEvent,
  findStreamEvent,
  runConversationScenario,
  runConversationSuite,
  scoreDimensions,
  extractRuntimeMetrics,
  buildMarkdownReport,
  summarizeResults,
  containsForbiddenClaims,
  deriveFailureTaxonomy,
  buildFailureRecord,
}
