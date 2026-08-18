#!/usr/bin/env node
/**
 * Defer 收口 Electron smoke：Studio / Hub 添加 / Cron 自动化 / 文件中心 / 工作台搜索。
 * 走 Vite dev + Electron --dev（dist file:// 在 Playwright 下 React 可能未挂载）。
 * 不打真实 LLM；原生文件对话框不点（会卡住）。
 */
'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn, execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../../..')
const SHOTS = path.join(__dirname, 'screenshots', 'electron')
const REACT = path.join(__dirname, 'screenshots', 'react')
const REPORT = path.join(__dirname, 'defer-closeout-electron-smoke.json')
const VITE_URL = String(process.env.KNOWME_VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

function waitForHttp(url, timeoutMs = 45000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`等待 Vite 超时：${url}`))
        else setTimeout(ping, 250)
      })
    }
    ping()
  })
}

function startViteDev() {
  if (process.env.KNOWME_SMOKE_SKIP_VITE === '1') return null
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')], {
    cwd: ROOT,
    stdio: 'ignore',
    env: process.env,
  })
  return child
}

async function shot(window, name) {
  const file = `${name}.png`
  const target = path.join(SHOTS, file)
  try { fs.unlinkSync(target) } catch { /* none */ }
  await window.screenshot({ path: target, fullPage: false })
  fs.copyFileSync(target, path.join(REACT, `electron-${file}`))
}

async function waitPending(window) {
  const pending = window.locator('[data-testid="km-surface-pending"]')
  if (await pending.count()) {
    await pending.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null)
  }
}

async function openStudio(window) {
  await window.locator('[data-wb-mode="workflows"]').click()
  await window.waitForTimeout(1200)
  await waitPending(window)
  const shelfCreate = window.locator('[data-testid="shelf-create-workflow"]')
  if (await shelfCreate.isVisible().catch(() => false)) {
    await shelfCreate.click()
  } else {
    await window.locator('#wbShelfManage').click()
    await window.waitForTimeout(1000)
    await waitPending(window)
    await window.locator('[data-testid="studio-create-workflow"]').click()
  }
  await window.waitForTimeout(1500)
  await waitPending(window)
  const studio = window.locator('[data-testid="studio-surface"]')
  await studio.waitFor({ state: 'visible', timeout: 45000 })
  const palette = window.locator('[data-testid="studio-palette"]')
  await palette.waitFor({ state: 'visible', timeout: 15000 })
  return { studio, palette }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.mkdirSync(REACT, { recursive: true })
  killElectron()
  await new Promise((r) => setTimeout(r, 800))

  const vite = startViteDev()
  if (vite) {
    process.stdout.write(`[smoke] 等待 Vite ${VITE_URL}/workspace/ …\n`)
    await waitForHttp(`${VITE_URL}/workspace/`)
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-defer-smoke-'))
  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: vite ? 'vite-dev' : 'dist',
    userDataDir,
    consoleErrors: [],
    checks: [],
  }

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', '--dev', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userDataDir,
      KNOWME_VITE_URL: VITE_URL,
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
    await window.locator('#appShell').waitFor({ state: 'visible', timeout: 60000 })
    await window.waitForTimeout(1500)

    await window.locator('#btnRailWorkbench').click()
    await window.waitForTimeout(1600)
    await waitPending(window)
    const taskhome = window.locator('[data-testid="taskhome-surface"]')
    await taskhome.waitFor({ state: 'visible', timeout: 25000 })
    const search = window.locator('#wbShelfSearch')
    const searchVisible = await search.isVisible().catch(() => false)
    report.checks.push({ id: 'wb-search-visible-on-taskhome', ok: searchVisible })
    await shot(window, 'workbench-search')

    const { studio, palette } = await openStudio(window)
    report.checks.push({
      id: 'studio-surface',
      ok: (await studio.isVisible()) && (await palette.count()) > 0,
    })
    await shot(window, 'studio')
    const leave = window.locator('[data-testid="studio-leave"]')
    if (await leave.isVisible().catch(() => false)) {
      await leave.click({ force: true }).catch(() => null)
    }
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
    await window.getByRole('tab', { name: '技能' }).click()
    await window.waitForTimeout(400)
    const addBtn = window.locator('#hubBtnAdd').or(window.getByRole('button', { name: '添加能力' }))
    await addBtn.first().waitFor({ state: 'visible', timeout: 15000 })
    await addBtn.first().click()
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
    if (vite && !vite.killed) vite.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
