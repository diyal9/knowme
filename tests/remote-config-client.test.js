const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeEndpoint,
  createRemoteConfigClient,
} = require('../src/lib/remote-config-client')

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('remote config client', () => {
  it('is disabled by default', async () => {
    const client = createRemoteConfigClient()
    assert.equal(client.enabled, false)
    const result = await client.fetchPublic()
    assert.equal(result.ok, false)
    assert.equal(result.code, 'disabled')
  })

  it('allows only loopback HTTP endpoints', () => {
    assert.equal(normalizeEndpoint(), 'http://127.0.0.1:8020')
    assert.equal(normalizeEndpoint('http://localhost:8020/'), 'http://localhost:8020')
    assert.throws(() => normalizeEndpoint('https://127.0.0.1:8020'), /仅允许连接本机/)
    assert.throws(() => normalizeEndpoint('http://192.168.0.2:8020'), /仅允许连接本机/)
  })

  it('loads public config when enabled', async () => {
    const fetch = async url => {
      assert.match(url, /\/v1\/config\/public$/)
      return jsonResponse(
        { ok: true, config: { banner: 'hello' }, updated_at: '2026-07-30T00:00:00Z' },
        200,
        { 'X-Request-Id': 'req-1' },
      )
    }
    const result = await createRemoteConfigClient({ enabled: true, fetch }).fetchPublic()
    assert.equal(result.ok, true)
    assert.equal(result.config.banner, 'hello')
    assert.equal(result.requestId, 'req-1')
  })
})
