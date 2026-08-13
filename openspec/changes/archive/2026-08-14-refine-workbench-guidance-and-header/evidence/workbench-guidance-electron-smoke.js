'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'workbench-guidance-electron-smoke.json')

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

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-workbench-guidance-'))
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
    await window.locator('#wbModeSelect').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#wbModeSelect').selectOption('visual')
    await window.waitForFunction(() => document.querySelector('#wbOverviewTitle')?.textContent?.includes('视觉创作'))
    await window.locator('#wbTabTasks').click()
    await window.locator('.wb-workflow-empty').waitFor({ state: 'visible', timeout: 30000 })

    const desktopBounds = await window.evaluate(() => {
      const head = document.querySelector('.wb-head')
      const switcher = document.querySelector('.wb-mode-switcher')
      const empty = document.querySelector('.wb-workflow-empty')
      return {
        headOverflowX: head.scrollWidth > head.clientWidth,
        switcherHeight: Math.round(switcher.getBoundingClientRect().height),
        emptyHeight: Math.round(empty.getBoundingClientRect().height),
      }
    })
    const desktopCopy = await window.locator('.wb-workflow-empty').textContent()
    const recentNote = await window.locator('#wbRecentNote').textContent()
    const failedActionCount = await window.locator('.wb-task-chip.failed .wb-task-state, .wb-task-chip.error .wb-task-state').count()
    const failedActions = failedActionCount
      ? await window.locator('.wb-task-chip.failed .wb-task-state, .wb-task-chip.error .wb-task-state').allTextContents()
      : []

    await window.screenshot({
      path: path.join(SHOTS, 'workbench-guidance-desktop.png'),
      scale: 'css',
    })

    await window.locator('[data-empty-action="capabilities"]').click()
    const hubFrame = window.locator('.capability-hub-frame')
    await hubFrame.waitFor({ state: 'visible', timeout: 30000 })
    const capabilitySrc = await hubFrame.getAttribute('src')
    await window.locator('#btnRailCapabilities').click()
    await window.locator('.wb-workflow-empty').waitFor({ state: 'visible', timeout: 30000 })

    await window.locator('[data-empty-action="agents"]').click()
    await hubFrame.waitFor({ state: 'visible', timeout: 30000 })
    const agentSrc = await hubFrame.getAttribute('src')
    await window.locator('#btnRailCapabilities').click()

    await window.setViewportSize({ width: 780, height: 720 })
    await window.locator('.wb-workflow-empty').waitFor({ state: 'visible' })
    const narrowBounds = await window.evaluate(() => {
      const head = document.querySelector('.wb-head')
      const empty = document.querySelector('.wb-workflow-empty')
      return {
        headOverflowX: head.scrollWidth > head.clientWidth,
        emptyOverflowX: empty.scrollWidth > empty.clientWidth,
      }
    })
    await window.screenshot({
      path: path.join(SHOTS, 'workbench-guidance-narrow.png'),
      scale: 'css',
    })

    const checks = [
      {
        id: 'integrated-mode-context',
        pass: desktopBounds.switcherHeight === 34
          && await window.locator('.wb-mode-switcher .wb-mode-kind').textContent() === '工作模式',
        detail: desktopBounds,
      },
      {
        id: 'actionable-empty-state',
        pass: /视觉创作/.test(desktopCopy || '')
          && /安装专业能力/.test(desktopCopy || '')
          && /添加 Agent/.test(desktopCopy || '')
          && desktopBounds.emptyHeight < 140,
        detail: { copy: desktopCopy, height: desktopBounds.emptyHeight },
      },
      {
        id: 'capability-and-agent-actions',
        pass: /tab=skills/.test(capabilitySrc || '') && /tab=experts/.test(agentSrc || ''),
        detail: { capabilitySrc, agentSrc },
      },
      {
        id: 'cross-mode-history-disclosure',
        pass: failedActionCount === 0 || /来自软件研发/.test(recentNote || ''),
        detail: { recentNote, failedActionCount },
      },
      {
        id: 'failed-run-details-label',
        pass: failedActions.every(text => text === '查看详情'),
        detail: failedActions,
      },
      {
        id: 'responsive-no-overflow',
        pass: !desktopBounds.headOverflowX && !narrowBounds.headOverflowX && !narrowBounds.emptyOverflowX,
        detail: { desktopBounds, narrowBounds },
      },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      viewports: [{ width: 1360, height: 860 }, { width: 780, height: 720 }],
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
