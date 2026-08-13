'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { VERSION, EventType, createRunEmitter } = require('../src/lib/agent-output-protocol')

describe('agent output ipc contract', () => {
  const root = path.join(__dirname, '..')
  const main = readMainIpcBundle()
  const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8')
  const renderer = fs.readFileSync(path.join(root, 'src', 'workspace-agent.js'), 'utf8')
  const adapter = fs.readFileSync(path.join(root, 'src', 'lib', 'agent-run-kernel-adapter.js'), 'utf8')

  it('kernel path forwards v2 envelopes without ai-stream-chunk dual emit', () => {
    assert.ok(main.includes("webContents.send('ai-stream-event'"), 'main uses ai-stream-event channel')
    assert.match(main, /onStreamChunk:\s*null/, 'kernel run disables stream chunk forwarding')
    assert.ok(preload.includes('onAiStreamChunk'), 'preload keeps chunk API for other surfaces')
    assert.ok(preload.includes('onAiStreamEvent'), 'preload exposes v2 event subscription')
    assert.ok(!renderer.includes('onAiStreamChunk('), 'workspace runAI does not subscribe to chunk channel')
    assert.ok(renderer.includes('event.version == null'), 'workspace ignores only legacy no-version events')
  })

  it('adapter persist does not duplicate assistant messages', () => {
    assert.ok(!adapter.includes('session.messages.push(...toolMessages'), 'adapter no longer pushes assistant again')
    assert.ok(adapter.includes('answerHash'), 'adapter persist telemetry includes answer hash')
  })

  it('executor emits strictly monotonic v2 seq for a run', async () => {
    const fixture = {
      input: { prompt: '查', tier: 'retrieval', forceTools: true, runId: 'run_seq' },
      llmScript: [
        {
          response: {
            text: '先搜索。',
            toolCalls: [{ name: 'search_knowledge', arguments: { query: 'x' } }],
          },
        },
        { response: { text: '结果是 42。' } },
      ],
      toolScript: [{ ok: true, text: 'hit' }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))
    const v2 = events.filter(e => e.version === VERSION)
    assert.ok(v2.length >= 4)
    const seqs = v2.map(e => e.seq)
    for (let i = 1; i < seqs.length; i++) {
      assert.ok(seqs[i] > seqs[i - 1], `seq must increase: ${seqs[i - 1]} -> ${seqs[i]}`)
    }
    assert.equal(v2.filter(e => e.type === EventType.RUN_COMPLETED).length, 1)
    assert.equal(v2.filter(e => TERMINAL_COUNT(e)).length, 1)
    assert.doesNotThrow(() => structuredClone(v2))
    assert.equal(events.filter(e => e.type === 'content').length, 0, 'no legacy content stream')
  })

  it('kernel invoke projection omits duplicate body text', () => {
    const kernelReturn = main.slice(
      main.indexOf('const kernelResult = await AgentRunExecutor.run'),
      main.indexOf('} catch (err) {', main.indexOf('const kernelResult = await AgentRunExecutor.run')),
    )
    assert.ok(!kernelReturn.includes('text: kernelResult.text'), 'kernel invoke must not return text')
  })

  it('workspace forbids invoke finalText overwrite after v2 commit', () => {
    assert.ok(renderer.includes('v2AnswerCommitted'), 'tracks committed answer state')
    assert.ok(renderer.includes('if (!assistantRef.message.v2AnswerCommitted)'), 'invoke completion gated on commit')
    assert.ok(renderer.includes('protocolVersion === 2'), 'v2 uses protocol error instead of invoke text')
    assert.ok(renderer.includes('未能收到完整答复，请重试'), 'readable v2 missing-answer error')
    assert.ok(renderer.includes('hydrateLegacyAssistantMessage'), 'lazy legacy suggestion hydration exists')
    assert.ok(renderer.includes('data-structured-ui="1"'), 'structured ui has stable target')
  })
})

function TERMINAL_COUNT(event) {
  return ['run.completed', 'run.cancelled', 'run.failed'].includes(event.type)
}

describe('agent output emitter clone safety', () => {
  it('emitter events are structuredClone-safe', () => {
    const events = []
    const emitter = createRunEmitter('run_clone')
    emitter.emit(EventType.STAGE, { title: '准备', id: 's1', status: 'pending' }, { phase: 'PREPARE' }, (e) => events.push(e))
    emitter.emit(EventType.ANSWER_COMMITTED, { text: 'hi', hash: 'abc' }, { phase: 'PERSIST' }, (e) => events.push(e))
    emitter.emit(EventType.RUN_COMPLETED, { title: '完成' }, { phase: 'DONE' }, (e) => events.push(e))
    for (const event of events) {
      assert.doesNotThrow(() => structuredClone(event))
    }
  })
})
