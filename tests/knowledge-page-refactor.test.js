'use strict'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const knowledgeOs = require('../src/lib/knowledge-os')

describe('knowledge-page-refactor', () => {
  let userData
  let firstRoot
  let secondRoot

  before(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-kpr-user-'))
    firstRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-kpr-first-'))
    secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-kpr-second-'))
    fs.writeFileSync(path.join(firstRoot, 'first.md'), '# 第一知识根\n\nalpha-only\n', 'utf8')
    fs.writeFileSync(path.join(secondRoot, 'second.md'), '# 第二知识根\n\nbeta-only\n', 'utf8')
  })

  after(() => {
    for (const dir of [userData, firstRoot, secondRoot]) {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* cleanup */ }
    }
  })

  it('rebuilds the persisted index after the local wiki root changes', () => {
    const sources = [
      { id: 'first', type: 'local', rootPath: firstRoot },
      { id: 'second', type: 'local', rootPath: secondRoot },
    ]
    knowledgeOs.saveConfig(userData, { spaceSourceId: 'first', subDir: '' })
    const first = knowledgeOs.listEntries(userData, { sources })
    assert.ok(first.wiki.some(entry => entry.path === 'first.md'))

    knowledgeOs.saveConfig(userData, { spaceSourceId: 'second', subDir: '' })
    const second = knowledgeOs.listEntries(userData, { sources })
    assert.ok(second.wiki.some(entry => entry.path === 'second.md'))
    assert.ok(!second.wiki.some(entry => entry.path === 'first.md'))

    const stored = JSON.parse(fs.readFileSync(knowledgeOs.defaultPaths(userData).indexFile, 'utf8'))
    assert.equal(path.resolve(stored.wikiRoot), path.resolve(secondRoot))
    assert.equal(stored.version, 2)
  })

  it('ships the compact two-pane workspace, source modal, and tree browser', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    assert.match(html, /\.knowledge-grid\s*\{/)
    assert.match(html, /grid-template-columns:minmax\(250px,310px\) minmax\(340px,1fr\)/)
    assert.match(html, /@media \(max-width:720px\)/)
    assert.match(html, /\.knowledge-tree\s*\{/)
    assert.match(html, /\.knowledge-tree-row/)
    assert.match(js, /knowledgeEntryListHtml/)
    assert.match(js, /knowledgeBuildTree/)
    assert.match(js, /collapsedDirs/)
    assert.match(js, /data-kos-toggle-dir/)
    assert.match(js, /function knowledgeBrowserHtml/)
    assert.match(js, /renderHealthPanel/)
    assert.match(js, /function renderKnowledgeOrganizerWorkspace/)
    assert.match(js, /function renderKnowledgeReviewWorkspace/)
    assert.match(js, /knowledgeStewardTaskCreate/)
    assert.match(js, /knowledgeStewardProposalAccept/)
    assert.match(js, /开始 AI 整理/)
    assert.doesNotMatch(js, /D:\\\\workflows\\\\workbench\\\\server-src\\\\llm-wiki/)
    assert.match(js, /renderLocalConfigModal/)
    assert.match(js, /renderKnowledgeSourcesModal/)
    assert.match(js, /openKnowledgeModal/)
    assert.match(js, /knowledgeOsRefresh/)
    assert.doesNotMatch(js, /knowledgeGraphTreeHtml|knowledge-graph-tree/)
    assert.doesNotMatch(js, /knowledgeProviderNavHtml/)
    assert.match(js, /openFabricIngestModal/)
    assert.match(js, /knowledgeOsIngest/)
    assert.match(js, /renderKnowledgeFabricWorkspace/)
    assert.match(js, /renderKnowledgeRetrieveWorkspace/)
    assert.match(js, /renderObsidianBridgeModal/)
    assert.doesNotMatch(js, /mountKnowledgeGraph|knowledgeGraphViewHtml|requestAnimationFrame\(simulate\)/)
  })

  it('builds a nested directory tree and keeps ancestor folders while searching', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    assert.match(js, /function knowledgeBuildTree/)
    assert.match(js, /function knowledgeAncestorDirs/)
    assert.match(js, /keepPaths\.add\(item\.path\)/)
    assert.match(js, /knowledgeUi\.collapsedDirs/)
    assert.match(js, /refreshKnowledgeEntryList/)
    assert.match(js, /wireKnowledgeEntries/)
  })

  it('edits raw files in-app while keeping Obsidian as an optional handoff', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.match(js, /function renderKnowledgeRawEditor/)
    assert.match(js, /knowledgeOsSaveRaw/)
    assert.match(js, /expectedHash: currentHash/)
    assert.match(js, /stale_content/)
    assert.match(js, /async function loadKnowledgeHarnessStatus/)
    assert.match(js, /harness status unavailable/)
    assert.match(html, /\.knowledge-raw-editor-grid/)
    assert.match(html, /\.knowledge-raw-editor/)
    assert.match(js, /id="obsidianOpen"/)
    assert.match(js, /window\.api\.obsidianStatus/)
    assert.match(js, /window\.api\.obsidianOpen/)
    assert.match(js, /window\.api\.obsidianInstall/)
    assert.match(html, /\.obsidian-handoff/)
    assert.doesNotMatch(js, /knowledgeGraph|graphHash|ResizeObserver/)
    assert.doesNotMatch(html, /\.knowledge-graph-/)
  })

  it('renders the root LLMWiki workbench without ops hub marketing copy', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    const home = js.slice(js.indexOf('async function renderKnowledgeStatusWorkspace'), js.indexOf('function renderLocalKnowledgeWorkspace'))
    assert.match(home, /llmwiki-workspace/)
    assert.match(home, /llmwiki-workbench/)
    assert.match(home, /knowledgeBrowserHtml/)
    assert.match(home, /id="llmwikiAddMaterial"/)
    assert.match(home, /id="kosReader"/)
    assert.doesNotMatch(home, /id="kosContext"/)
    assert.match(js, /id="kosSearch"/)
    assert.match(js, /id="kosLint"/)
    assert.match(js, /id="kbSourcesOpen"/)
    assert.match(js, /id="obsidianOpen"/)
    assert.match(home, /id="llmwikiAddMaterial"/)
    assert.match(js, /检查问题/)
    assert.doesNotMatch(home, /knowledge-ops-home/)
    assert.doesNotMatch(home, /织网|Fabric governance|authority/)
    assert.match(html, /\.llmwiki-workbench\s*\{/)
    assert.match(html, /grid-template-columns:272px minmax\(0,1fr\)/)
    assert.doesNotMatch(html, /\.llmwiki-context-pane/)
    assert.doesNotMatch(js, /knowledgeGraphCanvas|buildLinkGraph|knowledge-graph/)
    assert.doesNotMatch(html, /knowledgeGraphCanvas|knowledge-graph-canvas/)
  })

  it('hardens fabric weave/search async buttons and no-hit empty state', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    assert.match(js, /function runAsyncKnowledgeButton/)
    assert.match(js, /button\.isConnected/)
    assert.match(js, /fabricSearchAttempted/)
    assert.match(js, /未找到相关知识/)
    assert.match(js, /data-fabric-no-hit/)
    assert.match(js, /fabricHitRowsHtml\(knowledgeUi\.fabricHits, \{ searched: true \}\)/)
    assert.match(js, /runAsyncKnowledgeButton\(btn, \{ busyLabel: '织网中…'/)
    assert.match(js, /title="权威级 \$\{auth\}\/5"/)
  })

  it('keeps the first-touch component available without bypassing the workbench', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.match(js, /function renderKnowledgeEmptyWelcome/)
    const status = js.slice(js.indexOf('async function renderKnowledgeStatusWorkspace'), js.indexOf('function renderLocalKnowledgeWorkspace'))
    assert.doesNotMatch(status, /renderKnowledgeEmptyWelcome\(\)/)
    assert.match(js, /把资料放进来，AI 帮你理成能查的知识/)
    assert.match(js, /添加第一份资料/)
    assert.match(js, /async function saveKnowledgeMaterial/)
    assert.match(js, /function renderKnowledgeFirstTouchDone/)
    assert.match(js, /要我把它整理成知识吗/)
    assert.match(js, /id="firstTouchOrganize"/)
    assert.match(js, /openKnowledgeOsPanel\(undefined, 'organize'\)/)
    assert.match(js, /id="firstTouchConnect"/)
    assert.match(html, /\.knowledge-firsttouch\s*\{/)
    const welcome = js.slice(js.indexOf('function renderKnowledgeEmptyWelcome'), js.indexOf('async function renderKnowledgeStatusWorkspace'))
    assert.doesNotMatch(welcome, /Query|Ingest|Lint|LLM Wiki|qmd|raw\//)
  })

  it('escapes Markdown before applying lightweight formatting', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const renderer = js.slice(js.indexOf('function renderKnowledgeMarkdown'), js.indexOf('function knowledgeEntryListHtml'))
    assert.match(renderer, /const inline = text => esc\(text\)/)
    assert.doesNotMatch(renderer, /innerHTML\s*=\s*src/)
  })

  it('exposes review IPC without allowing the renderer to write files directly', () => {
    const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
    assert.match(preload, /knowledgeStewardTaskCreate/)
    assert.match(preload, /knowledgeStewardTaskCancel/)
    assert.match(preload, /knowledgeStewardProposalAccept/)
    assert.match(preload, /knowledgeStewardProposalReject/)
    assert.match(preload, /knowledgeOsHarnessStatus/)
    assert.match(preload, /knowledgeOsSaveRaw/)
    assert.match(preload, /knowledgeSearch/)
    assert.match(preload, /knowledgeAddMaterial/)
    assert.match(preload, /knowledgeCheck/)
    const knowledgeOsIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'knowledge-os.js'), 'utf8')
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('knowledge-os-harness-status'/)
    assert.match(knowledgeOsIpc, /ipcMain\.handle\('knowledge-os-save-raw'/)
    assert.match(knowledgeOsIpc, /llmwikiService\.query/)
    assert.match(knowledgeOsIpc, /llmwikiService\.ingest/)
    assert.match(knowledgeOsIpc, /llmwikiService\.lint/)
    assert.match(knowledgeOsIpc, /llmwikiService\.saveRaw/)
    assert.match(main, /registerCoreIpc/)
    assert.doesNotMatch(preload, /require\(['"]fs['"]\)/)
  })

})
