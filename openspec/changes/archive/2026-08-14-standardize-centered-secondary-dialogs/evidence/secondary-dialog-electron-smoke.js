'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'secondary-dialog-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-secondary-dialog-'))
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
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|center-surface/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1500)

    await window.locator('#btnRailCapabilities').click()
    const frameHost = window.locator('.capability-hub-frame')
    await frameHost.waitFor({ state: 'visible', timeout: 30000 })

    const primaryGeometry = await window.locator('#drawer').evaluate(node => {
      const rect = node.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        transform: getComputedStyle(node).transform,
      }
    })
    checks.push({
      id: 'primary-surface-preserved',
      pass: Math.abs(primaryGeometry.left - 44) <= 2
        && Math.abs(primaryGeometry.top) <= 2
        && Math.abs(primaryGeometry.right - primaryGeometry.viewportWidth) <= 2
        && Math.abs(primaryGeometry.bottom - primaryGeometry.viewportHeight) <= 2
        && primaryGeometry.transform === 'none',
      detail: primaryGeometry,
    })

    await window.locator('[data-capability-hub-tab="skills"]').click()
    const hub = window.frameLocator('.capability-hub-frame')
    const writingCard = hub.locator('[data-id="writing-polish"]').first()
    await writingCard.waitFor({ state: 'visible', timeout: 30000 })
    await writingCard.click()
    await hub.locator('#hubDrawer.open').waitFor({ state: 'visible', timeout: 10000 })
    await window.waitForTimeout(350)

    const dialogGeometry = await hub.locator('#hubDrawer').evaluate(node => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        position: style.position,
        overflow: style.overflow,
      }
    })
    checks.push({
      id: 'hub-detail-centered',
      pass: Math.abs(dialogGeometry.centerX - dialogGeometry.viewportWidth / 2) <= 2
        && Math.abs(dialogGeometry.centerY - dialogGeometry.viewportHeight / 2) <= 2
        && dialogGeometry.left > 0
        && dialogGeometry.top > 0
        && dialogGeometry.position === 'fixed',
      detail: dialogGeometry,
    })

    const footerVisible = await hub.locator('#hubDrawerActions').isVisible()
    const bodyOverflow = await hub.locator('#hubDrawerBody').evaluate(node => getComputedStyle(node).overflowY)
    checks.push({
      id: 'stable-header-body-footer',
      pass: footerVisible && bodyOverflow === 'auto',
      detail: { footerVisible, bodyOverflow },
    })

    await window.screenshot({
      path: path.join(SHOTS, 'capability-detail-centered.png'),
      scale: 'css',
    })

    await hub.locator('#hubDrawerClose').click()
    await hub.locator('#hubDrawer.open').waitFor({ state: 'hidden', timeout: 10000 })
    await window.waitForTimeout(100)
    const focusedCapability = await writingCard.evaluate(node => document.activeElement === node)
    checks.push({ id: 'close-restores-card-focus', pass: focusedCapability })
    checks.push({ id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors })
  } finally {
    if (app) await app.close().catch(() => {})
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(check => check.pass),
    checks,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
