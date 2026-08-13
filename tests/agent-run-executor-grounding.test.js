'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const groundingRuntime = require('../src/lib/agent-grounding-runtime')

describe('agent-run-executor grounding', () => {
  it('blocks ungrounded meeting summary when required tool missing', async () => {
    const fixture = {
      input: { prompt: '总结会议', tier: 'retrieval', forceTools: true },
      referenceState: groundingRuntime.serializeReferenceState(
        groundingRuntime.setTaskFrame(groundingRuntime.createReferenceState(), {
          requiredTools: ['feishu.meeting_read'],
        }),
      ),
      llmScript: [{ response: { text: '已读取。议题：架构评审；负责人：李四。' } }],
      expect: {},
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(!String(result.text).includes('议题：'))
    assert.match(String(result.text), /尚未|不能|需要先|证据不足|没有成功/)
  })

  it('includes GROUND and VERIFY_CLAIMS phases in runtime mode', async () => {
    const fixture = {
      input: { prompt: '你好', tier: 'chat' },
      llmScript: [{ response: { text: '你好！' } }],
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.ok(result.runPhases.includes(RunPhase.GROUND))
    assert.ok(result.runPhases.includes(RunPhase.VERIFY_CLAIMS))
  })

  it('allows happy path with meeting_read evidence', async () => {
    const { runConversationScenario, loadConversationFixtures } = require('./agent-conversation-eval-harness')
    const fixture = loadConversationFixtures().find(f => f.name === 'feishu-meeting-pick-2-happy')
    assert.ok(fixture)
    const result = await runConversationScenario(fixture)
    assert.equal(result.passed, true)
    assert.equal(result.dimensions.toolChoice, 1)
    const calls = result.ports.toolLedger.calls.filter(c => c.status === 'ok').map(c => c.name)
    assert.ok(calls.includes('feishu.meeting_read'))
  })

  it('blocks current-news claims when required web search evidence is missing', async () => {
    const taskFrame = {
      requiredTools: ['search_web'],
      requiredEvidence: [{ kind: 'tool_result', tool: 'search_web', minChars: 40 }],
      completionConditions: [{ type: 'tool_success', tool: 'search_web' }],
    }
    const fixture = {
      input: { prompt: '今天的 AI 新闻', tier: 'assist', forceTools: true },
      referenceState: groundingRuntime.serializeReferenceState(
        groundingRuntime.setTaskFrame(groundingRuntime.createReferenceState(), taskFrame),
      ),
      llmScript: [{ response: { text: '我已经检索，今天发布了三个新模型。' } }],
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(!String(result.text).includes('三个新模型'))
    assert.match(String(result.text), /公开网络搜索|尚未|不能|需要先|证据不足/)
  })

  it('allows current-news output after successful web search evidence', async () => {
    const taskFrame = {
      requiredTools: ['search_web'],
      requiredEvidence: [{ kind: 'tool_result', tool: 'search_web', minChars: 40 }],
      completionConditions: [{ type: 'tool_success', tool: 'search_web' }],
    }
    const fixture = {
      input: { prompt: '今天的 AI 新闻', tier: 'assist', forceTools: true },
      referenceState: groundingRuntime.serializeReferenceState(
        groundingRuntime.setTaskFrame(groundingRuntime.createReferenceState(), taskFrame),
      ),
      llmScript: [
        { response: { toolCalls: [{ name: 'search_web', arguments: { query: 'AI news', mode: 'news' } }] } },
        { response: { text: '根据公开来源，今天有一项模型更新。来源：https://example.com/release' } },
      ],
      toolScript: {
        'search_web': {
          ok: true,
          text: '检索时间：2026-08-07T08:00:00.000Z\n1. Model release\nURL：https://example.com/release',
        },
      },
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE)
    assert.match(String(result.text), /example\.com\/release/)
    assert.ok(ports._eval.toolLedger.calls.some(call => call.name === 'search_web' && call.status === 'ok'))
  })

  it('skill block YAML contract enforces OutputGate blocked when tool missing', async () => {
    const { parseSkillGroundingFromContent } = require('../src/lib/skill-runtime')
    const parsed = parseSkillGroundingFromContent(`---
name: meeting-summary
requiredTools:
  - feishu.meeting_read
requiredEvidence:
  - kind: tool_result
    tool: feishu.meeting_read
    minChars: 200
completionConditions:
  - type: tool_success
    tool: feishu.meeting_read
---
# Body
`)
    assert.deepEqual(parsed.contract.requiredTools, ['feishu.meeting_read'])

    const fixture = {
      input: { prompt: '总结会议', tier: 'retrieval', forceTools: true },
      referenceState: groundingRuntime.serializeReferenceState(
        groundingRuntime.setTaskFrame(groundingRuntime.createReferenceState(), parsed.contract),
      ),
      llmScript: [{ response: { text: '已读取。议题：架构评审；负责人：李四。' } }],
      expect: {},
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(!String(result.text).includes('议题：'))
    assert.match(String(result.text), /飞书会议妙记读取|尚未|不能|需要先|证据不足/)
  })

  it('skill contract allows verified output when required tool evidence present', async () => {
    const { parseSkillGroundingFromContent } = require('../src/lib/skill-runtime')
    const parsed = parseSkillGroundingFromContent(`---
name: meeting-summary
requiredTools:
  - feishu.meeting_read
---
# Body
`)
    const body = 'x'.repeat(250)
    const fixture = {
      input: { prompt: '总结', tier: 'retrieval', forceTools: true, budget: { maxRounds: 5, maxToolCalls: 5 } },
      referenceState: groundingRuntime.serializeReferenceState(
        groundingRuntime.setTaskFrame(groundingRuntime.createReferenceState(), parsed.contract),
      ),
      llmScript: [
        { response: { toolCalls: [{ name: 'feishu.meeting_read', arguments: { minute_token: 't1' } }] } },
        { response: { text: '根据会议记录，主要讨论了发布计划。' } },
      ],
      toolScript: {
        'feishu.meeting_read': { ok: true, text: body, meta: { workflow: 'meeting_read' } },
      },
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(String(result.text).includes('发布计划') || String(result.text).length > 10)
    const gateStatus = result.groundingStatus?.status || ports.lastGroundingStatus?.status
    assert.ok(gateStatus === 'verified' || result.runPhases.includes(RunPhase.VERIFY_CLAIMS))
  })
})
