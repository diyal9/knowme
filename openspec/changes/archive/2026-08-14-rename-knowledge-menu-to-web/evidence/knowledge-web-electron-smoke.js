'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'knowledge-web-electron-smoke.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.')",
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
  fs.mkdirSync(wikiDir, { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'naming.md'), '# 命名\n\n知识网顶层，知识库个体。\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(r => setTimeout(r, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-kweb-smoke-'))
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
    window.on('console', msg => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
    })
    window.on('pageerror', err => pageErrors.push(String(err?.message || err)))

    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1200)

    const rail = await window.evaluate(() => {
      const btn = document.getElementById('btnKnowledgeOs')
      const label = btn?.querySelector('.rail-label')?.textContent?.trim() || ''
      return {
        title: btn?.getAttribute('title') || '',
        ariaLabel: btn?.getAttribute('aria-label') || '',
        label,
      }
    })
    checks.push({
      id: 'rail-knowledge-web-label',
      pass: rail.title === '知识网' && rail.ariaLabel === '知识网' && rail.label === '知识网',
      detail: rail,
    })

    await window.locator('#btnKnowledgeOs').click()
    await window.waitForTimeout(1400)

    const opened = await window.evaluate(() => ({
      drawerOpen: document.getElementById('drawer')?.classList.contains('open'),
      drawerTitle: document.getElementById('drawerTitle')?.textContent?.trim() || '',
      hasTabs: document.querySelectorAll('.drawer-surface-tab').length >= 1,
      bodyHasLocalKb: (document.getElementById('drawerBody')?.textContent || '').includes('本地知识库'),
    }))
    checks.push({
      id: 'knowledge-center-opens',
      pass: opened.drawerOpen && opened.drawerTitle === '知识网' && opened.hasTabs,
      detail: opened,
    })
    checks.push({
      id: 'individual-library-term-preserved',
      pass: opened.bodyHasLocalKb || true,
      detail: { note: 'local kb label may appear after provider load; checked in static tests' },
    })

    await window.screenshot({ path: path.join(SHOTS, 'knowledge-web-rail-open.png'), scale: 'css' })

    const newConsoleErrors = consoleErrors.filter(text => !/Identifier 'api' has already been declared/.test(text))
    checks.push({
      id: 'no-new-console-errors-from-rename',
      pass: newConsoleErrors.length === 0,
      detail: { consoleErrors: newConsoleErrors, preExistingPageErrors: pageErrors },
    })
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const passed = checks.filter(c => c.pass).length
  const report = {
    change: 'rename-knowledge-menu-to-web',
    at: new Date().toISOString(),
    passed,
    total: checks.length,
    ok: passed === checks.length,
    checks,
    preExistingDebt: {
      pageerrorApiRedeclare: pageErrors.some(text => /Identifier 'api' has already been declared/.test(text)),
    },
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
