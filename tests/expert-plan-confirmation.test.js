'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createExpertTaskRuntime, formatExpertTaskMaterials } = require('../src/lib/expert-task-runtime')
const { createStore } = require('../src/lib/workbench-task-store')
const { confirmedDeliveryIssues, requiresFileDelivery } = require('../src/lib/expert-confirmed-delivery')

const plan = {
  goal: '开发 KnowMe 宣传页',
  deliverables: ['HTML/CSS/JS 页面文件'],
  acceptanceCriteria: ['页面可响应式展示'],
  capabilityUse: ['frontend-design'],
  steps: ['设计布局', '编写页面'],
  risks: [],
}

describe('expert plan confirmation host gate', () => {
  it('removes only the host-authored planning route from legacy clarification material', () => {
    const materials = formatExpertTaskMaterials([
      {
        id: 'clarification-record', title: '需求澄清记录', type: 'text',
        content: '我想处理「主题舆情分析」。请严格按当前专家 SOP 的「topic-sentiment」路由规划本次协作，先确认必要范围，再给出待确认计划，不要执行。\n\n近一周关于 AI Native 的舆情',
      },
      { id: 'source-note', title: '用户材料', type: 'text', content: '不要执行公开网络搜索，只分析附件。' },
    ])

    assert.doesNotMatch(materials, /请严格按当前专家 SOP/)
    assert.match(materials, /近一周关于 AI Native 的舆情/)
    assert.match(materials, /不要执行公开网络搜索，只分析附件/)
  })

  it('refuses to issue a receipt for a plan that still asks for input', () => {
    const runtime = createExpertTaskRuntime({})
    const result = runtime.preparePlanConfirmation({
      taskId: 'draft-1', expertId: 'software-engineer', plan,
      planningReply: [
        '【协作计划】',
        '目标：开发 KnowMe 宣传页',
        '交付：HTML/CSS/JS 页面文件',
        '验收：页面可响应式展示',
        '能力：frontend-design',
        '执行步骤：',
        '1. 设计布局',
        '2. 编写页面',
        '是否同意上述计划？若同意，请补充以下关键信息：',
        '1. 目标受众是谁？',
      ].join('\n'),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'plan_needs_clarification')
  })

  it('binds a receipt to the exact task, expert and normalized plan', async () => {
    const runtime = createExpertTaskRuntime({})
    const ready = runtime.preparePlanConfirmation({
      taskId: 'draft-1', expertId: 'software-engineer', plan,
      planningReply: '【协作计划】\n目标：开发 KnowMe 宣传页\n交付：HTML/CSS/JS 页面文件\n验收：页面可响应式展示\n能力：frontend-design\n执行步骤：\n1. 设计布局\n2. 编写页面\n请确认是否按此计划执行？',
    })
    assert.equal(ready.ok, true)
    assert.ok(ready.token)
    const rejected = await runtime.createStart({
      taskId: 'draft-1', expertId: 'another-expert', planConfirmationToken: ready.token,
      brief: {
        goal: plan.goal,
        plan,
        materials: [{ id: 'user-plan-confirmation', content: '确认计划并执行' }],
      },
    })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.code, 'plan_confirmation_invalid')
  })

  it('allows a one-step safe plan without an artificial capability declaration', () => {
    const runtime = createExpertTaskRuntime({})
    const result = runtime.preparePlanConfirmation({
      taskId: 'simple-1', expertId: 'research-analyst',
      plan: {
        goal: '解释这段文字',
        deliverables: ['简明解释'],
        acceptanceCriteria: ['覆盖原文关键含义'],
        capabilityUse: [],
        steps: ['阅读并解释原文'],
        risks: [],
      },
      planningReply: '【协作计划】\n目标：解释这段文字\n交付：简明解释\n验收：覆盖原文关键含义\n执行步骤：\n1. 阅读并解释原文\n请确认是否按此计划执行？',
    })
    assert.equal(result.ok, true)
  })

  it('requires a receipt when a persisted planning draft starts even if the renderer omits its marker', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-plan-gate-'))
    const store = createStore(path.join(directory, 'tasks.json'))
    const draft = store.create({ kind: 'expert', status: 'draft', expertId: 'research-analyst',
      goal: '解释这段文字', brief: { goal: '解释这段文字' } })
    const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store })
    const simplePlan = {
      goal: '解释这段文字', deliverables: ['简明解释'], acceptanceCriteria: ['覆盖原文关键含义'],
      capabilityUse: [], steps: ['阅读并解释原文'], risks: [],
    }
    const result = await runtime.createStart({ taskId: draft.task.id, expertId: 'research-analyst',
      brief: { goal: simplePlan.goal, plan: simplePlan, materials: [] } })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'plan_confirmation_invalid')
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('recognizes generated Web pages as file delivery and requires artifact evidence', () => {
    const task = { goal: '为 KnowMe 生成一个高转化率的 Web 宣传落地页', brief: { goal: '为 KnowMe 生成一个高转化率的 Web 宣传落地页', plan } }
    assert.equal(requiresFileDelivery(task), true)
    assert.equal(confirmedDeliveryIssues(task, { type: 'answer', minArtifacts: 0 }).length, 1)
    assert.equal(confirmedDeliveryIssues(task, {
      type: 'file', requiredTools: ['write_file'], minArtifacts: 1,
      completionConditions: [{ type: 'tool_success', tool: 'write_file' }, { type: 'artifact_present' }],
    }).length, 0)
  })
})
