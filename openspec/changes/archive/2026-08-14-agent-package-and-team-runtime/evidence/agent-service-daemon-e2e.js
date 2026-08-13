'use strict'

const fs = require('fs')
const http = require('http')
const {
  RemoteAgentServiceAdapter,
  BACKEND_DAEMON,
  CANCEL_BUDGET_MS,
} = require('../../../../src/lib/agent-run-launcher')

const REPORT = `${__dirname}/agent-service-daemon-e2e.json`

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('payload_too_large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function json(response, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': data.length,
  })
  response.end(data)
}

function createAgentService() {
  const runs = new Map()
  const requests = []
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1')
      requests.push({ method: request.method, path: url.pathname })
      if (request.method === 'POST' && url.pathname === '/agent/v1/handshake') {
        const body = await readBody(request)
        return json(response, 200, {
          protocolVersion: Math.min(1, Number(body.protocolVersion) || 1),
          builderId: 'workbench-daemon',
          capabilities: ['executeAgentRun', 'cancelRun', 'resumeRun', 'fetchRunStatus'],
        })
      }
      if (request.method === 'POST' && url.pathname === '/agent/v1/runs') {
        const body = await readBody(request)
        const run = {
          runId: body.runId,
          status: 'completed',
          terminal: 'completed',
          summary: `daemon completed ${body.agentPackageId}`,
        }
        runs.set(run.runId, run)
        return json(response, 200, { taskId: `task_${run.runId}`, ...run })
      }
      const match = url.pathname.match(/^\/agent\/v1\/runs\/([^/]+)(?:\/(cancel|resume))?$/)
      if (match) {
        const runId = decodeURIComponent(match[1])
        const action = match[2]
        if (request.method === 'GET' && !action) {
          return json(response, runs.has(runId) ? 200 : 404, runs.get(runId) || { code: 'not_found' })
        }
        if (request.method === 'POST' && action === 'cancel') {
          await readBody(request)
          const run = { ...(runs.get(runId) || { runId }), status: 'cancelled', terminal: 'cancelled' }
          runs.set(runId, run)
          return json(response, 200, { ok: true, ...run })
        }
        if (request.method === 'POST' && action === 'resume') {
          await readBody(request)
          const run = { ...(runs.get(runId) || { runId }), status: 'running', terminal: null }
          runs.set(runId, run)
          return json(response, 200, { ok: true, ...run })
        }
      }
      return json(response, 404, { code: 'not_found' })
    } catch (error) {
      return json(response, 400, { code: 'bad_request', message: String(error?.message || error) })
    }
  })
  return { server, runs, requests }
}

function createHttpClient(endpoint) {
  async function request(pathname, options = {}) {
    const response = await fetch(`${endpoint}${pathname}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.message || body.code || `HTTP ${response.status}`)
    return body
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
    cancelRun: (runId, body = {}) => request(`/agent/v1/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    resumeRun: (runId, body = {}) => request(`/agent/v1/runs/${encodeURIComponent(runId)}/resume`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  }
}

async function main() {
  const service = createAgentService()
  await new Promise((resolve, reject) => {
    service.server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve())
  })
  const address = service.server.address()
  const endpoint = `http://127.0.0.1:${address.port}`
  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'loopback-http-agent-service',
    endpoint,
    checks: [],
  }

  try {
    const adapter = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      builderId: 'workbench-daemon',
      client: createHttpClient(endpoint),
    })
    const handshake = await adapter.handshake()
    report.checks.push({
      id: 'versioned-handshake',
      ok: handshake.ok === true
        && handshake.negotiatedVersion === 1
        && handshake.capabilities.includes('executeAgentRun'),
    })

    const runId = `daemon_e2e_${Date.now()}`
    const terminalEvents = []
    const launched = await adapter.launch({
      runId,
      expertId: 'daemon-builder-agent',
      packageSnapshotHash: 'snapshot_e2e_1',
      governanceEnvelope: { tools: { allowlist: ['read_file'] } },
      prompt: 'daemon protocol e2e',
      handoff: { artifactRefs: ['artifact_input_1'] },
    }, {
      onTerminal: event => terminalEvents.push(event),
    })
    report.checks.push({
      id: 'remote-run-terminal',
      ok: launched.handle.runId === runId
        && terminalEvents.length === 1
        && terminalEvents[0].terminal === 'completed',
    })

    const status = await adapter.getStatus(launched.handle)
    report.checks.push({
      id: 'remote-status',
      ok: status.ok === true && status.status === 'completed',
    })

    const resumed = await adapter.resume(launched.handle, 'checkpoint_e2e_1')
    report.checks.push({
      id: 'remote-resume',
      ok: resumed.ok === true && resumed.status === 'running',
    })

    const cancelStarted = Date.now()
    const cancelled = await adapter.cancel(launched.handle, 'e2e_cleanup')
    const cancelElapsedMs = Date.now() - cancelStarted
    report.cancelElapsedMs = cancelElapsedMs
    report.checks.push({
      id: 'remote-cancel-budget',
      ok: cancelled.withinBudgetMs === true && cancelElapsedMs <= CANCEL_BUDGET_MS,
    })

    report.requestAudit = service.requests
    report.checks.push({
      id: 'http-boundaries-exercised',
      ok: ['/agent/v1/handshake', '/agent/v1/runs']
        .every(pathname => service.requests.some(item => item.path === pathname))
        && service.requests.some(item => item.path.endsWith('/resume'))
        && service.requests.some(item => item.path.endsWith('/cancel')),
    })
    report.ok = report.checks.every(check => check.ok)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    if (!report.ok) throw new Error('Agent Service Daemon E2E failed')
  } finally {
    await new Promise(resolve => service.server.close(resolve))
  }
}

main().catch(error => {
  let existing = {}
  try { existing = JSON.parse(fs.readFileSync(REPORT, 'utf8')) } catch { /* no report */ }
  fs.writeFileSync(REPORT, `${JSON.stringify({
    ...existing,
    at: new Date().toISOString(),
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
