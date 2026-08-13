/**
 * 专家库对外命名边界：模块名用「专家库」，条目级「添加能力」可保留。
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'src')

describe('expert library naming', () => {
  const workspaceHtml = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8')
  const workspaceJs = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8')
  const hubHtml = fs.readFileSync(path.join(root, 'capability-hub.html'), 'utf8')
  const settingsHtml = fs.readFileSync(path.join(root, 'settings.html'), 'utf8')
  const workbenchJs = fs.readFileSync(path.join(root, 'workbench.js'), 'utf8')

  it('rail and hub chrome use 专家库', () => {
    const at = workspaceHtml.indexOf('id="btnRailCapabilities"')
    const slice = workspaceHtml.slice(at, at + 420)
    assert.ok(slice.includes('<span class="rail-label">专家库</span>'))
    assert.ok(slice.includes('title="专家库"'))
    assert.ok(hubHtml.includes('<title>KnowMe — 专家库</title>'))
    assert.ok(hubHtml.includes('<span>专家库</span>'))
    assert.ok(workspaceHtml.includes('aria-label="专家库"'))
    assert.ok(workspaceJs.includes("openDrawer('专家库'"))
    assert.ok(workspaceJs.includes('title="专家库"'))
  })

  it('user-facing module names avoid legacy 能力 Hub / 能力界面 / 能力中心', () => {
    assert.ok(!workspaceHtml.includes('能力 Hub'))
    assert.ok(!hubHtml.includes('能力 Hub'))
    assert.ok(!settingsHtml.includes('能力 Hub'))
    assert.ok(!settingsHtml.includes('「能力」入口'))
    assert.ok(!workbenchJs.includes('能力界面'))
    assert.ok(!workbenchJs.includes('能力中心'))
    assert.ok(settingsHtml.includes('打开专家库'))
    assert.ok(workbenchJs.includes('去专家库添加专家') || workbenchJs.includes('去专家库添加'))
  })

  it('keeps item-level 添加能力 and engineering ids', () => {
    assert.ok(hubHtml.includes('添加能力') || hubHtml.includes('id="hubBtnAdd"'))
    assert.ok(workspaceHtml.includes('id="btnRailCapabilities"'))
    assert.ok(workspaceJs.includes("kind: 'capability-hub'"))
  })
})
