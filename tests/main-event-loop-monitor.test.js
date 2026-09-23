'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { startMainEventLoopMonitor } = require('../src/lib/main-event-loop-monitor')

test('main event-loop monitor exports a stoppable startup guard', () => {
  assert.equal(typeof startMainEventLoopMonitor, 'function')
  const monitor = startMainEventLoopMonitor({
    intervalMs: 1000,
    thresholdMs: 50,
    logger: { warn() {} },
  })
  assert.equal(typeof monitor.stop, 'function')
  monitor.stop()
})
