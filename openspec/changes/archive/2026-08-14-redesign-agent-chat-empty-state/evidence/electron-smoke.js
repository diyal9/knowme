'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'electron-smoke.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.')",
    "}",
    '$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique',
    'if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }',
  ].join(' ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch { /* no matching KnowMe process */ }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(resolve => setTimeout(resolve, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-chat-launch-'))
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
    await window.waitForTimeout(1600)
    await window.locator('#btnRailAi').click()
    await window.waitForTimeout(700)

    const launch = await window.evaluate(() => {
      const col = document.querySelector('#agentCol')
      const foot = document.querySelector('.agent-col-foot')
      const cards = [...document.querySelectorAll('.agent-empty-actions .agent-empty-act')]
      return {
        isLaunch: col?.classList.contains('agent-launch-state'),
        footInMount: foot?.parentElement?.matches('[data-agent-composer-mount]'),
        composerCount: document.querySelectorAll('#agentComposer').length,
        inputCount: document.querySelectorAll('#agentInput').length,
        hasHeroHeading: Boolean(document.querySelector('.agent-empty-home .agent-empty-hero')),
        subtitle: document.querySelector('.agent-empty-home .agent-empty-sub')?.textContent?.trim(),
        cardCount: cards.length,
        iconCardCount: cards.filter(card => card.querySelector('.agent-empty-act-mark .ico')).length,
      }
    })
    checks.push({
      id: 'launch-state-centered-composer-and-four-cards',
      pass: launch.isLaunch
        && launch.footInMount
        && launch.composerCount === 1
        && launch.inputCount === 1
        && !launch.hasHeroHeading
        && /KnowMe/.test(launch.subtitle || '')
        && launch.cardCount === 4
        && launch.iconCardCount === 4,
      detail: launch,
    })
    await window.screenshot({ path: path.join(SHOTS, 'agent-launch-state.png'), scale: 'css' })

    const composer = window.locator('#agentInput')
    await composer.fill('你好，帮我规划今天的工作')
    await window.locator('#agentSend').click()
    await window.waitForFunction(() => !document.querySelector('#agentCol')?.classList.contains('agent-launch-state'), null, { timeout: 10000 })
    await window.waitForTimeout(350)

    const conversation = await window.evaluate(() => {
      const col = document.querySelector('#agentCol')
      const foot = document.querySelector('.agent-col-foot')
      const user = document.querySelector('.agent-bubble.user')
      const style = user ? getComputedStyle(user) : null
      return {
        isLaunch: col?.classList.contains('agent-launch-state'),
        footDocked: foot?.parentElement === col && foot?.previousElementSibling?.id === 'agentChatLog',
        userText: user?.textContent?.trim(),
        userAlign: style?.alignSelf,
        userWidth: user?.getBoundingClientRect().width || 0,
        logWidth: document.querySelector('#agentChatLog')?.getBoundingClientRect().width || 0,
      }
    })
    checks.push({
      id: 'first-send-enters-conversation-state',
      pass: !conversation.isLaunch
        && conversation.footDocked
        && /帮我规划今天的工作/.test(conversation.userText || '')
        && conversation.userAlign === 'flex-end'
        && conversation.userWidth > 0
        && conversation.userWidth < conversation.logWidth,
      detail: conversation,
    })
    await window.screenshot({ path: path.join(SHOTS, 'agent-conversation-state.png'), scale: 'css' })

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
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
