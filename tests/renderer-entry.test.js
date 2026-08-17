'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { getRendererMode } = require('../src/lib/renderer-entry')

describe('renderer-entry', () => {
  it('defaults to vite', () => {
    assert.equal(getRendererMode({}), 'vite')
    assert.equal(getRendererMode({ KNOWME_RENDERER: '' }), 'vite')
  })

  it('accepts vite explicitly', () => {
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'vite' }), 'vite')
  })

  it('allows legacy only when set', () => {
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'legacy' }), 'legacy')
  })
})
