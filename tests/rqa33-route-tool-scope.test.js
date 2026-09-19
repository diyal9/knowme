'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')
const agentRun = require('../src/lib/agent-run')
const profile = require('../src/lib/expert-execution-profile')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')

describe('RQA33 route-scoped tool permissions', () => {
  it('preserves an explicit empty route allowlist and a bounded external allowlist', () => {
    assert.deepEqual(profile.routeContract({
      id: 'local', toolAllowlist: [], requiredTools: [],
    }).executionToolAllowlist, [])
    assert.deepEqual(profile.routeContract({
      id: 'web', toolAllowlist: ['search_web', 'fetch_web_page'], requiredTools: ['search_web'],
    }).executionToolAllowlist, ['search_web', 'fetch_web_page'])
  })

  it('can only narrow the expert package tool permissions', () => {
    const base = {
      tools: { allowlist: ['search_web', 'fetch_web_page'] },
      connectors: { allowedConnectorIds: [] },
      network: true,
      write: false,
      externalWrite: false,
    }
    assert.deepEqual(
      profile.scopePermissionsForOutputSpec(base, { executionToolAllowlist: [] }).tools.allowlist,
      [],
    )
    assert.deepEqual(
      profile.scopePermissionsForOutputSpec(base, {
        executionToolAllowlist: ['search_web', 'ungranted_tool'],
      }).tools.allowlist,
      ['search_web'],
    )
    assert.deepEqual(profile.scopePermissionsForOutputSpec(base, {}).tools.allowlist, base.tools.allowlist)
  })

  it('passes the local route empty tool surface into the real expert execution request', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-route-scope-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    const store = createStore(path.join(directory, 'tasks.json'))
    const created = store.create({
      expertId: 'arbitrary-researcher',
      status: 'starting',
      goal: '整理我提供的材料',
      brief: {
        goal: '整理我提供的材料',
        materials: [{ title: '正文', content: '这是已经提供的完整研究材料。' }],
        deliverables: [{ id: 'primary', title: '研究结果', type: 'answer', required: true }],
      },
      execRef: { kind: 'session', id: 'rqa33-local-session' },
    })
    const snapshot = {
      expertId: 'arbitrary-researcher',
      bindings: { skills: [], connectors: [] },
      capabilityManifest: {
        version: '1.0.0',
        permissions: {
          tools: { allowlist: ['search_web', 'fetch_web_page'] },
          connectors: { allowedConnectorIds: [] },
          network: true,
          write: false,
          externalWrite: false,
        },
        metadata: { knowme: { execution: {
          deliverables: [{ id: 'primary', title: '研究结果', type: 'answer', required: true }],
          routes: [{
            id: 'provided-material',
            when: { hasReadableMaterials: true },
            toolAllowlist: [],
            description: '只处理已提供材料。',
          }],
        } } },
      },
    }
    let captured = null
    let session = { id: 'rqa33-local-session', expertId: 'arbitrary-researcher', messages: [], run: agentRun.createEmptyRun() }
    const runtime = createExpertTaskRuntime({
      getWorkbenchTaskStore: () => store,
      loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
      normalizeChatEndpoint: value => value,
      ensureCapabilityHub: () => ({
        expertRuntime: () => ({ readSessionSnapshot: () => snapshot }),
        skillRuntime: () => ({ findSkillRecord: () => null, isSkillEnabled: () => false }),
      }),
      ensureAgentSession: () => ({ session, sessions: [session] }),
      saveAgentSessions: sessions => { session = sessions[0] },
      runAgentGenerate: async (_deps, input) => {
        captured = input
        return {
          runId: input.runId,
          text: '已基于提供材料完成研究整理。',
          artifacts: [],
          executionEvidence: { gateStatus: 'verified', verificationPassed: true, toolCalls: [], evidence: [], violations: [] },
        }
      },
      agentRun,
    })

    const result = await runtime.execute(created.task.id)
    assert.equal(result.task.status, 'review')
    assert.equal(captured.executionContract.requiredTools.length, 0)
    assert.deepEqual(captured.permissions.tools.allowlist, [])
  })
})
