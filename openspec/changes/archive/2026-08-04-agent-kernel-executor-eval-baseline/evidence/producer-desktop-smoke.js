'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = process.cwd()
const OUT = path.join(__dirname)
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'producer-desktop-smoke.json')
const REAL_USER_DATA = path.join(process.env.APPDATA || '', 'KnowMe')

function makeUserDataDir({ withSettings = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-producer-'))
  if (withSettings && fs.existsSync(REAL_USER_DATA)) {
    for (const name of ['settings.json', 'settings.json.bak']) {
      const src = path.join(REAL_USER_DATA, name)
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, name))
    }
  }
  return dir
}

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "$targets = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and ($_.CommandLine -match 'knowme|electron \\.') }; " +
      "$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique; " +
      "if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"
    ], { stdio: 'ignore' })
  } catch { /* none */ }
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function launchApp({ executor = 'kernel', userDataDir = null, withSettings = true } = {}) {
  const udd = userDataDir || makeUserDataDir({ withSettings })
  const report = {
    executor,
    userDataDir: udd,
    consoleErrors: [],
    mainLogs: [],
    checks: [],
  }

  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 2500))

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${udd}`],
    env: {
      ...process.env,
      KNOWME_AGENT_EXECUTOR: executor,
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
  await window.waitForTimeout(4000)

  return { app, window, report }
}

async function ensureAgentPanel(window) {
  const rail = window.locator('#btnRailAi')
  await rail.waitFor({ state: 'visible', timeout: 30000 })
  await rail.click()
  await window.waitForTimeout(800)
  await window.locator('#agentInput').waitFor({ state: 'visible', timeout: 20000 })
}

async function sendChat(window, text) {
  const input = window.locator('#agentInput')
  await input.fill(text)
  await window.locator('#agentSend').click()
}

async function waitForAssistantDone(window, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await window.evaluate(() => {
      const log = document.getElementById('agentChatLog')
      const meta = document.getElementById('agentComposerMeta')
      const send = document.getElementById('agentSend')
      const bubbles = log ? Array.from(log.querySelectorAll('.agent-bubble')) : []
      const last = bubbles[bubbles.length - 1]
      const timeline = last?.querySelector('[data-execution-timeline]')
      const timelineText = timeline?.innerText || ''
      const assistantText = last?.classList.contains('assistant') ? (last.innerText || '') : ''
      const errorBubble = log?.querySelector('.agent-bubble.error')
      return {
        bubbleCount: bubbles.length,
        busy: meta?.classList.contains('busy') || false,
        isRunning: send?.classList.contains('is-running') || false,
        assistantText: assistantText.slice(0, 500),
        timelineText: timelineText.slice(0, 500),
        hasTimeline: !!timeline,
        errorText: document.querySelector('.agent-bubble.assistant.err, .agent-bubble.err')?.innerText?.slice(0, 300) || '',
        runPhaseVisible: /PREPARE|MODEL|TOOL|runPhase/i.test(log?.innerText || ''),
      }
    })
    if (!state.busy && !state.isRunning && (state.assistantText || state.errorText)) {
      return state
    }
    await window.waitForTimeout(800)
  }
  throw new Error('assistant response timeout')
}

async function runKernelSuite() {
  const { app, window, report } = await launchApp({ executor: 'kernel' })
  try {
    await ensureAgentPanel(window)
    report.checks.push({ id: 'kernel-rail-agent', ok: true })

    // S1 / acceptance: 普通 chat
    await sendChat(window, '你好')
    const s1 = await waitForAssistantDone(window, 120000)
    const s1Ok = !!s1.assistantText && !/白屏|undefined/i.test(s1.assistantText)
    report.checks.push({
      id: 'S1-chat-simple',
      ok: s1Ok,
      hasTimeline: s1.hasTimeline,
      sample: s1.assistantText.slice(0, 120),
      timelineSample: s1.timelineText.slice(0, 160),
      runPhaseLeaked: s1.runPhaseVisible,
    })
    await window.screenshot({ path: path.join(SHOTS, 'kernel-s1-chat.png') })

    // S2: 知识检索意图
    await sendChat(window, '查一下知识库里关于团队约定的内容')
    const s2 = await waitForAssistantDone(window, 120000)
    const s2Ok = !!(s2.assistantText || s2.errorText) && !s2.runPhaseVisible
    report.checks.push({
      id: 'S2-knowledge-retrieval',
      ok: s2Ok,
      hasTimeline: s2.hasTimeline,
      timelineHasRetrieval: /知识|检索|资料|上下文|准备/i.test(s2.timelineText + s2.assistantText),
      sample: (s2.assistantText || s2.errorText).slice(0, 160),
      runPhaseLeaked: s2.runPhaseVisible,
    })
    await window.screenshot({ path: path.join(SHOTS, 'kernel-s2-knowledge.png') })

    // S3: 取消生成
    await sendChat(window, '请用不少于800字详细介绍 KnowMe 便签产品的功能与使用场景，分段输出。')
    await window.waitForTimeout(2500)
    const running = await window.evaluate(() => ({
      busy: document.getElementById('agentComposerMeta')?.classList.contains('busy'),
      isRunning: document.getElementById('agentSend')?.classList.contains('is-running'),
    }))
    if (running.busy || running.isRunning) {
      await window.locator('#agentSend').click()
      await window.waitForTimeout(2000)
    }
    const s3 = await waitForAssistantDone(window, 30000)
    const composerReady = await window.evaluate(() => {
      const meta = document.getElementById('agentComposerMeta')
      const input = document.getElementById('agentInput')
      return {
        notBusy: !meta?.classList.contains('busy'),
        canType: !input?.disabled,
        stopped: /已停止|停止生成/i.test(document.getElementById('agentChatLog')?.innerText || ''),
      }
    })
    await sendChat(window, '取消后继续：收到')
    const s3Follow = await waitForAssistantDone(window, 90000)
    report.checks.push({
      id: 'S3-cancel-and-continue',
      ok: composerReady.notBusy && composerReady.canType && (composerReady.stopped || !!s3.assistantText) && !!s3Follow.assistantText,
      stopped: composerReady.stopped,
      followUp: s3Follow.assistantText.slice(0, 80),
    })
    await window.screenshot({ path: path.join(SHOTS, 'kernel-s3-cancel.png') })

    report.checks.push({
      id: 'S4-kernel-mode',
      ok: report.checks.filter(c => c.id.startsWith('S1') || c.id.startsWith('S2') || c.id.startsWith('S3')).every(c => c.ok),
    })

    report.ok = report.checks.every(c => c.ok !== false) && report.consoleErrors.length === 0
    return report
  } finally {
    await app.close()
  }
}

async function runNoKeySuite() {
  const userDataDir = makeUserDataDir({ withSettings: false })
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'auto',
  }, null, 2))
  const { app, window, report } = await launchApp({ executor: 'kernel', userDataDir })
  try {
    await ensureAgentPanel(window)
    await sendChat(window, '你好')
    const state = await waitForAssistantDone(window, 30000)
    const ok = /API Key|API 设置|未填写/i.test(state.errorText)
    report.checks.push({ id: 'acceptance-no-api-key', ok, errorText: state.errorText.slice(0, 200) })
    await window.screenshot({ path: path.join(SHOTS, 'kernel-no-api-key.png') })
    report.ok = ok && report.consoleErrors.length === 0
    return report
  } finally {
    await app.close()
  }
}

async function runLegacySuite() {
  const { app, window, report } = await launchApp({ executor: 'legacy' })
  try {
    await ensureAgentPanel(window)
    await sendChat(window, '你好')
    const s1 = await waitForAssistantDone(window, 120000)
    const ok = !!s1.assistantText || /API Key/i.test(s1.errorText)
    report.checks.push({
      id: 'S6-legacy-chat',
      ok,
      sample: (s1.assistantText || s1.errorText).slice(0, 120),
      hasTimeline: s1.hasTimeline,
    })
    await window.screenshot({ path: path.join(SHOTS, 'legacy-s6-chat.png') })
    report.ok = ok && report.consoleErrors.length === 0
    return report
  } finally {
    await app.close()
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const summary = {
    at: new Date().toISOString(),
    change: 'agent-kernel-executor-eval-baseline',
    role: 'producer',
    suites: {},
    ok: false,
  }

  summary.suites.kernel = await runKernelSuite()
  summary.suites.noApiKey = await runNoKeySuite()
  summary.suites.legacy = await runLegacySuite()

  summary.ok = Object.values(summary.suites).every(s => s.ok)
  fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
