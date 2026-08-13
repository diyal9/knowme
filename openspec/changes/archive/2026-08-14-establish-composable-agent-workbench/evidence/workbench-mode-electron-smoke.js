'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'workbench-mode-electron-smoke.json')

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

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-workbench-mode-'))
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

    const firstState = await window.evaluate(() => window.api.workbenchModeList())
    const initialMode = await window.locator('#wbModeSelect').inputValue()
    const modeIds = firstState.modes.map(mode => mode.id)

    await window.screenshot({
      path: path.join(SHOTS, 'workbench-office-overview.png'),
      scale: 'css',
    })

    await window.locator('#wbModeSelect').selectOption('engineering')
    await window.waitForFunction(() => document.querySelector('#wbOverviewTitle')?.textContent?.includes('软件研发'))
    const engineeringCopy = await window.locator('#wbOverviewTitle').textContent()
    const engineeringEmpty = await window.locator('#wbHomeWorkflowList').textContent()
    const engineeringWorkflowCount = await window.locator('#wbHomeWorkflowList .wb-home-workflow').count()

    await window.locator('#wbModeSelect').selectOption('office')
    await window.waitForFunction(() => document.querySelector('#wbOverviewTitle')?.textContent?.includes('日常办公'))
    await window.locator('#btnRailCapabilities').click()
    const hub = window.frameLocator('.capability-hub-frame')
    await hub.locator('.hub-card, .hub-featured-card').first().waitFor({ state: 'visible', timeout: 30000 })

    const expert = await window.evaluate(async () => {
      const result = await window.api.capabilityList({ kind: 'expert' })
      return (result.items || []).find(item =>
        item.kind === 'expert' && !['high', 'critical'].includes(item.risk?.level)
      ) || null
    })
    if (!expert) throw new Error('没有可用于组队验证的低风险 Expert')

    const expertCard = hub.locator(`[data-id="${expert.id}"]`).first()
    await expertCard.scrollIntoViewIfNeeded()
    await expertCard.click()
    const addButton = hub.locator('[data-act="addExpert"]')
    await addButton.waitFor({ state: 'visible', timeout: 30000 })
    await addButton.click()
    await window.waitForFunction(() => {
      const frame = document.querySelector('.capability-hub-frame')
      const button = frame?.contentDocument?.querySelector('[data-act="addExpert"]')
      return button?.textContent?.includes('已在工作台')
    }, null, { timeout: 30000 })

    await window.locator('#btnRailCapabilities').click()
    await window.locator('#wbTabTeam').click()
    await window.locator(`[data-bound-expert="${expert.id}"]`).waitFor({ state: 'visible', timeout: 30000 })
    const teamText = await window.locator('#wbTeamList').textContent()
    await window.screenshot({
      path: path.join(SHOTS, 'workbench-office-team.png'),
      scale: 'css',
    })

    await window.locator('#wbTabHome').click()
    await window.locator('#wbModeSelect').selectOption('visual')
    await window.waitForFunction(() => document.querySelector('#wbOverviewTitle')?.textContent?.includes('视觉创作'))
    const visualEmpty = await window.locator('#wbHomeWorkflowList').textContent()
    const activeBeforeReload = await window.evaluate(async () => (await window.api.workbenchModeList()).activeModeId)

    await window.reload({ waitUntil: 'domcontentloaded' })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#wbModeSelect').waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForFunction(() => document.querySelector('#wbModeSelect')?.value === 'visual')
    const activeAfterReload = await window.evaluate(async () => (await window.api.workbenchModeList()).activeModeId)
    const bounds = await window.locator('#wbHomePage').evaluate(element => ({
      overflowX: element.scrollWidth > element.clientWidth,
      width: element.getBoundingClientRect().width,
    }))

    const checks = [
      { id: 'three-built-in-modes', pass: ['office', 'engineering', 'visual'].every(id => modeIds.includes(id)), detail: modeIds },
      { id: 'office-default', pass: initialMode === 'office', detail: initialMode },
      { id: 'engineering-positioning', pass: engineeringCopy?.includes('软件研发'), detail: engineeringCopy },
      {
        id: 'engineering-honest-workflow-state',
        pass: engineeringWorkflowCount > 0 || /连接研发执行服务|暂无可用工作流/.test(engineeringEmpty || ''),
        detail: { engineeringWorkflowCount, copy: engineeringEmpty },
      },
      { id: 'hub-adds-expert-to-current-mode', pass: teamText?.includes(expert.name), detail: { id: expert.id, name: expert.name } },
      { id: 'visual-honest-empty-state', pass: visualEmpty?.includes('先添加适合这个岗位的 Agent'), detail: visualEmpty },
      {
        id: 'active-mode-survives-reload',
        pass: activeBeforeReload === 'visual' && activeAfterReload === 'visual',
        detail: { activeBeforeReload, activeAfterReload },
      },
      { id: 'overview-no-horizontal-overflow', pass: !bounds.overflowX, detail: bounds },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      viewport: { width: 1360, height: 860 },
      expert: { id: expert.id, name: expert.name },
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
