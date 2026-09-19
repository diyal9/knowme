'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { finalizeAgentContext } = require('../src/lib/agent-context-finalize')

function preparedDraft() {
  return {
    modelProfile: { model: 'test-model', contextWindow: 32000, supportsTools: true },
    contextDraft: {
      version: 2,
      tier: 'retrieval',
      executionPolicy: 'tools-allowed',
      staticCapabilityIds: ['suggestion'],
      policyInput: {
        tier: 'retrieval', scene: 'expert-collaboration', phase: 'execution',
        locale: 'zh-CN', identity: '办公协作专家', conversationMode: 'expert-execution',
      },
      blocks: [
        {
          id: 'scene.expert', kind: 'scene_instruction', sourceTrust: 'bundled',
          content: '当前由办公协作专家负责。', meta: { claims: { identity: '办公协作专家' } },
        },
        { id: 'persona.sop', kind: 'persona', sourceTrust: 'bundled', content: '先读取证据，再整理行动项。' },
        { id: 'skill.explicit-content', kind: 'skill', explicit: true, sourceTrust: 'user', content: '输出会议行动项。' },
      ],
      query: '整理会议',
      optionalTopK: 8,
      contextBudget: 6000,
      inputBudget: 8000,
      semanticSelection: {},
      history: [],
      prompt: '请整理会议并查找公开资料',
      noteContext: '',
      imageAttachments: [],
      infoBase: { tier: 'retrieval' },
    },
  }
}

describe('agent context finalization', () => {
  it('assembles once after the actual tool surface is known', () => {
    const result = finalizeAgentContext({
      prepared: preparedDraft(),
      toolRecords: [{ name: 'search_web' }],
      researchRoute: { active: true, context: '先检索再核对来源。', intent: { mode: 'web-research' } },
    })
    const included = result.contextAssembly.manifest.included
    assert.ok(result.capabilityIds.includes('web'))
    assert.equal(result.capabilityIds.includes('feishu'), false)
    assert.ok(included.some(item => item.id === 'tool.web'))
    assert.equal(included.some(item => item.id === 'tool.feishu'), false)
    assert.equal(included.filter(item => item.id === 'scene.research-runtime').length, 1)
    assert.equal(included.find(item => item.id === 'persona.sop').projectedRole, 'user')
    assert.equal(included.find(item => item.id === 'skill.explicit-content').projectedRole, 'user')
    assert.equal(result.contextInfo.contextManifest, result.contextAssembly.manifest)
    assert.equal(result.apiMessages.some(message => /先检索再核对来源/.test(String(message.content))), true)
  })

  it('injects only a compact capability index into the model context', () => {
    const result = finalizeAgentContext({
      prepared: preparedDraft(),
      toolRecords: [{
        type: 'function',
        function: { name: 'search_web', description: '搜索公开网页' },
        _knowme: { source: 'builtin', capability: 'web-search', risk: 'read', sideEffects: false },
      }],
    })
    const runtime = result.contextInfo.toolRuntime
    assert.equal(runtime.enabled, true)
    assert.equal(runtime.mode, 'progressive')
    assert.equal(runtime.toolCount, 1)
    assert.equal(runtime.tools[0].name, 'search_web')
    assert.equal(runtime.promptProjection, 'capability-index')
    const runtimeBlock = result.contextAssembly.manifest.included.find(item => item.id === 'tool.runtime-index')
    assert.ok(runtimeBlock)
    assert.ok(result.apiMessages.some(message => /能力族索引/.test(String(message.content))))
    assert.doesNotMatch(String(runtimeBlock.content), /search_web/)
  })

  it('fails closed to no tool contracts when the final surface is empty', () => {
    const result = finalizeAgentContext({ prepared: preparedDraft(), toolRecords: [] })
    const includedIds = result.contextAssembly.manifest.included.map(item => item.id)
    assert.equal(includedIds.includes('tool.web'), false)
    assert.equal(includedIds.includes('tool.feishu'), false)
    assert.deepEqual(result.capabilityIds, ['suggestion'])
  })
})
