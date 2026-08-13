'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const EVIDENCE = __dirname
const SHOTS = path.join(EVIDENCE, 'screenshots')
const REPORT = path.join(EVIDENCE, 'team-empty-state-electron-smoke.json')

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-team-empty-state-'))
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
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        consoleErrors.push(text)
      }
    })
    window.on('dialog', dialog => dialog.accept())
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })

    await window.setViewportSize({ width: 1360, height: 860 })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#workbench').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('.wb-advanced-context > summary').click()
    await window.locator('#wbModeSelect').selectOption('visual')
    await window.waitForFunction(() => document.querySelector('#wbTeamPageTitle')?.textContent?.includes('视觉创作'), null, { timeout: 30000 })
    await window.locator('#wbTabTeam').click()
    await window.locator('.wb-team-empty').waitFor({ state: 'visible', timeout: 30000 })

    const desktop = await window.evaluate(() => {
      const empty = document.querySelector('.wb-team-empty')
      const menu = document.querySelector('.wb-advanced-menu')
      const head = document.querySelector('.wb-head')
      const emptyRect = empty.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      return {
        mode: document.querySelector('#wbModeSelect').value,
        emptyHeight: Math.round(emptyRect.height),
        headOverflowX: head.scrollWidth > head.clientWidth,
        menuTop: Math.round(menuRect.top),
        menuBottom: Math.round(menuRect.bottom),
        viewportHeight: window.innerHeight,
      }
    })
    const desktopCopy = await window.locator('.wb-team-empty').textContent()
    await window.screenshot({
      path: path.join(SHOTS, 'team-empty-state-desktop.png'),
      scale: 'css',
    })

    await window.setViewportSize({ width: 720, height: 640 })
    const narrow = await window.evaluate(() => {
      const empty = document.querySelector('.wb-team-empty')
      const menu = document.querySelector('.wb-advanced-menu')
      const head = document.querySelector('.wb-head')
      const emptyRect = empty.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      return {
        headOverflowX: head.scrollWidth > head.clientWidth,
        emptyOverflowX: empty.scrollWidth > empty.clientWidth,
        menuWithinViewport: menuRect.left >= 0
          && menuRect.right <= window.innerWidth
          && menuRect.top >= 0
          && menuRect.bottom <= window.innerHeight,
        emptyHeight: Math.round(emptyRect.height),
      }
    })
    await window.screenshot({
      path: path.join(SHOTS, 'team-empty-state-narrow.png'),
      scale: 'css',
    })

    const checks = [
      {
        id: 'visual-mode-empty-team',
        pass: desktop.mode === 'visual'
          && /先组建你的 Agent 团队/.test(desktopCopy || '')
          && /添加 Agent/.test(desktopCopy || '')
          && /浏览能力中心/.test(desktopCopy || ''),
        detail: { mode: desktop.mode, copy: desktopCopy },
      },
      {
        id: 'advanced-menu-visible',
        pass: desktop.menuTop >= 0
          && desktop.menuBottom <= desktop.viewportHeight
          && desktop.headOverflowX === false,
        detail: desktop,
      },
      {
        id: 'narrow-no-overflow',
        pass: narrow.headOverflowX === false
          && narrow.emptyOverflowX === false
          && narrow.menuWithinViewport === true,
        detail: narrow,
      },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      viewports: [{ width: 1360, height: 860 }, { width: 720, height: 640 }],
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
