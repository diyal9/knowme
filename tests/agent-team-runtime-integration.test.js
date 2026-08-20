'use strict'

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const agentTools = require('../src/lib/agent-tools')
const {
  AgentRunLauncher,
  RemoteAgentServiceAdapter,
  CANCEL_BUDGET_MS,
  HANDOFF_MAX_BYTES,
  validateHandoffPayload,
  isFakeSpawnResult,
  createLauncherRunManagerPort,
  BACKEND_DAEMON,
} = require('../src/lib/agent-run-launcher')
const {
  buildOrchestrationTools,
  runStates,
  MAX_SUB_RUNS,
  MAX_PARALLEL,
} = require('../src/lib/agent-orchestration')
const { AgentRunManager } = require('../src/lib/agent-run-manager')
const { AgentRunStore } = require('../src/lib/agent-run-store')

const tempDirs = []

function mkTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  runStates.clear()
})

function childFixture(runId, opts = {}) {
  return {
    input: { prompt: opts.prompt || 'child task', tier: 'chat', runId },
    llmScript: opts.llmScript || [{ response: { text: opts.childText || 'child completed ok' } }],
    settingsError: opts.settingsError,
    abortAt: opts.abortAt,
  }
}

function hangUntilAbort(ports, signal) {
  const baseComplete = ports.llm.complete.bind(ports.llm)
  ports.llm.complete = async (...args) => {
    if (signal?.aborted) return { cancelled: true }
    await new Promise((resolve) => {
      const onAbort = () => {
        clearInterval(poll)
        resolve()
      }
      const poll = setInterval(() => {
        if (signal?.aborted) onAbort()
      }, 25)
      signal?.addEventListener?.('abort', onAbort, { once: true })
    })
    if (signal?.aborted) return { cancelled: true }
    return baseComplete(...args)
  }
  return ports
}

function augmentPortsWithOrchestration(basePorts, orchBundle) {
  const surface = agentTools.createToolSurface({
    extraDefinitions: orchBundle.definitions,
    handlers: orchBundle.handlers,
  })
  const executor = surface.createToolExecutor({ signal: basePorts.signal })
  return {
    ...basePorts,
    tools: {
      surface: {
        getToolDefinitions: () => surface.getToolDefinitions(),
        validateToolCall: (name, args) => surface.validateToolCall(name, args),
      },
      execute: async (toolCall) => executor.executeToolCall(toolCall),
    },
    orchestration: {
      cancelAll: () => orchBundle.cancelAllSubRuns({ reason: 'parent_cancelled' }),
      cancelAllSubRuns: orchBundle.cancelAllSubRuns,
    },
  }
}

function createHarness(parentRunId = 'parent_run_1', opts = {}) {
  runStates.clear()
  const childRecords = new Map()

  const launcher = new AgentRunLauncher({
    buildPorts: ({ runId, prompt, handoff, signal, expertId }) => {
      const spec = typeof opts.childSpec === 'function'
        ? opts.childSpec(runId, { prompt, handoff, expertId, signal })
        : childFixture(runId, { prompt, ...opts.childDefaults })
      let ports = createMockRunPorts(spec, signal)
      if (opts.hangChildUntilAbort) ports = hangUntilAbort(ports, signal)
      childRecords.set(runId, { ports, spec, signal })
      return ports
    },
  })

  const runManager = createLauncherRunManagerPort(launcher, {
    runs: opts.runs || new Map(),
    busMessages: opts.busMessages || new Map(),
  })
  const orch = buildOrchestrationTools({ runId: parentRunId, runManager })

  return {
    parentRunId,
    launcher,
    runManager,
    orch,
    childRecords,
    augmentParentPorts: (basePorts) => augmentPortsWithOrchestration(basePorts, orch),
  }
}

async function waitForChildRecord(runManager, subRunId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const rec = runManager.runs.get(subRunId)
    if (rec?.terminal) return rec
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return runManager.runs.get(subRunId)
}

