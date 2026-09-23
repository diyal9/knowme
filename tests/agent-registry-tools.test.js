'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  AGENT_REGISTRY_DEFINITIONS,
  AGENT_EVALUATION_DEFINITIONS,
  SKILL_GOVERNANCE_DEFINITIONS,
  buildAgentRegistryTools,
} = require('../src/lib/agent-registry-tools')
const { buildHostBuiltinDefinitions } = require('../src/lib/agent-host-builtin-tools')
const { parseSkillGroundingFromContent } = require('../src/lib/skill-runtime')

describe('Agent Registry tools', () => {
  it('keeps draft edits reversible and requires host approval only for publication', () => {
    const contracts = Object.fromEntries(AGENT_REGISTRY_DEFINITIONS.map(item => [item.function.name, item._knowme]))
    assert.equal(contracts.get_agent_draft.sideEffects, false)
    assert.equal(contracts.list_manageable_agents.sideEffects, false)
    assert.equal(contracts.get_agent_definition.sideEffects, false)
    assert.equal(contracts.update_agent_draft.sideEffects, true)
    assert.equal(contracts.update_agent_draft.requiresApproval, false)
    assert.equal(contracts.update_agent_draft.rollbackSupported, true)
    assert.equal(contracts.verify_agent_definition.requiresApproval, false)
    assert.equal(contracts.preview_agent_change.sideEffects, false)
    assert.equal(contracts.commit_agent_change.requiresApproval, true)
    assert.equal(contracts.commit_agent_change.sideEffects, true)
    assert.equal(contracts.commit_agent_change.rollbackSupported, true)
    assert.equal(contracts.check_agent_eval_runtime.sideEffects, false)
    assert.equal(contracts.setup_agent_eval_runtime.requiresApproval, true)
    assert.equal(contracts.setup_agent_eval_runtime.risk, 'external')
    assert.equal(contracts.save_agent_eval_suite.rollbackSupported, true)
    assert.equal(contracts.run_agent_eval.requiresApproval, true)
    assert.equal(contracts.run_agent_eval.risk, 'network')
    assert.equal(contracts.get_agent_eval_report.sideEffects, false)
    assert.equal(contracts.list_manageable_skills.sideEffects, false)
    assert.equal(contracts.get_skill_definition.sideEffects, false)
    assert.equal(contracts.verify_skill_definition.sideEffects, false)
    assert.equal(contracts.publish_skill_definition.requiresApproval, true)
    assert.equal(contracts.publish_skill_definition.sideEffects, true)
    assert.equal(contracts.publish_skill_definition.rollbackSupported, false)
  })

  it('projects the registry contract into preflight only when a task requires it', () => {
    const absent = buildHostBuiltinDefinitions({ requiredTools: [] }).definitions.map(item => item.function.name)
    const present = buildHostBuiltinDefinitions({ requiredTools: ['commit_agent_change'] }).definitions.map(item => item.function.name)
    assert.equal(absent.includes('commit_agent_change'), false)
    for (const name of AGENT_REGISTRY_DEFINITIONS.map(item => item.function.name)) {
      assert.equal(present.includes(name), true)
    }
  })

  it('ships a generic Skill that activates the governed registry surface', () => {
    const skillPath = path.resolve(__dirname, '../src/catalog/skills/agent-registry-operations/SKILL.md')
    const parsed = parseSkillGroundingFromContent(fs.readFileSync(skillPath, 'utf8'))
    assert.equal(parsed.ok, true, JSON.stringify(parsed.issues))
    assert.deepEqual(parsed.contract.requiredTools, AGENT_REGISTRY_DEFINITIONS.map(item => item.function.name))
  })

  it('delegates through the shared registry and does not accept a missing token', async () => {
    const calls = []
    const registry = {
      listManageableAgents: () => ({ ok: true, operatorRole: 'admin', agents: [{ id: 'a', name: 'Agent A' }] }),
      getAgentDefinition: payload => ({ ok: true, agentId: payload.agentId, definition: { id: payload.agentId, name: 'Agent A' } }),
      getAgentDraft: payload => ({ ok: true, draft: { agentId: payload.agentId, status: 'draft' } }),
      saveAgentDraft: payload => ({ ok: true, draft: { agentId: payload.draft.id, definition: payload.draft } }),
      verifyAgentDefinition: payload => ({ ok: true, payload }),
      previewAgentChange: payload => ({ ok: true, changeToken: 'token-1', payload }),
      commitAgentChange: payload => { calls.push(payload); return { ok: true, revision: 2 } },
      listAgentRevisions: () => ({ ok: true, revisions: [{ revision: 1 }] }),
    }
    const evaluation = {
      checkRuntime: async () => ({ ok: true, available: false }),
      setupRuntime: async () => ({ ok: true, available: true, version: 'test' }),
      saveSuite: payload => ({ ok: true, suite: payload.suite }),
      runEvaluation: async () => ({ ok: true, report: { runId: 'eval-1' } }),
      getReport: () => ({ ok: true, report: { runId: 'eval-1' } }),
    }
    const bundle = buildAgentRegistryTools({ registry, evaluation })
    assert.deepEqual(
      bundle.definitions.map(item => item.function.name),
      AGENT_REGISTRY_DEFINITIONS
        .filter(item => !SKILL_GOVERNANCE_DEFINITIONS.includes(item))
        .map(item => item.function.name),
    )
    assert.equal(AGENT_EVALUATION_DEFINITIONS.length, 5)
    const missing = await bundle.handlers.commit_agent_change({})
    assert.equal(missing.ok, false)
    assert.equal(calls.length, 0)
    const manageable = await bundle.handlers.list_manageable_agents({})
    assert.deepEqual(manageable.agents.map(item => item.id), ['a'])
    const current = await bundle.handlers.get_agent_definition({ agent_id: 'a' })
    assert.equal(current.agent.definition.id, 'a')
    const updatedDraft = await bundle.handlers.update_agent_draft({
      agent_id: 'a',
      intent: 'create',
      definition: { name: 'Agent A', description: 'draft' },
    })
    assert.equal(updatedDraft.ok, true)
    assert.equal(updatedDraft.draft.definition.id, 'a')
    const loadedDraft = await bundle.handlers.get_agent_draft({ agent_id: 'a' })
    assert.equal(loadedDraft.draft.status, 'draft')
    const preview = await bundle.handlers.preview_agent_change({ action: 'retire', agent_id: 'a' })
    assert.equal(preview.meta.changeToken, 'token-1')
    const committed = await bundle.handlers.commit_agent_change({ change_token: 'token-1' })
    assert.equal(committed.ok, true)
    assert.deepEqual(calls, [{ changeToken: 'token-1' }])
    const savedSuite = await bundle.handlers.save_agent_eval_suite({ agent_id: 'a', suite: { id: 'regression' } })
    assert.equal(savedSuite.ok, true)
    const evaluated = await bundle.handlers.run_agent_eval({ agent_id: 'a', suite_id: 'regression', observations: [] })
    assert.equal(evaluated.report.runId, 'eval-1')
  })

  it('reads, verifies, and approval-gates publication of user-owned Skills', async () => {
    const published = []
    const skillMarkdown = [
      '---',
      'name: 周报整理',
      'description: 把零散进展整理为结构化周报',
      'slash: weekly',
      '---',
      '',
      '# 周报整理',
      '',
      '提取本周进展、风险和下周计划，并保留事实来源。',
    ].join('\n')
    const hub = {
      listCapabilities: async () => ({
        ok: true,
        items: [
          { id: 'weekly-report', kind: 'skill', name: '周报整理', description: '把零散进展整理为结构化周报', source: 'custom', installed: true, enabled: true },
          { id: 'bundled-skill', kind: 'skill', name: '内置技能', description: '只读能力', source: 'curated', installed: true, enabled: true },
        ],
      }),
      skillRuntime: () => ({
        readSkillPackageFile: skillId => skillId === 'weekly-report'
          ? { ok: true, content: skillMarkdown }
          : { ok: false, code: 'not_found' },
      }),
      importCapability: async payload => {
        published.push(payload)
        return { ok: true, entry: { id: payload.id, kind: 'skill' } }
      },
    }
    const bundle = buildAgentRegistryTools({ hub })
    assert.deepEqual(
      bundle.definitions.map(item => item.function.name),
      SKILL_GOVERNANCE_DEFINITIONS.map(item => item.function.name),
    )

    const listed = await bundle.handlers.list_manageable_skills({ query: '周报' })
    assert.deepEqual(listed.skills.map(item => item.id), ['weekly-report'])
    assert.equal(listed.skills[0].editable, true)

    const loaded = await bundle.handlers.get_skill_definition({ skill_id: 'weekly-report' })
    assert.equal(loaded.ok, true)
    assert.equal(loaded.definition.slash, 'weekly')
    assert.match(loaded.definition.instructions, /本周进展/)
    assert.doesNotMatch(loaded.definition.instructions, /^# 周报整理/)

    const invalid = await bundle.handlers.verify_skill_definition({ definition: { id: '../bad' } })
    assert.equal(invalid.ok, false)
    assert.equal(invalid.evaluationStatus, 'not_run')
    assert.ok(invalid.issues.some(issue => issue.field === 'id'))

    const definition = {
      id: 'weekly-report',
      name: '周报整理',
      description: '在每周复盘时把零散进展整理为结构化周报',
      slash: '/weekly',
      instructions: '先核对事实来源，再按进展、风险、下周计划三个部分输出；缺少信息时明确列出待补充项，不得自行编造。',
      evaluation_cases: [{ type: 'normal' }, { type: 'boundary' }, { type: 'failure' }, { type: 'revision' }],
    }
    const verified = await bundle.handlers.verify_skill_definition({ definition })
    assert.equal(verified.ok, true)
    assert.equal(verified.evaluationStatus, 'not_run')

    const result = await bundle.handlers.publish_skill_definition({ definition })
    assert.equal(result.ok, true)
    assert.equal(result.requiresApproval, true)
    assert.equal(published.length, 1)
    assert.deepEqual(published[0], {
      source: 'custom',
      kind: 'skill',
      id: 'weekly-report',
      name: '周报整理',
      description: '在每周复盘时把零散进展整理为结构化周报',
      slash: 'weekly',
      instructions: definition.instructions,
      trustConfirmed: true,
      riskConfirmed: true,
    })

    const protectedResult = await bundle.handlers.publish_skill_definition({
      definition: { ...definition, id: 'bundled-skill', name: '内置技能副本' },
    })
    assert.equal(protectedResult.ok, false)
    assert.equal(protectedResult.code, 'read_only_skill')
    assert.equal(published.length, 1)
  })
})
