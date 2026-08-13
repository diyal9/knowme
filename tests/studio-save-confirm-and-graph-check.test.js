'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workbenchJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench.js'), 'utf8')
const layoutCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench-layout.css'), 'utf8')
const consoleCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench-console.css'), 'utf8')

describe('studio-save-confirm-and-graph-check', () => {
  it('toolbar save opens confirm; run is dry-run check', () => {
    assert.match(workbenchJs, /function openStudioSaveConfirm\(/)
    assert.match(workbenchJs, /function previewCheckStudioGraph\(/)
    assert.match(workbenchJs, /kind: 'studio-save'/)
    assert.match(workbenchJs, /label: '检查流程'/)
    assert.match(workbenchJs, /if \(action === 'save'\) void openStudioSaveConfirm\(\)/)
    assert.match(workbenchJs, /if \(action === 'run'\) void previewCheckStudioGraph\(\)/)
    assert.match(workbenchJs, /inspectStudioGraph/)
    assert.match(workbenchJs, /async function testStudioWorkflow\(\) \{\s*\/\/ 兼容旧名：改为干跑检查/)
    assert.match(workbenchJs, /return previewCheckStudioGraph\(\)/)
  })

  it('save confirm dialog uses editable goal and multi-column nodes', () => {
    assert.match(workbenchJs, /id="wbStudioSaveGoal"/)
    assert.match(workbenchJs, /wb-launch-extra-grid/)
    assert.match(workbenchJs, /确认保存/)
    assert.match(workbenchJs, /不会启动运行/)
    assert.doesNotMatch(workbenchJs, /data-save-graph>保存为我的工作流/)
    assert.match(layoutCss, /\.wb-launch-extra-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3/s)
    assert.match(layoutCss, /\.wb-modal-mask\.is-studio-save/)
  })

  it('graph check animation styles exist', () => {
    assert.match(consoleCss, /\.wb-studio-flow-node\.is-check-active/)
    assert.match(consoleCss, /\.wb-studio-flow-node\.is-check-fail/)
    assert.match(consoleCss, /\.wb-studio-edge\.is-check-flow/)
    assert.match(consoleCss, /\.wb-studio-check-dot/)
  })
})
