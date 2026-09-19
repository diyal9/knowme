'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const providerSecret = require('../src/lib/provider-secret')

describe('provider-secret', () => {
  it('wraps DPAPI ciphertext without exposing plaintext', () => {
    const spawnSync = (_command, _args, options) => {
      assert.equal(options.input, 'private-key')
      return { status: 0, stdout: 'ciphertext\n' }
    }
    const encrypted = providerSecret.encryptWithDpapi('private-key', { platform: 'win32', spawnSync })
    assert.equal(encrypted, 'dpapi:ciphertext')
    assert.equal(encrypted.includes('private-key'), false)
  })

  it('decrypts only explicitly prefixed DPAPI values', () => {
    let calls = 0
    const spawnSync = (_command, _args, options) => {
      calls += 1
      assert.equal(options.input, 'ciphertext')
      return { status: 0, stdout: 'private-key' }
    }
    assert.equal(providerSecret.decryptWithDpapi('not-dpapi', { platform: 'win32', spawnSync }), '')
    assert.equal(providerSecret.decryptWithDpapi('dpapi:ciphertext', { platform: 'win32', spawnSync }), 'private-key')
    assert.equal(calls, 1)
  })

  it('does not attempt DPAPI outside Windows', () => {
    assert.equal(providerSecret.encryptWithDpapi('private-key', { platform: 'linux' }), null)
    assert.equal(providerSecret.decryptWithDpapi('dpapi:ciphertext', { platform: 'linux' }), '')
  })
})
