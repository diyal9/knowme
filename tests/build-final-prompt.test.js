'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { registerBuildFinalPromptIpc } = require('../src/ipc/build-final-prompt')

describe('build-final-prompt preview', () => {
  it('uses the same authority projection as the runtime and returns a manifest', () => {
    let handler = null
    registerBuildFinalPromptIpc({
      handle: (channel, fn) => {
        assert.equal(channel, 'build-final-prompt')
        handler = fn
      },
    }, {
      loadSettings: () => ({
        locale: 'en-US', userProfile: 'Product manager', userPrompt: 'PRIVATE_PREFERENCE',
      }),
      readNote: () => null,
      KNOWLEDGE_DIR: 'Z:/knowme-test-missing-knowledge',
    })
    const result = handler(null, { role: 'general', prompt: '请整理一份项目状态更新。' })
    assert.equal(result.ok, true)
    assert.equal(result.contextManifest.locale, 'en-US')
    assert.equal(result.contextManifest.executionPolicy, 'no-tools')
    const outputStyle = result.contextManifest.included.find(item => item.id === 'scene.conversation-output-style')
    assert.ok(outputStyle, 'preview includes the ordinary conversation formatting rule')
    assert.match(result.systemContent, /Short answers usually need no headings/)
    const preference = result.contextManifest.included.find(item => item.id === 'preference.user-preview')
    assert.equal(preference.projectedRole, 'user')
    assert.doesNotMatch(result.systemContent, /PRIVATE_PREFERENCE/)
    assert.match(String(result.messages.at(-1).content), /PRIVATE_PREFERENCE/)
    assert.equal(result.contextManifest.included.some(item => item.kind === 'tool_contract'), false)
  })

  it('keeps a fresh partner greeting free of work profile and industry-pack context', () => {
    let handler = null
    registerBuildFinalPromptIpc({
      handle: (_channel, fn) => { handler = fn },
    }, {
      loadSettings: () => ({
        locale: 'zh-CN',
        industry: 'game',
        occupationId: 'game-designer',
        userProfile: '游戏制作人',
        userPrompt: 'PRIVATE_WORK_RULE',
        agentSoul: '保持自然、友好的表达。',
        agentDomainCapabilities: '游戏版本推进、数值验收',
        agentCollaboration: '每轮给出版本排期。',
        agentSelfDriveRules: '主动跟进里程碑。',
      }),
      readNote: () => null,
      KNOWLEDGE_DIR: 'Z:/knowme-test-missing-knowledge',
    })

    const result = handler(null, { role: 'general', prompt: 'hi' })
    const projected = [result.systemContent, ...result.messages.map(item => item.content)].join('\n')
    assert.equal(result.ok, true)
    assert.equal(result.contextManifest.scene, 'assistant')
    assert.equal(result.contextManifest.included.filter(item => item.id === 'scene.conversation-output-style').length, 1)
    assert.match(projected, /自然、友好/)
    assert.doesNotMatch(projected, /游戏制作人|游戏版本推进|数值验收|版本排期|里程碑|PRIVATE_WORK_RULE/)
  })
})
