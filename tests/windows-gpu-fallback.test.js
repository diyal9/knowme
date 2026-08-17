'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  FALLBACK_TTL_MS,
  RECOVERY_STABLE_MS,
  readGpuFallback,
  markGpuCrash,
  noteGpuFallbackStable,
  clearGpuFallback,
} = require('../src/lib/windows-gpu-fallback')

describe('windows-gpu-fallback', () => {
  /** @type {string} */
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-gpu-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('marks crash and reads as active', () => {
    const t0 = 1_700_000_000_000
    markGpuCrash(dir, fs, path, t0)
    const got = readGpuFallback(dir, fs, path, t0 + 1000)
    assert.equal(got.active, true)
    assert.equal(got.state.reason, 'crash')
    assert.equal(got.state.crashCount, 1)
  })

  it('expires after TTL', () => {
    const t0 = 1_700_000_000_000
    markGpuCrash(dir, fs, path, t0)
    const got = readGpuFallback(dir, fs, path, t0 + FALLBACK_TTL_MS + 1)
    assert.equal(got.active, false)
    assert.equal(got.expired, true)
  })

  it('clears after stable window', () => {
    const t0 = 1_700_000_000_000
    markGpuCrash(dir, fs, path, t0)
    noteGpuFallbackStable(dir, fs, path, t0 + 1000)
    const mid = noteGpuFallbackStable(dir, fs, path, t0 + 1000 + RECOVERY_STABLE_MS - 1)
    assert.equal(mid.cleared, false)
    const done = noteGpuFallbackStable(dir, fs, path, t0 + 1000 + RECOVERY_STABLE_MS)
    assert.equal(done.cleared, true)
    assert.equal(readGpuFallback(dir, fs, path, t0 + 1000 + RECOVERY_STABLE_MS).active, false)
  })

  it('clearGpuFallback removes file', () => {
    markGpuCrash(dir, fs, path)
    clearGpuFallback(dir, fs, path)
    assert.equal(readGpuFallback(dir, fs, path).active, false)
  })
})
