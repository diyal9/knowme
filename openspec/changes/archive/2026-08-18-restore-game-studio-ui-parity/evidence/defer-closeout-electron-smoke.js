#!/usr/bin/env node
/**
 * Defer 收口 Electron smoke：Studio / Hub 添加 / Cron 自动化 / 文件中心 / 工作台搜索。
 * 不打真实 LLM；原生文件对话框不点（会卡住）。
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../../..')
const SHOTS = path.join(__dirname, 'screenshots', 'electron')
const REACT = path.join(__dirname, 'screenshots', 'react')
const REPORT = path.join(__dirname, 'defer-closeout-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function shot(window, name) {
  const file = `${name}.png`
  await window.screenshot({ path: path.join(SHOTS, file), fullPage: false })
  fs.copyFileSync(path.join(SHOTS, file), path.join(REACT, `electron-${file}`))
}

async function waitPending(window) {
  const pending = window.locator('[data-testid="km-surface-pending"]')
  if (await pending.count()) {
    await pending.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => null)
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.mkdirSync(REACT, { recursive: true })
  killElectron()
  await new Promise((r) => setTimeout(r, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-defer-smoke-'))
  const report = {
    at: new Date().toISOString(),
    ok: false,
    userDataDir,
    consoleErrors: [],
    checks: [],
  }

  const app = await electron.launch({
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

  try {
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.locator('#appShell, #btnRailAi').first().waitFor({ state: 'visible', timeout: 45000 })
    await window.waitForTimeout(1800)

    await window.locator('#btnRailWorkbench').click()
    await window.waitForTimeout(1600)
    await waitPending(window)
    const taskhome = window.locator('[data-testid="taskhome-surface"]')
    await taskhome.waitFor({ state: 'visible', timeout: 25000 })
    const search = window.locator('#wbShelfSearch')
    const searchVisible = await search.isVisible().catch(() => false)
    report.checks.push({ id: 'wb-search-visible-on-taskhome', ok: searchVisible })
    await shot(window, 'workbench-search')

    await window.locator('[data-wb-mode="workflows"]').click()
    await window.waitForTimeout(1200)
    await waitPending(window)
    const manageWf = window.locator('#wbShelfManage')
    await manageWf.waitFor({ state: 'visible', timeout: 15000 })
    await manageWf.click()
    await window.waitForTimeout(1000)
    await waitPending(window)
    const createWf = window.locator('[data-testid="studio-create-workflow"]')
    await createWf.waitFor({ state: 'visible', timeout: 15000 })
    await createWf.click()
    await window.waitForTimeout(1500)
    await waitPending(window)
    const studio = window.locator('[data-testid="studio-surface"]')
    await studio.waitFor({ state: 'visible', timeout: 20000 })
    const palette = window.locator('[data-testid="studio-palette"]')
    report.checks.push({
      id: 'studio-surface',
      ok: await studio.isVisible() && (await palette.count()) > 0,
    })
    await shot(window, 'studio')
    const leave = window.locator('[data-testid="studio-leave"]')
    if (await leave.isVisible().catch(() => false)) await leave.click()
    await window.waitForTimeout(600)
    const discard = window.locator('[data-leave-choice="discard"]')
    if (await discard.count()) await discard.click().catch(() => null)
    await window.waitForTimeout(800)

    await window.locator('#btnRailAutomation').click()
    await window.waitForTimeout(1400)
    await waitPending(window)
    const createAuto = window.locator('[data-testid="automation-create"]')
    await createAuto.waitFor({ state: 'visible', timeout: 15000 })
    await createAuto.click()
    await window.waitForTimeout(800)
    const modal = window.locator('[data-testid="automation-modal"]')
    await modal.waitFor({ state: 'visible', timeout: 10000 })
    await window.locator('#wbAutoScheduleType').selectOption('cron')
    const cron = window.locator('#wbAutoCronExpr')
    report.checks.push({
      id: 'automation-cron',
      ok: await modal.isVisible() && await cron.isVisible(),
    })
    await shot(window, 'automation-cron')
    await window.locator('#wbAutomationModalCancel').click()
    await window.waitForTimeout(400)

    await window.locator('#btnRailCapabilities').click()
    await window.waitForTimeout(1400)
    await waitPending(window)
    const hub = window.locator('[data-testid="capability-hub-surface"]')
    await hub.waitFor({ state: 'visible', timeout: 20000 })
    await window.locator('#hubBtnAdd').click()
    const addDlg = window.locator('[data-testid="hub-add-dialog"]')
    await addDlg.waitFor({ state: 'visible', timeout: 10000 })
    report.checks.push({
      id: 'hub-add-dialog',
      ok: await addDlg.isVisible() && /本地文件夹|确认安装|添加能力/.test(await addDlg.innerText()),
    })
    await shot(window, 'hub-add')
    await window.getByRole('button', { name: '关闭添加能力' }).click().catch(async () => {
      await window.getByRole('button', { name: '取消' }).click()
    })

    await window.locator('#btnToggleSide').click()
    const files = window.locator('[data-testid="files-pane"]')
    await files.waitFor({ state: 'visible', timeout: 15000 })
    const fileMenu = window.getByLabel('文件操作')
    let splitOk = false
    let versionDisabled = false
    if (await fileMenu.isVisible().catch(() => false)) {
      await fileMenu.click()
      const split = window.getByRole('menuitem', { name: '分屏预览' })
      const version = window.getByRole('menuitem', { name: /版本对比/ })
      splitOk = await split.isVisible().catch(() => false)
      versionDisabled = await version.isDisabled().catch(() => false)
    } else {
      splitOk = /前往设置添加/.test(await files.innerText())
      versionDisabled = true
    }
    report.checks.push({ id: 'files-pane', ok: await files.isVisible() })
    report.checks.push({ id: 'files-split-or-empty', ok: splitOk })
    report.checks.push({ id: 'files-version-retired', ok: versionDisabled })
    await shot(window, 'files')

    report.ok = report.checks.every((c) => c.ok) && report.consoleErrors.length === 0
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} ${REPORT}\n`)
    process.stdout.write(JSON.stringify(report.checks, null, 2) + '\n')
    if (!report.ok) process.exitCode = 1
  } finally {
    await app.close().catch(() => null)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
