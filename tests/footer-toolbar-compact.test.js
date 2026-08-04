/**
 * footer-toolbar-compact — 底栏分区与紧凑工具组
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('footer-toolbar-compact', () => {
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8')
  const footer = noteHtml.slice(
    noteHtml.indexOf('<div class="footer">'),
    noteHtml.indexOf('</section>')
  )

  it('keeps only plain/md in mode-seg', () => {
    const segStart = footer.indexOf('class="mode-seg"')
    const segEnd = footer.indexOf('</div>', segStart)
    const seg = footer.slice(segStart, segEnd)
    assert.ok(seg.includes('id="modePlain"') && seg.includes('id="modeMd"'), 'plain+md in seg')
    assert.ok(!seg.includes('id="modeMdPreview"'), 'preview not in mode-seg')
  })

  it('groups preview with compact foot-tools', () => {
    const toolsStart = footer.indexOf('class="foot-tools"')
    assert.ok(toolsStart > 0, 'foot-tools present')
    const toolsEnd = footer.indexOf('</div>', toolsStart)
    const tools = footer.slice(toolsStart, toolsEnd)
    assert.ok(tools.includes('id="modeMdPreview"'), 'preview in tools')
    assert.ok(tools.includes('id="btnStar"'), 'star in tools')
    assert.ok(tools.includes('id="btnSuggest"'), 'suggest in tools')
    assert.ok(!tools.includes('id="btnPromote"'), 'legacy OKF promote removed')
    assert.ok(tools.includes('id="btnVersions"'), 'history in tools')
  })

  it('unifies AI and copy as foot-actions', () => {
    assert.ok(footer.includes('class="foot-actions"'), 'foot-actions wrapper')
    assert.ok(footer.includes('foot-action ai-toggle'), 'ai uses foot-action')
    assert.ok(footer.includes('foot-action btn-copy-primary'), 'copy uses foot-action')
  })
})
