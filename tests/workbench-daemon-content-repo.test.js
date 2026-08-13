'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { resolveDaemonContentRepo } = require('../src/lib/workbench-repo')

describe('resolveDaemonContentRepo', () => {
  it('loads workflow root from workbenchInstall.path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-daemon-repo-'))
    fs.mkdirSync(path.join(root, '.cursor', 'workflows'), { recursive: true })
    const repo = resolveDaemonContentRepo({ workbenchInstall: { path: root } })
    assert.equal(repo.ok, true)
    assert.equal(repo.origin, 'daemon')
    assert.equal(repo.workflowsDir, path.join(root, '.cursor', 'workflows'))
  })

  it('fails closed when install path missing', () => {
    const repo = resolveDaemonContentRepo({})
    assert.equal(repo.ok, false)
    assert.equal(repo.code, 'missing_install')
  })
})
