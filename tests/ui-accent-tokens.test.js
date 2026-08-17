'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { spawnSync } = require('child_process')

describe('ui accent token guard', () => {
  it('passes on current renderer CSS', () => {
    const script = path.join(__dirname, '..', 'scripts', 'check-ui-accent-tokens.js')
    const res = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' })
    assert.equal(res.status, 0, res.stderr || res.stdout)
    const report = JSON.parse(res.stdout)
    assert.equal(report.ok, true)
    assert.equal(report.findings.length, 0)
  })
})
