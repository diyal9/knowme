'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { collectReferences, parseArgs } = require('../scripts/reconcile-production-roster.js')

test('production roster reconcile parses explicit apply and removal targets', () => {
  assert.deepEqual(parseArgs([
    'node',
    'reconcile-production-roster.js',
    '--apply',
    '--remove',
    'ui-expert, artbundle-expert',
  ]), {
    userData: '',
    apply: true,
    removeIds: ['ui-expert', 'artbundle-expert'],
  })
})

test('production roster reconcile detects bindings and task references before deletion', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-roster-'))
  fs.writeFileSync(path.join(userData, 'workbench-modes.json'), JSON.stringify({
    bindings: { visual: [{ expertId: 'ui-expert' }] },
  }))
  fs.writeFileSync(path.join(userData, 'workbench-tasks.json'), JSON.stringify({
    tasks: [{ id: 'task-1', expertId: 'ui-expert', status: 'review' }],
  }))

  assert.deepEqual(collectReferences(userData, 'ui-expert'), {
    bindings: [{ modeId: 'visual', expertId: 'ui-expert' }],
    tasks: [{ id: 'task-1', status: 'review' }],
  })
})
