'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

test('file center separates hub management from the active file tree', () => {
  assert.match(workspace, /fileCenterLayer/)
  assert.match(workspace, /function showFileCenterHub/)
  assert.match(workspace, /function resolveFileCenterLayer/)
  assert.match(workspace, /function syncFileCenterChrome/)
  assert.match(workspace, /source-hub/)
  assert.match(workspace, /source-switcher/)
  assert.match(workspace, /data-open-knowledge-center/)
  assert.match(workspace, /source-section-title">代码仓库/)
  assert.match(workspace, /source-section-title">网页资料/)
  assert.match(workspace, /data-generated-session/)
  assert.match(workspace, /artifactMetaLabel\?\.\(item\)/)
  assert.match(workspace, /relTime\(item\.updatedAt\)/)
  assert.match(workspace, /generatedArtifacts: data\.generatedArtifacts \|\| \[\]/)
  assert.doesNotMatch(
    workspace.slice(workspace.indexOf('const switcher ='), workspace.indexOf('const nodes = (data.fileTree')),
    /source-section-title">代码仓库/,
  )
  assert.doesNotMatch(
    workspace.slice(workspace.indexOf('const switcher ='), workspace.indexOf('const nodes = (data.fileTree')),
    /打开<\/button>/,
  )
  assert.match(html, /id="btnOpenWorkspace"/)
  assert.match(html, /id="btnSwitchSource"/)
  assert.match(html, /data-icon="externalLink"/)
  assert.match(html, /data-icon="arrowLeftRight"/)
  assert.doesNotMatch(html, /side-text-btn/)
  assert.match(html, /id="btnAddSource"/)
  assert.match(html, /id="btnSourceSettings"/)
  assert.match(html, /id="btnRefreshSources"/)
  assert.match(html, /id="editorFileActions"/)
  assert.match(html, /file-center-model\.js/)
  assert.match(html, /\.source-switcher/)
  assert.match(workspace, /btnOpenWorkspace/)
  assert.match(workspace, /btnSwitchSource/)
})

test('file center keeps Workbench out of local source navigation', () => {
  assert.doesNotMatch(workspace.slice(workspace.indexOf('function renderSourceTree'), workspace.indexOf('function updateProjectChrome')), /Workbench/)
  assert.match(workspace, /sourcesTreeChildren/)
  assert.match(workspace, /openKnowledgeOsPanel\(\)/)
})
