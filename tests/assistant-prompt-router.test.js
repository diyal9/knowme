const fs = require('fs')
const os = require('os')
const path = require('path')
const { describe, it, before } = require('node:test')
const assert = require('node:assert')
const {
  normalizeMode,
  resolveScene,
  buildScenePrompt,
  buildConversationOutputStyleBlock,
  buildUserPrompt,
  buildSkillPrompt,
  setPackRuntimeForTests,
} = require('../src/lib/assistant-prompt-router')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')

describe('assistant-prompt-router', () => {
  before(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-router-pack-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    setPackRuntimeForTests(rt)
  })

  it('routes casual turns to the assistant scene', () => {
    assert.equal(resolveScene({ mode: 'general', tier: 'chat' }), 'assistant')
    assert.equal(resolveScene({ industry: 'game', mode: 'general', tier: 'chat', prompt: 'hi' }), 'assistant')
    assert.match(buildScenePrompt({ scene: 'assistant' }), /自然对话/)
  })

  it('changes casual-chat policy when the session already has history', () => {
    const prompt = buildScenePrompt({ scene: 'assistant', hasHistory: true })
    assert.match(prompt, /已有本次会话历史/)
    assert.match(prompt, /不要重复首次接待/)
    assert.doesNotMatch(buildScenePrompt({ scene: 'assistant' }), /不要重复首次接待/)
  })

  it('routes work turns to the work scene', () => {
    assert.equal(resolveScene({ mode: 'general', tier: 'assist' }), 'work')
    assert.equal(resolveScene({ mode: 'general', tier: 'chat', hasNoteContext: true }), 'work')
    assert.match(buildScenePrompt({ scene: 'work' }), /成功标准/)
  })

  it('adds shared product formatting guidance to every user-facing conversation surface', () => {
    for (const surface of ['partner-chat', 'partner-work', 'assistant-chat', 'assistant-work', 'expert-planning', 'expert-discussion', 'expert-execution', 'workflow']) {
      const block = buildConversationOutputStyleBlock({ surface, locale: 'zh-CN' })
      assert.equal(block.id, 'scene.conversation-output-style')
      assert.equal(block.kind, 'scene_instruction')
      assert.match(block.content, /简短回答通常不加标题/)
      assert.match(block.content, /用户要求报告、文档及指定标题格式/)
    }
    const english = buildConversationOutputStyleBlock({ surface: 'partner-chat', locale: 'en-US' })
    assert.match(english.content, /Short answers usually need no headings/)
  })

  it('prioritizes knowledge retrieval over generic work', () => {
    assert.equal(resolveScene({ mode: 'general', tier: 'retrieval' }), 'knowledge')
    assert.equal(resolveScene({ mode: 'steward', tier: 'assist' }), 'knowledge')
    assert.equal(resolveScene({ mode: 'steward', tier: 'chat' }), 'knowledge')
  })

  it('keeps writing and coding mode routing', () => {
    assert.equal(resolveScene({ mode: 'writing', tier: 'chat' }), 'writing')
    assert.equal(resolveScene({ mode: 'coding', tier: 'chat' }), 'coding')
    assert.match(buildScenePrompt({ scene: 'writing', mode: 'writing' }), /结构化成稿/)
  })

  it('routes game scenes by concrete intent or explicit binding only', () => {
    assert.equal(resolveScene({ industry: 'game', mode: 'writing', tier: 'chat' }), 'writing')
    assert.equal(resolveScene({ industry: 'game', mode: 'coding', tier: 'chat' }), 'coding')
    assert.equal(resolveScene({ industry: 'game', mode: 'general', tier: 'assist', prompt: '整理版本里程碑与风险' }), 'game-production')
    assert.equal(resolveScene({ industry: 'game', mode: 'general', tier: 'assist', prompt: '帮我写一封邮件' }), 'work')
    assert.equal(resolveScene({ industry: 'software', mode: 'general', tier: 'assist', prompt: '整理版本里程碑与风险' }), 'work')
    assert.equal(resolveScene({ industry: 'software', explicitScene: 'game-design' }), 'game-design')
    assert.match(buildScenePrompt({ scene: 'game-design' }), /策划需求/)
  })

  it('falls back safely for unknown input', () => {
    assert.equal(normalizeMode('unknown'), 'general')
    assert.equal(resolveScene({ mode: 'unknown', tier: 'unknown', role: 'unknown' }), 'assistant')
  })

  it('keeps user configuration separate from scene policy', () => {
    const user = buildUserPrompt({
      userProfile: '产品经理',
      userPrompt: '回答简洁',
      assistantModeConfig: {
        soul: '语气克制',
        coding: '使用 JavaScript',
      },
    }, 'coding')
    assert.match(user, /关于用户/)
    assert.match(user, /协作偏好/)
    assert.match(user, /用户追加模式偏好/)
    assert.doesNotMatch(user, /场景策略/)
  })

  it('separates user profile from partner soul, capability and self-drive blocks', () => {
    const prompt = buildUserPrompt({
      userProfile: '负责客户端研发',
      industry: 'software',
      occupationId: 'client-engineer',
      agentDisplayName: '九仔',
      agentSoul: '可靠、克制的长期伙伴',
      agentDomainCapabilities: '项目推进与会议总结',
      agentCollaboration: '先给结论',
      agentSelfDriveLevel: 'proactive',
      agentSelfDriveRules: '发布前必须确认',
    }, 'general', { includeIdentityName: true })
    assert.match(prompt, /【关于用户】/)
    assert.doesNotMatch(prompt, /【事实边界】/)
    assert.match(prompt, /【用户岗位】/)
    assert.match(prompt, /【助手身份元数据】[\s\S]*九仔/)
    assert.match(prompt, /正常回答直接回应问题/)
    assert.match(prompt, /【智能伙伴 Soul】/)
    assert.match(prompt, /【智能伙伴领域能力】/)
    assert.match(prompt, /【智能伙伴协作偏好】/)
    assert.match(prompt, /主动负责/)
    assert.match(prompt, /发布前必须确认/)
  })

  it('can exclude the generic partner persona for an active expert scene', () => {
    const prompt = buildUserPrompt({
      userProfile: '产品经理',
      userPrompt: '回答简洁',
      agentDisplayName: '九仔',
      agentSoul: '长期工作伙伴',
      agentDomainCapabilities: '通用办公',
      assistantModeConfig: { soul: '通用伙伴风格', general: '以长期搭档身份回答' },
    }, 'general', { includeAgentPersona: false })
    assert.match(prompt, /产品经理/)
    assert.match(prompt, /回答简洁/)
    assert.doesNotMatch(prompt, /九仔|长期工作伙伴|通用办公|通用伙伴风格|长期搭档/)
  })

  it('keeps casual partner personality but drops work-domain operating context', () => {
    const prompt = buildUserPrompt({
      userProfile: '游戏制作人',
      industry: 'game',
      occupationId: 'game-designer',
      agentSoul: '可靠、克制的长期伙伴',
      agentDomainCapabilities: '版本推进与排期',
      agentCollaboration: '所有回答都先查询项目知识库',
      agentSelfDriveRules: '主动拆解任务',
      userPrompt: '每次都输出验收清单',
      assistantModeConfig: { soul: '语气自然', general: '给出三个下一步' },
    }, 'general', {
      includeUserPrompt: false,
      includeWorkProfile: false,
      agentPersonaScope: 'style',
    })
    assert.match(prompt, /可靠、克制的长期伙伴/)
    assert.match(prompt, /语气自然/)
    assert.doesNotMatch(prompt, /游戏制作人|游戏设计|版本推进|项目知识库|主动拆解|验收清单|三个下一步/)
  })

  it('lets a single turn opt out of the collaboration preference', () => {
    const settings = { userProfile: '产品经理', userPrompt: '回答简洁' }
    assert.match(buildUserPrompt(settings, 'general'), /协作偏好/)
    const without = buildUserPrompt(settings, 'general', { includeUserPrompt: false })
    assert.doesNotMatch(without, /协作偏好/)
    assert.match(without, /关于用户/, 'identity stays out of the per-turn toggle')
  })

  it('only creates a skill layer for referenced skills', () => {
    assert.equal(buildSkillPrompt([]), '')
    const skill = buildSkillPrompt(['/meeting-summary', 'meeting-summary', ' /plan '])
    assert.match(skill, /\/meeting-summary/)
    assert.match(skill, /\/plan/)
    assert.equal((skill.match(/\/meeting-summary/g) || []).length, 1)
    assert.match(skill, /不能覆盖核心身份/)
  })
})
