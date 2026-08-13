'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'goal-driven-workbench-electron-smoke.json')

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
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-goal-workbench-'))
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
    await window.locator('#wbGoalInput').waitFor({ state: 'visible', timeout: 30000 })

    const headerText = await window.locator('.wb-tabs-group').textContent()
    const goalTitle = await window.locator('#wbGoalTitle').textContent()
    const modeVisible = await window.locator('#wbModeSelect').isVisible()
    const starterCount = await window.locator('[data-goal-template]').count()
    await window.screenshot({
      path: path.join(SHOTS, 'goal-workbench-start-desktop.png'),
      scale: 'css',
    })

    const goal = '整理客户访谈纪要并生成跟进待办'
    await window.locator('#wbGoalInput').fill(goal)
    await window.locator('#wbGoalSubmit').click()
    await window.locator('#wbTaskPage.active').waitFor({ state: 'visible', timeout: 30000 })
    const taskTitle = await window.locator('#wbStartTitle').textContent()
    const goalInModal = await window.locator('#wbDaemonIntent').count()
      ? await window.locator('#wbDaemonIntent').inputValue()
      : ''
    const goalHint = await window.locator('#wbWorkflowModeHint').textContent()

    if (await window.locator('#wbWorkflowModal').isVisible()) {
      await window.locator('#wbModalCancel').click()
    }
    await window.locator('#wbTabHome').click()
    await window.locator('[data-goal-template="制作一张新品发布宣传图"]').click()
    await window.locator('#wbTaskPage.active').waitFor({ state: 'visible', timeout: 30000 })
    const starterTaskVisible = await window.locator('#wbTaskPage.active').isVisible()

    await window.locator('#wbTabHome').click()
    await window.locator('.wb-advanced-context summary').click()
    const advancedModeVisible = await window.locator('#wbModeSelect').isVisible()
    await window.locator('.wb-advanced-context summary').click()

    await window.setViewportSize({ width: 780, height: 720 })
    const bounds = await window.evaluate(() => {
      const head = document.querySelector('.wb-head')
      const home = document.querySelector('#wbHomePage')
      return {
        headOverflowX: head.scrollWidth > head.clientWidth,
        homeOverflowX: home.scrollWidth > home.clientWidth,
      }
    })
    await window.screenshot({
      path: path.join(SHOTS, 'goal-workbench-start-narrow.png'),
      scale: 'css',
    })

    const checks = [
      { id: 'user-language-header', pass: /开始/.test(headerText) && /任务/.test(headerText) && /团队/.test(headerText), detail: headerText },
      { id: 'goal-first-home', pass: goalTitle?.includes('今天想完成什么'), detail: goalTitle },
      { id: 'mode-is-advanced', pass: !modeVisible && advancedModeVisible, detail: { modeVisible, advancedModeVisible } },
      { id: 'common-goal-starters', pass: starterCount === 4, detail: starterCount },
      {
        id: 'goal-enters-existing-task-path',
        pass: taskTitle?.includes('浏览全部模板') && (goalInModal === goal || goalHint?.includes('目标已记录')),
        detail: { taskTitle, goalInModal, goalHint },
      },
      { id: 'starter-enters-task-path', pass: starterTaskVisible, detail: '制作宣传图' },
      { id: 'responsive-no-overflow', pass: !bounds.headOverflowX && !bounds.homeOverflowX, detail: bounds },
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
