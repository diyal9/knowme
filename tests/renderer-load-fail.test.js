'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
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
