'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'collaboration-model-electron-smoke.json')

function killApp() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try { execFileSync('taskkill.exe', ['/F', '/IM', image, '/T'], { stdio: 'ignore' }) } catch { /* not running */ }
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-collab-smoke-'))
  const report = { at: new Date().toISOString(), ok: false, checks: [], consoleErrors: [] }
  killApp()
  const app = await electron.launch({ cwd: ROOT, executablePath: require('electron'), args: ['.', `--user-data-dir=${userDataDir}`], env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }, timeout: 120000 })
  try {
    const page = await app.firstWindow({ timeout: 90000 })
    page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools|Autofill/i.test(message.text())) report.consoleErrors.push(message.text()) })
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#btnRailAi').waitFor({ state: 'visible', timeout: 60000 })
    report.checks.push({ id: 'personal-agent-rail', ok: await page.locator('#btnRailAi[aria-label="我的 KnowMe"]').count() === 1 })

    await page.locator('#btnRailCapabilities').click()
    await page.locator('[data-testid="capability-hub-surface"]').waitFor({ state: 'visible' })
    report.checks.push({ id: 'agent-center', ok: await page.getByText('Agent 中心', { exact: true }).count() > 0 })
    report.checks.push({ id: 'agent-skill-mcp-tabs', ok: await page.getByRole('tab', { name: 'Agent' }).count() === 1 && await page.getByRole('tab', { name: 'Skill' }).count() === 1 && await page.getByRole('tab', { name: 'MCP 连接器' }).count() === 1 })

    await page.locator('#btnRailWorkbench').click()
    await page.locator('[data-testid="taskhome-surface"]').waitFor({ state: 'visible' })
    report.checks.push({ id: 'expert-task-home', ok: await page.getByRole('heading', { name: '发起正式任务' }).count() === 1 && await page.getByRole('heading', { name: '专家任务' }).count() === 1 })

    await page.locator('#btnSettings').click()
    await page.locator('[data-testid="settings-surface"]').waitFor({ state: 'visible' })
    await page.getByRole('tab', { name: '我的 KnowMe' }).click()
    report.checks.push({ id: 'growth-entry', ok: await page.getByRole('button', { name: '前往培养' }).count() === 1 && await page.getByRole('button', { name: '打开 Agent 中心' }).count() === 1 })

    await page.screenshot({ path: path.join(SHOTS, 'collaboration-model.png'), fullPage: false })
    report.checks.push({ id: 'no-console-errors', ok: report.consoleErrors.length === 0 })
    report.ok = report.checks.every(check => check.ok)
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    if (!report.ok) throw new Error('collaboration smoke checks failed')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await app.close().catch(() => null)
    killApp()
  }
}

main().catch(error => { console.error(error); process.exit(1) })
