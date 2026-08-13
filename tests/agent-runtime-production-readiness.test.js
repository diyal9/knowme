'use strict'

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')

const trust = require('../src/lib/agent-package-trust')
const packageRuntime = require('../src/lib/agent-package-runtime')
const { AgentRunStore } = require('../src/lib/agent-run-store')
const { AgentRunManager } = require('../src/lib/agent-run-manager')
const {
  AgentRunLauncher,
  RemoteAgentServiceAdapter,
  BACKEND_DAEMON,
} = require('../src/lib/agent-run-launcher')
const { createAgentRuntimeMetrics } = require('../src/lib/agent-runtime-metrics')

const tempDirs = []

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-production-readiness-'))
  tempDirs.push(dir)
  return dir
}

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    packageId: 'trusted-agent',
    name: 'Trusted Agent',
    version: '1.0.0',
    builder: 'local',
    persona: { role: 'Reviewer' },
    capabilities: { required: [{ id: 'read_file', required: true }], optional: [] },
    inputs: { type: 'object', properties: {} },
    outputs: { type: 'object', properties: {} },
    orchestration: { allowDelegate: false, maxParallel: 1, allowedSubExperts: [] },
    ...overrides,
  }
}

function runtimeStack() {
  const metrics = createAgentRuntimeMetrics()
  const runStore = new AgentRunStore({ rootDir: tempDir(), metrics })
  const launcher = new AgentRunLauncher({ metrics })
  const manager = new AgentRunManager({ runStore, launcher, metrics })
  return { metrics, runStore, launcher, manager }
}

afterEach(() => {
  while (tempDirs.length) {
    try { fs.rmSync(tempDirs.pop(), { recursive: true, force: true }) } catch { /* cleanup */ }
  }
})

describe('agent package production trust', () => {
  it('uses deterministic full SHA-256 canonical integrity locks', () => {
    const first = trust.computeIntegrityHash({ b: { y: 2, x: 1 }, a: ['z'] })
    const reordered = trust.computeIntegrityHash({ a: ['z'], b: { x: 1, y: 2 } })
    assert.match(first, /^[a-f0-9]{64}$/)
    assert.equal(first, reordered)
  })

  it('authenticates trusted Ed25519 publishers and rejects tampering or revocation', () => {
    const pair = crypto.generateKeyPairSync('ed25519')
    const pkg = manifest()
    const permissions = { tools: { allowlist: ['read_file'] }, network: false }
    const contentHash = trust.computeIntegrityHash(pkg)
    const signature = trust.signPackage({
      manifest: pkg,
      publisherId: 'knowme-release',
      keyId: 'release-2026',
      contentHash,
      permissions,
    }, pair.privateKey)
    const policy = {
      mode: 'strict',
      trustedPublishers: {
        'knowme-release': {
          keys: { 'release-2026': pair.publicKey },
        },
      },
    }

    const verified = trust.verifyPackageTrust({
      manifest: pkg,
      expectedContentHash: contentHash,
      signature,
      permissions,
      policy,
    })
    assert.equal(verified.ok, true)
    assert.equal(verified.trustLevel, 'verified_publisher')
    assert.equal(verified.authenticatedPublisher, true)

    const tampered = trust.verifyPackageTrust({
      manifest: { ...pkg, name: 'Tampered' },
      expectedContentHash: contentHash,
      signature,
      permissions,
      policy,
    })
    assert.equal(tampered.ok, false)
    assert.equal(tampered.code, 'package_integrity_mismatch')

    const revoked = trust.verifyPackageTrust({
      manifest: pkg,
      expectedContentHash: contentHash,
      signature,
      permissions,
      policy: { ...policy, revokedKeyIds: ['release-2026'] },
    })
    assert.equal(revoked.ok, false)
    assert.equal(revoked.code, 'package_publisher_revoked')
  })

  it('does not confuse hash-only integrity with publisher authentication', () => {
    const pkg = manifest()
    const contentHash = trust.computeIntegrityHash(pkg)
    const compatible = trust.verifyPackageTrust({
      manifest: pkg,
      expectedContentHash: contentHash,
      policy: { mode: 'compatible', allowIntegrityOnly: true },
    })
    assert.equal(compatible.ok, true)
    assert.equal(compatible.trustLevel, 'integrity_only')
    assert.equal(compatible.authenticatedPublisher, false)

    const strict = trust.verifyPackageTrust({
      manifest: pkg,
      expectedContentHash: contentHash,
      policy: { mode: 'strict' },
    })
    assert.equal(strict.ok, false)
    assert.equal(strict.code, 'package_signature_required')

    const legacy = trust.verifyPackageTrust({
      manifest: pkg,
      expectedContentHash: contentHash.slice(0, 16),
      policy: { mode: 'strict' },
    })
    assert.equal(legacy.ok, false)
    assert.equal(legacy.migrationRequired, true)
  })

  it('blocks permission expansion until a hash-bound review receipt exists', () => {
    const previous = { tools: { allowlist: ['read_file'] }, network: false }
    const next = { tools: { allowlist: ['read_file', 'run_shell'] }, network: true }
    const contentHash = 'a'.repeat(64)
    const blocked = trust.verifyPermissionReview({
      previousPermissions: previous,
      nextPermissions: next,
      contentHash,
    })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, 'package_permission_review_required')
    assert.ok(blocked.diff.expanded.length >= 2)

    const reviewed = trust.verifyPermissionReview({
      previousPermissions: previous,
      nextPermissions: next,
      contentHash,
      receipt: {
        approved: true,
        contentHash,
        permissionDigest: trust.permissionDigest(next),
      },
    })
    assert.equal(reviewed.ok, true)
    assert.equal(reviewed.reviewed, true)
  })

  it('enforces strict trust and permission review at run materialization', () => {
    const pair = crypto.generateKeyPairSync('ed25519')
    const validated = packageRuntime.validateAgentPackage(manifest())
    const permissions = { tools: { allowlist: ['read_file', 'run_shell'] } }
    const signature = trust.signPackage({
      manifest: validated.manifest,
      contentHash: validated.contentHash,
      permissions,
      publisherId: 'runtime-release',
      keyId: 'runtime-key',
    }, pair.privateKey)
    const base = {
      manifest: validated.manifest,
      contentHash: validated.contentHash,
      permissions,
      packageSignature: signature,
      trustPolicy: {
        mode: 'strict',
        trustedPublishers: {
          'runtime-release': { keys: { 'runtime-key': pair.publicKey } },
        },
      },
      previousPermissions: { tools: { allowlist: ['read_file'] } },
    }
    const blocked = packageRuntime.materializeRunSpec(base)
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, 'package_permission_review_required')

    const allowed = packageRuntime.materializeRunSpec({
      ...base,
      permissionReviewReceipt: {
        approved: true,
        contentHash: validated.contentHash,
        permissionDigest: trust.permissionDigest(permissions),
      },
    })
    assert.equal(allowed.ok, true)
    assert.equal(allowed.runSpec.packageTrust.trustLevel, 'verified_publisher')
  })
})

