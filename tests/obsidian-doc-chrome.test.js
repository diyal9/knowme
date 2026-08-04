/**
 * obsidian-doc-chrome — 头栏阅读/更多、左侧 AI、底栏状态条
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('obsidian-doc-chrome', () => {
  const paneHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor-pane.html'), 'utf8')
  const paneJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor-pane.js'), 'utf8')
  const wsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const wsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
  const icons = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-icons.js'), 'utf8')

  it('exposes bookOpen, pencilLine and moreVertical icons', () => {
    assert.ok(icons.includes('bookOpen'), 'bookOpen icon')
    assert.ok(icons.includes('pencilLine'), 'pencilLine icon')
    assert.ok(icons.includes('moreVertical'), 'moreVertical icon')
  })

  it('puts reading + more on document head, not copy/AI in footer', () => {
    const head = paneHtml.slice(paneHtml.indexOf('class="head-block"'), paneHtml.indexOf('class="workspace"'))
    assert.ok(head.includes('id="btnReadingView"'), 'reading view button')
    assert.ok(head.includes('id="btnMore"'), 'more button')
    assert.ok(head.includes('id="moreMenu"'), 'more menu')
    assert.ok(head.includes('data-act="versions"'), 'versions in more menu')
    assert.ok(head.includes('data-act="final-prompt"'), 'final prompt in more menu')

    const footer = paneHtml.slice(paneHtml.indexOf('class="footer"'), paneHtml.indexOf('</section>'))
    assert.ok(!footer.includes('id="btnCopy"'), 'no copy button')
    assert.ok(!footer.includes('id="aiToggle"'), 'no AI in footer')
    assert.ok(!footer.includes('已复制'), 'no copy count label')
    assert.ok(!footer.includes('mode-seg'), 'no mode segment in footer')
    assert.ok(footer.includes('id="btnStar"'), 'favorite in status bar')
    assert.ok(footer.includes('id="wordCnt"'), 'word count')
    assert.ok(footer.includes('个字符'), 'char count label')
  })

  it('wires reading/more in editor-pane.js; workspace-mode from parent', () => {
    assert.ok(paneJs.includes('function toggleReadingView'), 'toggleReadingView')
    assert.ok(paneJs.includes("nextIcon = preview ? 'pencilLine' : 'bookOpen'"), 'reading/edit icon swap')
    assert.ok(paneJs.includes("let editorMode = 'md', mdView = 'edit'"), 'defaults to md edit')
    assert.ok(paneJs.includes('function runMoreAction'), 'runMoreAction')
    assert.ok(paneJs.includes("d.type === 'workspace-mode'"), 'accepts workspace-mode')
    assert.ok(paneJs.includes("d.type === 'get-editor-context'"), 'returns editor context')
    assert.ok(paneJs.includes('ws-shell'), 'hides embedded ai-pane')
    assert.ok(!paneJs.includes("type: 'ai-state'"), 'no longer reports ai-state')
    assert.ok(!paneJs.includes('btnCopy.addEventListener'), 'no copy button listener')
  })

  it('puts Agent mode toggle on left ribbon with workspace agent column', () => {
    assert.ok(wsHtml.includes('id="btnRailAi"'), 'rail AI button')
    assert.ok(wsHtml.includes('id="agentCol"'), 'workspace agent column')
    assert.ok(wsHtml.includes('mode-edit'), 'default edit mode class')
    assert.ok(wsJs.includes('workspaceMode'), 'workspace mode state')
    assert.ok(wsJs.includes('toggleWorkspaceMode'), 'mode toggle handler')
    assert.ok(wsJs.includes("type: 'workspace-mode'"), 'posts workspace-mode to pane')
    assert.ok(!wsJs.includes("type: 'toggle-ai'"), 'no longer toggles pane ai')
  })
})
