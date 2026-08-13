'use strict'

/**
 * ux-polish-desktop-smoke — 能力界面技能闭环与工作台编排的桌面冒烟。
 * 用法：node openspec/changes/polish-capability-and-workflow-authoring/evidence/ux-polish-desktop-smoke.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = process.cwd()
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'ux-polish-desktop-smoke.json')
const REAL_USER_DATA = path.join(process.env.APPDATA || '', 'KnowMe')

const report = { startedAt: new Date().toISOString(), checks: [], consoleErrors: [], ok: false }

function check(id, ok, detail = {}) {
  report.checks.push({ id, ok: !!ok, ...detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail.note ? ` — ${detail.note}` : ''}`)
}

function makeUserDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-uxpolish-'))
  if (fs.existsSync(REAL_USER_DATA)) {
    for (const name of ['settings.json']) {
      const src = path.join(REAL_USER_DATA, name)
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, name))
    }
  }
  return dir
}

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* 没有残留进程 */ }
  }
}

async function launch() {
  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1500))
  const userDataDir = makeUserDataDir()
  report.userDataDir = userDataDir
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  window.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) report.consoleErrors.push(text)
  })
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(3500)
  return { app, window }
}

async function capabilityHubChecks(window) {
  await window.locator('#btnRailCapabilities').click()
  await window.waitForTimeout(2500)
  const hub = window.frameLocator('.capability-hub-frame')

  await hub.locator('#hubGrid .hub-card').first().waitFor({ state: 'visible', timeout: 30000 })
  check('hub-confirm-shell', await hub.locator('#hubConfirmDialog').count() === 1, { note: '统一确认弹窗已就位' })

  await hub.locator('#hubGrid .hub-card').first().click()
  await hub.locator('#hubDrawer').waitFor({ state: 'visible', timeout: 15000 })
  const expertDrawer = await hub.locator('#hubDrawerBody').innerText()
  check('hub-expert-composition', expertDrawer.includes('装配'), {
    note: '专家详情展示装配的技能与连接器',
    sample: expertDrawer.slice(0, 160),
  })
  await window.screenshot({ path: path.join(SHOTS, 'hub-expert-composition.png') })
  await hub.locator('#hubDrawerClose').click()
  await window.waitForTimeout(500)

  const shellTab = window.locator('[data-capability-hub-tab="skills"]')
  if (await shellTab.isVisible().catch(() => false)) await shellTab.click()
  else await hub.locator('[data-tab="skills"]').click()
  await window.waitForTimeout(1500)
  const skillCards = hub.locator('#hubGrid .hub-card')
  const skillCount = await skillCards.count()
  if (!skillCount) {
    check('hub-skill-tasks', false, { note: '技能目录为空，无法验证任务列表' })
    return
  }
  await skillCards.first().click()
  await hub.locator('#hubDrawer').waitFor({ state: 'visible', timeout: 15000 })
  const skillDrawer = await hub.locator('#hubDrawerBody').innerText()
  check('hub-skill-tasks', skillDrawer.includes('可以做什么'), {
    note: '技能详情展示“可以做什么”与试用入口',
    hasTryButton: await hub.locator('[data-act="trySkill"]').count() > 0,
    hasUsage: skillDrawer.includes('装配它的专家'),
    sample: skillDrawer.slice(0, 200),
  })
  await window.screenshot({ path: path.join(SHOTS, 'hub-skill-tasks.png') })
  await hub.locator('#hubDrawerClose').click()
  await window.waitForTimeout(400)
}

async function openStudio(window) {
  await window.locator('#btnRailWorkbench').click()
  await window.waitForTimeout(2000)
  await window.evaluate(() => window.Workbench?.openPage?.('studio'))
  await window.waitForTimeout(1200)
  const visible = await window.locator('#wbStudioSurface').isVisible().catch(() => false)
  if (visible) return true
  const entry = window.locator('[data-shelf-action="orchestrate"], #wbWorkflowManageNew, [data-manage-action="new"]').first()
  if (await entry.count()) {
    await entry.click()
    await window.waitForTimeout(1200)
  }
  return window.locator('#wbStudioSurface').isVisible().catch(() => false)
}

