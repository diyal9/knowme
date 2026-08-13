'use strict'

/**
 * compact-workflow-studio-canvas-ux —
 * 编排工作流：窄侧栏、全宽画布、节点删除与右键菜单契约。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const src = path.join(__dirname, '..', 'src')
const consoleCss = fs.readFileSync(path.join(src, 'workbench-console.css'), 'utf8')
const shelfCss = fs.readFileSync(path.join(src, 'workbench-shelf.css'), 'utf8')
const workbenchJs = fs.readFileSync(path.join(src, 'workbench.js'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(src, 'workspace.html'), 'utf8')

describe('compact workflow studio canvas UX', () => {
  it('fills the workbench body and keeps a fixed narrow library', () => {
    assert.ok(shelfCss.includes('#workbench:has(#wbStudioSurface.active) .wb-body'), 'studio full-bleed body')
    assert.match(consoleCss, /\.wb-studio-shell\s*\{[^}]*grid-template-columns:\s*118px minmax\(0,1fr\)/s)
    assert.match(consoleCss, /\.wb-studio-shell\.has-inspector\s*\{[^}]*118px minmax\(0,1fr\) 276px/s)
    assert.ok(consoleCss.includes('grid-template-columns:1fr'), 'single-column palette grid')
    assert.ok(consoleCss.includes('.wb-studio-palette-col'), 'palette section columns')
  })

  it('exposes delete controls and a context menu on the canvas', () => {
    assert.ok(workspaceHtml.includes('id="wbStudioCtx"'), 'context menu shell')
    assert.match(workbenchJs, /function deleteStudioNode\(/, 'delete node helper')
    assert.match(workbenchJs, /function showStudioContextMenu\(/, 'context menu helper')
    assert.ok(workbenchJs.includes("addEventListener('contextmenu'"), 'contextmenu binding')
    assert.ok(workbenchJs.includes("event.key !== 'Delete' && event.key !== 'Backspace'"), 'keyboard delete')
    assert.ok(workbenchJs.includes("data-studio-remove"), 'on-node remove control')
  })

  it('protects start and end from removal', () => {
    assert.match(workbenchJs, /function studioNodeRemovable\(/, 'removable guard')
    assert.ok(workbenchJs.includes("toastFn('开始与结束节点不可删除')"), 'user feedback')
  })

  it('makes edges hittable for selection and delete', () => {
    assert.ok(consoleCss.includes('pointer-events:stroke'), 'edge stroke hit test')
    assert.ok(workbenchJs.includes('[data-studio-edge]'), 'edge click target')
  })
})
