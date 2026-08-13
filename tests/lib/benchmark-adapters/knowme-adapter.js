'use strict'

const path = require('path')
const { runConversationScenario } = require('../../agent-conversation-eval-harness')
const {
  normalizeBenchmarkResult,
  validateNormalizedResult,
  scoreTaskAgainstRubric,
} = require('../benchmark-schema')

const FIXTURE_ROOT = path.join(__dirname, '..', '..', 'fixtures', 'agent-benchmark', 'fixtures')

async function prepareContext(task) {
  const fixturePath = task.fixtureFile
    ? path.join(FIXTURE_ROOT, task.fixtureFile)
    : null
  return { task, fixturePath }
}

async function runTask(task, context = {}) {
  const startedAt = Date.now()
  if (!task.fixtureFile) {
    return normalizeBenchmarkResult({
      finalAnswer: '',
      toolLogs: [],
      evidenceRefs: [],
      latencyMs: Date.now() - startedAt,
      rounds: 0,
      errors: ['missing fixtureFile'],
      metadata: { terminal: 'ERROR', product: 'knowme' },
    })
  }

  const fs = require('fs')
  const fixture = JSON.parse(fs.readFileSync(context.fixturePath, 'utf8'))
  const result = await runConversationScenario(fixture, { baselineName: task.rubricVersion || 'v1' })
  const calls = result.ports?.toolLedger?.calls || []
  const evidence = result.ports?.evidenceLedger?.entries || []

  const normalized = normalizeBenchmarkResult({
    finalAnswer: result.report?.text || '',
    toolLogs: calls.map(c => ({ name: c.name, status: c.status, args: c.args })),
    evidenceRefs: evidence.map(e => e.ref || e.id).filter(Boolean),
    latencyMs: result.report?.durationMs || Date.now() - startedAt,
    rounds: result.report?.rounds || 0,
    errors: result.passed ? [] : (result.failReasons || []),
    metadata: {
      terminal: result.report?.terminal,
      product: 'knowme',
      scenario: result.name,
    },
  })

  const validation = validateNormalizedResult(normalized)
  if (!validation.ok) {
    normalized.errors.push(`invalid normalized result: missing ${validation.missing.join(', ')}`)
  }

  const scored = scoreTaskAgainstRubric(normalized, task.rubric || {})
  return { ...normalized, scored, passed: scored.passed && result.passed }
}

async function cleanup() {
  return undefined
}

module.exports = {
  id: 'knowme',
  prepareContext,
  runTask,
  cleanup,
}
