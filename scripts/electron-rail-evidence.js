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
    } catch { /* none */ }
  }
}

async function capture(changeName, steps) {
  const evidence = path.join(ROOT, 'openspec/changes', changeName, 'evidence')
  const shots = path.join(evidence, 'screenshots')
  fs.mkdirSync(shots, { recursive: true })
  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `km-${changeName}-`))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(4000)
  const report = { at: new Date().toISOString(), change: changeName, shots: [], checks: [] }
  for (const step of steps) {
    if (step.click) await window.locator(step.click).click()
    if (step.waitMs) await window.waitForTimeout(step.waitMs)
    if (step.check) {
      const ok = await window.locator(step.check).isVisible()
      report.checks.push({ id: step.id || step.check, ok })
    }
    if (step.file) {
      const target = path.join(shots, step.file)
      await window.screenshot({ path: target, fullPage: false })
      report.shots.push(step.file)
      report.checks.push({ id: `shot-${step.file}`, ok: fs.existsSync(target) })
    }
  }
  report.ok = report.checks.every(item => item.ok)
  fs.writeFileSync(path.join(evidence, 'electron-evidence.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await app.close()
  if (!report.ok) process.exit(1)
}

async function main() {
  const change = process.argv[2]
  if (change === 'align-capability-hub-tabs') {
    await capture(change, [
      { click: '#btnRailCapabilities', waitMs: 3000, check: '.drawer-capability-tabs', id: 'hub-open', file: 'electron-hub-outer-topbar.png' },
    ])
    return
  }
  if (change === 'swap-automation-capability-rail-order') {
    await capture(change, [
      { check: '#btnRailWorkbench', id: 'rail-workbench', file: 'electron-rail-order.png' },
    ])
    return
  }
  console.error('Usage: node scripts/electron-rail-evidence.js <align-capability-hub-tabs|swap-automation-capability-rail-order>')
  process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
