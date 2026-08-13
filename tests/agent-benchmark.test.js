'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const TASKS = path.join(ROOT, 'tests', 'fixtures', 'agent-benchmark', 'tasks', 'core-10.json')

describe('agent-benchmark script', () => {
  it('loads core-10 task set with 10 tasks', () => {
    const taskSet = JSON.parse(fs.readFileSync(TASKS, 'utf8'))
    assert.equal(taskSet.tasks.length, 10)
  })

  it('runs knowme adapter offline and marks cursor/workbuddy blocked', () => {
    const run = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts', 'agent-benchmark.js'),
      '--suite', 'core-10',
      '--products', 'knowme,cursor,workbuddy',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120000,
    })
    assert.equal(run.status, 0, run.stderr || run.stdout)
    const summary = JSON.parse(run.stdout)
    assert.equal(summary.taskSet, 'core-10')
    assert.ok(summary.productResults.knowme.length === 10)
    assert.ok(summary.productResults.cursor.every(r => r.blocked))
    assert.ok(summary.productResults.workbuddy.every(r => r.blocked))
    assert.ok(summary.gapSummary['knowme_vs_cursor'].blocked)
  })
})
