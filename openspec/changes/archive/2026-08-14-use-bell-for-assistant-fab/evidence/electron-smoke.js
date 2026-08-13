'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const SHOTS = path.join(__dirname, 'screenshots')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killKnowMeProcesses()
  await new Promise(resolve => setTimeout(resolve, 1200))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-bell-fab-'))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  const pageErrors = []
  const consoleErrors = []
  window.on('pageerror', error => pageErrors.push(error?.message || String(error)))
  window.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(4000)
  const fab = window.locator('#km-fab-btn')
  await fab.waitFor({ state: 'visible', timeout: 30000 })

  const check = await window.evaluate(() => {
    const button = document.getElementById('km-fab-btn')
    const bell = button?.querySelector('.km-fab-bell')
    const badge = document.getElementById('km-fab-badge')
    const style = bell ? getComputedStyle(bell) : null
    const badgeStyle = badge ? getComputedStyle(badge) : null
    return {
      ok: Boolean(button && bell && badge
        && !button.querySelector('.km-fab-mark-line')
        && style?.fill === 'none'
        && style?.stroke !== 'none'
        && badgeStyle?.top === '2px'
        && badgeStyle?.right === '2px'
        && bell.getBoundingClientRect().width >= 18
        && bell.getBoundingClientRect().width <= 20),
      bellWidth: bell?.getBoundingClientRect().width || 0,
      bellHeight: bell?.getBoundingClientRect().height || 0,
      fill: style?.fill || '',
      stroke: style?.stroke || '',
      badgeTop: badgeStyle?.top || '',
      badgeRight: badgeStyle?.right || '',
      badgeCount: document.querySelectorAll('#km-fab-badge').length,
      panelBrandPreserved: Boolean(document.querySelector('.km-fab-avatar .km-fab-mark-line')),
    }
  })

  const fullPath = path.join(SHOTS, 'assistant-bell-workspace.png')
  await window.screenshot({ path: fullPath, fullPage: false })
  const box = await fab.boundingBox()
  if (!box) throw new Error('Floating assistant button has no visible bounds')
  const viewport = window.viewportSize()
  const clip = {
    x: Math.max(0, box.x - 92),
    y: Math.max(0, box.y - 64),
    width: Math.min(140, (viewport?.width || box.x + box.width) - Math.max(0, box.x - 92)),
    height: Math.min(110, (viewport?.height || box.y + box.height) - Math.max(0, box.y - 64)),
  }
  await window.screenshot({ path: path.join(SHOTS, 'assistant-bell-detail.png'), clip })

  const report = {
    at: new Date().toISOString(),
    change: 'use-bell-for-assistant-fab',
    check,
    pageErrors,
    consoleErrors,
    screenshots: ['assistant-bell-workspace.png', 'assistant-bell-detail.png'],
  }
  report.ok = check.ok && pageErrors.length === 0 && consoleErrors.length === 0
  fs.writeFileSync(path.join(__dirname, 'electron-evidence.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await app.close()
  if (!report.ok) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
