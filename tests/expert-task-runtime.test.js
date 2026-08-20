const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const agentRun = require('../src/lib/agent-run')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')

async function waitFor(check, timeoutMs = 1500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for expert task runtime')
}

describe('expert task runtime', () => {
  it('sends review feedback and the prior artifact back to the expert as version 2', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-runtime-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '整理飞书消息',
      title: '待处理消息清单',
      expertId: 'office-partner',
      expertName: '办公协作专家',
      status: 'review',
      brief: {
        goal: '整理飞书消息',
        materials: [],
        deliverables: [{ id: 'primary', title: '可直接审阅的同步稿', type: 'document', required: true }],
      },
      execRef: { kind: 'session', id: 'session-review' },
      resultSummary: '上一版摘要',
      deliverables: [{
        deliverableId: 'primary',
        title: '可直接审阅的同步稿',
        type: 'document',
        version: 1,
        required: true,
        artifactRef: 'session-review#artifact-v1',
        acceptanceStatus: 'pending',
      }],
      events: [{ type: 'deliverable_ready', summary: '已提交第一版' }],
    })
    let session = {
      id: 'session-review',
      agentId: 'personal',
      expertId: 'office-partner',
      messages: [],
      run: {
        ...agentRun.createEmptyRun(),
        artifacts: [{
          id: 'artifact-v1',
          type: 'document',
          title: '可直接审阅的同步稿',
          body: '上一版正文：只有消息内容，没有负责人。',
          status: 'draft',
          meta: {},
        }],
      },
    }
    let capturedPrompt = ''
    let capturedPayload = null
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'test-key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({
        expertRuntime: () => ({ readSessionSnapshot: () => ({ persona: { systemPrompt: '你负责办公协作。' } }) }),
      }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        capturedPrompt = payload.prompt
        capturedPayload = payload
        session.messages.push(
          { role: 'user', text: payload.prompt },
          { role: 'assistant', text: '第二版正文：已补充负责人和截止时间。' },
        )
        return {
          runId: payload.runId,
          text: '第二版正文：已补充负责人和截止时间。',
          executionEvidence: { gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [] },
        }
      },
      agentRun,
    })

    const reviewed = runtime.reviewDeliverable({
      taskId: created.task.id,
      deliverableId: 'primary',
      action: 'changes_requested',
      comment: '请补充每条消息的负责人和截止时间。',
    })

    assert.equal(reviewed.ok, true)
    assert.equal(reviewed.started, true)
    assert.equal(reviewed.task.status, 'revising')
    const revised = await waitFor(() => {
      const current = store.get(created.task.id)
      return current.ok && current.task.status === 'review' && current.task.deliverables[0].version === 2
        ? current.task
        : null
    })

    assert.match(capturedPrompt, /请补充每条消息的负责人和截止时间/)
    assert.match(capturedPrompt, /上一版正文：只有消息内容，没有负责人/)
    assert.match(capturedPrompt, /不要输出“交付物 1”、类型、版本、Document/)
    assert.match(capturedPrompt, /不要使用方括号占位符/)
    assert.equal(capturedPayload.surface, 'workbench')
    assert.equal(capturedPayload.expertId, 'office-partner')
    assert.equal(capturedPayload.taskId, undefined)
    assert.equal(capturedPayload.workbenchTaskId, created.task.id)
    assert.equal(capturedPayload.permissions.orchestration.allowDelegate, false)
    assert.equal(revised.deliverables[0].acceptanceStatus, 'pending')
    assert.equal(revised.deliverables[0].previousVersionId, 'artifact-v1')
    assert.equal(revised.deliverables[0].comments.at(-1).body, '请补充每条消息的负责人和截止时间。')
    assert.equal(revised.events.at(-1).type, 'revision_ready')
    assert.equal(session.run.artifacts.at(-1).body, '第二版正文：已补充负责人和截止时间。')
  })

  it('runs every requested deliverable in sequence and does not complete on the first acceptance', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-multi-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '先预览再导入', expertId: 'importer', status: 'starting',
      brief: {
        goal: '先预览再导入', materials: [],
        deliverables: [
          { id: 'preview', title: '导入预览', required: true },
          { id: 'result', title: '导入结果', required: true },
        ],
      },
      execRef: { kind: 'session', id: 'session-multi' },
    })
    let session = { id: 'session-multi', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const payloads = []
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, payload) => {
        payloads.push(payload)
        return { runId: payload.runId, text: payloads.length === 1 ? '预览正文' : '导入结果正文', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    await runtime.execute(created.task.id)
    const first = store.get(created.task.id).task
    assert.equal(first.deliverables.length, 1)
    assert.equal(first.deliverables[0].deliverableId, 'preview')
    const accepted = runtime.reviewDeliverable({ taskId: created.task.id, deliverableId: 'preview', action: 'accept', comment: '确认继续' })
    assert.equal(accepted.task.status, 'review')
    assert.equal(accepted.started, true)
    const second = await waitFor(() => {
      const value = store.get(created.task.id).task
      return value.deliverables.some(item => item.deliverableId === 'result') ? value : null
    })
    assert.equal(second.deliverables.length, 2)
    assert.match(payloads[1].prompt, /确认继续/)
    const completed = runtime.reviewDeliverable({ taskId: created.task.id, deliverableId: 'result', action: 'accept' })
    assert.equal(completed.task.status, 'completed')
  })

  it('keeps a tool-backed deliverable out of review when the evidence gate blocks it', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-evidence-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'starting',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true, requiredTools: ['import_project'] }] },
      execRef: { kind: 'session', id: 'session-evidence' },
    })
    const session = { id: 'session-evidence', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '已经导入完成',
        executionEvidence: {
          gateStatus: 'blocked', verificationPassed: false, toolCalls: [], evidence: [],
          violations: [{ code: 'missing_required_tools', message: '缺少必需工具调用', missingTools: ['import_project'] }],
        },
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(result.task.executionEvidence[0].gateStatus, 'blocked')
    assert.equal(result.task.events.at(-1).type, 'execution_blocked')
  })

  it('independently blocks a required tool that failed even when the executor reports verified', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-failed-tool-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'starting',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true, requiredTools: ['import_project'] }] },
      execRef: { kind: 'session', id: 'session-failed-tool' },
    })
    const session = { id: 'session-failed-tool', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, payload) => ({
        runId: payload.runId,
        text: '导入已经完成',
        executionEvidence: {
          gateStatus: 'verified', verificationPassed: true,
          toolCalls: [{ id: 'call-1', name: 'import_project', status: 'fail', error: 'write failed' }],
          evidence: [], violations: [],
        },
      }),
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'needs_input')
    assert.equal(result.task.deliverables.length, 0)
    assert.equal(result.task.executionEvidence[0].gateStatus, 'blocked')
    assert.deepEqual(result.task.executionEvidence[0].violations.at(-1).missingTools, ['import_project'])
  })

  it('upgrades a legacy completed task contract and reopens false text-only completion', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-legacy-contract-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行完整导入', expertId: 'external-capability-importer', status: 'completed',
      brief: { goal: '执行完整导入', deliverables: [{ id: 'item-2', title: '实际导入与验证', required: true }] },
      assignmentSnapshot: { agentId: 'external-capability-importer', agentVersion: '' },
      execRef: { kind: 'session', id: 'session-legacy-contract' },
      deliverables: [{
        deliverableId: 'item-2', title: '实际导入与验证', required: true,
        evidenceStatus: 'verified', acceptanceStatus: 'accepted',
      }],
      executionEvidence: [{
        runId: 'legacy-run', deliverableId: 'item-2', gateStatus: 'verified', verificationPassed: true,
        toolCalls: [{ id: 'preview', name: 'preview_external_project', status: 'ok' }], evidence: [], violations: [],
      }],
    })
    const currentManifest = {
      version: '1.2.0',
      metadata: { knowme: { execution: { deliverables: { 'item-2': {
        requiredTools: ['import_external_project', 'verify_imported_workflow'],
      } } } } },
    }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({
        readSessionSnapshot: () => ({ capabilityManifest: {} }),
        createSessionSnapshot: () => ({
          ok: true,
          snapshot: { capabilityManifest: currentManifest, hashes: { expert: 'current-hash' } },
        }),
      }) }),
    })

    const reconciled = runtime.get(created.task.id)
    assert.equal(reconciled.ok, true)
    assert.equal(reconciled.task.status, 'needs_input')
    assert.equal(reconciled.task.assignmentSnapshot.agentVersion, '1.2.0')
    assert.deepEqual(reconciled.task.brief.deliverables[0].requiredTools, ['import_external_project', 'verify_imported_workflow'])
    assert.equal(reconciled.task.deliverables[0].evidenceStatus, 'blocked')
    assert.equal(reconciled.task.deliverables[0].acceptanceStatus, 'pending')
    assert.equal(reconciled.task.events.at(-1).type, 'execution_invalidated')
  })

  it('retries a failed expert task without treating its workbench id as a Skill task id', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-retry-')), 'tasks.json')
    const store = createStore(file)
    const created = store.create({
      goal: '执行导入', expertId: 'importer', status: 'failed',
      brief: { goal: '执行导入', deliverables: [{ id: 'result', title: '导入结果', required: true }] },
      execRef: { kind: 'session', id: 'session-retry' },
      events: [{ type: 'failed', summary: '旧入口校验失败' }],
    })
    const session = { id: 'session-retry', expertId: 'importer', messages: [], run: agentRun.createEmptyRun() }
    let payload = null
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'key', apiEndpoint: 'https://example.com/v1/chat/completions' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({ expertRuntime: () => ({ readSessionSnapshot: () => ({ capabilityManifest: {} }) }) }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: () => {},
      runAgentGenerate: async (_deps, value) => {
        payload = value
        return { runId: value.runId, text: '导入完成', executionEvidence: { gateStatus: 'not_required', verificationPassed: true } }
      },
      agentRun,
    })

    const retried = runtime.retry(created.task.id)
    assert.equal(retried.ok, true)
    assert.equal(retried.started, true)
    const reviewed = await waitFor(() => store.get(created.task.id).task.status === 'review' ? store.get(created.task.id).task : null)
    assert.equal(payload.taskId, undefined)
    assert.equal(payload.workbenchTaskId, created.task.id)
    assert.equal(reviewed.events.some(event => event.type === 'retried'), true)
  })
})
