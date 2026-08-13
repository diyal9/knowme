'use strict'

/**
 * streamline-studio-palette-expert-picker —
 * 侧栏去掉配置 Tab；单列分区组件；专家多选弹窗。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const src = path.join(__dirname, '..', 'src')
const consoleCss = fs.readFileSync(path.join(src, 'workbench-console.css'), 'utf8')
const workbenchJs = fs.readFileSync(path.join(src, 'workbench.js'), 'utf8')
const canvasJs = fs.readFileSync(path.join(src, 'lib', 'workbench-studio-canvas.js'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(src, 'workspace.html'), 'utf8')

describe('streamline studio palette expert picker', () => {
  it('removes the configuration tab and inline expert list from the studio library', () => {
    assert.doesNotMatch(workspaceHtml, /data-studio-lib-tab="config"/)
    assert.doesNotMatch(workspaceHtml, /id="wbStudioTabConfig"/)
    assert.doesNotMatch(workspaceHtml, /id="wbStudioAgents"/)
    assert.doesNotMatch(workspaceHtml, /id="wbStudioList"/)
    assert.match(workspaceHtml, /id="wbStudioPalette"/)
    assert.doesNotMatch(workspaceHtml, /id="wbStudioAddAgent"/)
  })

  it('renders a single-column sectioned palette with expert group metadata', () => {
    assert.match(canvasJs, /group:\s*'flow'/)
    assert.match(canvasJs, /group:\s*'capability'/)
    assert.match(canvasJs, /group:\s*'control'/)
    assert.match(workbenchJs, /wb-studio-palette-section/)
    assert.match(consoleCss, /\.wb-studio-palette-col\s*\{[^}]*grid-template-columns:\s*1fr/s)
  })

  it('opens a multi-select workbench expert picker from the Expert palette item', () => {
    assert.match(workbenchJs, /function openStudioExpertPicker\(/)
    assert.match(workbenchJs, /function confirmStudioExpertPicker\(/)
    assert.match(workbenchJs, /kind === 'agent'[\s\S]*openStudioExpertPicker\(\)/)
    assert.match(workbenchJs, /workbenchQuickExperts\(\)/)
    assert.match(workbenchJs, /data-studio-expert-pick/)
    assert.match(workbenchJs, /wb-studio-expert-pick-card/)
    assert.match(workbenchJs, /is-selected/)
    assert.match(workbenchJs, /model\.addAgent\(studioDraft, agent\)/)
    assert.match(consoleCss, /\.wb-studio-expert-pick-check/)
  })

  it('hosts the expert-library entry inside the picker and resumes after hub close', () => {
    assert.match(workbenchJs, /wb-studio-expert-picker-library/)
    assert.match(workbenchJs, /data-icon="capabilityStack"/)
    assert.match(workbenchJs, /function openStudioExpertLibraryFromPicker\(/)
    assert.match(workbenchJs, /resumeStudioExpertPickerAfterHub/)
    assert.match(workbenchJs, /knowme-drawer-closed/)
    assert.match(consoleCss, /\.wb-studio-expert-picker-library/)
  })
})
