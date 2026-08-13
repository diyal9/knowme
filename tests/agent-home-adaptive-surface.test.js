'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
const workbenchLayout = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench-layout.css'), 'utf8')
const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')

test('Agent 首页无活动文件时隐藏右侧工作区', () => {
  assert.match(
    html,
    /\.app\.mode-agent:not\(\.agent-has-document\) #workSurfaceWrap\s*\{\s*display:none/,
  )
  assert.match(workspace, /function syncAgentDocumentSurface\(\)/)
  assert.match(workspace, /shell\.classList\.toggle\('agent-has-document', hasOpenDocument\)/)
})

test('工作台模式覆盖 Agent 首页的无文件隐藏规则', () => {
  assert.match(
    workbenchLayout,
    /\.app\.mode-agent\.mode-workbench:not\(\.agent-has-document\) #workSurfaceWrap\s*\{\s*display:\s*flex/,
  )
})

test('打开或关闭文件后同步 Agent 文档工作区状态', () => {
  assert.match(workspace, /p\.active = fsId[\s\S]*?syncAgentDocumentSurface\(\)/)
  assert.match(workspace, /p\.active = id[\s\S]*?syncAgentDocumentSurface\(\)/)
  assert.match(workspace, /renderTabs\(pane\); syncAgentDocumentSurface\(\); renderTree\(\); saveState\(\)/)
  assert.match(workspace, /restoreState\(r\.state\)[\s\S]*?syncAgentDocumentSurface\(\)/)
})

test('Agent 首页提示紧凑且保留桌面留白', () => {
  assert.match(html, /\.agent-empty-tip \.tip-label\s*\{\s*flex:0 0 auto/)
  assert.match(html, /\.agent-empty-tip \.tip-key\s*\{\s*min-width:62px;\s*margin-left:2px/)
  assert.match(html, /\.app\.mode-agent:not\(\.agent-has-document\) \.agent-chat-log,[\s\S]*?width:min\(980px, calc\(100% - 64px\)\)/)
})
