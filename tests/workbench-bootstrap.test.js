'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const bootstrap = require('../src/lib/workbench-bootstrap')

test('loadManifest exposes anchor commit and patch targets', () => {
  const manifest = bootstrap.loadManifest()
  assert.ok(manifest)
  assert.equal(manifest.knowmeCompatId, 'knowme-cli-required-v1')
  assert.ok(manifest.upstreamWorkbench.anchorCommit.startsWith('ae2de9c'))
  assert.equal(manifest.targets.length, 2)
})

test('detectCompatState returns needs_patch for anchor file hashes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wb-test-'))
  try {
    const manifest = bootstrap.loadManifest()
    for (const t of manifest.targets) {
      const dest = path.join(temp, t.relPath)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, `placeholder-${t.relPath}\n`)
    }
    const daemon = path.join(temp, 'tools/workflow_runner/daemon/__main__.py')
    fs.writeFileSync(daemon, Buffer.alloc(1))
    const state = bootstrap.detectCompatState(temp)
    assert.notEqual(state.status, 'applied')
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('applyCompatPatch idempotent when marker present', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wb-test-'))
  try {
    const daemon = path.join(temp, 'tools/workflow_runner/daemon/__main__.py')
    fs.mkdirSync(path.dirname(daemon), { recursive: true })
    fs.writeFileSync(daemon, 'def _workflow_requires_cli(workflow_id, root):\n  return False\n')
    const loop = path.join(temp, 'tools/workflow_runner/orchestrator/loop.py')
    fs.mkdirSync(path.dirname(loop), { recursive: true })
    fs.writeFileSync(loop, 'skip_cli_preflight: bool = False\n')
    const state = bootstrap.detectCompatState(temp)
    assert.equal(state.status, 'applied')
    const result = bootstrap.applyCompatPatch(temp)
    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('deployWorkflows copies game-dev-delivery bundle', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wb-test-'))
  try {
    const daemon = path.join(temp, 'tools/workflow_runner/daemon/__main__.py')
    fs.mkdirSync(path.dirname(daemon), { recursive: true })
    fs.writeFileSync(daemon, '# daemon\n')
    fs.mkdirSync(path.join(temp, 'tools/workflow_runner'), { recursive: true })
    fs.writeFileSync(path.join(temp, 'tools/workflow_runner/scripts_registry.json'), '{"version":"1.0","scripts":{}}\n')
    fs.mkdirSync(path.join(temp, '.cursor/workflows'), { recursive: true })
    fs.writeFileSync(path.join(temp, '.cursor/workflows/index.json'), '{"version":"1.0","workflows":[]}\n')

    const deploy = bootstrap.deployWorkflows(temp)
    assert.equal(deploy.ok, true)
    assert.ok(fs.existsSync(path.join(temp, '.cursor/workflows/custom/game-dev-delivery.json')))
    assert.ok(fs.existsSync(path.join(temp, 'tools/knowme/game-dev-deliver.py')))
    const deployState = bootstrap.detectWorkflowDeployState(temp)
    assert.equal(deployState.ok, true)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('buildPublicStatus reports blockers when daemon/token missing', () => {
  const status = bootstrap.buildPublicStatus({ workbenchInstall: { path: '' } }, {
    tokenConfigured: false,
    daemonOverview: { online: false, workflows: [] },
  })
  assert.equal(status.ok, false)
  assert.ok(status.blockers.includes('token'))
  assert.ok(status.blockers.includes('daemon_offline'))
})

test('resolveWorkbenchInstallPath prefers settings over discovery', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wb-test-'))
  try {
    const daemon = path.join(temp, 'tools/workflow_runner/daemon/__main__.py')
    fs.mkdirSync(path.dirname(daemon), { recursive: true })
    fs.writeFileSync(daemon, '# daemon\n')
    const resolved = bootstrap.resolveWorkbenchInstallPath({ workbenchInstall: { path: temp } })
    assert.equal(path.resolve(resolved), path.resolve(temp))
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
