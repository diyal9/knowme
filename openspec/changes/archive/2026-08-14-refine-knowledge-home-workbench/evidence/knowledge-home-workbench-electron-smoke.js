'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'knowledge-home-workbench-electron-smoke.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.' )",
    "}",
    '$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique',
    'if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }',
  ].join(' ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch { /* no process */ }
}

function seedWiki(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(path.join(wikiDir, 'raw'), { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'raw', 'desk-note.md'), '# 资料笔记\n\nsearch workbench knowledge\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(resolve => setTimeout(resolve, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-desk-home-'))
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
    await window.locator('#knowledgeHomeSearchInput').waitFor({ state: 'visible', timeout: 15000 })

    const home = await window.evaluate(() => ({
      title: document.getElementById('drawerTitle')?.textContent?.trim() || '',
      search: !!document.getElementById('knowledgeHomeSearchInput'),
      add: !!document.getElementById('statusAddMaterial'),
      lint: !!document.getElementById('statusHealth'),
      browse: !!document.getElementById('statusBrowse'),
      obsidian: !!document.getElementById('statusOpenObsidian'),
      tree: !!document.querySelector('.knowledge-desk-tree .knowledge-index-tree'),
      graphCanvas: !!document.querySelector('canvas[id*="Graph"], .knowledge-graph-canvas'),
      text: document.querySelector('.knowledge-desk-home')?.textContent || '',
      hasHero: !!document.querySelector('.knowledge-desk-home h1'),
    }))
    checks.push({
      id: 'search-first-desk-home',
      pass: home.search && home.add && home.lint && home.browse && home.obsidian && home.tree && !home.hasHero,
      detail: home,
    })
    checks.push({
      id: 'no-internal-ops-terms',
      pass: !/Query|Ingest|Lint|Fabric|织网|authority/.test(home.text),
      detail: { sample: home.text.slice(0, 240) },
    })
    checks.push({
      id: 'obsidian-labeled-no-canvas',
      pass: home.obsidian && /Obsidian/.test(home.text) && !home.graphCanvas,
      detail: { obsidian: home.obsidian, graphCanvas: home.graphCanvas },
    })

    await window.locator('#knowledgeHomeSearchInput').fill('search')
    await window.locator('#knowledgeHomeSearch').evaluate(form => form.requestSubmit())
    await window.locator('.knowledge-desk-retrieval, .knowledge-home-hit-list, .knowledge-result').first().waitFor({ state: 'visible', timeout: 30000 })
    const retrieval = await window.evaluate(() => ({
      engine: document.querySelector('.knowledge-desk-retrieval strong')?.textContent?.trim() || '',
      hitCount: document.querySelectorAll('[data-home-knowledge-path]').length,
    }))
    checks.push({
      id: 'query-shows-user-facing-engine',
      pass: /智能检索|本地检索/.test(retrieval.engine) && retrieval.hitCount >= 1,
      detail: retrieval,
    })

    await window.screenshot({ path: path.join(SHOTS, 'knowledge-desk-home-desktop.png'), scale: 'css' })
    await window.setViewportSize({ width: 510, height: 820 })
    await window.waitForTimeout(300)
    const narrow = await window.evaluate(() => {
      const desk = document.querySelector('.knowledge-desk-home')
      const toolbar = document.querySelector('.knowledge-desk-toolbar')
      return {
        viewport: document.documentElement.clientWidth,
        bodyWidth: document.body.scrollWidth,
        deskWidth: Math.round(desk?.getBoundingClientRect().width || 0),
        toolbarVisible: !!toolbar && toolbar.getBoundingClientRect().width > 0,
      }
    })
    checks.push({
      id: 'narrow-layout-no-horizontal-overflow',
      pass: narrow.bodyWidth <= narrow.viewport + 1 && narrow.toolbarVisible,
      detail: narrow,
    })
    await window.screenshot({ path: path.join(SHOTS, 'knowledge-desk-home-narrow.png'), scale: 'css' })

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
    change: 'refine-knowledge-home-workbench',
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
