'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none running */ }
  }
}
const OUT = process.env.GAME_STUDIO_EVIDENCE
  ? path.resolve(process.env.GAME_STUDIO_EVIDENCE)
  : path.join(ROOT, 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon/evidence')
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'electron-uat-smoke.json')

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-uat-'))
  const report = {
    at: new Date().toISOString(),
    ok: false,
    userDataDir,
    consoleErrors: [],
    checks: [],
  }

  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    timeout: 120000,
  })

  const window = await app.firstWindow({ timeout: 90000 })
  window.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!/favicon|DevTools|Autofill/i.test(text)) report.consoleErrors.push(text)
    }
  })

  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(5000)

  const rail = window.locator('#btnRailAi')
  await rail.waitFor({ state: 'visible', timeout: 30000 })
  report.checks.push({ id: 'rail-visible', ok: await rail.isVisible() })

  const title = await window.title()
  report.checks.push({ id: 'window-title', ok: /KnowMe|知我/i.test(title), title })

  await window.screenshot({ path: path.join(SHOTS, 'electron-main-window.png'), fullPage: false })
  report.checks.push({ id: 'screenshot-main', ok: fs.existsSync(path.join(SHOTS, 'electron-main-window.png')) })

  const appShell = window.locator('#appShell')
  if (await appShell.count()) {
    report.checks.push({ id: 'app-shell', ok: true })
  }

  await window.locator('#btnRailWorkbench').click()
  await window.waitForTimeout(2500)
  const tracePanel = window.locator('[data-testid="wb-run-trace"]')
  await tracePanel.waitFor({ state: 'attached', timeout: 30000 })
  report.checks.push({ id: 'trace-panel-attached', ok: true })

  const traceSeed = await window.evaluate(async () => {
    if (!window.Workbench) return { ok: false, reason: 'no Workbench' }
    await window.Workbench.ensureLoaded()
    window.Workbench.openPage('tasks')
    const trace = window.Workbench.previewTaskTrace({
      context: {
        meta: {
          sceneId: 'game-dev',
          skillId: 'game-dev-delivery',
          connectors: ['feishu'],
          sources: ['feishu:docx:uat-probe'],
          handoffFrom: 'game-requirement',
        },
      },
      session: { id: 'uat-session', run: { id: 'uat-run' } },
      slug: `uat-trace-${Date.now()}`,
      workflow: 'demo-experience',
    })
    return { ok: Boolean(trace && trace.sceneId && trace.skillId), trace }
  })
  report.checks.push({ id: 'workbench-trace-seed', ok: traceSeed.ok, detail: traceSeed })

  const traceText = await tracePanel.innerText()
  const traceVisible = /game-dev/.test(traceText) && /game-dev-delivery/.test(traceText) && /feishu/.test(traceText)
  report.checks.push({ id: 'workbench-trace-visible', ok: traceVisible, sample: traceText.slice(0, 240) })

  await window.screenshot({ path: path.join(SHOTS, 'electron-workbench-trace.png'), fullPage: false })
  report.checks.push({
    id: 'screenshot-trace',
    ok: fs.existsSync(path.join(SHOTS, 'electron-workbench-trace.png')),
  })

  report.ok = report.checks.every(item => item.ok) && report.consoleErrors.length === 0
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  await app.close()
  if (!report.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
