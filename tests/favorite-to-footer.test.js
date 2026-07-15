/**
 * favorite-to-footer — 收藏星标在底部状态栏（紧凑工具组）
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('favorite-to-footer', () => {
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8')

  it('places favorite star in footer, not win-btns', () => {
    assert.ok(noteHtml.includes('id="btnStar"'), 'btnStar exists')
    assert.ok(
      /id="btnStar"[^>]*class="foot-tool"|class="foot-tool"[^>]*id="btnStar"/.test(noteHtml),
      'footer star uses foot-tool'
    )
    assert.ok(noteHtml.includes('class="footer"'), 'footer present')
    assert.ok(noteHtml.includes('class="foot-tools"'), 'compact tool cluster')

    const footerIdx = noteHtml.indexOf('class="footer"')
    const starIdx = noteHtml.indexOf('id="btnStar"')
    const winBtnsIdx = noteHtml.indexOf('class="win-btns"')
    assert.ok(footerIdx > 0 && starIdx > footerIdx, 'btnStar after footer start')
    assert.ok(winBtnsIdx > 0 && starIdx > winBtnsIdx, 'btnStar after win-btns block start')

    const topbarStart = noteHtml.indexOf('class="topbar"')
    const workspaceStart = noteHtml.indexOf('class="workspace"')
    const topbar = noteHtml.slice(topbarStart, workspaceStart)
    assert.ok(!topbar.includes('id="btnStar"'), 'star not in topbar')
    assert.ok(topbar.includes('id="btnPin"'), 'pin still in topbar')
  })

  it('keeps favorite toggle wiring', () => {
    assert.ok(noteHtml.includes('toggleFavorite'), 'toggle IPC')
    assert.ok(noteHtml.includes('setFavorite'), 'setFavorite helper')
    assert.ok(noteHtml.includes("btnStar.classList.toggle('on'"), 'on class toggle')
  })
})
