'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'capability-grid-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

async function readGrid(hub) {
  return hub.locator('body').evaluate(() => {
    const featured = document.querySelector('.hub-featured-row')
    const catalog = document.querySelector('.hub-grid')
    const app = document.querySelector('.hub-app')
    const toColumns = element => getComputedStyle(element).gridTemplateColumns
      .split(' ')
      .filter(Boolean)
    return {
      featuredColumns: toColumns(featured),
      catalogColumns: toColumns(catalog),
      featuredCards: featured.querySelectorAll('.hub-featured-card').length,
      catalogCards: catalog.querySelectorAll('.hub-card').length,
      overflowX: app.scrollWidth > app.clientWidth,
    }
  })
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-capability-grid-'))
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
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1000, height: 760 })
    await window.locator('#btnRailCapabilities').click()

    const frame = window.locator('.capability-hub-frame')
    await frame.waitFor({ state: 'visible', timeout: 30000 })
    const hub = window.frameLocator('.capability-hub-frame')
    await hub.locator('.hub-card').first().waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForTimeout(500)

    const experts = await readGrid(hub)
    await window.screenshot({
      path: path.join(SHOTS, 'capability-experts-three-column.png'),
      scale: 'css',
    })

    await window.locator('[data-capability-hub-tab="skills"]').click()
    await hub.locator('.hub-card').first().waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForTimeout(500)
    const skills = await readGrid(hub)
    await window.screenshot({
      path: path.join(SHOTS, 'capability-skills-three-column.png'),
      scale: 'css',
    })

    const checks = [
      { id: 'experts-featured-three-columns', pass: experts.featuredColumns.length === 3, detail: experts.featuredColumns },
      { id: 'experts-catalog-three-columns', pass: experts.catalogColumns.length === 3, detail: experts.catalogColumns },
      { id: 'skills-featured-three-columns', pass: skills.featuredColumns.length === 3, detail: skills.featuredColumns },
      { id: 'skills-catalog-three-columns', pass: skills.catalogColumns.length === 3, detail: skills.catalogColumns },
      { id: 'experts-no-horizontal-overflow', pass: !experts.overflowX },
      { id: 'skills-no-horizontal-overflow', pass: !skills.overflowX },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      viewport: { width: 1000, height: 760 },
      experts,
      skills,
      checks,
    }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    if (!report.pass) process.exitCode = 1
  } finally {
    if (app) await app.close().catch(() => {})
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
