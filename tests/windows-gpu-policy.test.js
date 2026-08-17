'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  detectRemoteDesktop,
  resolveWindowsGpuPolicy,
} = require('../src/lib/windows-gpu-policy')

describe('windows-gpu-policy', () => {
  it('keeps full performance on local console', () => {
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'Console' },
    })
    assert.equal(policy.disableGpu, false)
    assert.equal(policy.uiThrottle, false)
    assert.equal(policy.useInProcessGpu, false)
    assert.equal(policy.liveNowIntervalMs, 500)
    assert.equal(policy.reason, '')
  })

  it('throttles UI on remote but keeps GPU', () => {
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'RDP-Tcp#0' },
    })
    assert.equal(policy.isRemoteDesktop, true)
    assert.equal(policy.disableGpu, false)
    assert.equal(policy.useInProcessGpu, true)
    assert.equal(policy.uiThrottle, true)
    assert.equal(policy.liveNowIntervalMs, 1000)
    assert.equal(policy.runTelemetryIntervalMs, 4000)
    assert.equal(policy.reason, 'remote')
  })

  it('detects remote via CLIENTNAME when SESSIONNAME is Console', () => {
    assert.equal(
      detectRemoteDesktop({ SESSIONNAME: 'Console', CLIENTNAME: 'LAPTOP-1' }),
      true,
    )
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'Console', CLIENTNAME: 'LAPTOP-1' },
    })
    assert.equal(policy.disableGpu, false)
    assert.equal(policy.uiThrottle, true)
    assert.equal(policy.reason, 'remote')
  })

  it('crash fallback auto-disables GPU without user env', () => {
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'Console' },
      crashFallbackActive: true,
    })
    assert.equal(policy.disableGpu, true)
    assert.equal(policy.reason, 'crash')
    assert.equal(policy.uiThrottle, true)
  })

  it('hidden FORCE_GPU keeps GPU and still throttles on remote', () => {
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'RDP-Tcp#2', KNOWME_FORCE_GPU: '1' },
    })
    assert.equal(policy.disableGpu, false)
    assert.equal(policy.uiThrottle, true)
  })

  it('hidden DISABLE_GPU forces software path on local', () => {
    const policy = resolveWindowsGpuPolicy({
      env: { SESSIONNAME: 'Console', KNOWME_DISABLE_GPU: '1' },
    })
    assert.equal(policy.disableGpu, true)
    assert.equal(policy.reason, 'env')
  })
})
