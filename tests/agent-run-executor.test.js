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
  it('retains rewrite and re-audit capacity after repairing a length-truncated answer', async () => {
    const fixture = {
      input: {
        prompt: '给出正确答案',
        tier: 'assist',
        qualityReview: { enabled: true, criteria: ['答案必须等于 corrected'] },
      },
    }
    const ports = createMockRunPorts(fixture)
    const audit = (pass, requiredChange = '') => JSON.stringify({
      pass,
      userRequirements: {
        pass,
        evidence: pass ? '候选稿为 corrected' : '候选稿为 wrong',
        reason: pass ? '满足用户要求' : '未满足用户要求',
        ...(pass ? {} : { requiredChange }),
      },
      checks: [{
        criterion: 1,
        pass,
        evidence: pass ? '候选稿为 corrected' : '候选稿为 wrong',
        reason: pass ? '满足标准' : '未满足标准',
        ...(pass ? {} : { requiredChange }),
      }],
    })
    const responses = [
      { content: 'truncated', finishReason: 'length' },
      { content: 'wrong', finishReason: 'stop' },
      { content: audit(false, '改为 corrected'), finishReason: 'stop' },
      { content: 'corrected', finishReason: 'stop' },
      { content: audit(true), finishReason: 'stop' },
    ]
    let calls = 0
    ports.llm.complete = async () => {
      const snapshot = responses[calls++]
      return { snapshot: { ...snapshot, toolCalls: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }, streamed: false }
    }

    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(result.text, 'corrected')
    assert.equal(calls, 5)
    assert.deepEqual(result.metrics.finalizationBudget, {
      maxModelCalls: 4,
      usedModelCalls: 4,
      exhausted: false,
    })
    assert.equal(result.metrics.qualityReview.passed, true)
    assert.equal(result.metrics.qualityReview.rewritten, true)
  })

  it('repairs a truncated forced finalizer after the tool-round budget is exhausted', async () => {
    const fixture = {
      input: { prompt: '汇总四次检索结果', tier: 'assist', forceTools: true },
      llmScript: [
        ...[1, 2, 3, 4].map(index => ({
          response: { toolCalls: [{ name: 'search_knowledge', arguments: { query: `资料 ${index}` } }] },
        })),
      ],
      toolScript: [1, 2, 3, 4].map(index => ({ ok: true, text: `资料 ${index} 命中` })),
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    let calls = 0
    ports.llm.complete = async args => {
      calls += 1
      if (calls <= 4) return complete(args)
      const snapshot = calls === 5
        ? { content: '不完整答复', finishReason: 'length' }
        : { content: '完整汇总：四次检索结果均已纳入。', finishReason: 'stop' }
      return { snapshot: { ...snapshot, toolCalls: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }, streamed: false }
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(result.text, '完整汇总：四次检索结果均已纳入。')
    assert.equal(calls, 6)
    assert.equal(result.metrics.rounds, 4)
    assert.deepEqual(result.metrics.finalizationBudget, {
      maxModelCalls: 4,
      usedModelCalls: 2,
      exhausted: false,
    })
  })

  it('gives structured professional audits bounded headroom beyond ordinary prose', async () => {
    const fixture = {
      input: {
        prompt: '给出实现',
        tier: 'assist',
        qualityReview: { enabled: true, criteria: ['实现必须完整'] },
      },
    }
    const ports = createMockRunPorts(fixture)
    const build = ports.context.build
    ports.context.build = async () => {
      const context = await build()
      return { ...context, policy: { ...context.policy, maxOutput: 10000 } }
    }
    const requests = []
    ports.llm.complete = async args => {
      requests.push(args)
      const snapshot = requests.length === 1
        ? { content: '完整实现', finishReason: 'stop' }
        : {
            content: JSON.stringify({
              pass: true,
              userRequirements: { pass: true, evidence: '完整实现', reason: '满足用户要求' },
              checks: [{ criterion: 1, pass: true, evidence: '完整实现', reason: '实现完整' }],
            }),
            finishReason: 'stop',
          }
      return { snapshot: { ...snapshot, toolCalls: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }, streamed: false }
    }

    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(requests.length, 2)
    assert.equal(requests[1].policy.outputTokens, 6000)
  })

  it('reserves enough output for a forced file-delivery tool call', async () => {
    const fixture = {
      input: { prompt: '生成单页网页', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
      taskFrame: { requiredTools: ['write_file'] },
      llmScript: [{ response: { toolCalls: [{ name: 'write_file', arguments: { path: 'outputs/demo.html', content: '<main>ok</main>' } }] } }],
      toolScript: [{ ok: true, text: '已写入', artifactRefs: [{ id: 'demo', type: 'file', targetPath: 'outputs/demo.html' }] }],
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    let firstPolicy = null
    ports.llm.complete = async args => {
      firstPolicy ||= args.policy
      return complete(args)
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(firstPolicy.outputTokens, Math.min(firstPolicy.maxOutput, 4096))
  })

  it('corrects an unknown Skill-shaped call through the real tool surface and keeps the historical failure', async () => {
    const { createToolSurface } = require('../src/lib/agent-tools-surface')
    let effects = 0
    const surface = createToolSurface({ includeBuiltins: false,
      extraDefinitions: [{ type: 'function', function: { name: 'local_analysis', parameters: { type: 'object', properties: {} } } }],
      handlers: { local_analysis: async () => { effects++; return { ok: true, text: '收入从100增加到120，增长20%。' } } },
    })
    const fixture = { input: { prompt: '根据已给材料做分析', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
      llmScript: [
        { response: { toolCalls: [{ name: 'analysis_skill', arguments: '{}' }] } },
        { response: { toolCalls: [{ name: 'local_analysis', arguments: '{}' }] } },
        { response: { text: '收入增长20%，计算依据为(120-100)/100。' } },
      ],
    }
    const ports = createMockRunPorts(fixture)
    ports.tools.surface = surface
    ports.tools.execute = surface.createToolExecutor({}).executeToolCall
    const complete = ports.llm.complete
    let calls = 0
    ports.llm.complete = async args => {
      calls++
      if (calls === 2) assert.ok(args.messages.some(m => /Skill/.test(String(m.content))))
      return complete(args)
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(calls, 3)
    assert.equal(effects, 1)
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(result.executionEvidence.verificationPassed, true)
    assert.deepEqual(result.executionEvidence.toolCalls.map(c => c.status), ['fail', 'ok'])
  })

  it('repairs a safe invalid query once before asking the model to recover', async () => {
    const longQuery = 'x'.repeat(90)
    const fixture = {
      input: { prompt: '读取资料', tier: 'assist', forceTools: true },
      llmScript: [
        { response: { toolCalls: [{ name: 'safe_read', arguments: { query: longQuery } }] } },
        { response: { text: '资料已读取。' } },
      ],
    }
    const ports = createMockRunPorts(fixture)
    let calls = 0
    ports.tools.surface = {
      getToolDefinitions: () => [{ type: 'function', function: { name: 'safe_read', parameters: { type: 'object' } } }],
      getToolRecords: () => [{ function: { name: 'safe_read' }, _knowme: { risk: 'read', sideEffects: false } }],
      validateToolCall: (name, raw) => ({ ok: name === 'safe_read', name, args: typeof raw === 'string' ? JSON.parse(raw) : raw }),
    }
    ports.tools.execute = async call => {
      calls++
      const args = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments
      if (args.query.length > 60) return { ok: false, code: 'invalid_args', text: 'query too long', executionStarted: false }
      return { ok: true, text: '读取成功', executionStarted: true }
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(calls, 2)
    assert.equal(result.metrics.toolArgumentRepairs, 1)
  })

  it('keeps a verified artifact despite an optional unknown call and a failed handoff', async () => {
    const fixture = { input: { prompt: '生成交付成果', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
      taskFrame: { requiredTools: ['generate_image'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 },
      llmScript: [
        { response: { toolCalls: [{ name: 'generate_image', arguments: '{}' }, { name: 'optional_skill', arguments: '{}' }] } },
        { fail: true, message: 'handoff unavailable' },
      ],
      toolScript: [
        { ok: true, text: '已生成', artifactRefs: [{ id: 'verified-artifact', type: 'image', targetPath: 'https://example.test/generated.png' }] },
        { fail: true, code: 'unknown_tool', message: '未注册工具: optional_skill', executionStarted: false },
      ],
    }
    const ports = createMockRunPorts(fixture)
    const execute = ports.tools.execute
    let generations = 0
    ports.tools.execute = call => { if (call.name === 'generate_image') generations++; return execute(call) }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(result.artifactRefs[0].id, 'verified-artifact')
    assert.equal(generations, 1)
    assert.equal(result.metrics.recoveryRounds || 0, 0)
    assert.equal(result.executionEvidence.verificationPassed, true)
  })

  it('accepts a trusted complete-turn tool result only after the current contract is satisfied', async () => {
    const fixture = {
      input: {
        prompt: '查找今天的会议候选', tier: 'retrieval', forceTools: true,
        conversationMode: 'expert-execution',
      },
      taskFrame: {
        requiredTools: ['find_candidates'],
        requiredEvidence: [{ kind: 'tool_result', tool: 'find_candidates' }],
        completionConditions: [{ type: 'tool_success', tool: 'find_candidates' }],
      },
      llmScript: [{ response: { toolCalls: [{ name: 'find_candidates', arguments: '{}' }] } }],
      toolScript: [{
        ok: true,
        text: '今天没有找到符合范围的候选记录。',
        meta: { turnComplete: true },
      }],
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    let modelCalls = 0
    ports.llm.complete = async args => { modelCalls++; return complete(args) }

    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(modelCalls, 1)
    assert.equal(result.metrics.toolCalls, 1)
    assert.match(result.text, /没有找到符合范围的候选记录/)
    assert.equal(result.executionEvidence.verificationPassed, true)
  })

  for (const category of ['unknown_tool', 'invalid_args']) it(`fails structurally after ${category} recovery is exhausted`, async () => {
    const fixture = { input: { prompt: '材料已齐，执行分析', tier: 'assist', forceTools: true },
      llmScript: [0, 1, 2].map(n => ({ response: { toolCalls: [{ name: `analysis_${n}`, arguments: '{}' }] } })),
      toolScript: [{ fail: true, code: category, message: 'structured failure', executionStarted: false }],
    }
    const events = []
    const ports = createMockRunPorts(fixture)
    const checkpoints = []
    ports.session.checkpoint = async ({ session }) => { checkpoints.push(session) }
    const result = await AgentRunExecutor.run(fixture.input, ports, e => events.push(e))
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.ok(result.error)
    assert.equal(result.metrics.recoveryRounds, 2)
    assert.equal(result.metrics.toolRetries || 0, 0)
    assert.equal(findV2Events(events, EventType.ANSWER_COMMITTED).length, 0)
    assert.ok(checkpoints.some(session => session.run.steps.some(step => step.status === 'error')))
  })

  it('stops repeated unknown calls without re-executing the same tool', async () => {
    const fixture = { input: { prompt: '分析', tier: 'assist', forceTools: true },
      llmScript: [0, 1].map(() => ({ response: { toolCalls: [{ name: 'analysis_skill', arguments: '{}' }] } })),
      toolScript: [{ fail: true, code: 'unknown_tool', message: 'unregistered', executionStarted: false }],
    }
    const ports = createMockRunPorts(fixture)
    const execute = ports.tools.execute
    let effects = 0
    ports.tools.execute = call => { effects++; return execute(call) }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.equal(result.metrics.rounds, 2)
    assert.equal(effects, 1)
  })

  for (const approval of [false, true]) it(`returns structured ${approval ? 'approval' : 'missing resource'} waiting, not a verified output`, async () => {
    const fixture = { input: { prompt: '读取或提交目标', tier: 'assist', forceTools: true },
      llmScript: [0, 1, 2].map(() => ({ response: { toolCalls: [{ name: 'target', arguments: '{}' }] } })),
    }
    const ports = createMockRunPorts(fixture)
    let effects = 0
    ports.tools.execute = async () => { effects++; return approval
      ? { ok: true, requiresApproval: true, draftId: 'draft-qa', code: 'approval_required', text: '审批后执行' }
      : { ok: false, code: 'missing_resource', text: 'ENOENT: no such file', executionStarted: false } }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.attention?.action, 'provide_input')
    assert.equal(result.attention?.kind, approval ? 'approval_required' : 'missing_information')
    assert.equal(result.executionEvidence.verificationPassed, false)
    assert.equal(result.executionEvidence.gateStatus, 'blocked')
    assert.equal(effects, 1)
    if (approval) assert.equal(result.attention.draftId, 'draft-qa')
  })
  for (const finalize of [false, true]) it(`budgets ${finalize ? 'FINALIZE' : 'MODEL'} with the original request and media/tool pairs`, async () => {
    const { buildMediaObservation } = require('../src/lib/agent-media-resources')
    const llm = require('../src/lib/llm-runtime')
    const prompt = '材料'.repeat(4700) + '\nREVISION_END: only change color'
    const fixture = {
      input: { prompt, tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
      taskFrame: finalize ? { requiredTools: ['read'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 } : null,
      llmScript: [
        { response: { toolCalls: [{ id: 'read-1', name: 'read', arguments: '{}' }] } },
        { response: { text: '已整理结果。' } },
      ],
      toolScript: [{ ok: true, text: 'source '.repeat(10000),
        artifactRefs: [{ id: 'image', type: 'image', targetPath: 'https://example.test/image.png' }] }],
    }
    const ports = createMockRunPorts(fixture)
    ports.media = { observeArtifacts: artifacts => buildMediaObservation(artifacts, { supportsVision: true }) }
    const complete = ports.llm.complete
    const requests = []
    ports.llm.complete = async args => {
      requests.push(structuredClone(args.messages))
      assert.ok(args.messages.some(message => message.content === prompt), 'the real request must reach every model call')
      const cost = args.messages.reduce((sum, message) => {
        const parts = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }]
        return sum + llm.estimateTokens(parts.filter(part => part.type === 'text').map(part => part.text || '').join('\n'))
          + parts.filter(part => part.type === 'image_url').length * 1000
          + (message.tool_calls ? llm.estimateTokens(JSON.stringify(message.tool_calls)) : 0)
      }, 0)
      assert.ok(cost <= args.policy.inputBudget, `${cost} > ${args.policy.inputBudget}`)
      return complete(args)
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(requests.length, 2)
    assert.equal(requests[1].find(message => message.tool_calls)?.tool_calls[0].id, 'read-1')
    assert.equal(requests[1].find(message => message.role === 'tool')?.tool_call_id, 'read-1')
    assert.ok(requests[1].some(message => Array.isArray(message.content)
      && message.content.some(part => part.type === 'image_url')))
    assert.equal(result.metrics.toolCalls, 1)
  })

  it('retains the same request and both tool batches on a third MODEL call', async () => {
    const prompt = '材料'.repeat(4700) + '\nTHIRD_ROUND_END'
    const fixture = {
      input: { prompt, tier: 'assist', forceTools: true },
      llmScript: [
        { response: { toolCalls: [{ id: 'one', name: 'read', arguments: '{"path":"one"}' }] } },
        { response: { toolCalls: [{ id: 'two', name: 'read', arguments: '{"path":"two"}' }] } },
        { response: { text: '已核实两份资料。' } },
      ],
      toolScript: [{ ok: true, text: 'A'.repeat(30000) }, { ok: true, text: 'B'.repeat(30000) }],
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    const requests = []
    ports.llm.complete = async args => {
      requests.push(structuredClone(args.messages))
      assert.ok(args.messages.some(message => message.content === prompt))
      return complete(args)
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(requests.length, 3)
    assert.deepEqual(requests[2].flatMap(message => message.tool_calls || []).map(call => call.id), ['one', 'two'])
    assert.deepEqual(requests[2].filter(message => message.role === 'tool').map(message => message.tool_call_id), ['one', 'two'])
    assert.equal(result.metrics.toolCalls, 2)
  })

  it('checks budget again after recovery adds an internal user message', async () => {
    const fixture = {
      input: { prompt: '材料'.repeat(5000) + '\nRECOVERY_END', tier: 'assist', forceTools: true },
      llmScript: [
        { response: { toolCalls: [{ name: 'read', arguments: '{}' }] } },
        { response: { text: '工具失败，请检查输入。' } },
      ],
      toolScript: [{ fail: true, code: 'invalid_args', message: 'invalid argument ' + 'x'.repeat(30000), executionStarted: false }],
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    let calls = 0
    ports.llm.complete = async args => {
      calls++
      assert.ok(args.messages.some(message => message.content === fixture.input.prompt))
      const cost = require('../src/lib/llm-runtime').estimateTokens(args.messages.map(message => message.content).join('\n'))
      assert.ok(cost <= args.policy.inputBudget)
      return complete(args)
    }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(calls, 2)
  })

  it('rejects an oversized first MODEL request before calling the provider', async () => {
    const fixture = { input: { prompt: '材料'.repeat(7000), tier: 'assist' } }
    const ports = createMockRunPorts(fixture)
    let calls = 0
    ports.llm.complete = async () => { calls++; return { snapshot: { content: 'should not send' } } }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(result.terminal, RunPhase.ERROR)
    assert.match(result.error, /上下文预算/)
    assert.equal(calls, 0)
  })

  it('preserves a generated artifact when FINALIZE cannot fit fixed records without retrying generation', async () => {
    const fixture = {
      input: { prompt: '材料'.repeat(4700) + '\nKEEP_END', tier: 'assist', forceTools: true, conversationMode: 'expert-execution' },
      taskFrame: { requiredTools: ['generate_image'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 },
      llmScript: [{ response: { toolCalls: [{ name: 'generate_image', arguments: { prompt: 'x'.repeat(10000) } }] } }],
      toolScript: [{ ok: true, text: '已生成图片', artifactRefs: [{ id: 'generated', type: 'image', targetPath: 'https://example.test/result.png' }] }],
    }
    const ports = createMockRunPorts(fixture)
    const complete = ports.llm.complete
    const execute = ports.tools.execute
    let modelCalls = 0
    let effects = 0
    ports.llm.complete = async args => { modelCalls++; return complete(args) }
    ports.tools.execute = async call => { effects++; return execute(call) }
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})
    assert.equal(modelCalls, 1, 'oversized FINALIZE must not reach provider')
    assert.equal(effects, 1)
    assert.equal(result.terminal, RunPhase.DONE, result.error)
    assert.equal(result.artifactRefs[0].id, 'generated')
    assert.match(result.text, /已生成 1 项可验收成果/)
  })

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

  it('gives the model a follow-up after an unclassified tool failure', async () => {
    const fixture = {
      input: { prompt: '查询群消息', tier: 'retrieval', forceTools: true, runId: 'run_unknown_tool_failure' },
      llmScript: [
        {
          response: {
            toolCalls: [{ name: 'search_knowledge', arguments: { query: '技术委' } }],
          },
        },
        { response: { text: '查询没有成功，暂时无法获取群消息。' } },
      ],
      toolScript: [{ ok: false, code: 'mcp_error', text: '第三方工具返回了未标准化错误' }],
    }
    const ports = createMockRunPorts(fixture)
    const events = []
    const result = await AgentRunExecutor.run(fixture.input, ports, (e) => events.push(e))

    assert.equal(result.terminal, RunPhase.DONE)
    assert.match(result.text, /查询没有成功/)
    assert.equal(findV2Events(events, EventType.ANSWER_COMMITTED).length, 1)
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

  it('finishes any manifest-declared artifact delivery with a professional expert handoff', async () => {
    const fixture = {
      input: {
        prompt: '生成机器人 Icon',
        tier: 'retrieval',
        forceTools: true,
        runId: 'run_expert_image_review',
        conversationMode: 'expert-execution',
      },
      taskFrame: {
        requiredTools: ['generate_image'],
        requiredEvidence: [{ kind: 'tool_result', tool: 'generate_image' }],
        completionConditions: [{ type: 'tool_success', tool: 'generate_image' }],
        requiredArtifacts: [{ type: 'image' }],
        minArtifacts: 1,
      },
      llmScript: [
        {
          response: {
            toolCalls: [{ name: 'generate_image', arguments: { prompt: 'robot icon' } }],
          },
        },
        { response: { text: '机器人图标已经完成：1:1 构图、边缘清晰，并检查了小尺寸辨识度。你可以直接验收，也可以告诉我需要调整的配色。' } },
      ],
      toolScript: [{
        ok: true,
        text: '已生成 1 张图片，预览已附在成果区。',
        artifactRefs: [{ id: 'image_robot', type: 'image', targetPath: 'https://cdn.example.com/robot.png' }],
      }],
    }
    const ports = createMockRunPorts(fixture)
    const result = await AgentRunExecutor.run(fixture.input, ports, () => {})

    assert.equal(result.terminal, RunPhase.DONE)
    assert.match(result.text, /1:1 构图/)
    assert.match(result.text, /小尺寸辨识度/)
    assert.equal(result.artifactRefs[0].id, 'image_robot')
    assert.equal(result.metrics.toolCalls, 1)
  })

  it('keeps a verified artifact reviewable when the expert handoff finalization fails', async () => {
    const fixture = {
      input: {
        prompt: '生成封面图', tier: 'retrieval', forceTools: true,
        runId: 'run_artifact_handoff_fallback', conversationMode: 'expert-execution',
      },
      taskFrame: {
        requiredTools: ['generate_image'],
        requiredArtifacts: [{ type: 'image' }],
        minArtifacts: 1,
      },
      llmScript: [
        { response: { toolCalls: [{ name: 'generate_image', arguments: { prompt: 'cover' } }] } },
        { error: 'handoff model unavailable' },
      ],
      toolScript: [{
        ok: true,
        artifactRefs: [{ id: 'image_cover', type: 'image', targetPath: 'https://cdn.example.com/cover.png' }],
      }],
    }
    const result = await AgentRunExecutor.run(fixture.input, createMockRunPorts(fixture), () => {})

    assert.equal(result.terminal, RunPhase.DONE)
    assert.equal(result.artifactRefs[0].id, 'image_cover')
    assert.match(result.text, /已生成 1 项可验收成果/)
    assert.match(result.text, /接受成果|调整/)
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
          // A literal hook marker, not the platform's [source-id] notation.
          return `${fullText}\n\n\`[post]\``
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
