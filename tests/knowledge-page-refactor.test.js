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
    assert.match(js, /renderLocalConfigModal/)
    assert.match(js, /renderKnowledgeSourcesModal/)
    assert.match(js, /openKnowledgeModal/)
    assert.match(js, /knowledgeOsRefresh/)
    assert.doesNotMatch(js, /knowledgeGraphTreeHtml|knowledge-graph-tree/)
    assert.doesNotMatch(js, /knowledgeProviderNavHtml/)
    assert.doesNotMatch(js, /吸收资料|renderIngestPanel|kosIngestOpen/)
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

  it('hands editing to Obsidian without shipping an embedded graph renderer', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.match(js, /id="obsidianOpen"/)
    assert.match(js, /window\.api\.obsidianStatus/)
    assert.match(js, /window\.api\.obsidianOpen/)
    assert.match(js, /window\.api\.obsidianInstall/)
    assert.match(html, /\.obsidian-handoff/)
    assert.doesNotMatch(js, /knowledgeGraph|graphHash|ResizeObserver/)
    assert.doesNotMatch(html, /\.knowledge-graph-/)
  })

  it('escapes Markdown before applying lightweight formatting', () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
    const renderer = js.slice(js.indexOf('function renderKnowledgeMarkdown'), js.indexOf('function knowledgeEntryListHtml'))
    assert.match(renderer, /const inline = text => esc\(text\)/)
    assert.doesNotMatch(renderer, /innerHTML\s*=\s*src/)
  })

})
