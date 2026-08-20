const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { resolvePersonalAgentSettings } = require('../src/lib/personal-agent-runtime-profile')

describe('personal-agent runtime profile', () => {
  it('keeps user settings separate while overlaying the selected partner soul', () => {
    const settings = {
      apiKey: 'secret',
      model: 'gpt-test',
      industry: 'software',
      occupationId: 'client-engineer',
      userProfile: '用户本人档案',
      userPrompt: '历史偏好',
    }
    const resolved = resolvePersonalAgentSettings(
      settings,
      { profileId: 'my-knowme' },
      () => ({
        get: () => ({
          ok: true,
          profile: {
            identity: { displayName: '九仔' },
            roleOverlay: '可靠的长期伙伴',
            promptOverlay: '先列影响',
            taskPreferences: {
              domainCapabilities: '会议总结与产品分析',
              selfDriveLevel: 'proactive',
              selfDriveRules: '发布前确认',
            },
          },
        }),
      })
    )
    assert.equal(resolved.apiKey, 'secret')
    assert.equal(resolved.model, 'gpt-test')
    assert.equal(resolved.industry, 'software')
    assert.equal(resolved.occupationId, 'client-engineer')
    assert.equal(resolved.userProfile, '用户本人档案')
    assert.equal(resolved.userPrompt, '历史偏好')
    assert.equal(resolved.agentSoul, '可靠的长期伙伴')
    assert.equal(resolved.agentDisplayName, '九仔')
    assert.equal(resolved.agentCollaboration, '先列影响')
    assert.equal(resolved.agentDomainCapabilities, '会议总结与产品分析')
    assert.equal(resolved.agentSelfDriveLevel, 'proactive')
    assert.equal(resolved.agentSelfDriveRules, '发布前确认')
  })

  it('falls back to settings when a session profile is unavailable', () => {
    const settings = { industry: 'general', userPrompt: 'legacy prompt' }
    assert.equal(resolvePersonalAgentSettings(settings, {}, null), settings)
    assert.equal(
      resolvePersonalAgentSettings(settings, { profileId: 'missing' }, () => ({ get: () => ({ ok: false }) })),
      settings
    )
  })

  it('uses the singleton profile for legacy personal sessions without profileId', () => {
    const resolved = resolvePersonalAgentSettings(
      { userPrompt: 'legacy prompt' },
      { agentId: 'personal', sessionKind: 'personal-topic' },
      () => ({ get: (id) => ({ ok: id === 'my-knowme', profile: { identity: { displayName: '九仔' }, roleOverlay: '按我的规则陪伴', taskPreferences: {} } }) })
    )
    assert.equal(resolved.agentSoul, '按我的规则陪伴')
    assert.equal(resolved.agentDisplayName, '九仔')
  })
})
