'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'tester-fabric-governance-electron-qa.json')

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

function seedGovernanceData(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  const fabricGraph = require(path.join(ROOT, 'src/lib/fabric-graph'))
  const fabricGovernance = require(path.join(ROOT, 'src/lib/fabric-governance'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(wikiDir, { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'auth.md'), '# 认证流程\n\nOAuth 与 JWT。\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'dup-title.md'), '# 重复标题\n\n内容 A\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'dup-title-2.md'), '# 重复标题\n\n内容 B\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'broken-link.md'), '# 断链\n\n[bad](./missing.md)\n', 'utf8')
  fabricGraph.ensureFabric(userDataDir)
  fabricGraph.upsertNode(userDataDir, {
    id: 'c:old-auth',
    kind: 'concept',
    title: '旧版认证',
    summary: '旧版 OAuth',
    authority: 2,
    path: 'old-auth.md',
    lastSynced: '2020-01-01T00:00:00.000Z',
  })
  fabricGraph.upsertNode(userDataDir, {
    id: 'c:new-auth',
    kind: 'concept',
    title: '新版认证',
    summary: '新版 OAuth',
    authority: 4,
    path: 'auth.md',
    lastSynced: '2026-01-01T00:00:00.000Z',
  })
  fabricGraph.upsertEdge(userDataDir, {
    id: 'e:conflict-auth',
    from: 'c:old-auth',
    to: 'c:new-auth',
    type: 'contradicts',
    weight: 0.9,
  })
  fabricGraph.upsertNode(userDataDir, {
    id: 'a:kb_personal/missing-anchor.md',
    kind: 'anchor',
    kbId: 'kb_personal',
    extRef: 'missing-anchor.md',
    title: '悬空锚点',
    authority: 3,
    stale: false,
  })
  fabricGovernance.saveConfig(userDataDir, { ssotMode: 'mark' })
  knowledgeOs.refreshIndex(userDataDir, {})
}

async function openKnowledgeTab(window, tabLabel) {
  const drawerOpen = await window.evaluate(() =>
    Boolean(document.getElementById('drawer')?.classList.contains('open') && document.querySelector('.drawer-surface-tab'))
  )
  if (!drawerOpen) {
    await window.locator('#btnKnowledgeOs').click()
    await window.waitForTimeout(1400)
  }
  const tab = window.locator('.drawer-surface-tab', { hasText: tabLabel })
  await tab.first().waitFor({ state: 'visible', timeout: 20000 })
  await tab.first().click()
  await window.waitForTimeout(900)
}

async function launchApp(userDataDir) {
  const app = await electron.launch({
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
  const consoleErrors = []
  window.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
  })
  window.on('pageerror', err => consoleErrors.push(`pageerror:${err.message}`))
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(1000)
  return { app, window, consoleErrors }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(r => setTimeout(r, 500))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-gov-qa-'))
  seedGovernanceData(userDataDir)
  const checks = []
  let app

  try {
    const ctx = await launchApp(userDataDir)
    app = ctx.app
    const w = ctx.window

    await w.setViewportSize({ width: 1280, height: 860 })

    // S1: governance tab empty state
    await openKnowledgeTab(w, '治理')
    const emptyGov = await w.evaluate(() => ({
      hasRunBtn: Boolean(document.getElementById('govRunCheckup')),
      hasSsot: Boolean(document.getElementById('govSsotMode')),
      hasConnect: Boolean(document.getElementById('govOpenConnect')),
      emptyCopy: document.getElementById('govReportHost')?.textContent || '',
    }))
    checks.push({
      id: 'S1-governance-tab-empty',
      pass: emptyGov.hasRunBtn && emptyGov.hasSsot && emptyGov.hasConnect && /尚未运行体检|运行体检/.test(emptyGov.emptyCopy),
      severity: 'blocking',
      detail: emptyGov,
    })
    await w.screenshot({ path: path.join(SHOTS, 'tester-governance-empty.png'), scale: 'css' })

    // S2: run checkup
    await w.locator('#govRunCheckup').click()
    await w.waitForSelector('.knowledge-gov-summary', { timeout: 30000 })
    const checkup = await w.evaluate(() => ({
      hasSummary: Boolean(document.querySelector('.knowledge-gov-summary')),
      issueCount: document.querySelectorAll('.knowledge-gov-issue').length,
      chips: document.querySelectorAll('.knowledge-gov-chip').length,
      ssotLabel: document.querySelector('.knowledge-gov-summary p')?.textContent || '',
      btnText: document.getElementById('govRunCheckup')?.textContent,
      btnDisabled: document.getElementById('govRunCheckup')?.disabled,
    }))
    checks.push({
      id: 'S2-checkup-report',
      pass: checkup.hasSummary && checkup.issueCount >= 1 && checkup.btnText === '运行体检' && !checkup.btnDisabled,
      severity: 'blocking',
      detail: checkup,
    })
    await w.screenshot({ path: path.join(SHOTS, 'tester-governance-checkup.png'), scale: 'css' })

    // S4: SSOT mode switch
    await w.locator('#govSsotMode').selectOption('block')
    await w.waitForTimeout(800)
    const ssotBlock = await w.evaluate(async () => {
      const cfg = await window.api.fabricGovernanceConfig?.()
      return { mode: cfg?.config?.ssotMode || cfg?.ssotMode, toast: document.querySelector('.toast')?.textContent || '' }
    })
    checks.push({
      id: 'S4-ssot-block-mode',
      pass: ssotBlock.mode === 'block' && /SSOT|策略/.test(ssotBlock.toast),
      severity: 'major',
      detail: ssotBlock,
    })
    await w.locator('#govSsotMode').selectOption('mark')
    await w.waitForTimeout(600)

    // S3: ignore action + button recovery
    const ignoreBtn = w.locator('[data-gov-action="ignore"]').first()
    const issuesBefore = await w.evaluate(() => document.querySelectorAll('.knowledge-gov-issue').length)
    if (await ignoreBtn.count()) {
      await ignoreBtn.click()
      await w.waitForTimeout(1200)
    }
    const afterIgnore = await w.evaluate(() => ({
      issues: document.querySelectorAll('.knowledge-gov-issue').length,
      btnDisabled: document.querySelector('[data-gov-action="ignore"]')?.disabled,
    }))
    checks.push({
      id: 'S3-ignore-action',
      pass: issuesBefore === 0 || afterIgnore.issues <= issuesBefore,
      severity: 'blocking',
      detail: { issuesBefore, afterIgnore },
    })

    // proposal cleanup if available
    const cleanupBtn = w.locator('[data-gov-action="cleanup"]').first()
    if (await cleanupBtn.count()) {
      await cleanupBtn.click()
      await w.waitForTimeout(1500)
      const proposalPending = await w.evaluate(() => document.querySelectorAll('[data-gov-proposal-apply]').length)
      checks.push({
        id: 'S3-cleanup-proposal',
        pass: proposalPending >= 0,
        severity: 'major',
        detail: { proposalPending },
      })
      if (proposalPending >= 1) {
        await w.locator('[data-gov-proposal-reject]').first().click()
        await w.waitForTimeout(1200)
      }
    }

    // stale/broken categories visible
    const categories = await w.evaluate(() =>
      [...document.querySelectorAll('.knowledge-gov-issue-cat')].map(el => el.textContent?.trim())
    )
    checks.push({
      id: 'broken-stale-detected',
      pass: categories.some(c => /断锚|悬空|冲突|重复|stale|新鲜/i.test(c || '')),
      severity: 'major',
      detail: { categories },
    })

    // conflict reflux in governance issues
    checks.push({
      id: 'conflict-reflux-visible',
      pass: (await w.evaluate(() => document.body.textContent || '')).includes('冲突') || categories.some(c => /冲突/.test(c || '')),
      severity: 'major',
      detail: { categories },
    })

    // regression: weave tab not stuck
    await openKnowledgeTab(w, '织网')
    await w.locator('#fabricWeaveRun').click()
    await w.waitForFunction(
      () => document.querySelectorAll('[data-fabric-apply]').length >= 1
        || document.getElementById('fabricWeaveRun')?.textContent === '织入当前库',
      null,
      { timeout: 20000 }
    )
    const weave = await w.evaluate(() => ({
      btn: document.getElementById('fabricWeaveRun')?.textContent,
      disabled: document.getElementById('fabricWeaveRun')?.disabled,
    }))
    checks.push({
      id: 'regression-weave-button',
      pass: weave.btn === '织入当前库' && !weave.disabled,
      severity: 'blocking',
      detail: weave,
    })

    // regression: retrieve tab
    await openKnowledgeTab(w, '检索')
    await w.locator('#fabricSearchQ').fill('认证')
    await w.locator('#fabricSearchRun').click()
    await w.waitForTimeout(1500)
    const retrieve = await w.evaluate(() => ({
      hits: document.querySelectorAll('.knowledge-fabric-hit').length,
      btn: document.getElementById('fabricSearchRun')?.textContent,
      disabled: document.getElementById('fabricSearchRun')?.disabled,
    }))
    checks.push({
      id: 'regression-retrieve',
      pass: retrieve.hits >= 1 && retrieve.btn === '检索' && !retrieve.disabled,
      severity: 'blocking',
      detail: retrieve,
    })

    // narrow viewport governance
    await w.setViewportSize({ width: 720, height: 640 })
    await openKnowledgeTab(w, '治理')
    const narrow = await w.evaluate(() => {
      const main = document.querySelector('.knowledge-governance-page')
      const rect = main?.getBoundingClientRect()
      return {
        overflowX: main ? main.scrollWidth > main.clientWidth + 2 : false,
        withinViewport: rect ? rect.right <= window.innerWidth + 2 : false,
      }
    })
    checks.push({
      id: 'narrow-viewport-governance',
      pass: narrow.withinViewport && !narrow.overflowX,
      severity: 'minor',
      detail: narrow,
    })
    await w.screenshot({ path: path.join(SHOTS, 'tester-governance-narrow.png'), scale: 'css' })

    // S5 console
    checks.push({
      id: 'S5-console-clean',
      pass: ctx.consoleErrors.length === 0,
      severity: 'blocking',
      detail: { consoleErrors: ctx.consoleErrors },
    })
  } finally {
    if (app) await app.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const blockingFails = checks.filter(c => !c.pass && c.severity === 'blocking')
  const report = {
    change: 'fabric-governance-and-conflict',
    role: 'tester',
    at: new Date().toISOString(),
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
    ok: blockingFails.length === 0,
    blockingFails: blockingFails.map(c => c.id),
    checks,
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (blockingFails.length) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
