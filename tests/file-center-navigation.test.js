'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

test('file center separates knowledge, repositories, generated artifacts, and current files', () => {
  assert.match(workspace, /titleEl\.textContent = '我的空间'/)
  assert.match(workspace, /data-open-knowledge-center/)
  assert.match(workspace, /source-section-title">代码仓库/)
  assert.match(workspace, /source-section-title">网页资料/)
  assert.match(workspace, /data-generated-session/)
  assert.match(workspace, /artifactMetaLabel\?\.\(item\)/)
  assert.match(workspace, /relTime\(item\.updatedAt\)/)
  assert.match(workspace, /generatedArtifacts: data\.generatedArtifacts \|\| \[\]/)
  assert.match(workspace, /source-section-title">当前文件/)
  assert.match(html, /id="btnAddSource"/)
  assert.match(html, /id="btnSourceSettings"/)
  assert.match(html, /id="btnRefreshSources"/)
  assert.match(html, /id="editorFileActions"/)
  assert.match(html, /file-center-model\.js/)
})

test('file center keeps Workbench out of local source navigation', () => {
  assert.doesNotMatch(workspace.slice(workspace.indexOf('function renderSourceTree'), workspace.indexOf('function updateProjectChrome')), /Workbench/)
  assert.match(workspace, /sourcesTreeChildren/)
  assert.match(workspace, /openKnowledgeOsPanel\(\)/)
})
