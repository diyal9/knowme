'use strict'

/**
 * Grounding change Electron 冒烟：验证工作区可启动、无业务 console error、保存截图。
 * 不覆盖完整飞书会议 E2E（需真实飞书授权）。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = process.cwd()
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'grounding-electron-smoke.json')

async function main() {
  let electron
  try {
    ({ _electron: electron } = require('playwright'))
  } catch (err) {
    const report = {
      ok: false,
      blocked: true,
      reason: 'playwright not available',
      error: String(err.message || err),
    }
    fs.mkdirSync(SHOTS, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }

  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-grounding-smoke-'))

  if (process.platform === 'win32') {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', 'electron.exe', '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
    await new Promise(r => setTimeout(r, 1500))
  }

  const report = {
    ok: false,
    userDataDir,
    consoleErrors: [],
    screenshot: null,
    checks: [],
  }

  let app
  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        KNOWME_GROUNDING_RUNTIME: 'runtime',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      timeout: 120000,
    })

    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) {
          report.consoleErrors.push(text)
        }
      }
    })

    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(3000)

    const shotPath = path.join(SHOTS, 'workspace-load.png')
    await window.screenshot({ path: shotPath, scale: 'css' })
    report.screenshot = path.relative(OUT, shotPath).replace(/\\/g, '/')
    report.checks.push({ id: 'workspace-screenshot', pass: fs.existsSync(shotPath) })

    const hasAgentLog = await window.locator('#agentChatLog').count()
    report.checks.push({ id: 'agent-chat-log-present', pass: hasAgentLog > 0 })

    const hasGroundingLabels = await window.evaluate(() => typeof window.GroundingLabels?.formatToolLabelForUser === 'function')
    report.checks.push({ id: 'grounding-labels-loaded', pass: hasGroundingLabels })

    report.checks.push({ id: 'no-console-errors', pass: report.consoleErrors.length === 0 })
    report.ok = report.checks.every(c => c.pass)
  } catch (err) {
    report.error = String(err.message || err)
    report.blocked = /timeout|ENOENT/i.test(report.error)
  } finally {
    if (app) await app.close().catch(() => {})
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