async function studioChecks(window) {
  const opened = await openStudio(window)
  check('studio-open', opened, { note: '可进入编排界面' })
  if (!opened) return

  const addButtons = window.locator('#wbStudioAgents [data-studio-add]')
  const available = await addButtons.count()
  if (available < 2) {
    check('studio-skill-picker', false, { note: `可用 Agent 不足（${available}），跳过编排交互检查` })
    return
  }
  await addButtons.nth(0).click()
  await window.waitForTimeout(500)
  await addButtons.nth(1).click()
  await window.waitForTimeout(700)

  await window.locator('#wbStudioGraph [data-studio-node]').first().click()
  await window.waitForTimeout(500)
  const inspectorText = await window.locator('#wbStudioInspector').innerText()
  check('studio-skill-picker', inspectorText.includes('本步骤技能'), {
    note: '检查器内可直接配置技能',
    checkboxes: await window.locator('#wbStudioInspector [data-studio-skill]').count(),
  })
  const skillBox = window.locator('#wbStudioInspector [data-studio-skill]').first()
  if (await skillBox.count()) {
    await skillBox.check()
    await window.waitForTimeout(400)
    const nodeSummary = await window.locator('#wbStudioGraph [data-studio-node]').first().innerText()
    check('studio-skill-written', /\d+ 个 Skill/.test(nodeSummary), {
      note: '勾选技能后写入节点并回显数量',
      sample: nodeSummary.replace(/\s+/g, ' ').slice(0, 120),
    })
  }
  await window.screenshot({ path: path.join(SHOTS, 'studio-skill-picker.png') })

  const firstBefore = await window.locator('#wbStudioGraph [data-studio-node]').first().getAttribute('data-studio-node')
  await window.locator('#wbStudioGraph [data-studio-node]').first().focus()
  await window.keyboard.press('Alt+ArrowDown')
  await window.waitForTimeout(500)
  const firstAfter = await window.locator('#wbStudioGraph [data-studio-node]').first().getAttribute('data-studio-node')
  const focusedNode = await window.evaluate(() => document.activeElement?.getAttribute?.('data-studio-node') || '')
  check('studio-keyboard-reorder', firstBefore !== firstAfter && focusedNode === firstBefore, {
    note: 'Alt+↓ 调整顺序并把焦点留在被移动的步骤',
    firstBefore,
    firstAfter,
    focusedNode,
  })

  const viewport = window.viewportSize()
  await window.setViewportSize({ width: 1080, height: viewport?.height || 800 })
  await window.waitForTimeout(700)
  check('studio-narrow-inspector', await window.locator('#wbStudioInspector').isVisible(), {
    note: '1080px 宽度下检查器仍可见',
  })
  await window.screenshot({ path: path.join(SHOTS, 'studio-narrow-1080.png') })
  await window.setViewportSize({ width: viewport?.width || 1440, height: viewport?.height || 900 })
  await window.waitForTimeout(500)

  await window.locator('#wbStudioBack').click()
  await window.waitForTimeout(600)
  const leaveVisible = await window.locator('#wbLeaveModal').isVisible()
  check('studio-dirty-guard', leaveVisible, { note: '有未保存改动时返回会先确认' })
  await window.screenshot({ path: path.join(SHOTS, 'studio-leave-guard.png') })
  if (leaveVisible) {
    await window.locator('[data-leave-choice="discard"]').click()
    await window.waitForTimeout(600)
    check('studio-dirty-discard', !(await window.locator('#wbStudioSurface').isVisible()), { note: '放弃修改后离开编排' })
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const { app, window } = await launch()
  try {
    await capabilityHubChecks(window)
    await studioChecks(window)
    report.ok = report.checks.every(item => item.ok) && report.consoleErrors.length === 0
  } catch (error) {
    report.error = error?.message || String(error)
    report.ok = false
    try { await window.screenshot({ path: path.join(SHOTS, 'failure.png') }) } catch { /* 窗口可能已关闭 */ }
  } finally {
    report.finishedAt = new Date().toISOString()
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
    await app.close().catch(() => {})
    killKnowMeProcesses()
  }
  console.log(report.ok ? 'SMOKE OK' : `SMOKE FAILED${report.error ? `: ${report.error}` : ''}`)
  process.exit(report.ok ? 0 : 1)
}

main()
