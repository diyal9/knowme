'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('knowledge steward IPC contract', () => {
  const stewardIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'knowledge-steward.js'), 'utf8')
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')

  it('keeps task lifecycle and proposal review handlers paired', () => {
    const names = [
      'knowledge-steward-task-list',
      'knowledge-steward-task-create',
      'knowledge-steward-task-cancel',
      'knowledge-steward-task-retry',
      'knowledge-steward-proposal-accept',
      'knowledge-steward-proposal-reject',
      'knowledge-steward-proposal-snooze',
    ]
    for (const name of names) {
      assert.match(stewardIpc, new RegExp(`ipcMain\\.handle\\('${name}'`), `${name} steward ipc handler`)
      assert.match(preload, new RegExp(`ipcRenderer\\.invoke\\('${name}'`), `${name} preload bridge`)
    }
    assert.match(main, /registerKnowledgeStewardIpc|registerCoreIpc/, 'main wires steward via core ipc')
  })
})
