'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { currentPage, readPreload } = require('./helpers/current-src')

describe("expert-task-chat-workbench (migrated)", () => {
  it('covers current renderer instead of retired golden pages', () => {
    const src = currentPage('workspace.js')
    assert.ok(src.includes('KnowMe') || src.includes('工作台') || src.includes('AppShell'))
    assert.match(readPreload(), /contextBridge/)
  })
})
