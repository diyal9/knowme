'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const manifest = require('../src/catalog/experts/office-partner/capability.manifest.json')
const profile = require('../src/lib/expert-execution-profile')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')
const { validateExecutionCompletion } = require('../src/lib/agent-execution-contract')
const { preflightExpertTools } = require('../src/lib/expert-task-tool-preflight')
const { executeRelatedChats } = require('../src/lib/connectors/feishu-cli/im')

const snapshot = { capabilityManifest: manifest, bindings: { connectors: ['feishu'] } }
const controls = [
  { id: 'clarification-record', type: 'text', content: '请先规划，不要执行。' },
  { id: 'confirmed-plan', type: 'text', content: '读取飞书后提取行动项与负责人。' },
  { id: 'user-plan-confirmation', type: 'user_confirmation', content: '确认计划并执行' },
]

for (const [goal, route, tool] of [
  ['读取并整理飞书中与用户相关的群聊/私聊消息，提炼重点、待办及风险。', 'related-chats', 'feishu.related_chats'],
  ['读取飞书会议并总结纪要', 'meeting-summary', 'feishu.meeting_candidates'],
  ['查询飞书今天安排与日程待办', 'today-priority', 'feishu.today_priority'],
  ['查找飞书文档与知识库资料', 'doc-kb', 'feishu.doc_kb_suggest'],
]) {
  test(`confirmed ${route} retains its connector, tools and completion gate`, async () => {
    const task = { goal, brief: { materials: controls, plan: { steps: ['提取行动项、负责人、截止日，输出总结'] } } }
    const spec = profile.resolveOutputSpec(task, snapshot)
    assert.equal(spec.executionRoute, route)
    assert.deepEqual(spec.requiredTools, [tool])
    assert.deepEqual(spec.requiredConnectorIds, ['feishu'])
    assert.ok(spec.executionToolAllowlist.includes(tool))
    const noRead = validateExecutionCompletion(spec, {
      text: '没有飞书权限，请粘贴正文。',
      executionEvidence: { verificationPassed: true, gateStatus: 'verified', toolCalls: [], evidence: [] },
    })
    assert.equal(noRead.ok, false)
    assert.ok(noRead.violations.some(item => item.code === 'missing_required_tools'))
    const read = { toolCalls: [{ name: tool, status: 'ok' }], evidence: [{ status: 'ok', provenance: { tool } }] }
    assert.equal(validateExecutionCompletion(spec, read).ok, true)
    for (const ready of [true, false]) {
      const checked = await preflightExpertTools({ snapshot,
        connectorIds: spec.requiredConnectorIds, requiredTools: spec.requiredTools,
        getConnectorsApi: () => ({ getConnectorStatus: async () => ({ ok: true, connector: {
          id: 'feishu', enabled: true, agentVisible: true,
          status: { ok: ready, userReady: ready, state: ready ? 'online' : 'auth_required', projectedAllowlist: [tool] },
        } }) }),
      })
      assert.equal(checked.ok, ready)
    }
  })
}

test('control records and image captions do not impersonate supplied source text', () => {
  const material = { id: 'actual-transcript', content: '李明承诺周五提交方案。' }
  const evidence = createProvidedMaterialsSnapshot({ taskId: 'task', runId: 'run', materials: [...controls, material] })
  assert.deepEqual(evidence.items.map(item => item.id), ['actual-transcript'])
  const task = { goal: '提取行动项与负责人', brief: { materials: controls } }
  assert.notEqual(profile.resolveOutputSpec(task, snapshot).executionRoute, 'action-extraction')
  task.brief.materials = [...controls, material]
  assert.equal(profile.resolveOutputSpec(task, snapshot).executionRoute, 'action-extraction')
  task.brief.materials = [{ type: 'image', content: '图片描述' }]
  assert.notEqual(profile.resolveOutputSpec(task, snapshot).executionRoute, 'action-extraction')
})

test('scope notes do not divert an explicit Feishu retrieval into local extraction', () => {
  const task = { goal: '从飞书读取群聊并提取行动项、负责人和截止日',
    brief: { materials: [{ content: '范围：研发群。' }] } }
  assert.equal(profile.resolveOutputSpec(task, snapshot).executionRoute, 'related-chats')
  const legacy = require('../src/catalog/experts/office-partner/manifest.json')
  const canonicalRoutes = manifest.metadata.knowme.execution.routes
  assert.deepEqual(canonicalRoutes.map(route => ({ id: route.id, when: route.when, toolAllowlist: route.toolAllowlist })),
    legacy.metadata.knowme.execution.routes.map(route => ({ id: route.id, when: route.when, toolAllowlist: route.toolAllowlist })))
})

function chatSpawn({ failList = false, hasMore = false } = {}) {
  return (_bin, argv) => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    queueMicrotask(() => {
      const isList = argv.includes('+chat-list')
      const payload = argv.includes('auth') ? { identities: { user: { openId: 'ou_fixture', userName: 'Fixture' } } }
        : isList ? { items: [] }
          : { data: { messages: [{ message_id: 'om_fixture', body: { text: '请确认方案' } }], has_more: hasMore, page_token: 'repeat' } }
      if (isList && failList) child.stderr.emit('data', 'fixture: chat list unavailable')
      else child.stdout.emit('data', JSON.stringify(payload))
      child.emit('close', isList && failList ? 1 : 0)
    })
    return child
  }
}

test('IM preserves successful mentions and explicitly reports a failed chat list', async () => {
  const result = await executeRelatedChats({}, { spawnImpl: chatSpawn({ failList: true }) })
  assert.equal(result.ok, true)
  assert.equal(result.meta.mentions.length, 1)
  assert.equal(result.meta.partial, true)
  assert.match(result.text, /会话列表读取失败/)
  assert.equal(result.meta.coverage.unreadCountsAvailable, false)
  assert.equal(result.meta.coverage.allMessageBodiesRead, false)
})

test('IM reports incomplete pagination and does not label unfiltered chats as today-only', async () => {
  const result = await executeRelatedChats({ days: 3 }, { spawnImpl: chatSpawn({ hasMore: true }) })
  assert.equal(result.meta.coverage.truncated, true)
  assert.match(result.text, /部分消息/)
  assert.match(result.text, /近期会话列表/)
  assert.doesNotMatch(result.text, /今日相关会话/)
})
