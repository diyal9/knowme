const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  publicStatus,
  mergeAuthFromHealth,
  isAuthFailure,
  login,
  resolveToken,
} = require('../src/lib/workbench-auth')

describe('workbench-auth', () => {
  it('reports required when auth enabled but token missing', () => {
    const status = publicStatus({}, { auth_enabled: true })
    assert.equal(status.state, 'required')
    assert.equal(status.configured, false)
  })

  it('reports ready when token configured and auth enabled', () => {
    const status = publicStatus({ workbenchToken: 'wb_test' }, { auth_enabled: true })
    assert.equal(status.state, 'ready')
    assert.equal(status.configured, true)
  })

  it('does not expose token in public status', () => {
    const status = publicStatus({ workbenchToken: 'wb_secret' }, { auth_enabled: true })
    assert.equal(JSON.stringify(status).includes('wb_secret'), false)
  })

  it('classifies auth-related 403 messages', () => {
    assert.equal(isAuthFailure(403, '需要授权码登录'), true)
    assert.equal(isAuthFailure(403, 'not your task'), false)
    assert.equal(isAuthFailure(401, ''), true)
  })

  it('login stores bearer token as the submitted key on success', async () => {
    const fetch = async (url, options = {}) => {
      assert.match(url, /\/api\/auth\/login$/)
      assert.equal(JSON.parse(options.body).key, 'wb_demo')
      return new Response(JSON.stringify({ tier: 'full', user: 'admin' }), { status: 200 })
    }
    const res = await login({ endpoint: 'http://127.0.0.1:8010', key: 'wb_demo' }, { fetch })
    assert.equal(res.ok, true)
    assert.equal(res.token, 'wb_demo')
    assert.equal(res.user, 'admin')
  })

  it('accepts remote HTTPS and rejects remote HTTP during login', async () => {
    const fetch = async url => {
      assert.match(url, /^https:\/\/daemon\.example\.com\/api\/auth\/login$/)
      return new Response(JSON.stringify({ user: 'remote-user' }), { status: 200 })
    }
    const remote = await login({ endpoint: 'https://daemon.example.com', key: 'wb_remote' }, { fetch })
    assert.equal(remote.ok, true)
    const insecure = await login({ endpoint: 'http://daemon.example.com', key: 'wb_remote' }, { fetch })
    assert.equal(insecure.ok, false)
    assert.equal(insecure.code, 'invalid_endpoint')
  })

  it('resolveToken prefers settings over env in module order', () => {
    const prev = process.env.KNOWME_WORKBENCH_TOKEN
    process.env.KNOWME_WORKBENCH_TOKEN = 'env-token'
    assert.equal(resolveToken({ workbenchToken: 'settings-token' }), 'settings-token')
    assert.equal(resolveToken({}), 'env-token')
    if (prev == null) delete process.env.KNOWME_WORKBENCH_TOKEN
    else process.env.KNOWME_WORKBENCH_TOKEN = prev
  })

  it('mergeAuthFromHealth keeps configured state', () => {
    const merged = mergeAuthFromHealth(
      { configured: true, state: 'ready' },
      { auth_enabled: true },
    )
    assert.equal(merged.authEnabled, true)
    assert.equal(merged.state, 'ready')
  })
})
