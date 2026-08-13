'use strict'

/**
 * 货架两态工作台 Electron 冒烟：
 *   货架渲染 → 卡片可运行性 → 管理抽屉 → 卡片启动进入确认输入 → 返回货架
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'shelf-electron-smoke.json')

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
  // Electron 窗口被遮挡时不产生新帧，截图会卡在 compositor 等待上
  const shoot = async (win, name) => {
    try {
      await win.bringToFront()
      await win.screenshot({ path: path.join(SHOTS, name), animations: 'disabled', timeout: 15000 })
    } catch (error) {
      state.report?.consoleErrors.push(`screenshot ${name}: ${String(error?.message || error).split('\n')[0]}`)
    }
  }
  state.shoot = shoot
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-shelf-'))
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
    if (!/favicon|DevTools|Autofill/i.test(text)) report.consoleErrors.push(text)
  })
  win.on('pageerror', error => report.consoleErrors.push(String(error?.message || error)))

  await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await win.waitForTimeout(4000)

  await win.locator('#btnRailWorkbench').click()
  await win.waitForTimeout(2500)
  await win.evaluate(async () => { await window.Workbench?.ensureLoaded?.() })
  await win.waitForTimeout(2500)

  const shelf = win.locator('#wbShelfSurface')
  check('shelf-active', await shelf.evaluate(node => node.classList.contains('active')))

  const summary = await win.locator('#wbShelfSummary').textContent()
  const cards = await win.locator('#wbShelfGrid .wb-shelf-card').count()
  const runnable = await win.locator('#wbShelfGrid .wb-shelf-card:not(.blocked)').count()
  check('shelf-has-cards', cards > 0, { cards, runnable, summary: (summary || '').trim() })
  check('shelf-summary-honest', /个工作流/.test(summary || '') || cards === 0)

  const emptyVisible = await win.locator('#wbShelfEmpty').isVisible()
  check('empty-state-consistent', cards > 0 ? !emptyVisible : emptyVisible)

  // 唯一启动入口：只有卡片上的「开始」，没有旧的七处入口
  const legacyEntries = await win.evaluate(() => [
    '#wbConsoleNewRun', '#wbLaunchDrawer', '#wbGoalForm', '#wbQuickGoalForm',
    '#wbTabHome', '#wbTabTasks', '#wbFlowLibraryGroups',
  ].filter(sel => document.querySelector(sel)))
  check('legacy-entries-removed', legacyEntries.length === 0, { legacyEntries })

  await shoot(win, 'shelf-desktop.png')

  // 筛选：领域 + 来源 + 搜索
  await win.locator('#wbDomainSwitcher [data-domain="engineering"]').click()
  await win.waitForTimeout(1200)
  const filtered = await win.locator('#wbShelfGrid .wb-shelf-card').count()
  const clearVisible = await win.locator('#wbShelfFilterClear').isVisible()
  check('domain-filter-applies', filtered <= cards && clearVisible, { filtered, clearVisible })
  if (clearVisible) {
    await win.locator('#wbShelfFilterClear').click()
    await win.waitForTimeout(800)
  }
  check('filter-clear-restores', await win.locator('#wbShelfGrid .wb-shelf-card').count() === cards)

  // 工作模式两 Tab：团队管线 / 我的 Agent
  check('mode-tabs-present', await win.locator('#wbModeTabs [data-work-mode]').count() === 2)
  check('team-tab-default-active', await win.locator('#wbModeTabs [data-work-mode="team"]').evaluate(n => n.classList.contains('active')))
  check('domain-visible-on-team', await win.locator('#wbDomainSwitcher').isVisible())

  await win.locator('#wbModeTabs [data-work-mode="mine"]').click()
  await win.waitForTimeout(800)
  check('domain-hidden-on-mine', await win.locator('#wbDomainSwitcher').isHidden())
  const mineHasContent = await win.evaluate(() => {
    const agents = document.querySelectorAll('#wbAgentGrid .wb-my-agent-card').length
    const flows = document.querySelectorAll('#wbShelfGrid .wb-shelf-card').length
    const emptyVisible = !document.getElementById('wbShelfEmpty')?.hidden
    const copyFromTeam = !!document.querySelector('[data-shelf-action="copy-from-team"]')
    // 有内容，或空态自造血（提供从团队管线复制入口）
    return (agents + flows > 0) || (emptyVisible && copyFromTeam)
  })
  check('mine-tab-content-or-selfstock', mineHasContent)
  await shoot(win, 'mine-agent-tab.png')

  await win.locator('#wbModeTabs [data-work-mode="team"]').click()
  await win.waitForTimeout(600)
  check('team-tab-restores-domain', await win.locator('#wbDomainSwitcher').isVisible())

  // 管理抽屉：四个面板都能打开
  await win.locator('#wbManageToggle').click()
  await win.waitForTimeout(500)
  check('manage-menu-opens', await win.locator('#wbManageMenu').isVisible(), {
    debug: await win.evaluate(() => {
      const menu = document.getElementById('wbManageMenu')
      if (!menu) return 'no menu'
      const style = getComputedStyle(menu)
      const rect = menu.getBoundingClientRect()
      return { hidden: menu.hidden, display: style.display, visibility: style.visibility, w: rect.width, h: rect.height }
    }),
  })

  await win.locator('#wbManageMenu [data-manage-panel="agents"]').click()
  await win.waitForTimeout(800)

  // 抽屉内可直接切换分区，无需回到菜单
  for (const panel of ['agents', 'studio', 'daemon', 'automation']) {
    await win.locator(`#wbManageTabs [data-manage-panel="${panel}"]`).click()
    await win.waitForTimeout(800)
    const active = await win.evaluate(id => {
      const drawer = document.getElementById('wbManageDrawer')
      const panelEl = document.querySelector(`.wb-manage-panel[data-manage-panel="${id}"]`)
      return !drawer?.hidden && !!panelEl?.classList.contains('active')
    }, panel)
    check(`manage-panel-${panel}`, active)
  }
  await shoot(win, 'manage-drawer.png')
  await win.locator('#wbManageClose').click()
  await win.waitForTimeout(400)
  check('manage-drawer-closes', await win.locator('#wbManageDrawer').isHidden())

  // 卡片启动 → 确认输入阶段
  const startable = win.locator('#wbShelfGrid .wb-shelf-card:not(.blocked) [data-flow-action="use"]').first()
  if (await startable.count()) {
    await startable.click()
    await win.waitForTimeout(1500)
    check('run-surface-active', await win.locator('#wbRunSurface').evaluate(node => node.classList.contains('active')))
    check('run-stage-input', await win.locator('#wbRunStageInput').isVisible())
    check('run-input-has-goal-field', await win.locator('#wbRunGoalInput').count() > 0)
    const backend = await win.locator('#wbRunBackendNote').textContent()
    check('run-backend-decided', /执行方式由系统决定/.test(backend || ''), { backend: (backend || '').trim() })
    await shoot(win, 'run-input-stage.png')

    // 真的把这一条跑起来：确认输入 → 执行中
    await win.locator('#wbRunGoalInput').fill('整理今天的会议纪要并生成待办')
    await win.locator('#wbRunInputStart').click()
    await win.waitForTimeout(4000)
    const stage = await win.evaluate(() => ({
      live: !document.getElementById('wbRunStageLive')?.hidden,
      result: !document.getElementById('wbRunStageResult')?.hidden,
      input: !document.getElementById('wbRunStageInput')?.hidden,
      status: document.getElementById('wbRunStatus')?.textContent?.trim() || '',
      stepper: document.querySelector('#wbRunStepper [data-run-step="running"]')?.className || '',
    }))
    // 快流程会直接跑完，落在执行中或产物都算真的起跑了；回到确认输入说明没跑起来
    check('run-leaves-input-stage', (stage.live || stage.result) && !stage.input, stage)
    check('run-shows-live-status', stage.status.length > 0, { status: stage.status })
    await shoot(win, 'run-live-stage.png')

    // 全屏遮罩一旦残留就会吞掉所有点击，必须显式失败而不是等到超时
    const blocking = await win.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, 24)
      const mask = el?.closest('.wb-modal-mask, .wb-auto-modal-mask')
      return mask ? `${mask.id}.${mask.className}` : ''
    })
    check('no-blocking-mask-during-run', blocking === '', { blocking })

    // 运行视图必须是「顶栏在上、内容在下」的单列，历史的两栏 grid 会把步骤条挤成竖条
    const runLayout = await win.evaluate(() => {
      const shell = document.getElementById('wbTaskDashboard')
      const bar = document.querySelector('.wb-run-topbar')
      const body = document.getElementById('wbRunBody')
      if (!shell || !bar || !body) return null
      return {
        columns: getComputedStyle(shell).gridTemplateColumns,
        barBottom: Math.round(bar.getBoundingClientRect().bottom),
        bodyTop: Math.round(body.getBoundingClientRect().top),
        barTop: Math.round(bar.getBoundingClientRect().top),
      }
    })
    check('run-topbar-sits-above-body', !!runLayout && runLayout.barBottom <= runLayout.bodyTop + 2, runLayout)
    check('run-shell-is-single-column', !!runLayout && runLayout.columns === 'none', runLayout)

    await win.evaluate(() => {
      const foot = document.querySelector('[data-run-action="back"]')
      if (foot) {
        foot.click()
        return
      }
      document.getElementById('wbRunInputCancel')?.click()
    })
    await win.waitForTimeout(1000)
    check('cancel-returns-to-shelf', await win.locator('#wbShelfSurface').evaluate(node => node.classList.contains('active')))
    check('running-toggle-visible-after-launch', await win.locator('#wbRunningToggle').isVisible())
  } else {
    check('run-surface-active', false, { reason: 'no runnable workflow on shelf' })
  }

  // 窄窗适配
  await win.setViewportSize({ width: 760, height: 720 })
  await win.waitForTimeout(800)
  const overflow = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('narrow-no-horizontal-overflow', overflow <= 1, { overflow })
  await shoot(win, 'shelf-narrow.png')

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
    console.log(`shelf smoke ${passed}/${report.checks.length} · console errors ${report.consoleErrors.length}`)
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
