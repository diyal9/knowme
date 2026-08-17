'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { currentPage } = require('./helpers/current-src')

describe('notes product retired', () => {
  it('no list/note renderer entry remains', () => {
    const root = path.join(__dirname, '..', 'src', 'renderer')
    assert.equal(fs.existsSync(path.join(root, 'list', 'main.tsx')), false)
    assert.equal(fs.existsSync(path.join(root, 'note', 'main.tsx')), false)
    assert.equal(currentPage('list.html'), '')
    assert.equal(currentPage('note.html'), '')
  })
})
