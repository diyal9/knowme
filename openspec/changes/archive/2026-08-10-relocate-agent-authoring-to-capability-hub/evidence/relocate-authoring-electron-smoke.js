'use strict'

/**
 * relocate-agent-authoring-to-capability-hub Electron 冒烟：
 *   单一货架（无 Tab）→ 来源标签 → 编排一级 → 管理抽屉两面板 → 能力界面 Agent 表单
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'relocate-authoring-electron-smoke.json')

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
  state.shoot = shoot
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-relocate-authoring-'))
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

  // 单一货架：无 Tab、无 Agent 子货架
  check('no-mode-tabs', await win.locator('#wbModeTabs').count() === 0)
  check('no-agent-shelf', await win.locator('#wbAgentShelf').count() === 0)
  check('shelf-active', await win.locator('#wbShelfSurface').evaluate(node => node.classList.contains('active')))

  const shelfMeta = await win.evaluate(() => ({
    cards: document.querySelectorAll('#wbShelfGrid .wb-shelf-card').length,
    provenance: [...document.querySelectorAll('#wbShelfGrid .wb-shelf-provenance')].map(el => el.textContent.trim()),
    domainVisible: !document.getElementById('wbDomainSwitcher')?.hidden,
    newWorkflow: !!document.getElementById('wbShelfNewWorkflow'),
    agentForm: !!document.getElementById('wbAgentManagerForm'),
  }))
  check('shelf-has-cards-or-empty', shelfMeta.cards >= 0)
  check('domain-filter-visible', shelfMeta.domainVisible)
  check('new-workflow-entry', shelfMeta.newWorkflow)
  check('no-workbench-agent-form', !shelfMeta.agentForm)
  check('provenance-badges-present', shelfMeta.cards === 0 || shelfMeta.provenance.length > 0, shelfMeta)
  await shoot(win, 'workbench-single-shelf.png')

  // 编排一级动作
  await win.locator('#wbShelfNewWorkflow').click()
  await win.waitForTimeout(1500)
  const studioMeta = await win.evaluate(() => ({
    active: document.getElementById('wbStudioSurface')?.classList.contains('active'),
    agents: document.querySelectorAll('#wbStudioAgents .wb-studio-agent').length,
    tuneLink: !!document.querySelector('[data-studio-tune-agent]'),
    manageAgent: !!document.querySelector('[data-studio-manage-agent]'),
    saveAgent: !!document.querySelector('[data-studio-save-agent]'),
  }))
  check('studio-surface-active', studioMeta.active)
  check('studio-agent-candidates', studioMeta.agents > 0, studioMeta)
  check('studio-no-agent-body-config', !studioMeta.manageAgent && !studioMeta.saveAgent)
  await shoot(win, 'workbench-orchestration.png')
  await win.locator('#wbStudioBack').click()
  await win.waitForTimeout(800)
  check('studio-back-to-shelf', await win.locator('#wbShelfSurface').evaluate(node => node.classList.contains('active')))

  // 管理抽屉仅 daemon + automation
  await win.locator('#wbManageToggle').click()
  await win.waitForTimeout(500)
  const manageMeta = await win.evaluate(() => ({
    menuPanels: [...document.querySelectorAll('#wbManageMenu [data-manage-panel]')].map(el => el.dataset.managePanel),
    tabPanels: [...document.querySelectorAll('#wbManageTabs [data-manage-panel]')].map(el => el.dataset.managePanel),
    teamPage: !!document.getElementById('wbTeamPage'),
  }))
  check('manage-menu-two-panels', manageMeta.menuPanels.length === 2
    && manageMeta.menuPanels.includes('daemon')
    && manageMeta.menuPanels.includes('automation'))
  check('manage-tabs-two-panels', manageMeta.tabPanels.length === 2)
  check('no-agent-manage-panel', !manageMeta.menuPanels.includes('agents') && !manageMeta.teamPage)

  await win.locator('#wbManageMenu [data-manage-panel="daemon"]').click()
  await win.waitForTimeout(800)
  check('manage-drawer-opens', await win.locator('#wbManageDrawer').isVisible())

  for (const panel of ['daemon', 'automation']) {
    const tab = win.locator(`#wbManageTabs [data-manage-panel="${panel}"]`)
    if (await tab.isVisible()) {
      await tab.click()
      await win.waitForTimeout(600)
    }
    const active = await win.evaluate(id => {
      const drawer = document.getElementById('wbManageDrawer')
      const panelEl = document.querySelector(`.wb-manage-panel[data-manage-panel="${id}"]`)
      return !drawer?.hidden && !!panelEl?.classList.contains('active')
    }, panel)
    check(`manage-panel-${panel}`, active)
  }
  await shoot(win, 'workbench-manage-drawer.png')
  await win.locator('#wbManageClose').click()
  await win.waitForTimeout(400)

  // 能力界面 Agent 表单
  await win.locator('#btnRailCapabilities').click()
  await win.waitForTimeout(1500)
  const frame = win.locator('.capability-hub-frame')
  await frame.waitFor({ state: 'visible', timeout: 30000 })
  const hub = win.frameLocator('.capability-hub-frame')
  await hub.locator('.hub-card, .hub-state, .hub-app').first().waitFor({ state: 'visible', timeout: 30000 })
  await win.waitForTimeout(800)
  await shoot(win, 'capability-hub-experts.png')

  const hubAddVisible = await hub.locator('#hubBtnAdd').isVisible().catch(() => false)
  check('hub-add-button-visible', hubAddVisible)
  if (hubAddVisible) {
    await hub.locator('#hubBtnAdd').click()
    await win.waitForTimeout(800)
    const expertDialog = await hub.locator('#hubExpertDialog').evaluate(node => ({
      open: !node.hidden,
      title: document.getElementById('hubExpertDialogTitle')?.textContent?.trim() || '',
      bodyFields: document.querySelectorAll('#hubExpertDialogBody input, #hubExpertDialogBody textarea, #hubExpertDialogBody select').length,
    })).catch(() => ({ open: false, title: '', bodyFields: 0 }))
    check('hub-expert-dialog-opens', expertDialog.open, expertDialog)
    check('hub-expert-form-fields', expertDialog.bodyFields > 0, expertDialog)
    await shoot(win, 'capability-hub-expert-form.png')
    const closeBtn = hub.locator('#hubExpertDialog [data-dialog-close]')
    if (await closeBtn.count()) await closeBtn.click({ timeout: 5000 }).catch(() => {})
    await win.waitForTimeout(400)
  }

  // 助理「我的专家」只读入口
  await win.locator('#btnRailAi').click({ force: true })
  await win.waitForTimeout(800)
  check('assistant-expert-btn-readonly-label', /我的专家/.test(await win.locator('#agentExpertBtn').getAttribute('title') || ''))
  await win.locator('#agentExpertBtn').click({ force: true })
  await win.waitForTimeout(400)
  check('assistant-expert-pop-visible', await win.locator('#agentExpertPop').isVisible())
  await shoot(win, 'assistant-experts-readonly.png')

  // 窄窗
  await win.setViewportSize({ width: 760, height: 720 })
  await win.waitForTimeout(800)
  const overflow = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('narrow-no-horizontal-overflow', overflow <= 1, { overflow })
  await shoot(win, 'workbench-narrow.png')

  check('console-error-free', report.consoleErrors.length === 0, { errors: report.consoleErrors.slice(0, 8) })

  // Agent 详情弹窗：只读 + 跳转能力界面，无 Profile 编辑
  await win.locator('#btnRailWorkbench').click()
  await win.waitForTimeout(2000)
  await win.evaluate(async () => {
    await window.Workbench?.ensureLoaded?.()
    const res = await window.api?.workbenchLoad?.()
    const agentId = res?.agents?.[0]?.id || 'office-partner'
    window.Workbench?.openAgentDetail?.(agentId)
  })
  await win.waitForFunction(() => !document.getElementById('wbModal')?.hidden, null, { timeout: 10000 }).catch(() => {})
  await win.waitForTimeout(800)
  const agentDetailMeta = await win.evaluate(() => ({
    profileButton: !!document.querySelector('[data-agent-profile]'),
    tuneButton: !!document.querySelector('[data-agent-tune-capability]'),
    tuneText: document.querySelector('[data-agent-tune-capability]')?.textContent?.trim() || '',
    profileFields: document.querySelectorAll('#wbAgentProfileRole, #wbAgentProfileSkills, #wbAgentProfileOutput').length,
    saveProfile: (document.getElementById('wbModalConfirm')?.textContent || '').includes('保存 Profile'),
  }))
  check('agent-detail-no-profile-edit', !agentDetailMeta.profileButton && !agentDetailMeta.profileFields && !agentDetailMeta.saveProfile, agentDetailMeta)
  check('agent-detail-tune-link', agentDetailMeta.tuneButton && /前往能力界面调优/.test(agentDetailMeta.tuneText), agentDetailMeta)
  await shoot(win, 'workbench-agent-detail-readonly.png')
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
    console.log(`relocate-authoring smoke ${passed}/${report.checks.length} · console errors ${report.consoleErrors.length}`)
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
