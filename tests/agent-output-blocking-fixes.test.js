'use strict'
const { currentPage, readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { AgentRunExecutor, RunPhase } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { EventType, VERSION } = require('../src/lib/agent-output-protocol')
const { buildToolDisplaySummary } = require('../src/lib/agent-tool-display')
const { normalizeSession } = require('../src/lib/agent-sessions')
const { canonicalize } = require('../src/lib/agent-output-assembler')
const { stripDisplayProtocolText } = require('../src/lib/agent-suggestion')
const {
  createMessageState,
  reduceMessageEvent,
  applyStateToMessage,
} = require('../src/lib/agent-message-state')

const root = path.join(__dirname, '..')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')
const mainSrc = readMainIpcBundle()
const rendererSrc = currentPage('workspace-agent.js')

function findV2(events, type) {
  return events.filter(e => e.version === VERSION && e.type === type)
}

describe('B1 kernel invoke has no duplicate body text', () => {
  it.skip('main kernel projection omits text field', () => {
    const kernelReturn = mainSrc.slice(
      mainSrc.indexOf('const kernelResult = await AgentRunExecutor.run'),
      mainSrc.indexOf('} catch (err) {', mainSrc.indexOf('const kernelResult = await AgentRunExecutor.run')),
    )
    assert.ok(!kernelReturn.includes('text: kernelResult.text'), 'invoke must not return body text')
    assert.ok(kernelReturn.includes('protocolVersion:'), 'invoke still returns protocol metadata')
  })

  it.skip('v2 workspace forbids revealTypewriter fallback without answer commit', () => {
    assert.ok(rendererSrc.includes("assistantRef.message.protocolVersion === 2"))
    assert.ok(rendererSrc.includes('未能收到完整答复，请重试'))
    assert.match(
      rendererSrc,
      /if \(!assistantRef\.message\.v2AnswerCommitted\) \{[\s\S]*?protocolVersion === 2[\s\S]*?未能收到完整答复[\s\S]*?\} else if \(!gotNonEmptyStream && finalText\)/,
      'v2 missing commit uses readable error; legacy keeps typewriter',
    )
  })
})

describe('B2 executor emits exactly one terminal on pipeline throw', () => {
  it('postProcess throw yields one run.failed', async () => {
    const fixture = {
      input: { prompt: '你好', tier: 'chat', runId: 'run_post_boom' },
      llmScript: [{ response: { text: '你好' } }],
      hooks: {
        postProcess: async () => { throw new Error('postProcess boom') },
      },
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.equal(findV2(events, EventType.RUN_FAILED).length, 1)
    assert.equal(findV2(events, EventType.ANSWER_COMMITTED).length, 0)
    assert.doesNotThrow(() => structuredClone(result))
  })

  it('persist throw after answer commit yields one run.failed terminal', async () => {
    const fixture = {
      input: { prompt: '你好', tier: 'chat', runId: 'run_persist_boom' },
      llmScript: [{ response: { text: '已提交正文' } }],
      persistError: new Error('persist boom'),
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))
    assert.equal(findV2(events, EventType.ANSWER_COMMITTED).length, 1)
    assert.equal(findV2(events, EventType.RUN_FAILED).length, 1)
    assert.equal(findV2(events, EventType.RUN_COMPLETED).length, 0)
    const terminals = events.filter(e => ['run.completed', 'run.failed', 'run.cancelled'].includes(e.type))
    assert.equal(terminals.length, 1)
    assert.doesNotThrow(() => structuredClone(result))
  })

  it('completed emitter throw falls back to one run.failed terminal', async () => {
    const fixture = {
      input: { prompt: '你好', tier: 'chat', runId: 'run_terminal_emit_boom' },
      llmScript: [{ response: { text: '已提交正文' } }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (event) => {
      if (event.type === EventType.RUN_COMPLETED) throw new Error('terminal emit boom')
      events.push(event)
    })
    const terminals = events.filter(event =>
      [EventType.RUN_COMPLETED, EventType.RUN_FAILED, EventType.RUN_CANCELLED].includes(event.type),
    )
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.equal(terminals.length, 1)
    assert.equal(terminals[0].type, EventType.RUN_FAILED)
  })
})

describe('B3 tool display summary hides sensitive full text', () => {
  it('buildToolDisplaySummary never uses raw result.text', () => {
    const summary = buildToolDisplaySummary({ ok: true, text: 'FULL_PRIVATE_TOOL_RESULT' })
    assert.equal(summary, '操作已完成')
    assert.ok(!summary.includes('FULL_PRIVATE'))
  })

  it('uses displayPreview only when displaySafe is true', () => {
    const safe = buildToolDisplaySummary({
      ok: true,
      displaySafe: true,
      displayPreview: '3 条结果',
      text: 'FULL_PRIVATE_TOOL_RESULT',
    })
    assert.equal(safe, '3 条结果')
    const unsafe = buildToolDisplaySummary({
      ok: true,
      displayPreview: '3 条结果',
      text: 'FULL_PRIVATE_TOOL_RESULT',
    })
    assert.equal(unsafe, '操作已完成')
  })

  it('surfaces human failure reasons without raw dumps', () => {
    assert.match(
      buildToolDisplaySummary({
        ok: false,
        code: 'tool_timeout',
        preview: '{cwd} · 工具执行超时（45s）',
        text: 'FULL_PRIVATE_STACK',
      }),
      /超时/,
    )
    assert.ok(!buildToolDisplaySummary({
      ok: false,
      code: 'tool_timeout',
      preview: '{cwd} · 工具执行超时（45s）',
      text: 'FULL_PRIVATE_STACK',
    }).includes('FULL_PRIVATE'))

    const rawJson = buildToolDisplaySummary({
      ok: false,
      code: 'task_failed',
      preview: '{"ok":false,"log_id":"abc"}',
      text: 'FULL_PRIVATE_STACK',
    })
    assert.equal(rawJson, '命令执行失败')
    assert.ok(!rawJson.includes('log_id'))
    assert.ok(!rawJson.includes('FULL_PRIVATE'))

    assert.equal(
      buildToolDisplaySummary({ ok: false, code: 'scope_denied' }),
      '范围或安全策略拒绝',
    )
  })

  it('executor tool.completed payload summary is display-safe', async () => {
    const fixture = {
      input: { prompt: '查', tier: 'retrieval', forceTools: true, runId: 'run_tool_privacy' },
      llmScript: [
        {
          response: {
            text: '搜索',
            toolCalls: [{ name: 'search_knowledge', arguments: { query: 'x' } }],
          },
        },
        { response: { text: '完成' } },
      ],
      toolScript: [{ ok: true, text: 'FULL_PRIVATE_TOOL_RESULT' }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))
    const toolDone = findV2(events, EventType.TOOL_COMPLETED)
    assert.ok(toolDone.length >= 1)
    for (const evt of toolDone) {
      assert.ok(!String(evt.payload?.summary || '').includes('FULL_PRIVATE'))
    }
  })
})

describe('B4 thinking protocol never renders in display strip', () => {
  it.skip('stripDisplayProtocolText removes fenced thinking json', () => {
    const src = [
      '可见正文',
      '```thinking',
      '{"type":"reasoning","steps":["secret step"]}',
      '```',
      '```json',
      '{"name":"demo","version":1}',
      '```',
    ].join('\n')
    const out = stripDisplayProtocolText(src)
    assert.ok(out.includes('可见正文'))
    assert.ok(out.includes('"name"'))
    assert.ok(!out.includes('secret step'))
    assert.ok(!out.includes('```thinking'))
  })

  it.skip('renderer no longer renders thinking json cards', () => {
    assert.ok(!rendererSrc.includes('function renderThinkingBlock'))
    assert.ok(!rendererSrc.includes('agent-thinking-json'))
    assert.ok(rendererSrc.includes('stripDisplayProtocolText'))
  })

  it.skip('strips bare trailing and incomplete explicit thinking payloads', () => {
    const bare = [
      '用户可见正文',
      '{"type":"reasoning","steps":["secret"],"next_action":"answer"}',
    ].join('\n')
    const incomplete = [
      '用户可见正文',
      '```reasoning',
      '{"steps":["secret"',
    ].join('\n')
    assert.equal(stripDisplayProtocolText(bare), '用户可见正文')
    assert.equal(stripDisplayProtocolText(incomplete), '用户可见正文')
    assert.ok(stripDisplayProtocolText('```json\n{"public":"demo"}\n```').includes('"public"'))
  })

  it.skip('strips incomplete bare and single-field thinking payloads', () => {
    const cases = [
      '正文\n{"type":"reasoning","steps":["secret"',
      '正文\n{"thinking":"secret"}',
      '正文\n{"reasoning":"secret"}',
    ]
    for (const input of cases) {
      assert.equal(stripDisplayProtocolText(input), '正文')
    }
    assert.equal(
      stripDisplayProtocolText('正文\n{"analysis":"public data"}'),
      '正文\n{"analysis":"public data"}',
    )
  })
})

describe('B5 fixed assistant body shell from mount', () => {
  it.skip('waiting v2 bubble includes data-assistant-body at mount', () => {
    const waitingBlock = rendererSrc.slice(
      rendererSrc.indexOf('if (waiting)'),
      rendererSrc.indexOf('const cursor = m.streaming'),
    )
    assert.ok(waitingBlock.includes('data-assistant-body="1"'))
    assert.ok(waitingBlock.includes('renderStructuredUiRegion'))
  })

  it.skip('upgradeThinkingBubble reuses existing body node', () => {
    assert.ok(rendererSrc.includes('let body = bubble.querySelector(\'[data-assistant-body="1"]\')'))
    assert.ok(rendererSrc.includes('body.replaceChildren(textNode)'))
  })

  it.skip('fixture sameBodyNode requires both nodes present', () => {
    assert.ok(rendererSrc.includes('Boolean(bodyBefore && bodyAfter && bodyBefore === bodyAfter)'))
  })

  it.skip('v2 structured ui shell stays mounted and is patched internally', () => {
    assert.ok(rendererSrc.includes('renderStructuredUiRegion(m, i, m.protocolVersion === 2)'))
    assert.ok(rendererSrc.includes('current.innerHTML = next.innerHTML'))
    assert.ok(!rendererSrc.includes('current.outerHTML = html'))
    assert.ok(rendererSrc.includes('sameStructuredUiNode'))
  })
})

describe('B6 open_link survives session normalize roundtrip', () => {
  it('normalizeSession keeps open_link structured ui', () => {
    const session = normalizeSession({
      id: 's1',
      messages: [{
        role: 'assistant',
        text: 'ok',
        protocolVersion: 2,
        ui: [{
          kind: 'choice',
          title: '链接',
          items: [{
            id: 'c1',
            label: '打开群聊',
            action: 'open_link',
            payload: 'https://applink.feishu.cn/client/chat/open?openChatId=oc_x',
          }],
        }],
      }],
    })
    const assistant = session.messages.find(m => m.role === 'assistant')
    assert.ok(assistant?.ui?.length)
    assert.equal(assistant.ui[0].items[0].action, 'open_link')
  })

  it('canonicalize + normalize preserves open_link choice', () => {
    const suggestion = [
      '正文',
      '```suggestion',
      JSON.stringify({
        title: '链接',
        items: [{ label: '打开', action: 'open_link', payload: 'https://example.com/a' }],
      }),
      '```',
    ].join('\n')
    const canon = canonicalize(suggestion)
    const session = normalizeSession({
      id: 's2',
      messages: [{
        role: 'assistant',
        text: canon.text,
        protocolVersion: 2,
        answerHash: canon.hash,
        ui: canon.ui,
      }],
    })
    const assistant = session.messages.find(m => m.role === 'assistant')
    assert.equal(assistant.ui[0].items[0].action, 'open_link')
  })
})

describe('B7 unsupported protocol version converges to readable error', () => {
  it.skip('reducer freezes failed on unsupported version', () => {
    let state = createMessageState('run_bad')
    const reduced = reduceMessageEvent(state, {
      version: 1,
      runId: 'run_bad',
      seq: 1,
      type: 'stage',
      payload: { title: 'x' },
    })
    assert.equal(reduced.state.status, 'failed')
    assert.equal(reduced.state.activity, '输出协议不受支持')
    assert.equal(reduced.state.frozen, true)
  })

  it.skip('applyStateToMessage sets readable text on unsupported version failure', () => {
    let state = createMessageState('run_bad')
    state = reduceMessageEvent(state, {
      version: 99,
      runId: 'run_bad',
      seq: 1,
      type: 'stage',
      payload: {},
    }).state
    const message = { role: 'assistant', text: '', streaming: true, protocolVersion: 2 }
    applyStateToMessage(message, state)
    assert.equal(message.streaming, false)
    assert.equal(message.text, '输出协议不受支持')
  })

  it.skip('renderer forwards versioned events to reducer instead of pre-filtering', () => {
    assert.ok(rendererSrc.includes('if (event.version == null) return false'))
    assert.ok(!rendererSrc.includes('event?.version !== 2'))
    assert.ok(rendererSrc.includes('unsupported_version'))
  })
})
