'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('workspace blank center-surface guard', () => {
  const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')

  it('defines a center-surface healing guard', () => {
    assert.match(workspaceJs, /function healBlankCenterSurface\(\)/)
    assert.match(workspaceJs, /\[center-surface\] healed blank surface/)
  })

  it('calls guard during rail sync and init hydration', () => {
    assert.match(workspaceJs, /function syncRailNavigation\(\)\s*\{\s*ensureShellLayoutInvariant\(\)\s*healBlankCenterSurface\(\)/)
    assert.match(workspaceJs, /await hydrateOpenSourceDirs\(\)[\s\S]*healBlankCenterSurface\(\)/)
  })
})

