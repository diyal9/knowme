'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const agentRun = require('../src/lib/agent-run')
const { createExpertRuntime } = require('../src/lib/expert-runtime')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')
const executionProfile = require('../src/lib/expert-execution-profile')

const catalogRoot = path.join(__dirname, '..', 'src', 'catalog')
const expertIds = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'catalog.json'), 'utf8')).entries
  .filter(item => item.kind === 'expert')
  .map(item => item.id)
  .sort()

async function waitFor(check, timeoutMs = 2500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for all-expert matrix scenario')
}

function matrixHarness(id, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `knowme-expert-matrix-${id}-`))
  const store = createStore(path.join(root, 'tasks.json'))
  // Session snapshots must never be written into the source catalog by tests.
  const capabilitiesRoot = path.join(root, 'capabilities')
  fs.cpSync(path.join(catalogRoot, 'experts', id), path.join(capabilitiesRoot, 'experts', id), { recursive: true })
  const expertRuntime = createExpertRuntime({ capabilitiesRoot })
  const loaded = expertRuntime.loadExpert(id)
  assert.equal(loaded.ok, true, `${id}: expert package failed to load`)
  const snapshot = { capabilityManifest: loaded.capabilityManifest }
  const outputs = executionProfile.declaredDeliverables(snapshot)
  const sessions = new Map()
  let generationIndex = 0
  let generationCalls = 0
  const hub = {
    expertRuntime: () => expertRuntime,
    skillRuntime: () => ({
      findSkillRecord: skillId => ({ id: skillId }),
      isSkillEnabled: () => true,
      loadSkillGroundingContract: () => ({ ok: true, contract: {} }),
    }),
  }
  const ensureAgentSession = (sessionId, expertId) => {
    const idValue = String(sessionId || `matrix-${id}`)
    if (!sessions.has(idValue)) sessions.set(idValue, {
      id: idValue, expertId, agentId: expertId, messages: [], run: agentRun.createEmptyRun(),
    })
    return { session: sessions.get(idValue), sessions: [...sessions.values()] }
  }
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => options.invalidSettings
      ? { apiKey: '', apiEndpoint: '' }
      : { apiKey: 'matrix-key', apiEndpoint: 'https://example.test/v1/chat/completions' },
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => hub,
    ensureAgentSession,
    saveAgentSessions: next => next.forEach(session => sessions.set(session.id, session)),
    getConnectorsApi: () => ({
      getConnectorStatus: async connectorId => ({
        ok: true,
        connector: { id: connectorId, enabled: true, agentVisible: true, status: { ok: true, state: 'ready', userReady: true } },
      }),
      // Explicit provider fixture: readiness alone is not evidence of a tool.
      // Keep ownership independent of the expert's requested tool list.
      getConnectorTools: async connectorId => ({
        ok: true,
        availableTools: connectorId === 'pango-image-mcp'
          ? ['list_paint_models', 'generate_image'].map(rawName => ({
            rawName, projectedName: `mcp_pango_image_${rawName}`, selected: true,
          })) : [],
      }),
    }),
    runAgentGenerate: async (_deps, payload) => {
      generationCalls += 1
      const output = outputs[generationIndex] || outputs.at(-1)
      generationIndex += 1
      const contract = payload.executionContract || {}
      const requiredTools = contract.requiredTools || []
      const artifactCount = Math.max(Number(contract.minArtifacts) || 0, (contract.requiredArtifacts || []).length ? 1 : 0)
      const artifactType = contract.requiredArtifacts?.[0]?.type || output?.type || 'document'
      const artifacts = Array.from({ length: artifactCount }, (_, index) => ({
        id: `${id}-${output?.id || 'output'}-${index + 1}`,
        type: artifactType,
        title: `${output?.title || '成果'} ${index + 1}`,
        targetPath: artifactType === 'image' ? `https://cdn.example.test/${id}-${index + 1}.png` : undefined,
        body: artifactType === 'image' ? '' : `${output?.title || '成果'}的可验收正文。`,
      }))
      return {
        runId: payload.runId,
        text: `${output?.title || '专业成果'}已完成；已核对输入、关键判断、限制与验收要求。`,
        artifacts,
        executionEvidence: {
          gateStatus: requiredTools.length ? 'verified' : 'not_required',
          verificationPassed: true,
          toolCalls: requiredTools.map(name => ({ name, status: 'ok' })),
          evidence: requiredTools.map(tool => ({ status: 'ok', provenance: { kind: 'tool_result', tool } })),
          violations: [],
        },
      }
    },
    agentRun,
  })
  const task = store.create({
    goal: `验证 ${id} 的专业任务`,
    title: `${id} 自动化验证`,
    expertId: id,
    expertName: loaded.name,
    status: 'starting',
    brief: { goal: `验证 ${id} 的专业任务`, materials: [{ id: 'fixture', title: '已确认测试材料', content: '事实与验收标准均已提供。' }] },
    execRef: { kind: 'session', id: `matrix-session-${id}` },
  }).task
  return { runtime, store, task, outputs, generationCalls: () => generationCalls }
}

