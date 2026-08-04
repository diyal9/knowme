'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const orchestrator = require('../src/lib/agent-context-orchestrator')

describe('agent-context-orchestrator', () => {
  it('disables memory for chat tier by default', () => {
    const policy = orchestrator.buildMemoryPolicy({
      tier: 'chat',
      memoryContext: '有记忆内容',
    })
    assert.equal(policy.enabled, false)
    assert.equal(policy.reason, 'chat_tier')
    assert.equal(policy.mode, 'light')
  })

  it('enables memory for retrieval tier when context exists', () => {
    const policy = orchestrator.buildMemoryPolicy({
      tier: 'retrieval',
      memoryContext: '有记忆内容',
    })
    assert.equal(policy.enabled, true)
    assert.equal(policy.reason, 'enabled')
  })

  it('respects explicit disable switch', () => {
    const policy = orchestrator.buildMemoryPolicy({
      tier: 'retrieval',
      memoryContext: '有记忆内容',
      disableMemory: true,
    })
    assert.equal(policy.enabled, false)
    assert.equal(policy.reason, 'disabled_by_setting')
  })

  it('builds dynamic context with section report', () => {
    const pack = orchestrator.buildDynamicContext({
      policy: { inputBudget: 8000, tier: 'retrieval' },
      roleGuidance: '保持准确并优先完成任务',
      timeAnchor: '当前本地时间：2026-07-30 16:00',
      groundingText: '用户需要排查上下文共享行为',
      sessionSummary: '最近两轮讨论了 Session 与工作区边界',
      retrievalContext: '检索命中：context 编排与压缩策略',
      memoryContext: '近期记忆：用户偏好简洁说明',
      personalizationContext: '【轻量个性化上下文】\n- [用户已确认] 先给结论',
    })
    assert.match(pack.dynamicContext, /工作方式/)
    assert.ok(Array.isArray(pack.sectionUsage))
    assert.ok(Array.isArray(pack.sectionOmitted))
    assert.equal(pack.memoryPolicy.enabled, true)
    assert.equal(pack.personalizationIncluded, true)
    assert.match(pack.dynamicContext, /先给结论/)
  })

  it('omits memory section when policy disables it', () => {
    const pack = orchestrator.buildDynamicContext({
      policy: { inputBudget: 8000, tier: 'chat' },
      roleGuidance: '保持准确并优先完成任务',
      timeAnchor: '当前本地时间：2026-07-30 16:00',
      groundingText: '用户问候',
      sessionSummary: '',
      retrievalContext: '',
      memoryContext: '这段内容不应注入',
      memoryPolicy: { enabled: false, reason: 'chat_tier', source: 'product-memory' },
    })
    assert.doesNotMatch(pack.dynamicContext, /这段内容不应注入/)
    assert.equal(pack.memoryPolicy.enabled, false)
  })

  it('allows a small personalization capsule for chat without work memory', () => {
    const pack = orchestrator.buildDynamicContext({
      policy: { inputBudget: 8000, tier: 'chat' },
      memoryPolicy: { enabled: false, mode: 'light', reason: 'chat_tier' },
      personalizationContext: '【轻量个性化上下文】\n- [用户已确认] 先给结论',
      memoryContext: '不应注入的工作记忆',
    })
    assert.match(pack.dynamicContext, /先给结论/)
    assert.doesNotMatch(pack.dynamicContext, /不应注入/)
    assert.equal(pack.memoryPolicy.mode, 'light')
  })

  it('injects high-priority plan checklist section', () => {
    const pack = orchestrator.buildDynamicContext({
      policy: { inputBudget: 8000, tier: 'assist' },
      planContext: '## 执行计划\n- [doing] 读取源文件\n- [pending] 汇总',
      roleGuidance: '保持准确',
    })
    assert.match(pack.dynamicContext, /执行计划/)
    assert.match(pack.dynamicContext, /读取源文件/)
    const planSection = pack.sectionUsage.find((s) => s.key === 'plan')
    assert.ok(planSection)
    assert.ok(planSection.usedTokens > 0)
  })
})
