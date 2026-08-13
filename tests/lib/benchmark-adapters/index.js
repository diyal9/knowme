'use strict'

const knowmeAdapter = require('./knowme-adapter')
const cursorAdapter = require('./cursor-adapter')
const workbuddyAdapter = require('./workbuddy-adapter')

const ADAPTERS = {
  knowme: knowmeAdapter,
  cursor: cursorAdapter,
  workbuddy: workbuddyAdapter,
}

function getAdapter(product = 'knowme') {
  const adapter = ADAPTERS[product]
  if (!adapter) throw new Error(`Unknown benchmark adapter: ${product}`)
  return adapter
}

module.exports = {
  ADAPTERS,
  getAdapter,
}
