'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'knowledge-two-pane-electron-smoke.json')

function seedWiki(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(path.join(wikiDir, 'raw'), { recursive: true })
  fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'raw', 'desk-note.md'), '# 资料笔记\n\n左树右阅读的两栏版式\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'concepts', 'organized.md'), '# 已整理条目\n\n只读知识内容\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-two-pane-'))
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

    const layout = await window.evaluate(() => {
      const workbench = document.querySelector('.llmwiki-workbench')
      const tree = document.querySelector('.llmwiki-tree-pane')
      const reader = document.querySelector('.llmwiki-reader-pane#kosReader')
      const treeRect = tree?.getBoundingClientRect()
      const readerRect = reader?.getBoundingClientRect()
      return {
        columns: getComputedStyle(workbench).gridTemplateColumns.split(' ').length,
        context: !!document.querySelector('#kosContext, .llmwiki-context-pane'),
        treeLeftOfReader: !!treeRect && !!readerRect && treeRect.left < readerRect.left,
        readerWider: Math.round(readerRect?.width || 0) > Math.round(treeRect?.width || 0),
        readerWidth: Math.round(readerRect?.width || 0),
        rootLine: document.querySelector('.knowledge-root')?.textContent?.trim() || '',
      }
    })
    checks.push({
      id: 'knowledge-home-has-two-panes',
      pass: layout.columns === 2 && !layout.context && layout.treeLeftOfReader && layout.readerWider,
      detail: layout,
    })
    checks.push({
      id: 'topbar-does-not-print-absolute-path',
      pass: !/[A-Za-z]:\\|\/knowledge-os\//.test(layout.rootLine) && layout.rootLine.length > 0,
      detail: { rootLine: layout.rootLine },
    })

    await window.locator('[data-path="concepts/organized.md"]').click()
    await window.locator('#kosReader').getByText('已整理条目').first().waitFor({ state: 'visible', timeout: 15000 })
    const readOnly = await window.evaluate(() => ({
      editor: !!document.getElementById('kosRawEditor'),
      head: document.querySelector('#kosReader .knowledge-doc-head')?.textContent || '',
      organize: !!document.getElementById('kosDocOrganize'),
      review: !!document.getElementById('kosDocReview'),
      body: document.querySelector('#kosReader .knowledge-markdown')?.textContent || '',
    }))
    checks.push({
      id: 'read-only-entry-keeps-metadata-and-actions-in-doc-head',
      pass: !readOnly.editor
        && /concepts\/organized\.md/.test(readOnly.head)
        && /只读阅读/.test(readOnly.head)
        && readOnly.organize
        && readOnly.review
        && /只读知识内容/.test(readOnly.body),
      detail: readOnly,
    })

    await window.locator('[data-path="raw/desk-note.md"]').click()
    await window.locator('#kosRawEditor').waitFor({ state: 'visible', timeout: 15000 })
    const rawHead = await window.evaluate(() => ({
      health: !!document.getElementById('kosDocHealth'),
      preview: !!document.getElementById('kosRawPreview'),
      docWidth: Math.round(document.querySelector('.knowledge-raw-document')?.getBoundingClientRect().width || 0),
    }))
    checks.push({
      id: 'raw-entry-gets-wide-editor-and-check-action',
      pass: rawHead.health && rawHead.preview && rawHead.docWidth > 620,
      detail: rawHead,
    })

    await window.locator('#kosRawEditor').fill('# 资料笔记\n\n左树右阅读的两栏版式\n\n已修改')
    const dirty = await window.locator('#kosRawSaveState').textContent()
    await window.locator('#kosRawSave').click()
    await window.waitForTimeout(400)
    const saved = await window.locator('#kosRawSaveState').textContent()
    checks.push({
      id: 'raw-safe-save-still-works',
      pass: /未保存/.test(dirty || '') && /已安全保存/.test(saved || ''),
      detail: { dirty, saved },
    })

    await window.screenshot({ path: path.join(SHOTS, 'knowledge-two-pane-desktop.png'), scale: 'css' })
    await window.setViewportSize({ width: 510, height: 820 })
    await window.waitForTimeout(400)
    const narrow = await window.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      bodyWidth: document.body.scrollWidth,
      treeTop: Math.round(document.querySelector('.llmwiki-tree-pane')?.getBoundingClientRect().top || 0),
      readerTop: Math.round(document.querySelector('.llmwiki-reader-pane')?.getBoundingClientRect().top || 0),
    }))
    checks.push({
      id: 'narrow-layout-stacks-without-overflow',
      pass: narrow.bodyWidth <= narrow.viewport + 1 && narrow.readerTop > narrow.treeTop,
      detail: narrow,
    })
    await window.screenshot({ path: path.join(SHOTS, 'knowledge-two-pane-narrow.png'), scale: 'css' })
    checks.push({
      id: 'no-renderer-errors-in-knowledge-flow',
      pass: consoleErrors.length === 0 && pageErrors.length === 0,
      detail: { consoleErrors, pageErrors },
    })
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const passed = checks.filter(check => check.pass).length
  const report = {
    change: 'simplify-knowledge-reading-layout',
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
