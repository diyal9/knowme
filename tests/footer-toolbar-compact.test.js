'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { currentPage } = require('./helpers/current-src')

describe('footer-toolbar-compact (retired note chrome)', () => {
  it('note window markup is gone', () => {
    assert.equal(currentPage('note.html'), '')
  })
})
