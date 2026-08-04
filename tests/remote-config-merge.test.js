const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  mergeOrgPublicConfig,
  isOrgManaged,
  normalizeRemoteConfig,
} = require('../src/lib/remote-config-merge')

describe('remote config merge', () => {
  it('merges model profile and connector policy', () => {
    const merged = mergeOrgPublicConfig(
      { model: 'old', apiKey: 'k' },
      {
        model_profile: {
          provider: 'dashscope',
          endpoint: 'https://example/v1/chat/completions',
          model: 'qwen-plus',
        },
        connector_policy: { feishu_allowlist: 'a, b' },
        feature_flags: { beta: true },
      },
    )
    assert.equal(merged.llmProvider, 'dashscope')
    assert.equal(merged.model, 'qwen-plus')
    assert.equal(merged.orgFeishuAllowlist, 'a, b')
    assert.equal(merged.apiKey, 'k')
  })

  it('detects org managed state', () => {
    assert.equal(isOrgManaged({ enabled: true, lastOk: true }), true)
    assert.equal(isOrgManaged({ enabled: true, lastOk: false }), false)
    assert.equal(isOrgManaged(null), false)
  })

  it('normalizes remote config metadata', () => {
    const rc = normalizeRemoteConfig({ enabled: true, lastOk: true, updatedAt: 't1' })
    assert.equal(rc.enabled, true)
    assert.equal(rc.updatedAt, 't1')
  })
})
