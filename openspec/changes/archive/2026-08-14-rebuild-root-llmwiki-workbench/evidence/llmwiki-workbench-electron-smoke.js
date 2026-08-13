'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'llmwiki-workbench-electron-smoke.json')

function seedWiki(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(path.join(wikiDir, 'raw'), { recursive: true })
  fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'raw', 'desk-note.md'), '# 资料笔记\n\nsearch workbench knowledge\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'concepts', 'organized.md'), '# 已整理条目\n\n只读知识内容\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-llmwiki-workbench-'))
  seedWiki(userDataDir)
  const checks = []
  const consoleErrors = []
  const pageErrors = []
  let app

  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        KNOWME_TEST_SEAM: '1',
        KNOWME_TEST_USER_DATA_DIR: userDataDir,
      },
      timeout: 120000,
    })
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
    })
    window.on('pageerror', error => pageErrors.push(String(error?.message || error)))
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1200)
    await window.locator('#btnKnowledgeOs').click()
    await window.locator('.llmwiki-workbench').waitFor({ state: 'visible', timeout: 15000 })

    const home = await window.evaluate(() => {
      const workbench = document.querySelector('.llmwiki-workbench')
      return {
        tree: !!document.querySelector('.llmwiki-tree-pane .knowledge-tree'),
        reader: !!document.querySelector('.llmwiki-reader-pane#kosReader'),
        context: !!document.querySelector('.llmwiki-context-pane#kosContext'),
        add: !!document.getElementById('llmwikiAddMaterial'),
        refresh: !!document.getElementById('kosRefresh'),
        lint: !!document.getElementById('kosLint'),
        obsidian: !!document.getElementById('obsidianOpen'),
        bodyHeight: Math.round(workbench?.getBoundingClientRect().height || 0),
        text: workbench?.textContent || '',
        graphCanvas: !!document.querySelector('canvas[id*="Graph"], .knowledge-graph-canvas'),
      }
    })
    checks.push({
      id: 'root-workbench-has-three-panes',
      pass: home.tree && home.reader && home.context && home.add && home.refresh && home.lint && home.obsidian && home.bodyHeight > 250,
      detail: home,
    })
    checks.push({
      id: 'no-internal-graph-surface',
      pass: !home.graphCanvas && !/Fabric|织网|authority|Query|Ingest|Lint/.test(home.text),
      detail: { graphCanvas: home.graphCanvas },
    })

    await window.locator('#kosSearch').fill('desk-note')
    await window.locator('[data-path="raw/desk-note.md"]').waitFor({ state: 'visible', timeout: 15000 })
    await window.locator('[data-path="raw/desk-note.md"]').click()
    await window.locator('#kosRawEditor').waitFor({ state: 'visible', timeout: 15000 })
    const rawContext = await window.evaluate(() => ({
      path: document.querySelector('#kosContext')?.textContent || '',
      editor: !!document.getElementById('kosRawEditor'),
      preview: !!document.getElementById('kosRawPreview'),
    }))
    checks.push({
      id: 'raw-entry-opens-in-editor-with-context',
      pass: rawContext.editor && rawContext.preview && /raw\/desk-note\.md/.test(rawContext.path) && /可编辑/.test(rawContext.path),
      detail: rawContext,
    })

    await window.locator('#kosRawEditor').fill('# 资料笔记\n\nsearch workbench knowledge\n\n已修改')
    const dirty = await window.locator('#kosRawSaveState').textContent()
    checks.push({ id: 'raw-editor-exposes-unsaved-state', pass: /未保存/.test(dirty || ''), detail: { dirty } })
    await window.locator('#kosRawSave').click()
    await window.locator('#kosRawSaveState').waitFor({ state: 'visible', timeout: 15000 })
    const saved = await window.locator('#kosRawSaveState').textContent()
    checks.push({ id: 'raw-editor-safe-save-completes', pass: /已安全保存/.test(saved || ''), detail: { saved } })

    await window.locator('#kosSearch').fill('')
    await window.locator('[data-path="concepts/organized.md"]').click()
    await window.locator('#kosReader').getByText('已整理条目').first().waitFor({ state: 'visible', timeout: 15000 })
    const organized = await window.evaluate(() => ({
      editor: !!document.getElementById('kosRawEditor'),
      reader: document.querySelector('#kosReader')?.textContent || '',
      context: document.querySelector('#kosContext')?.textContent || '',
    }))
    checks.push({
      id: 'organized-entry-is-read-only',
      pass: !organized.editor && /只读知识内容/.test(organized.reader) && /已整理知识/.test(organized.context),
      detail: organized,
    })

    await window.screenshot({ path: path.join(SHOTS, 'llmwiki-workbench-desktop.png'), scale: 'css' })
    await window.setViewportSize({ width: 510, height: 820 })
    await window.waitForTimeout(300)
    const narrow = await window.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      tree: !!document.querySelector('.llmwiki-tree-pane'),
      reader: !!document.querySelector('.llmwiki-reader-pane'),
      context: !!document.querySelector('.llmwiki-context-pane'),
      contextTop: Math.round(document.querySelector('.llmwiki-context-pane')?.getBoundingClientRect().top || 0),
      readerTop: Math.round(document.querySelector('.llmwiki-reader-pane')?.getBoundingClientRect().top || 0),
    }))
    checks.push({
      id: 'narrow-layout-stacks-without-overflow',
      pass: narrow.bodyWidth <= narrow.viewport + 1 && narrow.tree && narrow.reader && narrow.context && narrow.contextTop > narrow.readerTop,
      detail: narrow,
    })
    await window.screenshot({ path: path.join(SHOTS, 'llmwiki-workbench-narrow.png'), scale: 'css' })
    checks.push({
      id: 'no-new-renderer-errors',
      pass: consoleErrors.length === 0 && pageErrors.length === 0,
      detail: { consoleErrors, pageErrors },
    })
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const passed = checks.filter(check => check.pass).length
  const report = {
    change: 'rebuild-root-llmwiki-workbench',
    at: new Date().toISOString(),
    passed,
    total: checks.length,
    ok: passed === checks.length,
    checks,
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
