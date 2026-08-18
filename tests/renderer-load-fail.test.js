'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const {
  ERR_ABORTED,
  ERR_FAILED,
  shouldIgnoreRendererLoadFail,
  shouldRetryRendererLoadFail,
} = require('../src/lib/renderer-load-fail')

describe('renderer-load-fail', () => {
  it('ignores subframe failures and ERR_ABORTED on the main frame', () => {
    assert.equal(shouldIgnoreRendererLoadFail({ code: ERR_FAILED, isMainFrame: false }), true)
    assert.equal(shouldIgnoreRendererLoadFail({ code: ERR_ABORTED, isMainFrame: true }), true)
    assert.equal(shouldIgnoreRendererLoadFail({ code: ERR_FAILED, isMainFrame: true }), false)
  })

  it('consumes renderer load rejections for initial and retry loads', () => {
    const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'shell.ts'), 'utf8')
    assert.ok(shell.includes('[workspace-load-reject]'))
    assert.ok(shell.includes('[workspace-load-retry-reject]'))
  })

  it('retries first ERR_FAILED only while GPU fallback is active', () => {
    assert.equal(shouldRetryRendererLoadFail({
      code: ERR_FAILED,
      gpuFallbackActive: true,
      retryCount: 0,
    }), true)
    assert.equal(shouldRetryRendererLoadFail({
      code: ERR_FAILED,
      gpuFallbackActive: true,
      retryCount: 1,
    }), false)
    assert.equal(shouldRetryRendererLoadFail({
      code: ERR_FAILED,
      gpuFallbackActive: false,
      retryCount: 0,
    }), false)
  })
})
