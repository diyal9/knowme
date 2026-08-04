/**
 * reposition-ai-file-editor — 单窗口工作台冒烟（结构/IPC 标记）
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('note-close-resume', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
  const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
  const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

  it('启动和全局入口只指向工作台', () => {
    assert.ok(main.includes('createWorkspaceWindow()'), 'workspace startup')
    assert.ok(main.includes("globalShortcut.register('CmdOrCtrl+Alt+N', newNote)"), 'new shortcut')
    assert.ok(main.includes("globalShortcut.register('CmdOrCtrl+Alt+L', () => createWorkspaceWindow())"), 'show shortcut')
    assert.ok(main.includes('openWorkspaceNote(id)'), 'new note opens workspace')
    assert.ok(!main.includes("globalShortcut.register('CmdOrCtrl+Alt+L', toggleListWin)"), 'no list shortcut')
  })

  it('工作台覆盖分组、新建和最终提示词入口', () => {
    assert.ok(preload.includes('workspaceInit'), 'workspace init')
    assert.ok(preload.includes('workspaceNewNote'), 'workspace new file')
    assert.ok(preload.includes('buildFinalPrompt'), 'final prompt')
    assert.ok(workspace.includes('group'), 'project groups')
    assert.ok(workspace.includes('openFinalPrompt'), 'final prompt panel')
    assert.ok(workspace.includes('openKnowledgeOsPanel'), 'knowledge panel')
    assert.ok(workspace.includes('mode-knowledge') || workspaceHtml.includes('mode-knowledge'), 'knowledge fullpage mode')
    assert.ok(workspace.includes('fullpage'), 'knowledge opens as fullpage')
    assert.ok(workspace.includes('setKnowledgeFullpage'), 'knowledge fullpage helper')
    assert.ok(workspaceHtml.includes('btnKnowledgeOs'), 'knowledge rail entry')
    assert.ok(workspaceHtml.includes('rail-foot'), 'rail foot for knowledge/settings')
    assert.ok(workspaceHtml.includes('.app.mode-center-surface .drawer.open'), 'show knowledge in center surface')
    assert.ok(!workspace.includes('openSnippets'), 'no snippet library')
    assert.ok(!workspaceHtml.includes('btnSnippets'), 'no snippet button')
    assert.ok(!workspaceHtml.includes('agentKnowledgeBtn'), 'no agent header knowledge btn')
    assert.ok(workspace.includes('sideCollapsed'), 'sidebar collapse toggle')
    assert.ok(workspaceHtml.includes('btnToggleSide'), 'sidebar toggle button in markup')
  })

  it('片段库 IPC 已下线', () => {
    assert.ok(!main.includes("ipcMain.handle('list-snippets'"), 'no list-snippets')
    assert.ok(!main.includes("ipcMain.handle('create-snippet'"), 'no create-snippet')
    assert.ok(!main.includes("ipcMain.handle('update-snippet'"), 'no update-snippet')
    assert.ok(!preload.includes('listSnippets'), 'no listSnippets preload')
  })

  it('旧便签入口不再暴露高频浮窗操作', () => {
    assert.ok(!preload.includes("ipcRenderer.send('note-hide'"), 'no note hide API')
    assert.ok(!preload.includes("ipcRenderer.send('note-minimize-tray'"), 'no tray minimize API')
    assert.ok(!preload.includes("ipcRenderer.send('focus-note'"), 'no focus-note API')
  })
})
