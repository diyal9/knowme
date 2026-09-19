'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { it } = require('node:test')
const { createStore } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')

const snapshot = {
  persona: {}, bindings: { skills: [], connectors: [] },
  capabilityManifest: {
    version: '1.0.0', dependencies: {},
    metadata: { knowme: { execution: { routes: [{ id: 'unmatched', keywords: ['不会命中'] }] } } },
  },
}

it('persists the user plan confirmation in the generic expert task activity stream', async () => {
  const store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-plan-confirmation-')), 'tasks.json'))
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    ensureAgentSession: () => ({ session: { id: 'session-plan-confirmation' }, sessions: [] }),
    saveAgentSessions: () => {},
    ensureCapabilityHub: () => ({
      expertRuntime: () => ({
        createSessionSnapshot: () => ({ ok: true, snapshot }),
        readSessionSnapshot: () => ({ ok: true, snapshot }),
      }),
    }),
    getConnectorsApi: () => ({ getConnectorStatus: async () => ({ ok: true }) }),
    runAgentGenerate: async () => ({ text: '结果' }),
  })

  const plan = {
    goal: '执行已确认的计划', deliverables: ['结果'], acceptanceCriteria: ['结果完整'],
    capabilityUse: ['通用专家能力'], steps: ['执行方案 A', '核对结果'], risks: [],
  }
  const receipt = runtime.preparePlanConfirmation({
    expertId: 'generic', plan,
    planningReply: '【协作计划】\n目标：执行已确认的计划\n交付：结果\n验收：结果完整\n能力：通用专家能力\n执行步骤：\n1. 执行方案 A\n2. 核对结果\n请确认是否按此计划执行？',
  })
  const result = await runtime.createStart({
    expertId: 'generic',
    planConfirmationToken: receipt.token,
    brief: {
      goal: '执行已确认的计划',
      materials: [{ id: 'user-plan-confirmation', type: 'user_confirmation', title: '用户确认', content: '确认方案 A 并执行' }],
      deliverables: [{ id: 'primary', title: '结果', type: 'answer', required: true }],
      plan,
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.task.events[0].type, 'plan_confirmed')
  assert.equal(result.task.events[0].source, 'user')
  assert.equal(result.task.events[0].summary, '确认方案 A 并执行')
})


it('blocks an implementation promise backed only by an answer contract on creation and retry', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-plan-execution-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const store = createStore(path.join(directory, 'tasks.json'))
  const agentRun = require('../src/lib/agent-run')
  const executionSnapshot = { bindings: { skills: [], connectors: [] }, capabilityManifest: {
    version: '1.0.0', dependencies: [], permissions: { tools: { allowlist: [] }, write: false },
    metadata: { knowme: { execution: { routes: [{ id: 'implementation', default: true }] } } },
  } }
  let generated = 0
  let session = { id: '', messages: [], run: agentRun.createEmptyRun() }
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
    normalizeChatEndpoint: value => value,
    ensureAgentSession: id => { session.id = id; return { session, sessions: [session] } },
    saveAgentSessions: sessions => { session = sessions[0] },
    ensureCapabilityHub: () => ({ expertRuntime: () => ({
      createSessionSnapshot: () => ({ ok: true, snapshot: executionSnapshot }),
      readSessionSnapshot: () => executionSnapshot,
    }) }),
    runAgentGenerate: async () => { generated++; return { text: '源码如下' } },
    agentRun,
  })
  const created = await runtime.createStart({ expertId: 'imported-engineer', brief: {
    goal: '为 KnowMe 制作宣传网页',
    plan: { goal: '制作宣传网页', deliverables: ['完整前端代码包（HTML/CSS/JS）'], steps: ['设计', '实现'] },
    deliverables: [{ id: 'primary', title: '软件工程交付', type: 'answer', required: true }],
  } })
  assert.equal(created.task.status, 'needs_input')
  assert.equal(created.started, false)
  assert.match(created.task.attention.detail, /执行工具|文件成果|必需工具|write_file/)
  assert.equal(generated, 0)
  const retried = await runtime.execute(created.task.id)
  assert.equal(retried.task.status, 'needs_input')
  assert.equal(generated, 0)
  assert.equal(retried.task.events.some(event => event.type === 'task_started'), false)
})


it('keeps advice available and requires both tools and artifacts for promised source packages', () => {
  const { confirmedDeliveryIssues } = require('../src/lib/expert-confirmed-delivery')
  const task = { brief: { plan: { deliverables: ['完整前端代码包（HTML/CSS/JS）'] } } }
  assert.equal(confirmedDeliveryIssues({ brief: { plan: { deliverables: ['前端代码评审建议及 HTML/CSS 技术选型报告'] } } }).length, 0)
  assert.equal(confirmedDeliveryIssues(task, { requiredTools: ['read_file'] }).length, 1)
  assert.equal(confirmedDeliveryIssues(task, { minArtifacts: 1 }).length, 1)
  assert.equal(confirmedDeliveryIssues(task, { requiredTools: ['create_file'], minArtifacts: 1 }).length, 0)
  assert.equal(confirmedDeliveryIssues({ brief: { ...task.brief, deliverables: [{ requiredTools: ['create_file'], minArtifacts: 1 }] } }, { type: 'answer' }).length, 0)
})
