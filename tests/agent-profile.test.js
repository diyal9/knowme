const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const profile = require('../src/lib/agent-profile')
const storeModule = require('../src/lib/agent-profile-store')

function sample(overrides = {}) {
  return {
    id: 'developer-profile',
    agentId: 'developer',
    name: '研发 Agent',
    promptOverlay: '先读取知识，再给出可验证结论',
    skillRefs: [{ id: 'code-review', version: '1.0.0', contentHash: 'sha256:review' }],
    knowledgeRefs: [{ id: 'kb-team', version: 'latest' }],
    knowledgePolicy: { mode: 'selected', includeWorkMemory: true },
    connectorRefs: [{ id: 'gitlab', version: '2.0.0' }],
    permissions: { files: 'workspace' },
    outputContract: { format: 'markdown' },
    ...overrides,
  }
}

describe('agent-profile', () => {
  it('normalizes profile refs and creates a snapshot', () => {
    const result = profile.validateAgentProfile(sample(), {
      enabledSkillIds: ['code-review'],
      availableConnectorIds: ['gitlab'],
      availableKnowledgeIds: ['kb-team'],
      confirmedRisk: true,
    })
    assert.equal(result.ok, true)
    const snapshot = profile.createProfileSnapshot(result.profile)
    assert.equal(snapshot.ok, true)
    assert.equal(snapshot.snapshot.skillRefs[0].contentHash, 'sha256:review')
    assert.equal(snapshot.snapshot.promptOverlay, '先读取知识，再给出可验证结论')
    assert.equal(snapshot.snapshot.knowledgeRefs[0].id, 'kb-team')
    assert.equal(snapshot.snapshot.knowledgePolicy.includeWorkMemory, true)
  })

  it('changes the profile hash when prompt or knowledge policy changes', () => {
    const base = profile.normalizeAgentProfile(sample()).profile
    const promptChanged = profile.normalizeAgentProfile(sample({ promptOverlay: '使用另一套交付标准' })).profile
    const knowledgeChanged = profile.normalizeAgentProfile(sample({
      knowledgePolicy: { mode: 'selected', includeWorkMemory: false },
    })).profile
    assert.notEqual(base.profileHash, promptChanged.profileHash)
    assert.notEqual(base.profileHash, knowledgeChanged.profileHash)
  })

  it('fails closed for unavailable skill and risk without confirmation', () => {
    const result = profile.validateAgentProfile(sample({
      risk: { level: 'high', reasons: ['write'] },
    }), { enabledSkillIds: [], availableConnectorIds: ['gitlab'] })
    assert.equal(result.ok, false)
    assert.deepEqual(result.issues.map(item => item.code), ['skill_unavailable', 'risk_confirmation_required'])
  })
})

describe('agent-profile-store', () => {
  it('persists and filters profiles by Agent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-profiles-'))
    const store = storeModule.createStore({ userData: dir })
    assert.equal(store.save(sample(), {
      enabledSkillIds: ['code-review'],
      availableConnectorIds: ['gitlab'],
      confirmedRisk: true,
    }).ok, true)
    assert.equal(store.list('developer').profiles.length, 1)
    assert.equal(store.get('developer-profile').profile.agentId, 'developer')
    assert.equal(store.remove('developer-profile').ok, true)
  })
})
