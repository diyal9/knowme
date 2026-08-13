'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../../../..')
const TESTS = [
  'tests/agent-team-runtime-core.test.js',
  'tests/agent-team-runtime-integration.test.js',
  'tests/agent-team-runtime-governance-ui.test.js',
  'tests/agent-team-workflow-runner.test.js',
]

function count(output, label) {
  const match = output.match(new RegExp(`(?:ℹ\\s+)?${label}\\s+(\\d+)`))
  return match ? Number(match[1]) : null
}

function has(output, text) {
  return output.includes(text)
}

function write(name, value) {
  fs.writeFileSync(path.join(__dirname, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const startedAt = Date.now()
const run = spawnSync(process.execPath, ['--test', ...TESTS], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 60_000,
  windowsHide: true,
})
const output = `${run.stdout || ''}\n${run.stderr || ''}`
const common = {
  at: new Date().toISOString(),
  command: `node --test ${TESTS.join(' ')}`,
  exitCode: run.status,
  durationMs: Date.now() - startedAt,
  tests: count(output, 'tests'),
  passed: count(output, 'pass'),
  failed: count(output, 'fail'),
}

const orchestration = {
  ...common,
  checks: {
    realChildExecutor: has(output, 'launcher starts real child AgentRunExecutor with run phases'),
    serialHandoffParallelJoin: has(output, 'runs serial handoff, one gate rollback, parallel join, and final aggregation'),
    crossBuilderAdapters: has(output, 'validates the checked-in cross-builder Team Package'),
    errorPropagation: has(output, 'child error surfaces to run record and status query'),
    approvalGovernance: has(output, 'wraps approval-required writes with pending_review envelope fields'),
    promptInjection: has(output, 'marks child prompt injection and preserves terminal audit refs'),
    outputPrivacy: has(output, 'redacts sensitive fields in message reducer payloads'),
  },
}
orchestration.ok = common.exitCode === 0
  && common.failed === 0
  && Object.values(orchestration.checks).every(Boolean)
write('orchestration-e2e.json', orchestration)

const cancelRecovery = {
  ...common,
  checks: {
    cascadeUnderThreeSeconds: has(output, 'parent cancel propagates within 3s with zero running leak'),
    interruptedRecovery: has(output, 'loadFromStore marks non-terminal runs interrupted after crash'),
    safeResume: has(output, 'resumeRun replays store and relaunches when allowed'),
    idempotentReceipt: has(output, 'writeReceipt is idempotent and getOrCreateReceipt dedupes'),
    terminalExactlyOnce: has(output, 'emits terminal exactly once'),
    launchFailureWakeup: has(output, 'notifies waiters immediately when a child backend cannot launch'),
  },
}
cancelRecovery.ok = common.exitCode === 0
  && common.failed === 0
  && Object.values(cancelRecovery.checks).every(Boolean)
write('cancel-recovery-smoke.json', cancelRecovery)

if (!orchestration.ok || !cancelRecovery.ok) {
  process.stderr.write(output)
  process.exitCode = 1
}