describe('run store corruption and recovery', () => {
  it('recovers only a truncated final line and reports the truncation', () => {
    const store = new AgentRunStore({ rootDir: tempDir() })
    store.appendEvent('run_tail', { type: 'run.created', payload: { status: 'queued' } })
    fs.appendFileSync(store.eventsPath('run_tail'), '{"v":1,"seq":2', 'utf8')
    const inspected = store.inspectEventLog('run_tail', { tolerateTruncatedTail: true })
    assert.equal(inspected.ok, true)
    assert.equal(inspected.tailTruncated, true)
    assert.equal(inspected.lastGoodSeq, 1)
    assert.equal(store.replay('run_tail').tailTruncated, true)
    assert.equal(store.appendEvent('run_tail', { type: 'run.phase', payload: {} }).code, 'event_log_tail_truncated')
  })

  it('fails closed on middle corruption and hash-chain tampering', () => {
    const store = new AgentRunStore({ rootDir: tempDir() })
    store.appendEvent('run_middle', { type: 'run.created', payload: {} })
    store.appendEvent('run_middle', { type: 'run.phase', payload: { phase: 'MODEL' } })
    const original = fs.readFileSync(store.eventsPath('run_middle'), 'utf8').trim().split('\n')
    fs.writeFileSync(store.eventsPath('run_middle'), `${original[0]}\n{bad-json}\n${original[1]}\n`, 'utf8')
    const corrupt = store.inspectEventLog('run_middle')
    assert.equal(corrupt.ok, false)
    assert.equal(corrupt.code, 'event_log_corrupt')
    assert.equal(store.replay('run_middle').ok, false)

    const hashStore = new AgentRunStore({ rootDir: tempDir() })
    hashStore.appendEvent('run_hash', { type: 'run.created', payload: { value: 1 } })
    const record = JSON.parse(fs.readFileSync(hashStore.eventsPath('run_hash'), 'utf8'))
    record.payload.value = 2
    fs.writeFileSync(hashStore.eventsPath('run_hash'), `${JSON.stringify(record)}\n`, 'utf8')
    assert.equal(hashStore.inspectEventLog('run_hash').code, 'event_hash_mismatch')
  })

  it('marks active persisted runs interrupted and rejects corrupt state safely', () => {
    const root = tempDir()
    const store = new AgentRunStore({ rootDir: root })
    store.appendEvent('run_interrupted', { type: 'run.created', payload: {} })
    store.writeState('run_interrupted', {
      runId: 'run_interrupted',
      rootRunId: 'run_interrupted',
      status: 'running',
      phase: 'MODEL',
      seq: 1,
    })
    store.updateTreeIndex('run_interrupted', {
      runId: 'run_interrupted',
      status: 'running',
      depth: 0,
    })
    const manager = new AgentRunManager({ runStore: new AgentRunStore({ rootDir: root }) })
    const loaded = manager.loadFromStore('run_interrupted')
    assert.equal(loaded.ok, true)
    assert.equal(manager.getRunStatus('run_interrupted').status, 'interrupted')

    fs.writeFileSync(store.statePath('run_interrupted'), '{broken', 'utf8')
    const state = store.readState('run_interrupted')
    assert.equal(state.ok, false)
    assert.equal(state.code, 'state_corrupt')
  })
})

