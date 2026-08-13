'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeAgenticType,
  isValidAgenticType,
  resolveSoulSop,
  assembleExpertLayeredBlocks,
  buildAgenticScaffoldBlock,
  AGENTIC_TYPES,
} = require('../src/lib/expert-agentic-profile')
const { assembleCapabilityContext } = require('../src/lib/agent-context-assembly')

describe('expert-agentic-profile', () => {
  it('normalizes five agentic types and rejects invalid', () => {
    assert.equal(normalizeAgenticType('planning'), 'planning')
    assert.equal(normalizeAgenticType('tool-use'), 'tool_use')
    assert.equal(normalizeAgenticType('weird', 'react'), 'react')
    assert.equal(isValidAgenticType('multi_agent'), true)
    assert.equal(isValidAgenticType('nope'), false)
    assert.equal(AGENTIC_TYPES.length, 5)
  })

  it('maps legacy systemPrompt to SOP with default react', () => {
    const resolved = resolveSoulSop({ systemPrompt: '你是写作教练。' })
    assert.equal(resolved.sop, '你是写作教练。')
    assert.equal(resolved.agenticType, 'react')
    assert.equal(resolved.legacyMapped, true)
  })

  it('assembles layered blocks with KnowMe L0 and agentic scaffold', () => {
    const layered = assembleExpertLayeredBlocks({
      persona: {
        name: '办公伙伴',
        soul: '冷静、简洁',
        sop: '先对齐目标再拆解',
        agenticType: 'planning',
        description: '办公协作',
      },
      session: { goal: '写周报', knowledgeRefs: ['kb1'] },
    })
    assert.match(layered.layers.knowmeStructure, /KnowMe 对话结构/)
    assert.match(layered.layers.agenticScaffold, /规划/)
    assert.match(layered.layers.soul, /冷静/)
    assert.match(layered.layers.sop, /对齐目标/)
    assert.match(layered.dynamicExpertContext, /不得关闭本层/)
    assert.match(layered.dynamicExpertContext, /路线图/)
  })

  it('planning and reflection scaffolds differ', () => {
    const plan = buildAgenticScaffoldBlock('planning', { planFirst: true })
    const reflect = buildAgenticScaffoldBlock('reflection', { maxReflectionRounds: 3 })
    assert.match(plan, /路线图/)
    assert.match(reflect, /自检 3 轮/)
    assert.notEqual(plan, reflect)
  })

  it('multi_agent scaffold states delegation boundary without fake team runtime', () => {
    const text = buildAgenticScaffoldBlock('multi_agent', { delegationHints: '涉及设计时转交 UI 专家' })
    assert.match(text, /工作流/)
    assert.match(text, /委派/)
    assert.doesNotMatch(text, /已拉起完整团队/)
  })
})

describe('agent-context-assembly layered expert injection', () => {
  it('injects layered expert context for different experts', () => {
    const a = assembleCapabilityContext({
      session: { id: 's1', expertId: 'a', goal: '任务A' },
      tier: 'assist',
      prompt: '帮我推进',
      expertRuntime: {
        getSessionPersona: () => ({
          ok: true,
          persona: { name: 'A', soul: '犀利', sop: '先结论', agenticType: 'reflection' },
          bindings: { skills: [], connectors: [] },
        }),
      },
    })
    const b = assembleCapabilityContext({
      session: { id: 's2', expertId: 'b', goal: '任务B' },
      tier: 'assist',
      prompt: '帮我推进',
      expertRuntime: {
        getSessionPersona: () => ({
          ok: true,
          persona: { name: 'B', soul: '温和', sop: '先共情', agenticType: 'planning' },
          bindings: { skills: [], connectors: [] },
        }),
      },
    })
    assert.match(a.dynamicCapabilityContext, /KnowMe 对话结构/)
    assert.match(a.dynamicCapabilityContext, /犀利/)
    assert.match(b.dynamicCapabilityContext, /温和/)
    assert.match(a.layers.agenticScaffold, /反射|自检/)
    assert.match(b.layers.agenticScaffold, /规划|路线图/)
    assert.notEqual(a.soul, b.soul)
  })
})
