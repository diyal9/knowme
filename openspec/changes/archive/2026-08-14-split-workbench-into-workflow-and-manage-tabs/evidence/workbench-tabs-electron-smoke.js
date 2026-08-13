'use strict'

/**
 * split-workbench-into-workflow-and-manage-tabs Electron 冒烟：
 *   两 Tab → 货架筛选行无新建 → 管理常驻面三分区 → 我的工作流分区 → 搜索按 Tab 显隐 → 窄窗
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-tabs-electron-smoke.json')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none running */ }
  }
}

async function main(state) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const shoot = async (win, name) => {
    try {
      await win.bringToFront()
      await win.screenshot({ path: path.join(SHOTS, name), animations: 'disabled', timeout: 15000 })
    } catch (error) {
      state.report?.consoleErrors.push(`screenshot ${name}: ${String(error?.message || error).split('\n')[0]}`)
    }
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-workbench-tabs-'))
  const report = { at: new Date().toISOString(), ok: false, consoleErrors: [], checks: [] }
  state.report = report
  const check = (id, ok, extra = {}) => report.checks.push({ id, ok: !!ok, ...extra })

  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  state.app = app

  const win = await app.firstWindow({ timeout: 90000 })
  win.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) report.consoleErrors.push(text)
  })
  win.on('pageerror', error => report.consoleErrors.push(String(error?.message || error)))

  await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await win.waitForTimeout(4000)

  await win.locator('#btnRailWorkbench').click()
  await win.waitForTimeout(2500)
  await win.evaluate(async () => { await window.Workbench?.ensureLoaded?.() })
  await win.waitForTimeout(2500)

  // 一级两 Tab，默认停在工作流
  const tabMeta = await win.evaluate(() => ({
    modes: [...document.querySelectorAll('#wbModeTabs [data-wb-mode]')].map(el => ({
      mode: el.dataset.wbMode,
      label: el.textContent.trim(),
      active: el.classList.contains('active'),
    })),
    manageToggle: !!document.getElementById('wbManageToggle'),
    shelfNewWorkflow: !!document.getElementById('wbShelfNewWorkflow'),
    searchVisible: !document.getElementById('wbShelfSearch')?.hidden,
  }))
  check('two-mode-tabs', tabMeta.modes.length === 2
    && tabMeta.modes[0].mode === 'shelf' && tabMeta.modes[0].label === '工作流'
    && tabMeta.modes[1].mode === 'manage' && tabMeta.modes[1].label === '管理', tabMeta)
  check('shelf-tab-default-active', tabMeta.modes[0]?.active === true)
  check('no-manage-dropdown', !tabMeta.manageToggle)
  check('filter-row-without-new-workflow', !tabMeta.shelfNewWorkflow)
  check('search-visible-on-shelf', tabMeta.searchVisible)
  await shoot(win, 'workbench-tab-workflow.png')

  // 搜索词在切 Tab 后不丢
  await win.locator('#wbShelfSearch').fill('会议')
  await win.waitForTimeout(400)

  // 管理 Tab：常驻面 + 三分区，默认工作流
  await win.locator('#wbModeTabs [data-wb-mode="manage"]').click()
  await win.waitForTimeout(900)
  const manageMeta = await win.evaluate(() => {
    const surface = document.getElementById('wbManageSurface')
    return {
      surfaceActive: !!surface?.classList.contains('active'),
      fixed: surface ? getComputedStyle(surface).position === 'fixed' : true,
      shelfActive: !!document.getElementById('wbShelfSurface')?.classList.contains('active'),
      panels: [...document.querySelectorAll('#wbManageTabs [data-manage-panel]')].map(el => el.dataset.managePanel),
      activePanel: document.querySelector('.wb-manage-panel.active')?.dataset.managePanel || '',
      searchHidden: !!document.getElementById('wbShelfSearch')?.hidden,
      reloadVisible: !!document.getElementById('wbReload')?.offsetParent,
      newWorkflowEntry: !!document.getElementById('wbWorkflowManageNew'),
      items: document.querySelectorAll('#wbWorkflowManageList .wb-workflow-manage-item').length,
      emptyVisible: !document.getElementById('wbWorkflowManageEmpty')?.hidden,
    }
  })
  check('manage-surface-active', manageMeta.surfaceActive && !manageMeta.shelfActive, manageMeta)
  check('manage-not-a-drawer', !manageMeta.fixed, manageMeta)
  check('manage-three-sections', manageMeta.panels.join(',') === 'workflows,daemon,automation', manageMeta)
  check('manage-defaults-to-workflows', manageMeta.activePanel === 'workflows', manageMeta)
  check('search-hidden-on-manage', manageMeta.searchHidden)
  check('reload-shared-across-tabs', manageMeta.reloadVisible)
  check('workflow-section-new-entry', manageMeta.newWorkflowEntry)
  check('workflow-section-list-or-empty', manageMeta.items > 0 || manageMeta.emptyVisible, manageMeta)
  await shoot(win, 'workbench-tab-manage-workflows.png')

  // 二级分区切换
  for (const panel of ['daemon', 'automation']) {
    await win.locator(`#wbManageTabs [data-manage-panel="${panel}"]`).click()
    await win.waitForTimeout(700)
    const active = await win.evaluate(id => {
      const surface = document.getElementById('wbManageSurface')
      const panelEl = document.querySelector(`.wb-manage-panel[data-manage-panel="${id}"]`)
      return !!surface?.classList.contains('active') && !!panelEl?.classList.contains('active')
    }, panel)
    check(`manage-panel-${panel}`, active)
  }
  await shoot(win, 'workbench-tab-manage-daemon.png')

  // 外部跳转仍直达管理分区
  await win.evaluate(() => window.Workbench?.openPage?.('automation'))
  await win.waitForTimeout(700)
  check('external-jump-to-automation', await win.evaluate(() => (
    !!document.getElementById('wbManageSurface')?.classList.contains('active')
    && !!document.querySelector('.wb-manage-panel[data-manage-panel="automation"]')?.classList.contains('active')
  )))

  // 切回工作流 Tab：搜索恢复且词还在
  await win.evaluate(() => window.Workbench?.openPage?.('home'))
  await win.waitForTimeout(500)
  await win.locator('#wbModeTabs [data-wb-mode="shelf"]').click()
  await win.waitForTimeout(700)
  const backMeta = await win.evaluate(() => ({
    shelfActive: !!document.getElementById('wbShelfSurface')?.classList.contains('active'),
    searchVisible: !document.getElementById('wbShelfSearch')?.hidden,
    query: document.getElementById('wbShelfSearch')?.value || '',
  }))
  check('back-to-shelf-tab', backMeta.shelfActive && backMeta.searchVisible, backMeta)
  check('search-query-preserved', backMeta.query === '会议', backMeta)
  await win.locator('#wbShelfSearch').fill('')
  await win.waitForTimeout(400)

  // 编排页隐藏两 Tab
  await win.evaluate(() => window.Workbench?.openPage?.('studio'))
  await win.waitForTimeout(900)
  check('tabs-hidden-in-studio', await win.evaluate(() => !!document.getElementById('wbModeTabs')?.hidden))
  await win.locator('#wbStudioBack').click()
  await win.waitForTimeout(700)
  check('tabs-back-after-studio', await win.evaluate(() => !document.getElementById('wbModeTabs')?.hidden))

  // 窄窗
  await win.setViewportSize({ width: 760, height: 720 })
  await win.waitForTimeout(600)
  await win.locator('#wbModeTabs [data-wb-mode="manage"]').click()
  await win.waitForTimeout(700)
  const overflow = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('narrow-no-horizontal-overflow', overflow <= 1, { overflow })
  await shoot(win, 'workbench-tab-manage-narrow.png')

  check('console-error-free', report.consoleErrors.length === 0, { errors: report.consoleErrors.slice(0, 8) })
}

async function run() {
  const state = { report: null, app: null }
  try {
    await main(state)
  } catch (error) {
    if (state.report) state.report.crash = String(error?.message || error)
    else console.error(error)
  }
  const report = state.report
  if (report) {
    report.ok = !report.crash && report.checks.every(item => item.ok)
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    const passed = report.checks.filter(item => item.ok).length
    console.log(`workbench-tabs smoke ${passed}/${report.checks.length} · console errors ${report.consoleErrors.length}`)
    for (const item of report.checks.filter(entry => !entry.ok)) console.log('  FAIL', JSON.stringify(item))
    if (report.crash) console.log('  CRASH', report.crash.split('\n')[0])
    if (!report.ok) process.exitCode = 1
  } else {
    process.exitCode = 1
  }
  try { await state.app?.close() } catch { /* already closed */ }
  killKnowMeProcesses()
}

run()
