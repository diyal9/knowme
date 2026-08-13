'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { getRendererMode } = require('../src/lib/renderer-entry')

describe('renderer-entry', () => {
  it('defaults to legacy', () => {
    assert.equal(getRendererMode({}), 'legacy')
    assert.equal(getRendererMode({ KNOWME_RENDERER: '' }), 'legacy')
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'LEGACY' }), 'legacy')
  })

  it('accepts vite', () => {
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'vite' }), 'vite')
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'Vite' }), 'vite')
  })

  it('rejects unknown as legacy', () => {
    assert.equal(getRendererMode({ KNOWME_RENDERER: 'react' }), 'legacy')
  })
})
