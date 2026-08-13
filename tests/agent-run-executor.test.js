'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { EventType, VERSION } = require('../src/lib/agent-output-protocol')

function findV2Events(events, type) {
  return events.filter(e => e.version === VERSION && e.type === type)
}

describe('agent-run-executor', () => {
  it('completes chat-simple with mock ports (zero network)', async () => {
    const fixture = {
      input: { prompt: '你好', tier: 'chat', runId: 'run_chat_simple' },
      llmScript: [{ response: { text: '你好！' } }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(result.text.includes('你好'))
    assert.equal(result.metrics.toolCalls, 0)
    assert.ok(result.runPhases.includes(RunPhase.PREPARE))
    assert.ok(result.runPhases.includes(RunPhase.MODEL))
    assert.ok(events.some(e => e.version === VERSION && (e.phase === RunPhase.MODEL || e.payload?.runPhase === RunPhase.MODEL)))
    assert.equal(findV2Events(events, EventType.ANSWER_COMMITTED).length, 1)
    assert.equal(findV2Events(events, EventType.RUN_COMPLETED).length, 1)
    assert.ok(result.answerHash)
    assert.equal(result.protocolVersion, VERSION)
    assert.doesNotThrow(() => structuredClone(result))
  })

  it('returns ERROR when API key missing', async () => {
    const fixture = {
      input: { prompt: 'hi', tier: 'chat', runId: 'run_no_key' },
      settingsError: 'no-api-key',
      llmScript: [],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.ERROR)
    assert.match(String(result.error || ''), /API Key/)
    assert.equal(findV2Events(events, EventType.RUN_FAILED).length, 1)
    assert.equal(findV2Events(events, EventType.ANSWER_COMMITTED).length, 0)
  })

  it('transitions to CANCELLED when signal aborted', async () => {
    const ac = new AbortController()
    const fixture = {
      input: { prompt: 'test', tier: 'chat', runId: 'run_cancel' },
      abortAt: { phase: 'MODEL', afterLlmCall: 0 },
      llmScript: [{ response: { text: 'x' } }],
    }
    const ports = createMockRunPorts(fixture, ac.signal)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.CANCELLED)
    assert.equal(result.cancelled, true)
    assert.equal(Object.hasOwn(result, 'ports'), false)
    assert.equal(findV2Events(events, EventType.RUN_CANCELLED).length, 1)
    assert.doesNotThrow(() => structuredClone(result))
  })

  it('buffers tool-round prose and commits canonical answer after tools', async () => {
    const fixture = {
      input: { prompt: '查资料', tier: 'retrieval', forceTools: true, runId: 'run_tool_buffer' },
      llmScript: [
        {
          response: {
            text: '我先搜索一下知识库。',
            toolCalls: [{ name: 'search_knowledge', arguments: { query: '资料' } }],
          },
        },
        { response: { text: '根据检索结果，答案是 42。' } },
      ],
      toolScript: [{ ok: true, text: 'mock knowledge hit' }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(result.text.includes('42'))
    assert.ok(!result.text.includes('我先搜索'))
    assert.equal(events.filter(e => e.type === 'content').length, 0)

    const committed = findV2Events(events, EventType.ANSWER_COMMITTED)
    assert.equal(committed.length, 1)
    assert.equal(committed[0].payload.text, result.text)
    assert.equal(committed[0].payload.hash, result.answerHash)

    const completedSeq = findV2Events(events, EventType.RUN_COMPLETED)[0].seq
    assert.ok(committed[0].seq < completedSeq)
    assert.equal(findV2Events(events, EventType.RUN_COMPLETED).length, 1)

    const assistant = result.session.messages.filter(m => m.role === 'assistant').pop()
    assert.equal(assistant.text, result.text)
    assert.equal(assistant.answerHash, result.answerHash)
    assert.equal(assistant.protocolVersion, VERSION)
  })

  it('retains artifact refs returned by tools in the terminal result', async () => {
    const fixture = {
      input: { prompt: '生成会议纪要', tier: 'retrieval', forceTools: true, runId: 'run_artifact_refs' },
      llmScript: [
        {
          response: {
            text: '生成纪要文件。',
            toolCalls: [{ name: 'search_knowledge', arguments: { query: '会议纪要' } }],
          },
        },
        { response: { text: '会议纪要和待办已整理完成。' } },
      ],
      toolScript: [{
        ok: true,
        text: '已创建会议纪要',
        artifactRefs: [{ id: 'artifact_minutes', kind: 'markdown', title: '会议纪要' }],
      }],
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE)
    assert.deepEqual(result.artifactRefs, [
      { id: 'artifact_minutes', kind: 'markdown', title: '会议纪要' },
    ])
  })

  it('records buffered draft discard and sanitized commit metrics', async () => {
    const fixture = {
      input: { prompt: '查资料', tier: 'retrieval', forceTools: true, runId: 'run_metrics_buffer' },
      llmScript: [
        {
          response: {
            text: '我先搜索一下知识库。',
            toolCalls: [{ name: 'search_knowledge', arguments: { query: '资料' } }],
          },
        },
        { response: { text: '根据检索结果，答案是 42。' } },
      ],
      toolScript: [{ ok: true, text: 'mock knowledge hit' }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.DONE)
    assert.ok(result.metrics.bufferedDraftsDiscarded >= 1)
    assert.ok(Number.isFinite(result.metrics.answerCommitMs))
    assert.ok(result.metrics.bufferMs == null || result.metrics.bufferMs >= 0)
    assert.ok(Array.isArray(result.metrics.outputDiagnostics))
    assert.ok(result.metrics.outputDiagnostics.some(item => item.code === 'answer_committed'))
    assert.ok(result.metrics.outputDiagnostics.every(item => !Object.prototype.hasOwnProperty.call(item, 'text')))
    const completed = findV2Events(events, EventType.RUN_COMPLETED)[0]
    assert.ok(completed.payload.metrics.bufferedDraftsDiscarded >= 1)
  })

  it('runs postProcess and grounding before answer commit', async () => {
    let postProcessed = false
    const fixture = {
      input: { prompt: '你好', tier: 'chat', runId: 'run_post_ground' },
      llmScript: [{ response: { text: '原始回答' } }],
      hooks: {
        postProcess: async ({ fullText }) => {
          postProcessed = true
          return `${fullText}\n\n[post]`
        },
      },
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(postProcessed, true)
    assert.ok(result.text.includes('[post]'))
    assert.ok(result.runPhases.includes(RunPhase.GROUND))
    assert.ok(result.runPhases.includes(RunPhase.VERIFY_CLAIMS))
    const committed = findV2Events(events, EventType.ANSWER_COMMITTED)[0]
    assert.ok(committed.payload.text.includes('[post]'))
  })

  it('emits choice.ready when suggestion is present in canonical answer', async () => {
    const suggestion = {
      title: '下一步',
      items: [{ label: '继续', action: 'send', payload: '继续分析' }],
    }
    const fixture = {
      input: { prompt: '分析', tier: 'chat', runId: 'run_choice' },
      llmScript: [{
        response: {
          text: `分析完成。\n\n\`\`\`suggestion\n${JSON.stringify(suggestion)}\n\`\`\``,
        },
      }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.ok(!result.text.includes('```suggestion'))
    assert.ok(result.ui?.length)
    assert.equal(findV2Events(events, EventType.CHOICE_READY).length, 1)
    const committed = findV2Events(events, EventType.ANSWER_COMMITTED)[0]
    const choice = findV2Events(events, EventType.CHOICE_READY)[0]
    assert.ok(committed.seq < choice.seq)
  })
})
