'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = process.cwd()
const SHOTS = path.join(__dirname, 'screenshots')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "$targets = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and ($_.CommandLine -match 'knowme|electron \\.') }; " +
      "$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique; " +
      "if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"
    ], { stdio: 'ignore' })
  } catch { /* none */ }
}

async function launch({ executor, userDataDir }) {
  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 2500))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KNOWME_AGENT_EXECUTOR: executor, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  await window.waitForLoadState('domcontentloaded')
  await window.waitForTimeout(4000)
  return { app, window }
}

async function openAgent(window) {
  await window.locator('#btnRailAi').click()
  await window.waitForTimeout(800)
  await window.locator('#agentInput').waitFor({ state: 'visible', timeout: 20000 })
}

async function waitDone(window, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const s = await window.evaluate(() => {
      const log = document.getElementById('agentChatLog')
      const meta = document.getElementById('agentComposerMeta')
      const send = document.getElementById('agentSend')
      const bubbles = log ? Array.from(log.querySelectorAll('.agent-bubble')) : []
      const last = bubbles[bubbles.length - 1]
      return {
        busy: meta?.classList.contains('busy') || false,
        running: send?.classList.contains('is-running') || false,
        errorText: log?.querySelector('.agent-bubble.err, .agent-bubble.assistant.err')?.innerText?.slice(0, 300) || '',
        lastText: last?.innerText?.slice(0, 400) || '',
        timelineText: last?.querySelector('[data-execution-timeline]')?.innerText?.slice(0, 200) || '',
        runPhaseInDom: !!log?.querySelector('[data-run-phase]'),
        enumInTimeline: /\b(PREPARE|CONTEXT|MODEL|TOOL|RECOVER|VERIFY|PERSIST|runPhase)\b/i.test(
          (last?.querySelector('[data-execution-timeline]')?.innerText || '') + (last?.innerText || '')
        ),
      }
    })
    if (!s.busy && !s.running && (s.lastText || s.errorText)) return s
    await window.waitForTimeout(800)
  }
  throw new Error('timeout')
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const out = { at: new Date().toISOString(), checks: [] }

  // No API key — fresh isolated profile
  const noKeyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-nokey-'))
  fs.writeFileSync(path.join(noKeyDir, 'settings.json'), JSON.stringify({
    apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'auto',
  }, null, 2))
  {
    const { app, window } = await launch({ executor: 'kernel', userDataDir: noKeyDir })
    try {
      await openAgent(window)
      await window.locator('#agentInput').fill('你好')
      await window.locator('#agentSend').click()
      const s = await waitDone(window, 30000)
      const ok = /API Key|API 设置|未填写|配置/i.test(s.errorText)
      out.checks.push({ id: 'SEC-no-api-key-isolated', ok, errorText: s.errorText.slice(0, 200), enumInTimeline: s.enumInTimeline })
      await window.screenshot({ path: path.join(SHOTS, 'qa-no-api-key-isolated.png') })
    } finally {
      await app.close()
    }
  }

  // A5 runPhase — fresh session, check last bubble only
  const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fresh-'))
  const realSettings = path.join(process.env.APPDATA || '', 'KnowMe', 'settings.json')
  if (fs.existsSync(realSettings)) fs.copyFileSync(realSettings, path.join(freshDir, 'settings.json'))
  {
    const { app, window } = await launch({ executor: 'kernel', userDataDir: freshDir })
    try {
      await openAgent(window)
      await window.locator('#agentInput').fill('你好')
      await window.locator('#agentSend').click()
      const s = await waitDone(window, 120000)
      out.checks.push({
        id: 'A5-runPhase-fresh-session',
        ok: !s.enumInTimeline && !s.runPhaseInDom,
        enumInTimeline: s.enumInTimeline,
        timelineSample: s.timelineText.slice(0, 120),
      })
      await window.screenshot({ path: path.join(SHOTS, 'qa-a5-fresh-chat.png') })
    } finally {
      await app.close()
    }
  }

  out.ok = out.checks.every(c => c.ok)
  fs.writeFileSync(path.join(__dirname, 'tester-isolated-checks.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  if (!out.ok) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
