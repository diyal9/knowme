'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-home-paths-electron-smoke.json')

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-home-paths-'))
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workbenchAuth: { endpoint: 'http://127.0.0.1:9' },
  }), 'utf8')

  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    checks: [],
    consoleErrors: [],
  }
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
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1360, height: 860 })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#wbGoalPaths').waitFor({ state: 'visible', timeout: 30000 })

    const homePaths = await window.evaluate(() => ({
      pipeline: Boolean(document.querySelector('[data-goal-path="pipeline"]')),
      agent: Boolean(document.querySelector('[data-goal-path="agent"]')),
      graph: Boolean(document.querySelector('[data-goal-path="graph"]')),
      legacyHidden: !document.querySelector('.wb-goal-legacy'),
    }))
    report.homePaths = homePaths
    report.checks.push({ id: 'home-three-paths', ok: homePaths.pipeline && homePaths.agent && homePaths.graph })
    report.checks.push({ id: 'legacy-removed', ok: homePaths.legacyHidden })

    await window.locator('#wbGoalInput').fill('调研资料并整理成可交付方案')
    await window.locator('#wbGoalSubmit').click()
    await window.locator('#wbGoalPathPicker:not([hidden])').waitFor({ state: 'visible', timeout: 15000 })

    const picker = await window.evaluate(() => ({
      recommendation: document.querySelector('#wbGoalPathRecommendation')?.textContent || '',
      graphContinue: Boolean(document.querySelector('[data-goal-path-continue="graph"]')),
    }))
    report.picker = picker
    report.checks.push({ id: 'goal-path-picker-visible', ok: picker.recommendation.includes('推荐') })
    report.checks.push({ id: 'graph-path-available', ok: picker.graphContinue })

    await window.locator('[data-goal-path-continue="pipeline"]').click()
    await window.locator('#wbFlowsPage.active').waitFor({ state: 'visible', timeout: 15000 })
    const flows = await window.evaluate(() => ({
      active: document.querySelector('#wbFlowsPage')?.classList.contains('active'),
      groups: Boolean(document.querySelector('#wbFlowLibraryGroups')),
    }))
    report.flows = flows
    report.checks.push({ id: 'pipeline-opens-flows', ok: flows.active && flows.groups })

    await window.locator('#wbTabFlows').click()

    await window.locator('#wbTabTeam').click()
    await window.locator('#wbTeamAssetsPanel').waitFor({ state: 'visible', timeout: 15000 })
    const assets = await window.evaluate(() => Boolean(document.querySelector('#wbTeamProfileAssets')))
    report.checks.push({ id: 'team-assets-panel', ok: assets })

    await window.screenshot({
      path: path.join(SHOTS, 'workbench-home-paths.png'),
      fullPage: false,
    })

    report.checks.push({ id: 'console-error-free', ok: report.consoleErrors.length === 0 })
    report.ok = report.checks.every(check => check.ok)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    if (!report.ok) throw new Error(`Electron smoke failed: ${JSON.stringify(report.checks)}`)
  } finally {
    await app?.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* Electron may release late */ }
  }
}

main().catch(error => {
  let existing = {}
  try { existing = JSON.parse(fs.readFileSync(REPORT, 'utf8')) } catch { /* no prior report */ }
  fs.writeFileSync(REPORT, `${JSON.stringify({
    ...existing,
    at: new Date().toISOString(),
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
