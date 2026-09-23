'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'capability-card-visual-smoke.json')
const VIEWPORTS = [
  { id: 'wide', width: 1200, height: 800, minimumColumns: 3 },
  { id: 'medium', width: 850, height: 720, minimumColumns: 2 },
  { id: 'narrow', width: 620, height: 720, minimumColumns: 1 },
]

async function readCardMetrics(window) {
  return window.locator('body').evaluate(() => {
    const app = document.querySelector('.hub-app')
    const grid = document.querySelector('.hub-grid')
    const card = document.querySelector('.hub-grid .hub-card')
    const title = card?.querySelector('.hub-card-title')
    const sub = card?.querySelector('.hub-card-sub')
    const description = card?.querySelector('.hub-card-desc')
    const icon = card?.querySelector('.hub-card-icon')
    const footer = card?.querySelector('.hub-card-foot')
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
    const style = element => element ? getComputedStyle(element) : null
    return {
      columns: columns.length,
      overflowX: app.scrollWidth > app.clientWidth,
      cardMinHeight: style(card)?.minHeight,
      cardPadding: style(card)?.padding,
      title: { fontSize: style(title)?.fontSize, fontWeight: style(title)?.fontWeight, lineHeight: style(title)?.lineHeight },
      metadata: { fontSize: style(sub)?.fontSize, fontWeight: style(sub)?.fontWeight, lineHeight: style(sub)?.lineHeight },
      description: { fontSize: style(description)?.fontSize, fontWeight: style(description)?.fontWeight, lineHeight: style(description)?.lineHeight },
      icon: { width: style(icon)?.width, height: style(icon)?.height },
      footerMinHeight: style(footer)?.minHeight,
    }
  })
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-visual-system-'))
  const consoleErrors = []
  const captures = []
  let app

  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', '--dev', `--user-data-dir=${userDataDir}`],
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
    await window.locator('#btnRailCapabilities').click()

    await window.locator('.hub-overlay-host').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('.hub-grid .hub-card').first().waitFor({ state: 'visible', timeout: 30000 })

    for (const viewport of VIEWPORTS) {
      await window.setViewportSize({ width: viewport.width, height: viewport.height })
      await window.waitForTimeout(350)
      const metrics = await readCardMetrics(window)
      await window.screenshot({
        path: path.join(SHOTS, `capability-cards-${viewport.id}-${viewport.width}.png`),
        scale: 'css',
      })
      captures.push({ ...viewport, metrics })
    }

    const medium = captures.find(capture => capture.id === 'medium').metrics
    const checks = [
      ...captures.flatMap(capture => [
        { id: `${capture.id}-minimum-columns`, pass: capture.metrics.columns >= capture.minimumColumns, detail: capture.metrics.columns },
        { id: `${capture.id}-no-horizontal-overflow`, pass: !capture.metrics.overflowX },
      ]),
      { id: 'card-min-height', pass: medium.cardMinHeight === '156px', detail: medium.cardMinHeight },
      { id: 'title-hierarchy', pass: medium.title.fontSize === '14px' && medium.title.fontWeight === '600', detail: medium.title },
      { id: 'metadata-hierarchy', pass: medium.metadata.fontSize === '12px' && medium.metadata.fontWeight === '400', detail: medium.metadata },
      { id: 'description-hierarchy', pass: medium.description.fontSize === '13px' && medium.description.fontWeight === '400', detail: medium.description },
      { id: 'shared-icon-scale', pass: medium.icon.width === '40px' && medium.icon.height === '40px', detail: medium.icon },
      { id: 'shared-footer-scale', pass: medium.footerMinHeight === '28px', detail: medium.footerMinHeight },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      captures,
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
