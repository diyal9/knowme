'use strict'
const { currentPage, readPreload } = require('./helpers/current-src')

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const registry = require('../src/lib/tool-contract-registry')
const output = require('../src/lib/agent-output-protocol')
const messageState = require('../src/lib/agent-message-state')

const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')

const ROOT = path.join(__dirname, '..')
const MAIN = readMainIpcBundle()
const PRELOAD = fs.readFileSync(path.join(ROOT, 'src', 'preload', 'index.ts'), 'utf8')
const WORKSPACE_AGENT = currentPage('workspace-agent.js')
const WORKSPACE_HTML = currentPage('workspace.html')

const baseContract = {
  source: 'builtin',
  capability: 'test',
  risk: 'read',
  sideEffects: false,
  requiresApproval: false,
  scope: 'content-source',
  timeoutMs: 5000,
  idempotencySupported: false,
  rollbackSupported: false,
}

function evt(runId, seq, type, payload = {}, extra = {}) {
  return {
    version: messageState.PROTOCOL_VERSION,
    runId,
    seq,
    lane: extra.lane || 'progress',
    type,
    payload,
    phase: extra.phase || 'ORCHESTRATE',
    round: extra.round ?? 1,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('agent-team-runtime-governance-ui', () => {
  describe('ToolContractRegistry per-run governance', () => {
    let reg

    beforeEach(() => {
      reg = registry.createRegistry()
      reg.registerTool(
        { function: { name: 'echo', description: 'echo', parameters: { type: 'object', properties: {} } } },
        { ...baseContract, capability: 'echo' },
        async () => ({ ok: true, text: 'pong' }),
      )
      reg.registerTool(
        { function: { name: 'delegate_to_expert', description: 'delegate', parameters: { type: 'object', properties: {} } } },
        { ...baseContract, capability: 'orchestration', risk: 'read', sideEffects: false },
        async () => ({ ok: true, text: 'delegated', subRunId: 'sub_1' }),
      )
      reg.registerTool(
        { function: { name: 'file.write', description: 'write', parameters: { type: 'object', properties: { idempotencyKey: { type: 'string' } } } } },
        { ...baseContract, capability: 'file', risk: 'write', sideEffects: true, idempotencySupported: true, requiresApproval: true },
        async (args) => ({ ok: true, text: 'written', draftId: `draft_${args?.idempotencyKey || 'x'}` }),
      )
      reg.registerTool(
        { function: { name: 'slow_tool', description: 'slow', parameters: { type: 'object', properties: {} } } },
        { ...baseContract, timeoutMs: 40 },
        async (_args, signal) => {
          await sleep(200)
          if (signal?.aborted) {
            const err = new Error('cancelled')
            err.code = 'cancelled'
            throw err
          }
          return { ok: true, text: 'slow-done' }
        },
      )
    })

    afterEach(() => {
      registry.unbindRunRuntimeContext('run_parent')
      registry.unbindRunRuntimeContext('run_child')
      registry.unbindRunRuntimeContext('run_idem_a')
      registry.unbindRunRuntimeContext('run_idem_b')
    })

    it('applies independent allowlist per parent and child run', () => {
      const parentPolicy = { allowlist: ['echo', 'delegate_to_expert'] }
      const childPolicy = { allowlist: ['echo'] }

      const parentDefs = reg.getDefinitionsForRun(parentPolicy)
      const childDefs = reg.getDefinitionsForRun(childPolicy)

      assert.ok(parentDefs.some((d) => d.function.name === 'delegate_to_expert'))
      assert.ok(!childDefs.some((d) => d.function.name === 'delegate_to_expert'))
      assert.ok(childDefs.some((d) => d.function.name === 'echo'))
    })

    it('denies undeclared tools at validate and execute with scope_denied', async () => {
      const policy = { denylist: ['file.write'] }
      const validation = reg.validateToolCall('file.write', '{}', registry.validateArgsAgainstSchema, policy)
      assert.equal(validation.ok, false)
      assert.equal(validation.code, 'scope_denied')

      const result = await reg.execute('file.write', { idempotencyKey: 'k1' }, {
        runId: 'run_parent',
        governancePolicy: policy,
        userData: os.tmpdir(),
      })
      assert.equal(result.ok, false)
      assert.equal(result.code, 'scope_denied')
    })

    it('treats explicit empty allowlists as deny-all', async () => {
      const policy = registry.normalizeRunGovernancePolicy({ tools: { allowlist: [] } })
      assert.equal(reg.getDefinitionsForRun(policy).length, 0)
      const result = await reg.execute('echo', {}, {
        runId: 'run_deny_all',
        governancePolicy: policy,
        userData: os.tmpdir(),
      })
      assert.equal(result.ok, false)
      assert.equal(result.code, 'scope_denied')
    })

    it('enforces contract timeoutMs at execute wrapper', async () => {
      const budgetTimeout = await reg.execute('echo', {}, {
        runId: 'run_parent',
        userData: os.tmpdir(),
        getRemainingTimeoutMs: () => 0,
      })
      assert.equal(budgetTimeout.ok, false)
      assert.equal(budgetTimeout.code, 'timeout')

      const slow = await reg.execute('slow_tool', {}, { runId: 'run_parent', userData: os.tmpdir() })
      assert.equal(slow.ok, false)
      assert.ok(['timeout', 'cancelled'].includes(slow.code), `slow tool must abort, got ${slow.code}`)
    })

    it('aborts in-flight tool when AbortSignal fires', async () => {
      const controller = new AbortController()
      registry.bindRunRuntimeContext('run_parent', { signal: controller.signal })
      const pending = reg.execute('slow_tool', {}, { runId: 'run_parent', userData: os.tmpdir() })
      await sleep(10)
      controller.abort()
      const result = await pending
      assert.equal(result.ok, false)
      assert.equal(result.code, 'cancelled')
    })

    it('deduplicates idempotent writes within run scope', async () => {
      let calls = 0
      reg.registerTool(
        { function: { name: 'idem_write', description: 'idem', parameters: { type: 'object', properties: { idempotencyKey: { type: 'string' } } } } },
        { ...baseContract, risk: 'write', sideEffects: true, idempotencySupported: true },
        async () => {
          calls += 1
          return { ok: true, text: 'once', auditId: 'audit_first' }
        },
      )

      const ctx = { runId: 'run_idem_a', userData: os.tmpdir() }
      const first = await reg.execute('idem_write', { idempotencyKey: 'same-key' }, ctx)
      const second = await reg.execute('idem_write', { idempotencyKey: 'same-key' }, ctx)

      assert.equal(calls, 1)
      assert.equal(first.auditId, 'audit_first')
      assert.equal(second.auditId, 'audit_first')
      assert.equal(second.receipt?.deduplicated, true)
    })

    it('does not share idempotency cache across different runs', async () => {
      let calls = 0
      reg.registerTool(
        { function: { name: 'idem_cross', description: 'idem cross', parameters: { type: 'object', properties: { idempotencyKey: { type: 'string' } } } } },
        { ...baseContract, risk: 'write', sideEffects: true, idempotencySupported: true },
        async () => {
          calls += 1
          return { ok: true, text: `call-${calls}`, auditId: `audit_${calls}` }
        },
      )

      await reg.execute('idem_cross', { idempotencyKey: 'shared' }, { runId: 'run_idem_a', userData: os.tmpdir() })
      await reg.execute('idem_cross', { idempotencyKey: 'shared' }, { runId: 'run_idem_b', userData: os.tmpdir() })
      assert.equal(calls, 2)
    })

    it('wraps approval-required writes with pending_review envelope fields', async () => {
      const result = await reg.execute('file.write', { idempotencyKey: 'draft-1' }, {
        runId: 'run_parent',
        parentRunId: 'run_parent',
        subRunId: 'sub_child',
        userData: os.tmpdir(),
        governancePolicy: { allowlist: ['file.write'] },
      })
      assert.equal(result.ok, true)
      assert.equal(result.requiresApproval, true)
      assert.equal(result.pendingReview, true)
      assert.ok(result.draftId)
      assert.equal(result.subRunId, 'sub_child')
    })

    it('computeEffectiveTimeoutMs respects run remaining budget', () => {
      const effective = registry.computeEffectiveTimeoutMs({ timeoutMs: 5000 }, { getRemainingTimeoutMs: () => 800 })
      assert.equal(effective, 800)
    })
  })

  describe('Output Protocol sub-run events', () => {
    it('maps subrun lifecycle types to progress lane', () => {
      for (const type of [
        output.EventType.SUBRUN_STARTED,
        output.EventType.SUBRUN_PROGRESS,
        output.EventType.SUBRUN_TERMINAL,
      ]) {
        const event = output.createSubRunOutputEvent(type, {
          subRunId: 'sub_1',
          parentRunId: 'run_parent',
          subRunSeq: 1,
          expertId: 'expert-a',
        }, { runId: 'run_parent', seq: 1 })
        assert.ok(event)
        assert.equal(event.lane, output.Lane.PROGRESS)
        assert.notEqual(event.lane, output.Lane.ANSWER)
        assert.doesNotThrow(() => structuredClone(event))
      }
    })

    it('parent emitter keeps single terminal after subrun events', () => {
      const emitter = output.createRunEmitter('run_parent')
      const events = []
      const emit = (e) => events.push(e)

      emitter.emit(output.EventType.SUBRUN_STARTED, { subRunId: 'sub_1', expertId: 'e1' }, { phase: 'ORCHESTRATE' }, emit)
      emitter.emit(output.EventType.SUBRUN_PROGRESS, { subRunId: 'sub_1', phase: 'TOOL' }, { phase: 'ORCHESTRATE' }, emit)
      emitter.emit(output.EventType.SUBRUN_TERMINAL, { subRunId: 'sub_1', terminal: 'completed' }, { phase: 'ORCHESTRATE' }, emit)
      emitter.emit(output.EventType.RUN_COMPLETED, { title: '完成' }, { phase: 'DONE', lane: output.Lane.TERMINAL }, emit)

      const terminals = events.filter((e) => output.TERMINAL_TYPES.has(e.type))
      assert.equal(terminals.length, 1)
      assert.equal(terminals[0].type, output.EventType.RUN_COMPLETED)
      assert.equal(events.filter((e) => e.type === output.EventType.SUBRUN_TERMINAL).length, 1)
      assert.equal(emitter.terminalEmitted, true)
    })

    it('subrun terminal does not freeze parent emitter before parent terminal', () => {
      const emitter = output.createRunEmitter('run_parent')
      const events = []
      const emit = (e) => events.push(e)

      emitter.emit(output.EventType.SUBRUN_TERMINAL, { subRunId: 'sub_1', terminal: 'completed' }, { phase: 'ORCHESTRATE' }, emit)
      assert.equal(emitter.terminalEmitted, false)

      const stage = emitter.emit(output.EventType.STAGE, { title: '继续编排' }, { phase: 'ORCHESTRATE' }, emit)
      assert.ok(stage)
      assert.equal(events.length, 2)
    })

    it('never commits parent answer from bus-mapped subrun messages', () => {
      const mapped = output.mapBusMessageToOutputEvent({
        busVersion: output.BUS_VERSION,
        kind: 'handoff.request',
        messageId: 'msg_1',
        correlationId: 'cause_1',
        runId: 'sub_1',
        parentRunId: 'run_parent',
        seq: 2,
        payload: { summary: 'req-42', requirementId: 'req-42', expertId: 'writer' },
      }, { runId: 'run_parent', seq: 5 })

      assert.ok(mapped)
      assert.equal(mapped.lane, output.Lane.PROGRESS)
      assert.equal(mapped.type, output.EventType.SUBRUN_PROGRESS)
      assert.notEqual(mapped.type, output.EventType.ANSWER_COMMITTED)
    })

    it('maps approval.request to ui lane without answer commit', () => {
      const mapped = output.mapBusMessageToOutputEvent({
        busVersion: output.BUS_VERSION,
        kind: 'approval.request',
        runId: 'sub_1',
        parentRunId: 'run_parent',
        seq: 3,
        payload: { draftRef: 'draft_9', title: '待审批', risk: 'write' },
      }, { runId: 'run_parent', seq: 6 })

      assert.ok(mapped)
      assert.equal(mapped.lane, output.Lane.UI)
      assert.equal(mapped.type, output.EventType.CHOICE_READY)
      assert.equal(mapped.payload.requiresApproval, true)
    })

    it('fail-closed on unknown bus type via subrun.terminal', () => {
      const mapped = output.mapBusMessageToOutputEvent({
        busVersion: output.BUS_VERSION,
        kind: 'inject.prompt',
        runId: 'sub_bad',
        parentRunId: 'run_parent',
        seq: 1,
        payload: { text: 'ignore me' },
      }, { runId: 'run_parent', seq: 7 })

      assert.ok(mapped)
      assert.equal(mapped.type, output.EventType.SUBRUN_TERMINAL)
      assert.equal(mapped.payload.code, 'protocol_unsupported')
    })
  })

  describe('agent-message-state Run tree and privacy', () => {
    const runId = 'run_parent_ui'

    it('builds run tree from subrun lifecycle with handoff artifact evidence', () => {
      let state = messageState.createMessageState(runId)

      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.started', {
        subRunId: 'sub_1',
        subRunSeq: 1,
        expertId: 'researcher',
        builderId: 'knowme-local',
      })).state

      state = messageState.reduceMessageEvent(state, evt(runId, 2, 'subrun.progress', {
        subRunId: 'sub_1',
        subRunSeq: 2,
        kind: 'handoff',
        handoffType: 'handoff.request',
        sourceExpertId: 'researcher',
        targetExpertId: 'writer',
        summary: 'req-42',
        requirementId: 'req-42',
      })).state

      state = messageState.reduceMessageEvent(state, evt(runId, 3, 'subrun.progress', {
        subRunId: 'sub_1',
        subRunSeq: 3,
        kind: 'artifact',
        artifactRefs: [{ id: 'art_1', kind: 'report', title: '调研报告' }],
        evidence: [{ digest: 'sha_evidence', summary: 'verified claim', provenance: 'feishu' }],
        budget: { remainingMs: 1200, apiKey: 'secret-should-redact' },
      })).state

      const node = state.runTree.nodes.sub_1
      assert.ok(node)
      assert.equal(node.handoffs.length, 1)
      assert.equal(node.artifacts.length, 1)
      assert.equal(node.evidence.length, 1)
      assert.equal(node.budget.remainingMs, 1200)
      assert.equal(node.budget.apiKey, '[REDACTED]')
      assert.ok(state.timeline.some((row) => row.kind === 'subrun' && row.subRunId === 'sub_1'))
    })

    it('parent terminal does not freeze before completion; subrun terminal keeps parent running', () => {
      let state = messageState.createMessageState(runId)

      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.started', {
        subRunId: 'sub_1', subRunSeq: 1, expertId: 'e1',
      })).state
      state = messageState.reduceMessageEvent(state, evt(runId, 2, 'subrun.terminal', {
        subRunId: 'sub_1', subRunSeq: 2, terminal: 'completed', summary: '子 Run 完成',
      })).state

      assert.equal(state.frozen, false)
      assert.equal(state.status, 'running')
      assert.equal(state.runTree.nodes.sub_1.frozen, true)

      state = messageState.reduceMessageEvent(state, evt(runId, 3, 'run.completed', { title: '完成' }, { lane: 'terminal' })).state
      assert.equal(state.frozen, true)
      assert.equal(state.status, 'completed')
    })

    it('records late subrun seq after parent terminal without unfreezing parent', () => {
      let state = messageState.createMessageState(runId)

      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.started', {
        subRunId: 'sub_1', subRunSeq: 1, expertId: 'e1',
      })).state
      state = messageState.reduceMessageEvent(state, evt(runId, 2, 'run.completed', { title: '完成' }, { lane: 'terminal' })).state

      const late = messageState.reduceMessageEvent(state, evt(runId, 3, 'subrun.progress', {
        subRunId: 'sub_1', subRunSeq: 2, phase: 'VERIFY', summary: 'late phase',
      }))

      assert.equal(state.frozen, true)
      assert.equal(state.status, 'completed')
      assert.equal(late.state.frozen, true)
      assert.equal(late.state.status, 'completed')
      assert.ok(late.state.runTree.nodes.sub_1.phases.some((p) => p.phase === 'VERIFY'))
    })

    it('redacts sensitive fields in message reducer payloads', () => {
      let state = messageState.createMessageState(runId)
      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.progress', {
        subRunId: 'sub_1',
        subRunSeq: 1,
        authorization: 'Bearer abc.def.ghi',
        password: 'plain-secret',
        summary: 'safe text',
      })).state

      const node = state.runTree.nodes.sub_1
      assert.equal(node.summary, 'safe text')
      const redacted = messageState.redactSensitiveFields({
        authorization: 'Bearer abc',
        nested: { api_key: 'k-123' },
      })
      assert.equal(redacted.authorization, '[REDACTED]')
      assert.equal(redacted.nested.api_key, '[REDACTED]')
    })

    it('projects approval choices and terminal evidence refs into the sub-run node', () => {
      let state = messageState.createMessageState(runId)
      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.started', {
        subRunId: 'sub_approval', subRunSeq: 1, expertId: 'writer',
      })).state
      state = messageState.reduceMessageEvent(state, evt(runId, 2, 'choice.ready', {
        subRunId: 'sub_approval',
        draftId: 'draft_1',
        requiresApproval: true,
        risk: 'write',
        ui: [{ kind: 'approval', title: '待审批', items: [] }],
      }, { lane: 'ui' })).state
      state = messageState.reduceMessageEvent(state, evt(runId, 3, 'subrun.completed', {
        subRunId: 'sub_approval',
        subRunSeq: 2,
        terminal: 'completed',
        evidenceRefs: [{ id: 'ev_1', digest: 'digest-1', summary: '已核验' }],
        artifactRefs: ['artifact_1'],
      })).state

      const node = state.runTree.nodes.sub_approval
      assert.equal(node.approvals.length, 1)
      assert.equal(node.approvals[0].draftId, 'draft_1')
      assert.equal(node.evidence[0].digest, 'digest-1')
      assert.equal(node.artifacts[0].id, 'artifact_1')
    })

    it('merges persisted snapshots without rendering the root as a child', () => {
      const state = messageState.createMessageState(runId)
      messageState.mergeRunTreeSnapshot(state, {
        rootRunId: runId,
        resumeAvailable: true,
        nodes: {
          [runId]: { status: 'interrupted' },
          sub_persisted: { parentRunId: runId, status: 'done', terminal: 'completed' },
        },
      })
      assert.equal(state.runTree.nodes[runId], undefined)
      assert.ok(state.runTree.nodes.sub_persisted)
      assert.equal(state.resumeAvailable, true)
    })

    it.skip('applyStateToMessage projects runTree onto chat message', () => {
      let state = messageState.createMessageState(runId)
      state = messageState.reduceMessageEvent(state, evt(runId, 1, 'subrun.started', {
        subRunId: 'sub_1', subRunSeq: 1, expertId: 'e1',
      })).state

      const message = { role: 'assistant', text: '', streaming: true }
      messageState.applyStateToMessage(message, state)
      assert.ok(message.runTree)
      assert.ok(message.runTree.nodes.sub_1)
      assert.ok(Array.isArray(message.trace))
    })
  })

  describe('preload/workspace static contract', () => {
    it.skip('preload exposes team run governance IPC bridges', () => {
      assert.match(PRELOAD, /agentRunTree:/)
      assert.match(PRELOAD, /agent-run-tree/)
      assert.match(PRELOAD, /agentRunCancel:/)
      assert.match(PRELOAD, /agentRunResume:/)
      assert.match(PRELOAD, /agentRunRetry:/)
      assert.match(PRELOAD, /toolApproveDraft:/)
      assert.match(PRELOAD, /onAiStreamEvent:/)
      assert.match(PRELOAD, /ai-stream-event/)
    })

    it.skip('workspace loads AgentMessageState before workspace-agent', () => {
      const stateIdx = WORKSPACE_HTML.indexOf('lib/agent-message-state.js')
      const agentIdx = WORKSPACE_HTML.indexOf('workspace-agent.js')
      assert.ok(stateIdx >= 0)
      assert.ok(agentIdx > stateIdx)
    })

    it.skip('workspace-agent renders Run tree with handoff approval artifact evidence sections', () => {
      assert.match(WORKSPACE_AGENT, /function renderRunTreePanel/)
      assert.match(WORKSPACE_AGENT, /function renderRunTreeNode/)
      assert.match(WORKSPACE_AGENT, /renderRunTreeMetaSection\('Handoff'/)
      assert.match(WORKSPACE_AGENT, /renderRunTreeMetaSection\('审批'/)
      assert.match(WORKSPACE_AGENT, /renderRunTreeMetaSection\('产物'/)
      assert.match(WORKSPACE_AGENT, /renderRunTreeMetaSection\('证据'/)
      assert.match(WORKSPACE_AGENT, /reduceMessageEvent/)
      assert.match(WORKSPACE_AGENT, /mergeRunTreeSnapshot/)
      assert.match(WORKSPACE_AGENT, /agent-run-tree/)
      assert.match(WORKSPACE_AGENT, /data-subrun-id/)
    })

    it.skip('workspace-agent keeps v2 answer commit isolated from subrun trace rows', () => {
      assert.match(WORKSPACE_AGENT, /v2AnswerCommitted/)
      assert.match(WORKSPACE_AGENT, /item\.kind === 'subrun'/)
      assert.match(WORKSPACE_AGENT, /agent-trace-row subrun/)
      assert.doesNotMatch(WORKSPACE_AGENT, /subrun\.terminal[\s\S]{0,80}v2AnswerCommitted\s*=\s*true/)
    })

    it('orchestration tool names registered in registry contract set', () => {
      assert.ok(registry.ORCHESTRATION_TOOL_NAMES.has('delegate_to_expert'))
      assert.ok(registry.ORCHESTRATION_TOOL_NAMES.has('handoff_artifact'))
      assert.ok(registry.ORCHESTRATION_TOOL_NAMES.has('await_sub_run'))
    })

    it('supports fail-closed emergency disable without restoring fake spawn', () => {
      assert.match(MAIN, /process\.env\.KNOWME_AGENT_TEAM_RUNTIME !== '0'/)
      assert.match(MAIN, /needsConnectorTools && isToolSurfaceV1\(\) && teamRuntime\.enabled/)
      assert.doesNotMatch(MAIN, /子 Run 已登记/)
    })
  })
})
