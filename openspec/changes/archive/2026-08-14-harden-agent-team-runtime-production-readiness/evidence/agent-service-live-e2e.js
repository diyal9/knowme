'use strict'

const fs = require('node:fs')
const {
  RemoteAgentServiceAdapter,
  BACKEND_CURSOR,
  BACKEND_CLAUDE,
  BACKEND_DAEMON,
} = require('../../../../src/lib/agent-run-launcher')

const REPORT = `${__dirname}/agent-service-live-e2e.json`
const RERUN = 'node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/agent-service-live-e2e.js'

const BACKENDS = [
  {
    id: BACKEND_CURSOR,
    label: 'cursor',
    endpoint: process.env.KNOWME_CURSOR_AGENT_URL,
    token: process.env.KNOWME_CURSOR_AGENT_TOKEN,
    packageId: process.env.KNOWME_CURSOR_AGENT_PACKAGE_ID,
  },
  {
    id: BACKEND_CLAUDE,
    label: 'claude',
    endpoint: process.env.KNOWME_CLAUDE_AGENT_URL,
    token: process.env.KNOWME_CLAUDE_AGENT_TOKEN,
    packageId: process.env.KNOWME_CLAUDE_AGENT_PACKAGE_ID,
  },
  {
    id: BACKEND_DAEMON,
    label: 'daemon',
    endpoint: process.env.KNOWME_DAEMON_AGENT_URL || process.env.KNOWME_WORKBENCH_URL,
    token: process.env.KNOWME_DAEMON_AGENT_TOKEN || process.env.KNOWME_WORKBENCH_TOKEN,
    packageId: process.env.KNOWME_DAEMON_AGENT_PACKAGE_ID,
  },
]

