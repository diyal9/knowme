'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { assembleCapabilityContext } = require('../src/lib/agent-context-assembly')

describe('assembleCapabilityContext groundingContract', () => {
  it('merges groundingContract from activated slash skills', () => {
    let groundingOptions = null
    const skillRuntime = {
      autoMatchSkills: () => [],
      findSkillRecord: (ref) => (ref === 'meeting-summary' ? { id: 'meeting-summary', source: 'standard' } : null),
      listSlashPickerItems: () => [],
      loadSkillL1: () => ({ ok: true, id: 'meeting-summary', name: '会议总结', body: '# Skill' }),
      loadSkillGroundingContract: (_id, options) => {
        groundingOptions = options
        return {
          ok: true,
          contract: {
            skillId: 'meeting-summary',
            requiredTools: ['feishu.meeting_read'],
            requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.meeting_read', minChars: 200 }],
            completionConditions: [{ type: 'tool_success', tool: 'feishu.meeting_read' }],
          },
        }
      },
    }
    const result = assembleCapabilityContext({
      session: { id: 's1' },
      prompt: '总结会议',
      slashRefs: ['meeting-summary'],
      tier: 'retrieval',
      expertRuntime: null,
      skillRuntime,
      taskId: 'meetingSummary',
    })
    assert.ok(result.groundingContract)
    assert.deepEqual(result.groundingContract.requiredTools, ['feishu.meeting_read'])
    assert.equal(result.groundingContract.requiredEvidence[0].minChars, 200)
    assert.equal(result.groundingContract.skillId, 'meeting-summary')
    assert.equal(groundingOptions.taskId, 'meetingSummary')
  })

  it('returns null groundingContract when no slash skills or no rules', () => {
    const skillRuntime = {
      autoMatchSkills: () => [],
      findSkillRecord: () => null,
      listSlashPickerItems: () => [],
      loadSkillL1: () => ({ ok: false }),
    }
    const empty = assembleCapabilityContext({
      session: {},
      prompt: 'hello',
      slashRefs: [],
      tier: 'retrieval',
      skillRuntime,
    })
    assert.equal(empty.groundingContract, null)

    const noRules = assembleCapabilityContext({
      session: {},
      prompt: 'hello',
      slashRefs: ['plain'],
      tier: 'retrieval',
      skillRuntime: {
        ...skillRuntime,
        findSkillRecord: () => ({ id: 'plain', source: 'standard' }),
        loadSkillL1: () => ({ ok: true, id: 'plain', body: 'x' }),
        loadSkillGroundingContract: () => ({ ok: true, contract: { requiredTools: [], requiredEvidence: [], completionConditions: [] } }),
      },
    })
    assert.equal(noRules.groundingContract, null)
  })

  it('keeps persona, task facts, automatic skills and explicit skills as independent blocks', () => {
    const result = assembleCapabilityContext({
      session: { id: 's-expert', expertId: 'office', goal: '整理会议纪要' },
      prompt: '整理会议纪要',
      slashRefs: ['meeting-summary'],
      tier: 'retrieval',
      expertRuntime: {
        getSessionPersona: () => ({
          ok: true,
          persona: {
            name: '办公协作专家', soul: '严谨', sop: '先读取证据，再整理行动项', agenticType: 'planning',
          },
          bindings: { skills: ['meeting-summary'], connectors: ['feishu'] },
          readiness: { state: 'ready', items: [] },
          capabilityManifest: { provenance: { source: 'bundled' } },
        }),
      },
      skillRuntime: {
        autoMatchSkills: () => [{ id: 'meeting-summary', name: '会议总结', description: '提取行动项' }],
        findSkillRecord: () => ({ id: 'meeting-summary', name: '会议总结', source: 'standard' }),
        listSlashPickerItems: () => [],
        loadSkillL1: () => ({ ok: true, id: 'meeting-summary', name: '会议总结', body: '读取会议并输出行动项' }),
      },
    })
    const ids = result.contextBlocks.map(block => block.id)
    assert.ok(ids.includes('persona.soul'))
    assert.ok(ids.includes('persona.sop'))
    assert.ok(ids.includes('task.expert-session'))
    assert.ok(ids.includes('skill.auto-summary'))
    assert.ok(ids.includes('skill.explicit-content'))
    assert.equal(result.contextBlocks.find(block => block.id === 'skill.explicit-content').kind, 'skill')
    assert.equal(result.contextBlocks.find(block => block.id === 'persona.sop').sourceTrust, 'bundled')
  })
})
