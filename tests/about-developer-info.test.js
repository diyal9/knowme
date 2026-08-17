'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { readPreload } = require('./helpers/current-src')

describe('about-developer-info', () => {
  const preload = readPreload()
  const main = require('./helpers/main-ipc-bundle').readMainEntryBundle()

  it('preload can open external links for about actions', () => {
    assert.match(preload, /openExternal/)
    assert.match(main, /KnowMe/)
  })
})
