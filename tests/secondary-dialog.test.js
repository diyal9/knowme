/**
 * secondary dialog — centered shell and primary-surface separation contract
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'src')
const sharedCss = fs.readFileSync(path.join(src, 'secondary-dialog.css'), 'utf8')
const hubHtml = fs.readFileSync(path.join(src, 'capability-hub.html'), 'utf8')
const hubCss = fs.readFileSync(path.join(src, 'capability-hub.css'), 'utf8')
const hubJs = fs.readFileSync(path.join(src, 'capability-hub.js'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(src, 'workspace.html'), 'utf8')
const workspaceJs = fs.readFileSync(path.join(src, 'workspace.js'), 'utf8')

describe('shared secondary dialog contract', () => {
  it('centers dialogs with bounded internal scrolling and reduced motion', () => {
    assert.ok(sharedCss.includes('.secondary-dialog {'), 'shared dialog primitive')
    assert.ok(sharedCss.includes('top: 50%'), 'vertical centering')
    assert.ok(sharedCss.includes('left: 50%'), 'horizontal centering')
    assert.ok(sharedCss.includes('translate(-50%, -50%)'), 'center transform')
    assert.ok(sharedCss.includes('max-height: min('), 'viewport-bounded height')
    assert.ok(sharedCss.includes('.secondary-dialog__body'), 'independent body region')
    assert.ok(sharedCss.includes('overflow-y: auto'), 'body scrolls internally')
    assert.ok(sharedCss.includes('@media (max-width: 640px)'), 'narrow viewport safe margin')
    assert.ok(sharedCss.includes('prefers-reduced-motion'), 'reduced motion')
  })

  it('renders Hub details as an accessible centered dialog with stable actions', () => {
    assert.match(hubHtml, /capability-hub\.css\?v=\d+/, 'Hub keeps local design system')
    assert.ok(hubHtml.includes('secondary-dialog.css?v=2'), 'Hub loads shared dialog shell')
    assert.match(hubHtml, /id="hubDrawer"[^>]*role="dialog"[^>]*aria-modal="true"/)
    assert.ok(hubHtml.includes('class="hub-drawer-backdrop secondary-dialog-mask"'), 'Hub uses shared mask')
    assert.ok(hubHtml.includes('class="hub-drawer secondary-dialog"'), 'Hub uses shared panel')
    assert.ok(hubHtml.includes('id="hubDrawerActions"'), 'stable action footer')
    assert.ok(hubJs.includes('drawerReturnFocus'), 'Hub restores trigger focus')
    assert.ok(hubJs.includes('StickyIcons.mount(el.drawerActions)'), 'footer keeps icon mounting support')
    assert.ok(!hubCss.includes('translateX(100%)'), 'Hub detail no longer enters from viewport edge')
  })

  it('opens Workspace transient content in dialog mode and preserves primary surfaces', () => {
    assert.ok(workspaceHtml.includes('secondary-dialog.css?v=1'), 'Workspace loads shared dialog shell')
    assert.ok(workspaceHtml.includes('id="drawerBackdrop"'), 'Workspace has dialog backdrop')
    assert.ok(workspaceJs.includes("drawer.classList.add('secondary-dialog')"), 'Workspace enables shared panel only for secondary mode')
    assert.ok(workspaceJs.includes("drawer.classList.remove('secondary-dialog')"), 'Workspace removes shared geometry for primary surfaces')
    assert.ok(workspaceJs.includes("shell?.classList.add('mode-secondary-dialog')"), 'transient content enables dialog mode')
    assert.ok(workspaceJs.includes("shell?.classList.add('mode-center-surface')"), 'primary surfaces retain full-page mode')
    assert.ok(workspaceJs.includes("opts.kind === 'knowledge' || opts.kind === 'settings' || opts.kind === 'capability-hub'"), 'primary kinds stay separated')
    assert.ok(workspaceHtml.includes('transform:none !important'), 'primary surfaces reset centered dialog transforms')
    assert.ok(workspaceHtml.includes('max-height:none !important'), 'primary surfaces reset dialog height bounds')
    assert.ok(workspaceJs.includes("drawer.setAttribute('aria-modal', 'true')"), 'secondary mode exposes modal semantics')
    assert.ok(workspaceJs.includes('isSecondaryDialogOpen()'), 'secondary Escape/backdrop dismissal is scoped')
    assert.ok(workspaceJs.includes('drawerReturnFocus'), 'Workspace restores trigger focus')
  })
})