describe('all bundled expert execution matrix', () => {
  it('runs every declared deliverable through review and completion without expert-specific platform code', async () => {
    for (const id of expertIds) {
      const harness = matrixHarness(id)
      let current = (await harness.runtime.execute(harness.task.id)).task
      for (let index = 0; index < harness.outputs.length; index += 1) {
        assert.equal(current.status, 'review', `${id}/${harness.outputs[index].id}: did not enter review: ${JSON.stringify(current.attention)}`)
        const pending = current.deliverables.find(item => item.acceptanceStatus === 'pending')
        assert.equal(pending?.deliverableId, harness.outputs[index].id, `${id}: wrong deliverable order`)
        assert.ok(String(current.resultSummary || '').includes('已完成'), `${id}: professional handoff missing`)
        const accepted = harness.runtime.reviewDeliverable({
          taskId: current.id,
          deliverableId: pending.deliverableId,
          action: 'accept',
          comment: '自动化验收通过',
        })
        assert.equal(accepted.ok, true, `${id}: acceptance failed: ${JSON.stringify(accepted)}`)
        if (index === harness.outputs.length - 1) {
          current = accepted.task
        } else {
          current = await waitFor(() => {
            const loaded = harness.store.get(harness.task.id)
            assert.ok(!loaded.ok || !['failed', 'needs_input', 'cancelled'].includes(loaded.task.status),
              `${id}/${harness.outputs[index + 1].id}: ${loaded.task?.status}: ${JSON.stringify(loaded.task?.attention)}`)
            return loaded.ok && loaded.task.status === 'review'
              && loaded.task.deliverables.some(item => item.deliverableId === harness.outputs[index + 1].id && item.acceptanceStatus === 'pending')
              ? loaded.task
              : null
          })
        }
      }
      assert.equal(current.status, 'completed', `${id}: task did not complete after all required outputs were accepted`)
      assert.equal(harness.generationCalls(), harness.outputs.length, `${id}: unexpected generation count`)
    }
  })

  it('keeps every expert task recoverable when platform AI configuration is unavailable', async () => {
    for (const id of expertIds) {
      const harness = matrixHarness(id, { invalidSettings: true })
      const result = await harness.runtime.execute(harness.task.id)
      assert.equal(result.task.status, 'needs_input', `${id}: invalid configuration was not blocked`)
      assert.equal(result.task.attention?.kind, 'configuration_required', `${id}: wrong attention kind`)
      assert.equal(harness.generationCalls(), 0, `${id}: model ran despite failed configuration preflight`)
      assert.equal(harness.store.get(harness.task.id).task.brief.goal, `验证 ${id} 的专业任务`)
    }
  })
})
