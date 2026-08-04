'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

describe('knowledge governance onboarding', () => {
  it('renders an action-oriented home with a four-step lifecycle', () => {
    const home = workspaceJs.slice(
      workspaceJs.indexOf('function renderKnowledgeWelcome'),
      workspaceJs.indexOf('function knowledgeIssueLabel')
    )
    assert.match(home, /让知识持续可用/)
    assert.match(home, /让 AI 帮我整理/)
    assert.match(home, /一键知识体检/)
    assert.match(home, /浏览知识/)
    assert.match(home, /添加资料/)
    assert.match(home, /AI 整理/)
    assert.match(home, /你来确认/)
    assert.match(home, /随时可用/)
    assert.match(home, /input\.value = '请帮我检查并整理当前知识库/)
    assert.doesNotMatch(home, /自动发送/)
  })

  it('uses plain language for tree types, filters, and health results', () => {
    assert.match(workspaceJs, /data-kos-filter="wiki">资料/)
    assert.match(workspaceJs, /data-kos-filter="okf">已整理/)
    assert.match(workspaceJs, /item\.kind === 'okf' \? '已整理' : '资料'/)
    assert.match(workspaceJs, /empty: '内容为空'/)
    assert.match(workspaceJs, /duplicate_title: '标题可能重复'/)
    assert.match(workspaceJs, /broken_link: '链接已经失效'/)
    assert.match(workspaceJs, /一键知识体检/)
  })

  it('ships responsive home and in-app bridge consent styles', () => {
    assert.match(workspaceHtml, /\.knowledge-home-status/)
    assert.match(workspaceHtml, /\.knowledge-flow-steps/)
    assert.match(workspaceHtml, /\.obsidian-permission-list/)
    assert.match(workspaceHtml, /@media \(max-width:520px\)/)
  })
})
