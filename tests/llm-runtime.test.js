'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const runtime = require('../src/lib/llm-runtime')

describe('llm-runtime', () => {
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
})
