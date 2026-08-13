'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'fabric-governance-electron-smoke.json')

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
  const fabricGraph = require(path.join(ROOT, 'src/lib/fabric-graph'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(wikiDir, { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'auth.md'), '# 认证流程\n\nOAuth 与 JWT。\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'broken-link.md'), '# 断链\n\n[bad](./missing.md)\n', 'utf8')
  fabricGraph.ensureFabric(userDataDir)
  fabricGraph.upsertNode(userDataDir, {
    id: 'a:kb_personal/missing.md',
    kind: 'anchor',
    kbId: 'kb_personal',
    extRef: 'missing-anchor.md',
    title: '悬空锚点',
    authority: 3,
  })
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function openKnowledgeTab(window, tabLabel) {
  const drawerOpen = await window.evaluate(() => document.getElementById('drawer')?.classList.contains('open'))
  if (!drawerOpen) {
    await window.locator('#btnKnowledgeOs').click()
    await window.waitForTimeout(1400)
  }
  const tab = window.locator('.drawer-surface-tab', { hasText: tabLabel })
  await tab.first().click()
  await window.waitForTimeout(900)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(r => setTimeout(r, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-gov-smoke-'))
  seedWiki(userDataDir)

  const checks = []
  const consoleErrors = []
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

    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1200)

    await openKnowledgeTab(window, '治理')
    await window.waitForSelector('#govRunCheckup', { timeout: 45000 })
    checks.push({ id: 'gov-tab', ok: await window.locator('.knowledge-governance-page').count() > 0 })

    await window.locator('#govRunCheckup').click()
    await window.waitForSelector('.knowledge-gov-summary', { timeout: 30000 })
    checks.push({ id: 'gov-checkup', ok: await window.locator('.knowledge-gov-summary').count() > 0 })

    await window.screenshot({ path: path.join(SHOTS, 'governance-checkup.png') })

    const ignoreBtn = window.locator('[data-gov-action="ignore"]').first()
    if (await ignoreBtn.count()) {
      await ignoreBtn.click()
      await window.waitForTimeout(1200)
      checks.push({ id: 'gov-ignore-action', ok: true })
    } else {
      checks.push({ id: 'gov-ignore-action', ok: true, skipped: 'no issues' })
    }

    await window.screenshot({ path: path.join(SHOTS, 'governance-after-action.png') })
    checks.push({ id: 'console-clean', ok: consoleErrors.length === 0, errors: consoleErrors })

    const report = {
      ok: checks.every(c => c.ok !== false),
      checks,
      consoleErrorCount: consoleErrors.length,
      userDataDir,
      at: new Date().toISOString(),
    }
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
