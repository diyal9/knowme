'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'electron-smoke.json')

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
  await new Promise(resolve => setTimeout(resolve, 700))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-quick-launcher-'))
  const checks = []
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
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1500)

    const installed = await window.evaluate(() => (
      window.api.capabilityPackInstall({ packId: 'game-studio', source: 'bundled' })
    ))
    checks.push({ id: 'install-game-studio', pass: installed?.ok === true, detail: installed })

    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await window.waitForTimeout(1800)
    await window.locator('#btnRailAi').click()
    await window.waitForTimeout(900)

    const cards = await window.locator('.agent-empty-actions .agent-empty-act[data-pack-id="game-studio"]').allTextContents()
    checks.push({
      id: 'home-four-recommendations',
      pass: cards.length === 4
        && cards.some(text => text.includes('查文档/知识库'))
        && cards.some(text => text.includes('会议总结'))
        && cards.some(text => /相关聊天|分析跟我相关的聊天/.test(text))
        && cards.some(text => text.includes('今日优先级')),
      detail: cards,
    })

    const workflowText = await window.locator('.agent-workflow-entry[data-pack-id="game-studio"]').textContent().catch(() => '')
    checks.push({
      id: 'workflow-intake-separated',
      pass: /启动工作流/.test(workflowText) && /需求梳理/.test(workflowText),
      detail: workflowText,
    })
    await window.screenshot({ path: path.join(SHOTS, 'home-four-cards.png'), scale: 'css' })

    const composer = window.locator('#agentInput')
    await composer.fill('这段草稿必须保留')
    await window.keyboard.press('Control+K')
    await window.waitForTimeout(250)

    const focusedId = await window.evaluate(() => document.activeElement?.id || '')
    const launcherText = await window.locator('#agentQuickMenu').textContent()
    checks.push({
      id: 'launcher-opens-focused-without-internal-categories',
      pass: focusedId === 'agentQuickSearch'
        && !/快捷大类|快捷子项/.test(launcherText)
        && /快捷操作/.test(launcherText),
      detail: { focusedId, launcherText: launcherText.slice(0, 500) },
    })

    const search = window.locator('#agentQuickSearch')
    await search.fill('会议')
    await window.waitForTimeout(120)
    const meetingResults = await window.locator('[data-quick-command]').allTextContents()
    checks.push({
      id: 'launcher-filters-results',
      pass: meetingResults.length >= 1 && meetingResults.every(text => text.includes('会议')),
      detail: meetingResults,
    })
    checks.push({
      id: 'launcher-preserves-composer-draft',
      pass: await composer.inputValue() === '这段草稿必须保留',
      detail: await composer.inputValue(),
    })
    await window.screenshot({ path: path.join(SHOTS, 'command-search.png'), scale: 'css' })

    await search.fill('不存在的任务zz')
    await window.waitForTimeout(120)
    checks.push({
      id: 'launcher-empty-result',
      pass: await window.locator('#agentQuickEmpty.show').count() === 1
        && await window.locator('[data-quick-command]').count() === 0,
    })

    await window.keyboard.press('Escape')
    await window.waitForTimeout(100)
    checks.push({
      id: 'escape-closes-and-restores-composer',
      pass: await window.locator('#agentQuickMenu.show').count() === 0
        && await window.evaluate(() => document.activeElement?.id) === 'agentInput'
        && await composer.inputValue() === '这段草稿必须保留',
    })

    checks.push({ id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors })
  } finally {
    if (app) await app.close().catch(() => {})
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(check => check.pass),
    checks,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
