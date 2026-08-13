'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { AgentRunStore } = require('../../../../src/lib/agent-run-store')
const { AgentRunManager } = require('../../../../src/lib/agent-run-manager')
const { AgentRunLauncher } = require('../../../../src/lib/agent-run-launcher')
const { createAgentRuntimeMetrics } = require('../../../../src/lib/agent-runtime-metrics')

const ROOT = path.resolve(__dirname, '../../../..')
const REPORT = path.join(__dirname, 'runtime-production-readiness-gates.json')
const METRICS_REPORT = path.join(__dirname, 'runtime-metrics.json')
const TESTS = [
  'tests/agent-runtime-production-readiness.test.js',
  'tests/agent-team-runtime-core.test.js',
  'tests/agent-team-runtime-integration.test.js',
]

function count(output, label) {
  const match = output.match(new RegExp(`(?:ℹ\\s+)?${label}\\s+(\\d+)`))
  return match ? Number(match[1]) : null
}

async function collectMetricsEvidence() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-runtime-gate-'))
  try {
    const metrics = createAgentRuntimeMetrics()
    const store = new AgentRunStore({ rootDir: temp, metrics })
    const launcher = new AgentRunLauncher({ metrics })
    const manager = new AgentRunManager({ runStore: store, launcher, metrics })
    manager.createRun({ runId: 'metrics_root', autoLaunch: false })
    manager.createChildRun('metrics_root', { runId: 'metrics_child', autoLaunch: false })
    await Promise.all([
      manager.cancelRun('metrics_root', 'metrics_evidence'),
      manager.cancelRun('metrics_root', 'metrics_evidence_duplicate'),
    ])
    const diagnostics = manager.getDiagnostics()
    fs.writeFileSync(METRICS_REPORT, `${JSON.stringify({
      at: new Date().toISOString(),
      ok: diagnostics.resources.resourceLeakCount === 0
        && diagnostics.resources.activeLaunches === 0
        && diagnostics.resources.waiters === 0,
      ...diagnostics,
    }, null, 2)}\n`, 'utf8')
    return diagnostics
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

async function main() {
  const startedAt = Date.now()
  const run = spawnSync(process.execPath, ['--test', ...TESTS], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  })
  const output = `${run.stdout || ''}\n${run.stderr || ''}`
  const diagnostics = await collectMetricsEvidence()
  const mainSource = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const checks = {
    noLegacyActiveSubRuns: !/\bactiveSubRuns\b/.test(mainSource),
    packageTrust: output.includes('authenticates trusted Ed25519 publishers and rejects tampering or revocation'),
    corruptionMatrix: output.includes('fails closed on middle corruption and hash-chain tampering'),
    interruptedRecovery: output.includes('marks active persisted runs interrupted and rejects corrupt state safely'),
    duplicateTerminal: output.includes('delivers duplicate backend terminal callbacks exactly once'),
    cancelStorm: output.includes('converges a cancellation storm without run-manager resource leaks'),
    idempotentEffects: output.includes('keeps idempotent side-effect receipts stable under repeated calls'),
    remoteFaults: output.includes('maps readiness timeout and execution disconnect to stable errors'),
    zeroResourceLeak: diagnostics.resources.resourceLeakCount === 0,
  }
  const report = {
    at: new Date().toISOString(),
    command: `node --test ${TESTS.join(' ')}`,
    status: run.status === 0 && Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    ok: run.status === 0 && Object.values(checks).every(Boolean),
    exitCode: run.status,
    durationMs: Date.now() - startedAt,
    tests: count(output, 'tests'),
    passed: count(output, 'pass'),
    failed: count(output, 'fail'),
    checks,
    metricsEvidence: 'runtime-metrics.json',
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) {
    process.stderr.write(output)
    process.exitCode = 1
  }
}

main().catch(error => {
  fs.writeFileSync(REPORT, `${JSON.stringify({
    at: new Date().toISOString(),
    status: 'FAIL',
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
