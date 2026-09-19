'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const runtime = require('../src/lib/llm-runtime')

describe('llm-runtime', () => {
  it('does not truncate already affordable context at each model budget gate', () => {
    const messages = [
      { role: 'system', content: 'S'.repeat(18000) },
      { role: 'user', content: '保留可容纳的工具证据' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'read', function: { name: 'read', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'read', content: 'T'.repeat(20000) },
      { role: 'user', content: '内部观察：继续整理' },
    ]
    const fitted = runtime.fitConversation(messages, 10000, { currentInput: messages[1] })
    assert.deepEqual(fitted.messages, messages)
    assert.ok(fitted.usedTokens <= 10000)
  })

  it('anchors the actual request across internal users and repeated tool batches', () => {
    const currentInput = { role: 'user', content: '材料'.repeat(4700) + '\nREVISION_END' }
    const messages = [{ role: 'user', content: 'old '.repeat(9000) }, currentInput]
    for (const id of ['one', 'two']) {
      messages.push(
        { role: 'assistant', content: '', tool_calls: [{ id, type: 'function', function: { name: 'read', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: id, content: 'source '.repeat(5000) },
        { role: 'user', content: '内部反思：继续核实' },
      )
    }
    const original = structuredClone(messages)
    const result = runtime.fitConversation(messages, 8000, { currentInput, preserveHistorySummary: true })
    assert.ok(result.messages.some(message => message.content === currentInput.content))
    assert.deepEqual(result.messages.flatMap(message => message.tool_calls || []).map(call => call.id), ['one', 'two'])
    assert.deepEqual(result.messages.filter(message => message.role === 'tool').map(message => message.tool_call_id), ['one', 'two'])
    assert.ok(result.usedTokens <= 8000)
    assert.deepEqual(messages, original)
    assert.throws(() => runtime.fitConversation(messages.slice(2), 8000, { currentInput }),
      error => error.code === 'current_input_anchor_missing')
  })

  it('reserves current tool parameters and images before optional system background', () => {
    const currentInput = { role: 'user', content: 'U'.repeat(2000) }
    const call = { id: 'write', type: 'function', function: { name: 'write', arguments: JSON.stringify({ body: 'A'.repeat(3600) }) } }
    for (const imageCount of [0, 1]) {
      const messages = [
        { role: 'system', content: 'S'.repeat(4000) }, currentInput,
        { role: 'assistant', content: '', tool_calls: [call] },
        { role: 'tool', tool_call_id: 'write', content: 'ok' },
        ...(imageCount ? [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://example.test/image.png' } }] }] : []),
      ]
      const budget = 2000 + imageCount * 1000
      const result = runtime.fitConversation(messages, budget, { currentInput })
      assert.ok(result.messages.some(message => message.content === currentInput.content))
      assert.deepEqual(result.messages.find(message => message.tool_calls)?.tool_calls, [call])
      assert.equal(result.messages.filter(message => message.role === 'tool').length, 1)
      assert.ok(result.usedTokens <= budget)
      assert.throws(() => runtime.fitConversation(messages, 1400 + imageCount * 1000, { currentInput }),
        error => error.code === 'current_input_budget_exceeded')
    }
  })

  it('counts separators when fitting multipart text at a tiny or calibrated budget', () => {
    for (const tokenEstimator of [runtime.estimateTokens, text => String(text).length]) {
      const result = runtime.fitConversation([
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: Array.from({ length: 3 }, () => ({ type: 'text', text: 'aaaa' })) },
      ], 4, { tokenEstimator })
      assert.ok(result.usedTokens <= 4, `used ${result.usedTokens}`)
      assert.equal(result.messages[0].content, 'Q')
    }
  })

  it('never lets the truncation marker exceed a tiny token budget', () => {
    for (const budget of [1, 2, 5, 10, 20]) {
      const fitted = runtime.fitText('中文上下文'.repeat(500), budget)
      assert.ok(runtime.estimateTokens(fitted) <= budget, `${budget}: ${runtime.estimateTokens(fitted)}`)
    }
  })
  it('estimates CJK and ASCII text conservatively', () => {
    assert.ok(runtime.estimateTokens('这是一个中文上下文') > 2)
    assert.ok(runtime.estimateTokens('a'.repeat(400)) >= 90)
  })

  it('builds intent-aware model policy', () => {
    const chat = runtime.getRequestPolicy({
      model: 'gpt-4o-mini',
      tier: 'chat',
      temperature: 0.8,
    })
    const retrieval = runtime.getRequestPolicy({
      model: 'gpt-4o-mini',
      tier: 'retrieval',
      temperature: 1.2,
    })
    assert.equal(chat.temperature, 0.8)
    assert.equal(retrieval.temperature, 0.4)
    assert.ok(retrieval.outputTokens > chat.outputTokens)
    assert.ok(retrieval.inputBudget < retrieval.contextWindow)
  })

  it('prefers an explicit provider profile over name heuristics', () => {
    const policy = runtime.getRequestPolicy({
      model: 'qwen-plus',
      tier: 'retrieval',
      profile: {
        contextWindow: 200000,
        maxOutput: 12000,
        parameter: 'max_tokens',
        supportsTools: true,
      },
    })
    assert.equal(policy.contextWindow, 200000)
    assert.equal(policy.maxOutput, 12000)
  })

  it('keeps high-priority sections before low-priority sections', () => {
    const result = runtime.fitSections([
      { key: 'low', text: 'low '.repeat(1000), priority: 1 },
      { key: 'current', text: '当前用户目标必须保留', priority: 100 },
    ], 20)
    assert.match(result.text, /当前用户目标必须保留/)
  })

  it('keeps system and latest message when history is over budget', () => {
    const result = runtime.fitMessages([
      { role: 'system', content: '固定规则' },
      { role: 'user', content: '旧问题'.repeat(4000) },
      { role: 'assistant', content: '旧回答'.repeat(4000) },
      { role: 'user', content: '当前问题' },
    ], 1000)
    assert.equal(result.messages[0].role, 'system')
    assert.match(result.messages.at(-1).content, /当前问题/)
  })

  it('drops whole turns from oldest without splitting a turn', () => {
    const result = runtime.fitConversation([
      { role: 'system', content: '固定规则' },
      { role: 'user', content: '第一轮问题'.repeat(2000) },
      { role: 'assistant', content: '第一轮回答'.repeat(2000) },
      { role: 'user', content: '第二轮问题' },
      { role: 'assistant', content: '第二轮回答' },
    ], 800)
    assert.equal(result.messages[0].role, 'system')
    assert.match(result.messages.at(-1).content, /第二轮回答/)
    assert.ok(result.omittedTurns >= 1)
    // 保留的一轮必须包含用户与助手，不能被拆散
    const kept = result.messages.filter(m => m.role !== 'system')
    assert.equal(kept[0].role, 'user')
  })

  it('keeps the entire current request even above the former per-message cap', () => {
    const input = 'REQUEST_BEGIN\n' + '材料'.repeat(6000) + '\n只修改负责人，保留其他内容 REQUEST_END'
    const result = runtime.fitConversation([
      { role: 'system', content: '保持事实准确', _contextCritical: true },
      { role: 'user', content: '旧问题'.repeat(6000) },
      { role: 'assistant', content: '旧回复'.repeat(6000) },
      { role: 'user', content: input },
    ], 12000, { preserveHistorySummary: true })
    assert.equal(result.messages.at(-1).content, input)
    assert.ok(result.usedTokens <= 12000)
  })

  it('rejects an oversized current request instead of silently cutting instructions', () => {
    assert.throws(() => runtime.fitConversation([
      { role: 'system', content: '保持事实准确', _contextCritical: true },
      { role: 'user', content: '材料'.repeat(6000) + '\n禁止生成新版本' },
    ], 1000), error => error?.code === 'current_input_budget_exceeded')
  })

  it('preserves the full user request while fitting a large tool result', () => {
    const input = '材料'.repeat(4700) + '\n修改意见：仅修改配色'
    const result = runtime.fitConversation([
      { role: 'system', content: '保持事实准确', _contextCritical: true },
      { role: 'user', content: input },
      { role: 'assistant', content: '', tool_calls: [{ id: 'one', function: { name: 'read', arguments: '{}' } }] },
      { role: 'tool', content: '来源内容'.repeat(10000), tool_call_id: 'one' },
    ], 8500)
    assert.equal(result.messages.find(message => message.role === 'user').content, input)
    assert.ok(result.messages.some(message => message.tool_calls?.[0]?.id === 'one'))
    assert.ok(result.messages.some(message => message.tool_call_id === 'one'))
    assert.ok(result.usedTokens <= 8500)
  })

  it('protects every leading system block while fitting history', () => {
    const result = runtime.fitConversation([
      { role: 'system', content: '平台规则：保持诚实', _contextCritical: true },
      { role: 'system', content: '场景规则：你是办公协作专家', _contextCritical: true },
      { role: 'system', content: '任务事实：整理会议' },
      { role: 'user', content: '旧问题'.repeat(3000) },
      { role: 'assistant', content: '旧回答'.repeat(3000) },
      { role: 'user', content: '你有什么能力？' },
    ], 900)
    assert.deepEqual(result.messages.slice(0, 3).map(message => message.role), [
      'system', 'system', 'system',
    ])
    assert.match(result.messages[1].content, /办公协作专家/)
    assert.equal(result.messages.some(message => Object.hasOwn(message, '_contextCritical')), false)
    assert.match(result.messages.at(-1).content, /你有什么能力/)
  })

  it('fails closed when critical system controls leave no safe user budget', () => {
    assert.throws(() => runtime.fitConversation([
      { role: 'system', content: '关键规则'.repeat(300), _contextCritical: true },
      { role: 'user', content: '当前请求' },
    ], 100), error => error?.code === 'critical_context_budget_exceeded')
  })

  it('keeps an assistant tool call together with its tool result', () => {
    const result = runtime.fitConversation([
      { role: 'system', content: '规则' },
      { role: 'user', content: '很早的问题'.repeat(2000) },
      { role: 'assistant', content: '很早的回答'.repeat(2000) },
      { role: 'user', content: '请查资料' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', function: { name: 'search', arguments: '{}' } }] },
      { role: 'tool', content: '工具结果：命中 3 条', tool_call_id: 'c1' },
      { role: 'assistant', content: '根据结果给出答复' },
    ], 900)
    const roles = result.messages.map(m => m.role)
    const hasTool = roles.includes('tool')
    const hasToolCall = result.messages.some(m => Array.isArray(m.tool_calls) && m.tool_calls.length)
    // 工具结果与其调用必须同时存在或同时不存在
    assert.equal(hasTool, hasToolCall)
  })

  it('enables cache_control policy only for explicitly supported providers', () => {
    const off = runtime.getCacheControlPolicy({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
    })
    assert.equal(off.enabled, false)
    const on = runtime.getCacheControlPolicy({
      enabled: true,
      provider: 'custom',
      model: 'claude-sonnet',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    })
    assert.equal(on.enabled, true)
  })

  it('applies cache_control tags to at most two system prefix messages', () => {
    const policy = { enabled: true, style: 'content_blocks_ephemeral' }
    const messages = [
      { role: 'system', content: 'BASE' },
      { role: 'system', content: 'CTX' },
      { role: 'user', content: 'Q' },
    ]
    const out = runtime.applyCacheControlMessages(messages, policy)
    assert.ok(Array.isArray(out[0].content))
    assert.ok(Array.isArray(out[1].content))
    assert.equal(out[2].content, 'Q')
    assert.equal(out[0].content[0].cache_control.type, 'ephemeral')
  })

  it('uses a provider tokenizer when available and calibrates fallback estimates', () => {
    const providerEstimate = runtime.createTokenEstimator({ tokenizer: text => text.length / 2 })
    assert.equal(providerEstimate('123456'), 3)
    const calibrated = runtime.createTokenEstimator({ calibrationFactor: 1.5 })
    assert.ok(calibrated('中文上下文') >= runtime.estimateTokens('中文上下文'))
  })

  it('never exceeds a calibrated tiny budget when one character is already too expensive', () => {
    const estimate = runtime.createTokenEstimator({ tokenizer: text => text.length * 2 })
    const fitted = runtime.fitTextWithEstimator('中文上下文', 1, estimate)
    assert.equal(fitted, '')
    assert.ok(estimate(fitted) <= 1)
  })

  it('adds an extractive history summary only when compaction is explicitly enabled', () => {
    const messages = [
      { role: 'system', content: '规则' },
      { role: 'user', content: '第一轮目标：整理产品计划'.repeat(300) },
      { role: 'assistant', content: '第一轮结论：确认范围'.repeat(300) },
      { role: 'user', content: '第二轮目标：列风险'.repeat(300) },
      { role: 'assistant', content: '第二轮结论：存在依赖'.repeat(300) },
      { role: 'user', content: '第三轮：继续执行' },
    ]
    const compacted = runtime.fitConversation(messages, 700, {
      preserveHistorySummary: true,
      historySummaryTokens: 96,
    })
    assert.ok(compacted.omittedTurns >= 1)
    assert.equal(compacted.historyCompaction?.strategy, 'extractive')
    assert.match(compacted.messages.find(message => /历史压缩摘要/.test(String(message.content)))?.content || '', /历史压缩摘要/)

    const defaultResult = runtime.fitConversation(messages, 700)
    assert.equal(defaultResult.historyCompaction, null)
    assert.equal(defaultResult.messages.some(message => /历史压缩摘要/.test(String(message.content))), false)
  })
})
