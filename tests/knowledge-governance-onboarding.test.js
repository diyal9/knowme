'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

describe('knowledge governance onboarding', () => {
  it('renders an action-oriented material browser welcome', () => {
    const home = workspaceJs.slice(
      workspaceJs.indexOf('function renderKnowledgeWelcome'),
      workspaceJs.indexOf('function knowledgeIssueLabel')
    )
    assert.match(home, /从左侧选择一份资料/)
    assert.match(home, /你的 LLMWiki 还没有资料/)
    assert.match(home, /添加资料/)
    assert.match(home, /已整理知识/)
  })

  it('uses plain language for tree types, filters, and health results', () => {
    assert.match(workspaceJs, /data-kos-filter="wiki">资料/)
    assert.match(workspaceJs, /data-kos-filter="okf">已整理/)
    assert.match(workspaceJs, /item\.kind === 'okf' \? '已整理' : item\.editable[\s\S]*\? '可编辑' : '资料'/)
    assert.match(workspaceJs, /empty: '内容为空'/)
    assert.match(workspaceJs, /duplicate_title: '标题可能重复'/)
    assert.match(workspaceJs, /broken_link: '链接已经失效'/)
    assert.match(workspaceJs, /知识体检/)
  })

  it('keeps the root workbench focused on tree and reader', () => {
    assert.match(workspaceJs, /function renderKnowledgeStatusWorkspace/)
    assert.match(workspaceJs, /id="llmwikiAddMaterial"/)
    assert.match(workspaceJs, /id="kosReader"/)
    assert.doesNotMatch(workspaceJs, /id="kosContext"/)
    assert.match(workspaceJs, /function knowledgeDocActionsHtml/)
    assert.match(workspaceJs, /knowledgeEntryEditable/)
    assert.match(workspaceJs, /llmwiki-workbench/)
  })

  it('ships responsive home and in-app bridge consent styles', () => {
    assert.match(workspaceHtml, /\.knowledge-home-status/)
    assert.match(workspaceHtml, /\.knowledge-flow-steps/)
    assert.match(workspaceHtml, /\.obsidian-permission-list/)
    assert.match(workspaceHtml, /@media \(max-width:520px\)/)
  })
})