describe('agent-team-runtime integration', () => {
  it('launcher starts real child AgentRunExecutor with run phases', async () => {
    const { launcher } = createHarness()
    const runId = `child_phases_${Date.now()}`
    const { handle } = await launcher.launch({
      runId,
      prompt: 'phase smoke',
      parentRunId: 'parent_phases',
    })
    const result = await handle.runPromise
    assert.equal(result.report.terminal, RunPhase.DONE)
    assert.ok(result.report.runPhases.includes(RunPhase.PREPARE))
    assert.ok(result.report.runPhases.includes(RunPhase.MODEL))
    assert.ok(result.report.runPhases.includes(RunPhase.DONE))
    assert.equal(isFakeSpawnResult({ ok: true, launched: true, report: result.report }), false)
  })

  it('fails a child run that returns text without completing its execution contract', async () => {
    const { launcher } = createHarness()
    const runId = `child_contract_${Date.now()}`
    let terminal = null
    const { handle } = await launcher.launch({
      runId,
      prompt: 'import the project',
      parentRunId: 'parent_contract',
      executionContract: { requiredTools: ['import_project'] },
    }, {
      onTerminal: value => { terminal = value },
    })
    const result = await handle.runPromise
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.equal(terminal.terminal, RunPhase.ERROR)
    assert.equal(terminal.code, 'execution_contract_unmet')
    assert.equal(terminal.executionEvidence.gateStatus, 'blocked')
  })

  it('delegate then await completes real child run', async () => {
    const { orch } = createHarness('parent_delegate_await')
    const { handlers } = orch

    const delegated = await handlers.delegate_to_expert({
      expertId: 'researcher',
      prompt: 'analyze fixture',
      handoff: { task: 'smoke' },
    })
    assert.equal(delegated.ok, true)
    assert.equal(delegated.meta.launched, true)
    assert.ok(delegated.meta.subRunId)
    assert.match(delegated.text, /已启动/)

    const subRunId = delegated.meta.subRunId
    const awaited = await handlers.await_sub_run({ subRunId, timeoutMs: 15000 })
    assert.equal(awaited.ok, true)
    assert.match(awaited.text, /child completed ok|已完成/)
    assert.ok(['completed', 'done', RunPhase.DONE].includes(awaited.meta.terminal)
      || awaited.meta.status === 'completed'
      || awaited.meta.terminal === RunPhase.DONE)
  })

  it('child error surfaces to run record and status query', async () => {
    const { orch, runManager, launcher } = createHarness('parent_error_float', {
      childDefaults: { settingsError: 'no-api-key' },
    })
    const { handlers } = orch

    const delegated = await handlers.delegate_to_expert({
      expertId: 'broken',
      prompt: 'this child will fail',
    })
    assert.equal(delegated.ok, true)
    assert.equal(delegated.meta.launched, true)
    const subRunId = delegated.meta.subRunId

    const record = await waitForChildRecord(runManager, subRunId, 3000)
    assert.equal(record.terminal, RunPhase.ERROR)
    assert.match(record.report?.error?.message || '', /API Key/)

    const queried = runManager.getRunStatus(subRunId)
    assert.equal(queried.terminal, RunPhase.ERROR)
    assert.match(record.report?.error?.message || '', /API Key/)

    const { handle } = await launcher.launch({
      runId: `err_${Date.now()}`,
      prompt: 'fail direct',
    })
    const failed = await handle.runPromise
    assert.equal(failed.report.terminal, RunPhase.ERROR)
  })

  it('rejects fake register-only spawn results', async () => {
    assert.ok(isFakeSpawnResult({ ok: true, text: '子 Run 已登记', launched: false }))
    assert.ok(isFakeSpawnResult({
      ok: true,
      text: '子 Run subrun_x 已登记（expert=e1）',
      registeredOnly: true,
    }))

    runStates.clear()
    const { handlers } = buildOrchestrationTools({
      runId: 'fake_spawn_guard',
      spawnSubRun: async () => ({ ok: true, text: '子 Run 已登记（expert=e1）' }),
    })
    const rejected = await handlers.delegate_to_expert({ expertId: 'e1', prompt: 'must not fake register' })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.code, 'fake_spawn_rejected')
  })

  it('enforces sub-run budget and parallel cap', async () => {
    const { orch } = createHarness('parent_caps', { hangChildUntilAbort: true })
    const { handlers, state } = orch

    const first = await handlers.delegate_to_expert({ expertId: 'e1', prompt: 'slow child 1' })
    assert.equal(first.ok, true)
    assert.equal(first.meta.launched, true)

    const parallelBlocked = await handlers.delegate_to_expert({ expertId: 'e2', prompt: 'parallel blocked' })
    assert.equal(parallelBlocked.ok, false)
    assert.equal(parallelBlocked.code, 'parallel_cap_exceeded')

    await handlers.cancel_sub_run({ subRunId: first.meta.subRunId, reason: 'cap_test_cleanup' })
    await handlers.await_sub_run({ subRunId: first.meta.subRunId, timeoutMs: 5000 })

    const second = await handlers.delegate_to_expert({ expertId: 'e2', prompt: 'second ok' })
    const third = await handlers.delegate_to_expert({ expertId: 'e3', prompt: 'budget exceeded' })
    assert.equal(third.ok, false)
    assert.equal(third.code, 'orchestration_depth_exceeded')
    assert.equal(state.subRuns.length, MAX_SUB_RUNS)
    assert.equal(MAX_PARALLEL, 1)
    await handlers.cancel_sub_run({ subRunId: second.meta.subRunId, reason: 'cap_test_cleanup' })
  })

  it('parent cancel propagates within 3s with zero running leak', async () => {
    const { orch, runManager, launcher } = createHarness('parent_cancel_leak', { hangChildUntilAbort: true })
    const { handlers, state } = orch

    const delegated = await handlers.delegate_to_expert({ expertId: 'slow', prompt: 'hang until cancel' })
    assert.equal(delegated.meta.launched, true)
    const subRunId = delegated.meta.subRunId

    const startedAt = Date.now()
    const cancelMeta = await handlers.cancel_sub_run({ subRunId, reason: 'parent_cancel_test' })
    const elapsed = Date.now() - startedAt

    assert.ok(elapsed <= CANCEL_BUDGET_MS + 250, `cancel took ${elapsed}ms`)
    assert.equal(cancelMeta.meta.withinBudget, true)
    state.completeSubRun(subRunId, { status: 'cancelled' })
    assert.equal(state.runningLeakCount(), 0)

    const entry = launcher.getLaunchEntry(subRunId)
    if (entry?.handle?.runPromise) {
      await Promise.race([
        entry.handle.runPromise.catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, CANCEL_BUDGET_MS)),
      ])
    }
    assert.equal(launcher.getLaunchEntry(subRunId), null)

    const childRecord = runManager.runs.get(subRunId)
    assert.ok(
      childRecord?.terminal === RunPhase.CANCELLED
      || childRecord?.phase === RunPhase.CANCELLED
      || childRecord?.status === 'cancelled',
      `expected cancelled child record, got ${JSON.stringify(childRecord)}`,
    )
  })

  it('await_sub_run times out when child stays running', async () => {
    const { orch } = createHarness('parent_timeout', { hangChildUntilAbort: true })
    const { handlers } = orch

    const delegated = await handlers.delegate_to_expert({ expertId: 'slow', prompt: 'never finish' })
    const subRunId = delegated.meta.subRunId

    const awaited = await handlers.await_sub_run({ subRunId, timeoutMs: 120 })
    assert.equal(awaited.ok, false)
    assert.equal(awaited.code, 'subrun_timeout')

    await handlers.cancel_sub_run({ subRunId, reason: 'timeout_cleanup' })
  })

  it('rejects handoff payloads over 32KB', async () => {
    const oversized = { blob: 'x'.repeat(HANDOFF_MAX_BYTES) }
    const check = validateHandoffPayload(oversized)
    assert.equal(check.ok, false)
    assert.equal(check.code, 'handoff_payload_too_large')

    const { orch } = createHarness('parent_handoff_limit')
    const delegated = await orch.handlers.delegate_to_expert({
      expertId: 'writer',
      prompt: 'too much context',
      handoff: oversized,
    })
    assert.equal(delegated.ok, false)
    assert.equal(delegated.code, 'handoff_payload_too_large')
  })

  it('accepts handoff payloads at 32KB boundary', async () => {
    const payload = { note: 'a'.repeat(Math.max(0, HANDOFF_MAX_BYTES - 20)) }
    const check = validateHandoffPayload(payload)
    assert.equal(check.ok, true)
    assert.ok(check.size <= HANDOFF_MAX_BYTES)

    const { orch } = createHarness('parent_handoff_ok')
    const delegated = await orch.handlers.delegate_to_expert({
      expertId: 'writer',
      prompt: 'bounded handoff',
      handoff: payload,
    })
    assert.equal(delegated.ok, true)
    assert.equal(delegated.meta.launched, true)
    await orch.handlers.cancel_sub_run({ subRunId: delegated.meta.subRunId, reason: 'cleanup' })
  })

  it('AgentRunManager returns duplicate receipt for repeated idempotent launch', () => {
    const rootDir = mkTempDir('knowme-runstore-receipt-')
    const store = new AgentRunStore({ rootDir })
    const manager = new AgentRunManager({ runStore: store, autoLaunch: false })

    const key = 'launch-receipt-smoke'
    const first = manager.createRun({ idempotencyKey: key, autoLaunch: false })
    assert.equal(first.ok, true)
    assert.equal(first.duplicate, undefined)

    const second = manager.createRun({ idempotencyKey: key, autoLaunch: false })
    assert.equal(second.ok, true)
    assert.equal(second.duplicate, true)
    assert.equal(second.runId, first.runId)

    const opKey = require('../src/lib/agent-run-store').createOperationKey({ idempotencyKey: key })
    const receipt = store.readReceipt('__global__', opKey)
    assert.equal(receipt.ok, true)
    assert.equal(receipt.receipt.result.runId, first.runId)
  })

  it('RemoteAgentServiceAdapter handshake, status, and cancel', async () => {
    const events = []
    const client = {
      handshake: async ({ protocolVersion, builderId }) => {
        events.push(['handshake', protocolVersion, builderId])
        return { protocolVersion: 1, capabilities: ['executeAgentRun', 'cancelRun', 'fetchRunStatus'] }
      },
      executeAgentRun: async ({ runId, inputPayload, hooks }) => {
        events.push(['execute', runId, inputPayload?.prompt])
        hooks?.onProgress?.({ type: 'progress', text: 'working' })
        return { taskId: `remote_${runId}`, terminal: 'completed', summary: 'remote done' }
      },
      fetchRunStatus: async (runId) => {
        events.push(['status', runId])
        return { status: 'completed', phase: RunPhase.DONE, summary: 'remote done' }
      },
      cancelRun: async (runId, { reason } = {}) => {
        events.push(['cancel', runId, reason])
        return { ok: true, status: 'cancelled' }
      },
    }

    const adapter = new RemoteAgentServiceAdapter({ id: BACKEND_DAEMON, client })
    const hs = await adapter.handshake()
    assert.equal(hs.ok, true)
    assert.equal(hs.negotiatedVersion, 1)

    const runId = `remote_${Date.now()}`
    const { handle } = await adapter.launch({
      runId,
      expertId: 'daemon-agent',
      prompt: 'remote task',
      handoff: { ref: 'smoke' },
    }, {
      emit: (evt) => events.push(['emit', evt?.type || evt]),
      onTerminal: (info) => events.push(['terminal', info.terminal]),
    })
    assert.equal(handle.runId, runId)
    assert.ok(events.some((e) => e[0] === 'execute'))

    const status = await adapter.getStatus(handle)
    assert.equal(status.ok, true)
    assert.equal(status.status, 'completed')

    const cancelStarted = Date.now()
    const cancel = await adapter.cancel(handle, 'remote_test_cancel')
    assert.equal(cancel.withinBudgetMs, true)
    assert.ok(Date.now() - cancelStarted <= CANCEL_BUDGET_MS + 100)
    assert.ok(events.some((e) => e[0] === 'cancel' && e[1] === runId))
  })

  it('parent executor orchestrates delegate via mock RunPorts and real child executor', async () => {
    const { orch, augmentParentPorts } = createHarness('parent_executor_orch')
    const parentRunId = 'parent_executor_orch'

    const parentFixture = {
      input: { prompt: 'delegate to expert', tier: 'agent', forceTools: true, runId: parentRunId },
      llmScript: [
        {
          response: {
            text: '正在委派子专家…',
            toolCalls: [{
              name: 'delegate_to_expert',
              arguments: { expertId: 'analyst', prompt: 'summarize fixture' },
            }],
          },
        },
        { response: { text: '子任务已启动，父 Run 继续。' } },
      ],
    }

    let capturedSubRunId = null
    const origDelegate = orch.handlers.delegate_to_expert
    orch.handlers.delegate_to_expert = async (args) => {
      const result = await origDelegate(args)
      if (result?.meta?.subRunId) capturedSubRunId = result.meta.subRunId
      return result
    }

    const basePorts = createMockRunPorts(parentFixture)
    const ports = augmentParentPorts(basePorts)
    const events = []
    const result = await AgentRunExecutor.run(parentFixture.input, ports, (e) => events.push(e))

    assert.equal(result.report.terminal, RunPhase.DONE)
    assert.ok(capturedSubRunId, 'expected delegate_to_expert to launch child')
    assert.ok(result.report.runPhases.includes(RunPhase.TOOL))
    assert.ok(events.some((e) => e.payload?.toolName === 'delegate_to_expert' || e.payload?.runPhase === RunPhase.ORCHESTRATE))

    const childStatus = await orch.runManager.awaitRun(capturedSubRunId, 15000)
    assert.equal(childStatus.ok, true)
    assert.ok(childStatus.summary?.includes('child completed')
      || childStatus.text?.includes('child completed')
      || childStatus.status === 'completed')
  })

  it('send_run_message delivers bus envelope under size limit', async () => {
    const { orch, runManager } = createHarness('parent_bus')
    const targetRunId = 'target_run_bus'

    const sent = await orch.handlers.send_run_message({
      targetRunId,
      kind: 'status',
      payload: { hello: 'team-runtime' },
    })
    assert.equal(sent.ok, true)
    assert.ok(sent.meta.messageId)

    const messages = runManager.getMessages(targetRunId)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].kind, 'status')
    assert.equal(messages[0].payload.hello, 'team-runtime')
    assert.equal(messages[0].busVersion, 1)
  })
})
