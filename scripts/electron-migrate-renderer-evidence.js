'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..')
const CHANGE = 'migrate-renderer-react-ts'
const SHOTS = path.join(ROOT, 'openspec/changes', CHANGE, 'evidence/screenshots')

const SETTINGS_TABS = [
  ['sources', '内容源'],
  ['ai', 'AI 接口'],
  ['assistant', '助手模式'],
  ['system', '系统配置'],
  ['connectors', '连接器'],
  ['memory', '我的记忆'],
  ['about', '关于'],
]

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function waitForWindow(app, predicate, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      if (await predicate(win)) return win
    }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('window not found within timeout')
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-migrate-evidence-'))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })

  const report = { at: new Date().toISOString(), change: CHANGE, shots: [], checks: [] }
  const workspace = await app.firstWindow({ timeout: 90000 })
  await workspace.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await workspace.waitForTimeout(4000)

  const shot = async (file, win = workspace) => {
    const target = path.join(SHOTS, file)
    await win.screenshot({ path: target, fullPage: false })
    report.shots.push(file)
    report.checks.push({ id: file, ok: fs.existsSync(target) })
  }

  await shot('electron-assistant.png')

  await workspace.getByRole('button', { name: '工作台' }).click()
  await workspace.waitForTimeout(800)
  await shot('electron-workspace.png')

  await workspace.getByRole('tab', { name: '工作流' }).click()
  await workspace.waitForTimeout(800)
  await shot('electron-shelf.png')

  await workspace.getByRole('tab', { name: '管线服务' }).click()
  await workspace.waitForTimeout(800)
  await shot('electron-daemon.png')

  await workspace.getByRole('tab', { name: '专家协作' }).click()
  await workspace.waitForTimeout(400)
  await workspace.getByRole('button', { name: '+ 新建协作' }).click()
  await workspace.waitForTimeout(1200)
  await shot('electron-studio.png')

  await workspace.evaluate(() => window.api?.openSettingsWindow?.())
  const settings = await waitForWindow(app, async w => /设置/.test(await w.title()))
  await settings.waitForLoadState('domcontentloaded')
  await settings.waitForTimeout(1500)
  await shot('electron-settings-sources.png', settings)

  for (const [id, label] of SETTINGS_TABS.slice(1)) {
    await settings.getByRole('tab', { name: label }).click()
    await settings.waitForTimeout(600)
    await shot(`electron-settings-${id}.png`, settings)
  }

  await workspace.evaluate(() => window.api?.openMemoryPanel?.())
  const memory = await waitForWindow(app, async w => /记忆|Memory/i.test(await w.title()))
  await memory.waitForLoadState('domcontentloaded')
  await memory.waitForTimeout(1200)
  await shot('electron-memory.png', memory)

  await workspace.evaluate(() => window.api?.openLogsWindow?.())
  const logs = await waitForWindow(app, async w => /日志/i.test(await w.title()))
  await logs.waitForLoadState('domcontentloaded')
  await logs.waitForTimeout(1200)
  await shot('electron-log-viewer.png', logs)

  report.ok = report.checks.every(item => item.ok)
  fs.writeFileSync(
    path.join(ROOT, 'openspec/changes', CHANGE, 'evidence/electron-evidence.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  await app.close()
  if (!report.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
