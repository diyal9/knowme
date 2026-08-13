'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('single-root knowledge top-level naming', () => {
  const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')

  it('keeps 知识网 as the rail product entry and 我的知识 as the root page', () => {
    const btn = workspaceHtml.match(/id="btnKnowledgeOs"[^>]*>[\s\S]*?<\/button>/)
    assert.ok(btn, 'btnKnowledgeOs exists')
    assert.match(btn[0], /title="知识网"/)
    assert.match(btn[0], /aria-label="知识网"/)
    assert.match(btn[0], /<span class="rail-label">知识网<\/span>/)
    assert.doesNotMatch(btn[0], /rail-label">知识库</)
  })

  it('opens the knowledge center as 我的知识 with task-oriented copy', () => {
    assert.match(workspaceJs, /openDrawer\(title \|\| '我的知识'/)
    assert.match(workspaceJs, /toast\('我的知识已打开'/)
    assert.match(workspaceJs, /function knowledgeBuildRootIndex/)
    assert.match(workspaceJs, /function knowledgeRootIndexHtml/)
    assert.match(workspaceJs, /node\.path === 'raw'\) return '资料'/)
    assert.match(workspaceJs, /node\.path === 'concepts'\) return '已整理知识'/)
    assert.doesNotMatch(workspaceJs, /knowledge-root-map-flow/)
    // 根 LLMWiki 两栏工作台：左资料树 + 右阅读；中文标签，无 Query/Ingest/Lint 运维术语
    const home = workspaceJs.slice(
      workspaceJs.indexOf('async function renderKnowledgeStatusWorkspace'),
      workspaceJs.indexOf('function renderLocalKnowledgeWorkspace')
    )
    assert.match(home, /llmwiki-workspace/)
    assert.match(home, /llmwiki-workbench/)
    assert.match(home, /knowledgeBrowserHtml/)
    assert.match(home, /id="kosReader"/)
    assert.match(home, /id="llmwikiAddMaterial"/)
    assert.doesNotMatch(home, /kosContext|llmwiki-context-pane/)
    assert.match(workspaceJs, /检查问题/)
    assert.match(workspaceJs, /Obsidian/)
    assert.doesNotMatch(home, /knowledge-ops-home/)
    assert.doesNotMatch(home, /Fabric|织网|authority/)
    assert.match(workspaceHtml, /\.llmwiki-workbench\s*\{/)
    assert.match(workspaceHtml, /grid-template-columns:272px minmax\(0,1fr\)/)
    assert.doesNotMatch(workspaceHtml, /\.llmwiki-context-pane/)
  })

  it('uses three user-facing primary tabs and keeps advanced terms out of them', () => {
    const tabs = workspaceJs.slice(
      workspaceJs.indexOf('const KNOWLEDGE_SURFACE_TABS'),
      workspaceJs.indexOf('const KNOWLEDGE_SURFACE_PRIMARY_TAB_IDS')
    )
    assert.match(tabs, /我的知识/)
    assert.match(tabs, /待我确认/)
    assert.match(tabs, /来源/)
    assert.doesNotMatch(tabs, /Fabric|织网|治理|OKF|Wiki/)
    assert.match(workspaceJs, /添加外部搜索来源/)
    assert.match(workspaceJs, /“我的知识”始终可用/)
    assert.match(workspaceJs, /资料保存在本机/)
    assert.match(workspaceJs, /知识库加载失败/)
    assert.match(workspaceJs, /window\.api\.knowledgeOsRead/)
    assert.match(workspaceJs, /window\.api\.knowledgeOsSaveRaw/)
    assert.match(workspaceJs, /knowledgeAddMaterial \|\| window\.api\.knowledgeOsIngest/)
    assert.match(workspaceJs, /knowledgeCheck \|\| window\.api\.knowledgeOsLint/)
    assert.doesNotMatch(workspaceJs, /openDrawer\(title \|\| '知识库'/)
  })
})
