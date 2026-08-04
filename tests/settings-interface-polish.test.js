'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('settings interface polish', () => {
  const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')
  const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

  it('removes the duplicate footer close action in embedded mode', () => {
    assert.match(settings, /document\.documentElement\.classList\.toggle\('embedded-settings', embeddedMode\)/)
    assert.match(settings, /\.embedded-settings \.footer \.btn-cancel\s*\{\s*display:none/)
    assert.match(settings, /if \(embeddedMode\)[\s\S]*close-settings-inline/)
  })

  it('uses accessible icons for close and save actions', () => {
    assert.match(settings, /id="btnCancel"[^>]*title="关闭设置"/)
    assert.match(settings, /data-icon="close"/)
    assert.match(settings, /id="btnSave"[\s\S]*data-icon="check"/)
    assert.match(workspace, /id="drawerClose"[^>]*aria-label="关闭当前面板"/)
    assert.match(workspace, /\.drawer-close:focus-visible/)
  })
})
