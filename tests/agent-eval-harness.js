'use strict'

const fs = require('fs')
const path = require('path')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts, RunPhase } = require('../src/lib/agent-run-ports')

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'agent-eval')

function loadFixtures() {
  if (!fs.existsSync(FIXTURE_DIR)) return []
  return fs.readdirSync(FIXTURE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8'))
      return { file: f, ...raw }
    })
}

function phasesInclude(actual, expected) {
  if (!Array.isArray(expected)) return true
  let lastIdx = -1
  for (const phase of expected) {
    const idx = actual.indexOf(phase)
    if (idx < 0 || idx < lastIdx) return false
    lastIdx = idx
  }
  return true
}

function diffReport(name, expect, actual) {
  const lines = [`Eval "${name}" failed:`]
  if (expect.terminal && expect.terminal !== actual.terminal) {
    lines.push(`  terminal: expected ${expect.terminal}, got ${actual.terminal}`)
  }
  if (expect.phases && !phasesInclude(actual.runPhases, expect.phases)) {
    lines.push(`  phases: expected ${JSON.stringify(expect.phases)}, got ${JSON.stringify(actual.runPhases)}`)
  }
  if (expect.toolCalls != null && expect.toolCalls !== actual.toolCalls) {
    lines.push(`  toolCalls: expected ${expect.toolCalls}, got ${actual.toolCalls}`)
  }
  if (expect.planEvalAction && actual.planEval?.action !== expect.planEvalAction) {
    lines.push(`  planEval.action: expected ${expect.planEvalAction}, got ${actual.planEval?.action}`)
  }
  if (expect.cancelled === true && !actual.cancelled) {
    lines.push('  expected cancelled=true')
  }
  if (expect.error && !actual.error) {
    lines.push(`  expected error containing "${expect.error}"`)
  }
  return lines.join('\n')
}

async function runEvalFixture(fixture, { signal } = {}) {
  const startedAt = Date.now()
  const ports = createMockRunPorts(fixture, signal)
  const events = []
  const emit = (event) => events.push(event)

  let result
  try {
    result = await AgentRunExecutor.run(fixture.input || {}, ports, emit)
  } catch (err) {
    result = {
      terminal: RunPhase.ERROR,
      runPhases: [RunPhase.PREPARE, RunPhase.ERROR],
      report: {
        terminal: RunPhase.ERROR,
        runPhases: [RunPhase.PREPARE, RunPhase.ERROR],
        error: { message: err.message },
        toolCalls: 0,
        rounds: 0,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  const report = result.report || {
    terminal: result.terminal || RunPhase.ERROR,
    runPhases: result.runPhases || [],
    rounds: result.metrics?.rounds || 0,
    toolCalls: result.metrics?.toolCalls || 0,
    planEval: result.planEval || null,
    durationMs: Date.now() - startedAt,
    error: result.error ? { message: String(result.error) } : null,
    cancelled: result.cancelled === true,
  }

  const expect = fixture.expect || {}
  const passed = (
    (!expect.terminal || report.terminal === expect.terminal) &&
    (!expect.phases || phasesInclude(report.runPhases, expect.phases)) &&
    (expect.toolCalls == null || report.toolCalls === expect.toolCalls) &&
    (!expect.planEvalAction || report.planEval?.action === expect.planEvalAction) &&
    (expect.cancelled !== true || report.cancelled === true) &&
    (!expect.error || (report.error && String(report.error.message || report.error).includes(expect.error)))
  )

  return {
    name: fixture.name || fixture.file,
    passed,
    report,
    events,
    diff: passed ? null : diffReport(fixture.name || fixture.file, expect, report),
  }
}

async function runAllEvals(options = {}) {
  const fixtures = options.fixtures || loadFixtures()
  const results = []
  for (const fixture of fixtures) {
    results.push(await runEvalFixture(fixture, options))
  }
  return results
}

module.exports = {
  loadFixtures,
  runEvalFixture,
  runAllEvals,
  diffReport,
  phasesInclude,
  FIXTURE_DIR,
}
