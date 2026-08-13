'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'fabric-knowledge-electron-smoke.json')

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
  fs.writeFileSync(path.join(wikiDir, 'ipc.md'), '# Electron IPC\n\nIPC 通信指南\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'notes-sync.md'), '# 便签同步\n\n桌面便签同步依赖 IPC 通道。\n', 'utf8')
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

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fabric-smoke-'))
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

    await openKnowledgeTab(window, '检索')
    await window.locator('#fabricSearchQ').fill('IPC')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1500)
    const search = await window.evaluate(() => ({
      hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
      routeText: document.getElementById('fabricRouteMeta')?.textContent || '',
    }))
    checks.push({ id: 'retrieve-tab-search-hits', pass: search.hitCount >= 1, detail: search })

    await window.locator('#fabricSearchQ').fill('xyznonexistentquery999')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1200)
    const noHit = await window.evaluate(() => ({
      hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
      emptyText: document.querySelector('[data-fabric-no-hit]')?.textContent?.trim() || '',
      hasActions: Boolean(document.getElementById('fabricNoHitIngest')),
    }))
    checks.push({
      id: 'retrieve-no-result-empty-state',
      pass: noHit.hitCount === 0 && /未找到相关知识/.test(noHit.emptyText) && noHit.hasActions,
      detail: noHit,
    })
    await window.screenshot({ path: path.join(SHOTS, 'knowledge-retrieve-no-hit.png'), scale: 'css' })

    await openKnowledgeTab(window, '织网')
    await window.locator('#fabricWeaveRun').click()
    await window.waitForFunction(
      () => document.querySelectorAll('[data-fabric-apply]').length >= 1,
      null,
      { timeout: 20000 }
    )
    const weaveBtn = await window.evaluate(() => {
      const b = document.getElementById('fabricWeaveRun')
      return { disabled: b?.disabled, text: b?.textContent?.trim() || '', pending: document.querySelectorAll('[data-fabric-apply]').length }
    })
    checks.push({
      id: 'weave-button-recovers-and-shows-proposal',
      pass: weaveBtn.disabled === false && weaveBtn.text === '织入当前库' && weaveBtn.pending >= 1,
      detail: weaveBtn,
    })
    await window.screenshot({ path: path.join(SHOTS, 'knowledge-weave-proposal.png'), scale: 'css' })

    await window.locator('[data-fabric-reject]').first().click()
    await window.waitForFunction(() => document.querySelectorAll('[data-fabric-apply]').length === 0, null, { timeout: 15000 })
    await window.waitForTimeout(500)

    await window.waitForFunction(
      () => {
        const b = document.getElementById('fabricWeaveRun')
        return b && !b.disabled && /织入当前库/.test(b.textContent || '')
      },
      null,
      { timeout: 15000 }
    )
    await window.locator('#fabricWeaveRun').click()
    await window.waitForFunction(() => document.querySelectorAll('[data-fabric-apply]').length >= 1, null, { timeout: 20000 })
    await window.locator('[data-fabric-apply]').first().click()
    await window.waitForTimeout(1800)
    const afterApply = await window.evaluate(() => ({
      pending: document.querySelectorAll('[data-fabric-apply]').length,
      anchors: Number(document.querySelectorAll('.fabric-stats strong')[1]?.textContent || 0),
    }))
    checks.push({
      id: 'weave-apply-closes-proposal-loop',
      pass: afterApply.pending === 0 && afterApply.anchors >= 1,
      detail: afterApply,
    })
    await window.screenshot({ path: path.join(SHOTS, 'knowledge-weave-applied.png'), scale: 'css' })

    checks.push({ id: 'console-clean', pass: consoleErrors.length === 0, detail: { consoleErrors } })
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const passed = checks.filter(c => c.pass).length
  const report = {
    change: 'establish-root-knowledge-fabric',
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

main().catch(err => {
  console.error(err)
  process.exit(1)
})