function createClient(endpoint, token) {
  async function request(pathname, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${String(endpoint).replace(/\/$/, '')}${pathname}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      })
      const text = await response.text()
      let body
      try { body = text ? JSON.parse(text) : {} } catch { body = { message: text.slice(0, 500) } }
      if (!response.ok) {
        const error = new Error(body.message || body.code || `HTTP ${response.status}`)
        error.code = body.code || `http_${response.status}`
        throw error
      }
      return body
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    handshake: body => request('/agent/v1/handshake', { method: 'POST', body: JSON.stringify(body) }),
    executeAgentRun: body => request('/agent/v1/runs', {
      method: 'POST',
      body: JSON.stringify({
        runId: body.runId,
        agentPackageId: body.agentPackageId,
        packageSnapshotHash: body.packageSnapshotHash,
        governanceEnvelope: body.governanceEnvelope,
        inputPayload: body.inputPayload,
      }),
    }),
    fetchRunStatus: runId => request(`/agent/v1/runs/${encodeURIComponent(runId)}`),
    cancelRun: (runId, body) => request(`/agent/v1/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
    resumeRun: (runId, body) => request(`/agent/v1/runs/${encodeURIComponent(runId)}/resume`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  }
}

async function evaluateBackend(config) {
  const missing = []
  if (!config.endpoint) missing.push(`KNOWME_${config.label.toUpperCase()}_AGENT_URL`)
  if (!config.token) missing.push(`KNOWME_${config.label.toUpperCase()}_AGENT_TOKEN`)
  if (missing.length) {
    return {
      backend: config.label,
      status: 'BLOCKED',
      missing,
      reason: '缺少 live Agent Service endpoint/token',
      rerun: RERUN,
    }
  }

  const adapter = new RemoteAgentServiceAdapter({
    id: config.id,
    builderId: config.label,
    client: createClient(config.endpoint, config.token),
    serviceTimeoutMs: 10000,
  })
  const readiness = await adapter.probeHealth()
  if (!readiness.ok) {
    return {
      backend: config.label,
      status: ['remote_timeout', 'remote_disconnected', 'remote_unavailable'].includes(readiness.code)
        ? 'BLOCKED'
        : 'FAIL',
      reason: readiness.message || readiness.code,
      code: readiness.code,
      readiness,
      rerun: RERUN,
    }
  }
  if (!config.packageId) {
    return {
      backend: config.label,
      status: 'ADVISORY',
      readiness,
      missing: [`KNOWME_${config.label.toUpperCase()}_AGENT_PACKAGE_ID`],
      reason: 'readiness 已通过，但未指定允许执行的 live fixture Package；未伪造场景 PASS',
      rerun: RERUN,
    }
  }

  const checks = []
  for (const scenario of ['success', 'failure', 'clarification']) {
    const terminals = []
    const runId = `live_${config.label}_${scenario}_${Date.now()}`
    try {
      const launched = await adapter.launch({
        runId,
        agentPackageId: config.packageId,
        expertId: config.packageId,
        prompt: process.env[`KNOWME_LIVE_${scenario.toUpperCase()}_PROMPT`] || `[knowme-live-e2e:${scenario}]`,
        governanceEnvelope: { approvals: { sideEffectDefault: 'deny' } },
      }, { onTerminal: event => terminals.push(event) })
      checks.push({
        id: scenario,
        status: scenario === 'clarification'
          ? (terminals.length === 0 && launched.handle.remoteStatus === 'need_input' ? 'PASS' : 'FAIL')
          : (terminals.length === 1 ? 'PASS' : 'FAIL'),
        remoteStatus: launched.handle.remoteStatus,
        terminal: terminals[0]?.terminal || null,
      })
    } catch (error) {
      checks.push({ id: scenario, status: 'FAIL', code: error.code, message: String(error.message || error) })
    }
  }

  const lifecycleRunId = `live_${config.label}_lifecycle_${Date.now()}`
  try {
    const lifecycle = await adapter.launch({
      runId: lifecycleRunId,
      agentPackageId: config.packageId,
      expertId: config.packageId,
      prompt: process.env.KNOWME_LIVE_LONG_RUNNING_PROMPT || '[knowme-live-e2e:wait-for-cancel]',
      governanceEnvelope: { approvals: { sideEffectDefault: 'deny' } },
    })
    const resumed = await adapter.resume(lifecycle.handle, 'live-checkpoint')
    checks.push({ id: 'resume', status: resumed.ok ? 'PASS' : 'FAIL', code: resumed.code })
    const cancelled = await adapter.cancel(lifecycle.handle, 'live_e2e_cleanup')
    checks.push({
      id: 'cancel',
      status: cancelled.withinBudgetMs ? 'PASS' : 'FAIL',
      code: cancelled.code,
    })
  } catch (error) {
    checks.push({ id: 'resume-cancel', status: 'FAIL', code: error.code, message: String(error.message || error) })
  }

  return {
    backend: config.label,
    status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL',
    readiness,
    checks,
    rerun: RERUN,
  }
}

async function main() {
  const results = []
  for (const backend of BACKENDS) results.push(await evaluateBackend(backend))
  const statuses = results.map(result => result.status)
  const status = statuses.includes('FAIL')
    ? 'FAIL'
    : statuses.includes('ADVISORY')
      ? 'ADVISORY'
      : statuses.every(item => item === 'BLOCKED')
        ? 'BLOCKED'
        : statuses.every(item => item === 'PASS')
          ? 'PASS'
          : 'ADVISORY'
  const report = {
    at: new Date().toISOString(),
    mode: 'live-agent-services',
    status,
    ok: status === 'PASS',
    hardGate: false,
    hermeticGateRequired: true,
    results,
    rerun: RERUN,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (status === 'FAIL') process.exitCode = 1
}

main().catch(error => {
  fs.writeFileSync(REPORT, `${JSON.stringify({
    at: new Date().toISOString(),
    mode: 'live-agent-services',
    status: 'FAIL',
    ok: false,
    hardGate: false,
    error: String(error?.stack || error),
    rerun: RERUN,
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