describe('authoritative lifecycle and fault convergence', () => {
  it('does not report cancellation success unless a root controller or RunManager accepted it', () => {
    const mainSource = readMainIpcBundle()
    assert.ok(!mainSource.includes('activeSubRuns'))
    assert.ok(mainSource.includes('const cancellationAccepted = Boolean(controller) || Boolean(runtimeCancellation?.ok)'))
    assert.ok(mainSource.includes('ok: cancellationAccepted'))
  })

  it('delivers duplicate backend terminal callbacks exactly once', async () => {
    const metrics = createAgentRuntimeMetrics()
    const launcher = new AgentRunLauncher({ metrics })
    launcher.registerBackend('duplicate-backend', {
      probeHealth: () => ({ ok: true }),
      launch: async (_spec, hooks) => {
        hooks.onTerminal({ terminal: 'completed', text: 'first' })
        hooks.onTerminal({ terminal: 'failed', text: 'duplicate' })
        return { handle: { runId: 'run_duplicate' }, backend: 'duplicate-backend' }
      },
      cancel: async () => ({ withinBudgetMs: true }),
    })
    const terminal = []
    await launcher.launch({ runId: 'run_duplicate', backend: 'duplicate-backend' }, {
      onTerminal: event => terminal.push(event),
    })
    assert.equal(terminal.length, 1)
    assert.equal(terminal[0].text, 'first')
    assert.equal(metrics.snapshot().counters.duplicate_terminal_callback_total, 1)
    assert.equal(launcher.getDiagnostics().activeLaunches, 0)
  })

  it('converges a cancellation storm without run-manager resource leaks', async () => {
    const { manager } = runtimeStack()
    manager.createRun({ runId: 'storm_root', autoLaunch: false })
    manager.createChildRun('storm_root', { runId: 'storm_child', autoLaunch: false })
    const results = await Promise.all(
      Array.from({ length: 20 }, () => manager.cancelRun('storm_root', 'cancel_storm')),
    )
    assert.ok(results.every(result => result.ok))
    assert.equal(manager.getRunStatus('storm_root').status, 'cancelled')
    assert.equal(manager.getRunStatus('storm_child').status, 'cancelled')
    const diagnostics = manager.getDiagnostics()
    assert.equal(diagnostics.authority, 'AgentRunManager+AgentRunStore')
    assert.equal(diagnostics.resources.activeLaunches, 0)
    assert.equal(diagnostics.resources.waiters, 0)
    assert.equal(diagnostics.resources.resourceLeakCount, 0)
    assert.ok(diagnostics.metrics.counters.duplicate_cancel_total >= 1)
  })

  it('keeps idempotent side-effect receipts stable under repeated calls', () => {
    const { runStore } = runtimeStack()
    const first = runStore.getOrCreateReceipt('run_receipt', 'effect-1', () => ({
      result: { applied: true, artifactId: 'a-1' },
    }))
    const second = runStore.getOrCreateReceipt('run_receipt', 'effect-1', () => ({
      result: { applied: true, artifactId: 'a-2' },
    }))
    assert.equal(first.ok, true)
    assert.equal(second.duplicate, true)
    assert.equal(second.receipt.result.artifactId, 'a-1')
  })
})

describe('remote readiness and deterministic network faults', () => {
  it('requires a timed handshake and minimum capabilities for readiness', async () => {
    const ready = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      serviceTimeoutMs: 50,
      client: {
        handshake: async () => ({
          protocolVersion: 1,
          capabilities: ['executeAgentRun', 'cancelRun', 'fetchRunStatus', 'resumeRun'],
        }),
      },
    })
    const healthy = await ready.probeHealth()
    assert.equal(healthy.ok, true)
    assert.equal(healthy.status, 'READY')

    const missing = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      client: {
        handshake: async () => ({ protocolVersion: 1, capabilities: ['executeAgentRun'] }),
      },
    })
    const rejected = await missing.probeHealth()
    assert.equal(rejected.ok, false)
    assert.equal(rejected.code, 'capability_missing')
  })

  it('maps readiness timeout and execution disconnect to stable errors', async () => {
    const timeout = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      serviceTimeoutMs: 20,
      client: { handshake: () => new Promise(() => {}) },
    })
    const timedOut = await timeout.probeHealth()
    assert.equal(timedOut.ok, false)
    assert.equal(timedOut.code, 'remote_timeout')

    const disconnected = new RemoteAgentServiceAdapter({
      id: BACKEND_DAEMON,
      serviceTimeoutMs: 50,
      client: {
        handshake: async () => ({
          protocolVersion: 1,
          capabilities: ['executeAgentRun', 'cancelRun', 'fetchRunStatus'],
        }),
        executeAgentRun: async () => {
          const error = new Error('socket disconnected')
          error.code = 'ECONNRESET'
          throw error
        },
      },
    })
    await assert.rejects(
      () => disconnected.launch({ runId: 'run_disconnect', prompt: 'x' }),
      error => error.code === 'remote_disconnected',
    )
  })
})
