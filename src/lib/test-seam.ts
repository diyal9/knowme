'use strict'

/** Test-only injection seam — production IPC MUST NOT accept fake/test keys from renderer. */

const TEST_KEYS = new Set([
  'fakeApply',
  'dryRun',
  'testMode',
  'skipAudit',
  'mockApply',
  '_testSeam',
])

function isTestSeamEnabled() {
  return process.env.KNOWME_TEST_SEAM === '1'
    || process.env.NODE_ENV === 'test'
    || process.env.npm_lifecycle_event === 'test'
    || process.argv.some((a) => String(a).includes('--test'))
}

function stripTestKeysFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return {}
  const out = { ...payload }
  for (const key of TEST_KEYS) {
    if (key in out) delete out[key]
  }
  return out
}

function resolveTestSeamOpts(payload = {}, defaults = {}) {
  const clean = stripTestKeysFromPayload(payload)
  if (!isTestSeamEnabled()) return { clean, seam: {} }
  return {
    clean,
    seam: {
      fakeApply: Boolean(payload.fakeApply),
      dryRun: Boolean(payload.dryRun),
      skipAudit: Boolean(payload.skipAudit),
      ...defaults,
    },
  }
}

module.exports = {
  TEST_KEYS,
  isTestSeamEnabled,
  stripTestKeysFromPayload,
  resolveTestSeamOpts,
}
