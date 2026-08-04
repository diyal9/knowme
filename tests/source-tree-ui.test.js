/**
 * 内容源层级文件树与点击预览静态接线回归
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

describe('source file tree UI', () => {
  it('renders directories and file names as a hierarchy', () => {
    assert.match(workspace, /data-src-dir="\$\{esc\(node\.path\)\}"/)
    assert.match(workspace, /data-icon="folder"/)
    assert.match(workspace, /class="file-name">\$\{esc\(node\.name\)\}<\/span>/)
    assert.match(workspace, /sourceAncestorPaths\(node\.path\)/)
    assert.match(workspace, /sourceCollapsed\.has\(sourceDirKey\(src\.id,\s*path\)\)/)
  })

  it('toggles directories without opening a file', () => {
    assert.match(workspace, /data-source-pick="\$\{esc\(s\.id\)\}"/)
    assert.match(workspace, /closest\('\[data-source-pick\]'\)/)
    assert.match(workspace, /const sourceDir = e\.target\.closest\('\[data-src-dir\]'\)/)
    assert.match(workspace, /sourceCollapsed\.(?:has|delete|add)\(key\)/)
    assert.match(workspace, /sourceDir\.dataset\.srcDir/)
    assert.match(workspace, /sourceCollapsed:\s*\[\.\.\.sourceCollapsed\]/)
  })

  it('reveals the editor preview when a source file opens', () => {
    assert.match(workspace, /function openFsFile[\s\S]*?if \(workbenchOn\)[\s\S]*?applyWorkbench\(\)/)
    assert.match(workspace, /type:\s*'load-fs-file'/)
    assert.match(html, /\.source-dir\.open \.tree-twist \.chev/)
  })

  it('lazy-loads directory children on expand', () => {
    assert.match(workspace, /sourcesTreeChildren/)
    assert.match(workspace, /ensureSourceDirLoaded/)
    assert.match(workspace, /mergeSourceChildren/)
    assert.match(workspace, /sourceLoadedDirs/)
  })
})
