'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'llmwiki-ops-hub-electron-smoke.json')

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
  fs.writeFileSync(path.join(wikiDir, 'raw', 'llmwiki.md'), '# LLM Wiki\n\nqmd query ingest lint knowledge\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(resolve => setTimeout(resolve, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-llmwiki-hub-'))
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
    await window.locator('#statusFocusQuery').waitFor({ state: 'visible', timeout: 15000 })

    const hub = await window.evaluate(() => ({
      title: document.getElementById('drawerTitle')?.textContent?.trim() || '',
      query: !!document.getElementById('statusFocusQuery'),
      ingest: !!document.getElementById('statusAddMaterial'),
      lint: !!document.getElementById('statusHealth'),
      obsidian: !!document.getElementById('statusOpenObsidian'),
      graphCanvas: !!document.querySelector('canvas[id*="Graph"], .knowledge-graph-canvas'),
      text: document.querySelector('.knowledge-ops-home')?.textContent || '',
    }))
    checks.push({
      id: 'llmwiki-three-action-hub',
      pass: hub.query && hub.ingest && hub.lint && /Query/.test(hub.text) && /Ingest/.test(hub.text) && /Lint/.test(hub.text),
      detail: hub,
    })
    checks.push({
      id: 'obsidian-is-graph-handoff',
      pass: hub.obsidian && !hub.graphCanvas && /关系图谱交给 Obsidian/.test(hub.text),
      detail: { obsidian: hub.obsidian, graphCanvas: hub.graphCanvas },
    })

    await window.locator('#knowledgeHomeSearchInput').fill('qmd')
    await window.locator('#knowledgeHomeSearch').evaluate(form => form.requestSubmit())
    await window.locator('.knowledge-ops-engine').waitFor({ state: 'visible', timeout: 30000 })
    const retrieval = await window.evaluate(() => ({
      engine: document.querySelector('.knowledge-ops-engine strong')?.textContent?.trim() || '',
      hitCount: document.querySelectorAll('[data-home-knowledge-path]').length,
    }))
    checks.push({
      id: 'query-shows-actual-engine',
      pass: /qmd 结构化检索|本地检索/.test(retrieval.engine) && retrieval.hitCount >= 1,
      detail: retrieval,
    })

    await window.screenshot({ path: path.join(SHOTS, 'llmwiki-ops-hub-desktop.png'), scale: 'css' })
    await window.setViewportSize({ width: 510, height: 820 })
    await window.waitForTimeout(300)
    const narrow = await window.evaluate(() => {
      const home = document.querySelector('.knowledge-ops-home')
      const actions = document.querySelector('.knowledge-ops-actions')
      return {
        viewport: document.documentElement.clientWidth,
        bodyWidth: document.body.scrollWidth,
        homeWidth: Math.round(home?.getBoundingClientRect().width || 0),
        actionColumns: actions ? getComputedStyle(actions).gridTemplateColumns : '',
      }
    })
    checks.push({
      id: 'narrow-layout-no-horizontal-overflow',
      pass: narrow.bodyWidth <= narrow.viewport + 1 && !narrow.actionColumns.includes(' '),
      detail: narrow,
    })
    await window.screenshot({ path: path.join(SHOTS, 'llmwiki-ops-hub-narrow.png'), scale: 'css' })

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
    change: 'llmwiki-ops-hub',
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
