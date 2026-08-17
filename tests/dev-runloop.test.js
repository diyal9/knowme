'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { parseListeningPids } = require('../scripts/kill-knowme')

describe('dev runloop helpers', () => {
  it('parses netstat LISTENING pids for a port', () => {
    const sample = [
      '  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       4242',
      '  TCP    127.0.0.1:51730        0.0.0.0:0              LISTENING       99',
      '  TCP    127.0.0.1:5173         127.0.0.1:9            ESTABLISHED     7',
    ].join('\n')
    assert.deepEqual(parseListeningPids(sample, 5173), [4242])
  })

  it('dev-app and start-dist chdir to realpath of the repo', () => {
    const repo = fs.realpathSync(path.join(__dirname, '..'))
    const devApp = fs.readFileSync(path.join(repo, 'scripts', 'dev-app.js'), 'utf8')
    const dist = fs.readFileSync(path.join(repo, 'scripts', 'start-dist.js'), 'utf8')
    assert.match(devApp, /realpathSync/)
    assert.match(devApp, /killKnowmeDev/)
    assert.match(devApp, /--dev/)
    assert.match(dist, /killKnowmeDev/)
    assert.doesNotMatch(dist, /--dev/)
  })
})
