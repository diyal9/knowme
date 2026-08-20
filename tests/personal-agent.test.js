const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const profileStoreModule = require('../src/lib/agent-profile-store')
const productMemory = require('../src/lib/product-memory')
const {
  MY_KNOWME_PROFILE_ID,
  createPersonalAgentService,
} = require('../src/lib/personal-agent')

function createFixture(settings = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-personal-'))
  const profileStore = profileStoreModule.createStore({ file: path.join(root, 'agent-profiles.json') })
  const service = createPersonalAgentService({
    profileStore,
    productMemory,
    memoryDir: path.join(root, 'memory'),
    auditFile: path.join(root, 'growth.json'),
    loadSettings: () => settings,
  })
  return { root, profileStore, service }
}

describe('personal-agent', () => {
  it('creates one v3 partner profile without treating user identity as its soul', () => {
    const { profileStore, service } = createFixture({
      userProfile: '产品经理',
      userPrompt: '先给结论',
      industry: 'software',
    })
    const first = service.get()
    const second = service.get()
    assert.equal(first.ok, true)
    assert.equal(first.profile.id, MY_KNOWME_PROFILE_ID)
    assert.equal(first.profile.profileVersion, 3)
    assert.equal(first.profile.profileKind, 'personal')
    assert.match(first.profile.roleOverlay, /长期使用的专业工作伙伴/)
    assert.doesNotMatch(first.profile.roleOverlay, /产品经理/)
    assert.equal(first.profile.promptOverlay, '先给结论')
    assert.match(first.profile.taskPreferences.domainCapabilities, /任务拆解/)
    assert.equal(first.profile.taskPreferences.selfDriveLevel, 'balanced')
    assert.match(first.profile.taskPreferences.selfDriveRules, /发布/)
    assert.equal(second.profile.profileHash, first.profile.profileHash)
    assert.equal(profileStore.list('personal').profiles.length, 1)
  })

  it('uses a stable partner soul and collaboration configuration by default', () => {
    const { service } = createFixture({ industry: 'software' })
    const result = service.get()
    assert.equal(result.ok, true)
    assert.match(result.profile.roleOverlay, /诚实、可靠和克制/)
    assert.match(result.profile.promptOverlay, /先给结论/)
    assert.match(result.profile.taskPreferences.domainCapabilities, /会议总结/)
    assert.equal(result.profile.taskPreferences.selfDriveLevel, 'balanced')
  })

  it('preserves explicit soul, capability, collaboration and self-drive customization', () => {
    const { service } = createFixture({ industry: 'software' })
    const configured = service.save({
      roleOverlay: '我是可靠的产品参谋',
      promptOverlay: '先列影响，再给建议',
      taskPreferences: {
        domainCapabilities: '产品分析\n项目推进',
        selfDriveLevel: 'proactive',
        selfDriveRules: '可以主动整理资料；发布前确认',
      },
    })
    assert.equal(configured.ok, true)
    assert.equal(configured.profile.roleOverlay, '我是可靠的产品参谋')
    assert.equal(configured.profile.promptOverlay, '先列影响，再给建议')
    assert.equal(configured.profile.taskPreferences.domainCapabilities, '产品分析\n项目推进')
    assert.equal(configured.profile.taskPreferences.selfDriveLevel, 'proactive')
    assert.match(configured.profile.taskPreferences.selfDriveRules, /发布前确认/)
  })

  it('applies explicit memory immediately and can undo it', () => {
    const { service } = createFixture()
    const taught = service.teach({ text: '记住我喜欢先看结论', kind: 'remember' })
    assert.equal(taught.ok, true)
    assert.equal(taught.applied, true)
    assert.ok(taught.undoEventId)
    const growth = service.growthList()
    assert.equal(growth.events[0].type, 'memory_applied')
    const undone = service.teach({ undoEventId: taught.undoEventId })
    assert.equal(undone.ok, true)
    assert.equal(service.growthList().events[0].type, 'memory_reverted')
  })

  it('requires confirmation for skills, knowledge and permissions', () => {
    const { service } = createFixture()
    const proposed = service.teach({
      text: '给你发布权限并装备调研技能',
      patch: { skillRefs: [{ id: 'research' }], permissions: { publish: true } },
    })
    assert.equal(proposed.ok, true)
    assert.equal(proposed.requiresConfirmation, true)
    assert.equal(service.get().profile.skillRefs.length, 0)
    const applied = service.applyProposal({ proposalId: proposed.proposal.id, confirmedRisk: true })
    assert.equal(applied.ok, true)
    assert.equal(applied.profile.skillRefs[0].id, 'research')
  })

  it('updates identity and contexts without creating another identity', () => {
    const { service } = createFixture()
    const saved = service.save({
      identity: { displayName: '小知', avatar: 'office/writer' },
      contexts: [{ id: 'product', name: '产品工作', role: '产品经理' }],
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.profile.id, MY_KNOWME_PROFILE_ID)
    assert.equal(saved.profile.identity.displayName, '小知')
    assert.equal(saved.profile.contexts[0].id, 'product')
  })
})
