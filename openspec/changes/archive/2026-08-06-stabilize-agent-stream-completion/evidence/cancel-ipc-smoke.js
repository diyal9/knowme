'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const realUserData = path.join(process.env.APPDATA || '', 'KnowMe')

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-cancel-ipc-'))
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })
  for (const name of ['settings.json', 'settings.json.bak']) {
    const source = path.join(realUserData, name)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(userDataDir, name))
  }

  const report = {
    ok: false,
    cancelledDuringRun: false,
    settled: false,
    cloneError: false,
    consoleErrors: [],
  }
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      KNOWME_AGENT_EXECUTOR: 'kernel',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
    timeout: 120000,
  })

  try {
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', message => {
      if (message.type() === 'error' && !/favicon|DevTools|Autofill|Electron Security Warning/i.test(message.text())) {
        report.consoleErrors.push(message.text())
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.locator('#btnRailAi').click()
    await window.locator('#agentInput').waitFor({ state: 'visible', timeout: 20000 })
    await window.locator('#agentInput').fill(
      '请详细分析 KnowMe 的功能与架构，至少写 1500 字并分章节输出；在回答完成前持续流式生成。',
    )
    await window.locator('#agentSend').click()

    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const running = await window.locator('#agentSend').evaluate(node => node.classList.contains('is-running'))
      if (running) {
        report.cancelledDuringRun = true
        await window.locator('#agentSend').click()
        break
      }
      await window.waitForTimeout(100)
    }

    await window.waitForFunction(
      () => !document.getElementById('agentSend')?.classList.contains('is-running'),
      null,
      { timeout: 30000 },
    )
    const chatText = await window.locator('#agentChatLog').innerText()
    report.settled = true
    report.cloneError = /An object could not be cloned|Error invoking remote method 'ai-generate'/i.test(chatText)
    report.stopped = /已停止生成|请求已取消/i.test(chatText)
    report.ok = report.cancelledDuringRun && report.settled && !report.cloneError && report.consoleErrors.length === 0

    await window.screenshot({
      path: path.join(OUT, 'screenshots', 'cancel-ipc-smoke.png'),
      fullPage: true,
    })
  } finally {
    await app.close()
  }

  fs.writeFileSync(
    path.join(OUT, 'cancel-ipc-smoke.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )
  console.log(JSON.stringify(report))
  if (!report.ok) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
