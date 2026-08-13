'use strict'

const fs = require('node:fs')
const http = require('node:http')
const {
  RemoteAgentServiceAdapter,
  BACKEND_DAEMON,
} = require('../../../../src/lib/agent-run-launcher')

const REPORT = `${__dirname}/agent-service-hermetic-e2e.json`

function json(response, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': data.length,
  })
  response.end(data)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
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

function createService() {
  const runs = new Map()
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.method === 'POST' && url.pathname === '/agent/v1/handshake') {
      return json(response, 200, {
        protocolVersion: 1,
        builderId: 'hermetic-daemon',
        capabilities: ['executeAgentRun', 'cancelRun', 'resumeRun', 'fetchRunStatus'],
      })
    }
    if (request.method === 'POST' && url.pathname === '/agent/v1/runs') {
      const body = await readBody(request)
      const scenario = String(body.inputPayload?.prompt || '')
      if (scenario === 'disconnect') {
        request.socket.destroy()
        return
      }
      if (scenario === 'timeout') {
        setTimeout(() => json(response, 200, {
          taskId: `task_${body.runId}`,
          runId: body.runId,
          status: 'completed',
          terminal: 'completed',
        }), 200)
        return
      }
      const terminal = scenario === 'failure'
        ? 'failed'
        : scenario === 'clarification'
          ? 'need_input'
          : scenario === 'running'
            ? null
            : 'completed'
      const run = {
        runId: body.runId,
        status: terminal || 'running',
        terminal,
        summary: terminal === 'need_input' ? '请补充目标范围' : `${scenario} result`,
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
        const run = { ...(runs.get(runId) || { runId }), status: 'running', terminal: null, resumed: true }
        runs.set(runId, run)
        return json(response, 200, { ok: true, ...run })
      }
    }
    return json(response, 404, { code: 'not_found' })
  })
  return { server, runs }
}

function createClient(endpoint) {
  async function request(pathname, options = {}) {
    const response = await fetch(`${endpoint}${pathname}`, {
      ...options,
      headers: { 'content-type': 'application/json' },
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.code || `HTTP ${response.status}`)
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

async function main() {
  const service = createService()
  await new Promise((resolve, reject) => {
    service.server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve())
  })
  const endpoint = `http://127.0.0.1:${service.server.address().port}`
  const report = {
    at: new Date().toISOString(),
    mode: 'hermetic-loopback-http',
    status: 'FAIL',
    hardGate: true,
    checks: [],
  }

  try {
    const adapter = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      builderId: 'hermetic-daemon',
      client: createClient(endpoint),
      serviceTimeoutMs: 80,
    })
    const readiness = await adapter.probeHealth()
    report.checks.push({
      id: 'readiness',
      status: readiness.ok && readiness.status === 'READY' ? 'PASS' : 'FAIL',
      negotiatedVersion: readiness.negotiatedVersion,
    })

    for (const scenario of ['success', 'failure', 'clarification']) {
      const terminals = []
      const launched = await adapter.launch({
        runId: `hermetic_${scenario}`,
        expertId: 'fixture-agent',
        prompt: scenario,
      }, { onTerminal: event => terminals.push(event) })
      const expectedTerminal = scenario === 'success' ? 'completed' : scenario === 'failure' ? 'failed' : null
      report.checks.push({
        id: scenario,
        status: expectedTerminal
          ? (terminals.length === 1 && terminals[0].terminal === expectedTerminal ? 'PASS' : 'FAIL')
          : (terminals.length === 0 && launched.handle.remoteStatus === 'need_input' ? 'PASS' : 'FAIL'),
        remoteStatus: launched.handle.remoteStatus,
        terminalCount: terminals.length,
      })
    }

    const running = await adapter.launch({
      runId: 'hermetic_running',
      expertId: 'fixture-agent',
      prompt: 'running',
    })
    const resumed = await adapter.resume(running.handle, 'checkpoint-1')
    report.checks.push({
      id: 'recovery',
      status: resumed.ok && resumed.resumed === true ? 'PASS' : 'FAIL',
    })
    const cancelStarted = Date.now()
    const cancelled = await adapter.cancel(running.handle, 'hermetic_cancel')
    report.checks.push({
      id: 'cancel',
      status: cancelled.withinBudgetMs && Date.now() - cancelStarted < 3000 ? 'PASS' : 'FAIL',
      elapsedMs: Date.now() - cancelStarted,
    })

    for (const scenario of ['timeout', 'disconnect']) {
      let code = null
      try {
        await adapter.launch({
          runId: `hermetic_${scenario}`,
          expertId: 'fixture-agent',
          prompt: scenario,
        })
      } catch (error) {
        code = error.code
      }
      report.checks.push({
        id: scenario,
        status: code === (scenario === 'timeout' ? 'remote_timeout' : 'remote_disconnected') ? 'PASS' : 'FAIL',
        code,
      })
    }

    report.status = report.checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL'
    report.ok = report.status === 'PASS'
  } finally {
    await new Promise(resolve => service.server.close(resolve))
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }
  if (!report.ok) process.exitCode = 1
}

main().catch(error => {
  fs.writeFileSync(REPORT, `${JSON.stringify({
    at: new Date().toISOString(),
    mode: 'hermetic-loopback-http',
    status: 'FAIL',
    hardGate: true,
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
