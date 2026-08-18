'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createLruCache } = require('../src/lib/workspace-lru-cache')

describe('workspace-lru-cache', () => {
  it('evicts oldest when over entry cap', () => {
    const cache = createLruCache({ maxEntries: 2, maxBytes: 10000 })
    cache.set('a', 'one')
    cache.set('b', 'two')
    cache.set('c', 'three')
    assert.equal(cache.get('a'), undefined)
    assert.equal(cache.get('b'), 'two')
    assert.equal(cache.get('c'), 'three')
  })

  it('rejects oversized values and clears', () => {
    const cache = createLruCache({ maxEntries: 4, maxBytes: 8 })
    assert.equal(cache.set('big', '123456789'), false)
    cache.set('ok', 'ab')
    assert.equal(cache.get('ok'), 'ab')
    cache.clear()
    assert.equal(cache.get('ok'), undefined)
  })
})
