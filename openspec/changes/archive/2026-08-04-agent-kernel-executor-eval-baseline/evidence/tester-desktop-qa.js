'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = process.cwd()
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'tester-desktop-qa.json')
const REAL_USER_DATA = path.join(process.env.APPDATA || '', 'KnowMe')
const SESSION_MARKER = `QA-SESSION-PERSIST-${Date.now()}`

function makeUserDataDir({ withSettings = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-tester-'))
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

async function launchApp({ executor = 'kernel', userDataDir, withSettings = true } = {}) {
  const udd = userDataDir || makeUserDataDir({ withSettings })
  const report = { executor, userDataDir: udd, consoleErrors: [], checks: [] }

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
  await window.locator('#btnRailAi').click()
  await window.waitForTimeout(800)
  await window.locator('#agentInput').waitFor({ state: 'visible', timeout: 20000 })
}

async function sendChat(window, text) {
  await window.locator('#agentInput').fill(text)
  await window.locator('#agentSend').click()
}

async function readChatState(window) {
  return window.evaluate(() => {
    const log = document.getElementById('agentChatLog')
    const meta = document.getElementById('agentComposerMeta')
    const send = document.getElementById('agentSend')
    const bubbles = log ? Array.from(log.querySelectorAll('.agent-bubble')) : []
    const last = bubbles[bubbles.length - 1]
    const timeline = last?.querySelector('[data-execution-timeline]')
    return {
      logText: log?.innerText || '',
      bubbleCount: bubbles.length,
      busy: meta?.classList.contains('busy') || false,
      isRunning: send?.classList.contains('is-running') || false,
      assistantText: last?.classList.contains('assistant') ? (last.innerText || '') : '',
      timelineText: timeline?.innerText || '',
      hasTimeline: !!timeline,
      errorText: log?.querySelector('.agent-bubble.err, .agent-bubble.assistant.err')?.innerText?.slice(0, 300) || '',
      runPhaseVisible: /\b(PREPARE|CONTEXT|MODEL|TOOL|RECOVER|VERIFY|PERSIST|runPhase)\b/i.test(log?.innerText || ''),
    }
  })
}

async function waitForAssistantDone(window, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await readChatState(window)
    if (!state.busy && !state.isRunning && (state.assistantText || state.errorText)) return state
    await window.waitForTimeout(800)
  }
  throw new Error('assistant response timeout')
}

async function measureChatLatency(window, text = '你好') {
  const t0 = Date.now()
  await sendChat(window, text)
  await waitForAssistantDone(window, 120000)
  return Date.now() - t0
}

async function runSessionPersistence(userDataDir) {
  const check = { id: 'R1-session-persistence', ok: false, marker: SESSION_MARKER }
  let app1 = null
  let app2 = null
  try {
    const first = await launchApp({ executor: 'kernel', userDataDir })
    app1 = first.app
    const window1 = first.window
    await ensureAgentPanel(window1)
    await sendChat(window1, `${SESSION_MARKER}：请记住这条测试消息`)
    await waitForAssistantDone(window1, 120000)
    await window1.screenshot({ path: path.join(SHOTS, 'qa-session-before-restart.png') })
    await app1.close()
    app1 = null
    killKnowMeProcesses()
    await new Promise(r => setTimeout(r, 3000))

    const second = await launchApp({ executor: 'kernel', userDataDir })
    app2 = second.app
    const window2 = second.window
    await ensureAgentPanel(window2)
    await window2.waitForTimeout(2000)
    const after = await readChatState(window2)
    check.ok = after.logText.includes(SESSION_MARKER)
    check.bubbleCount = after.bubbleCount
    check.sample = after.logText.slice(0, 300)
    await window2.screenshot({ path: path.join(SHOTS, 'qa-session-after-restart.png') })
    return check
  } finally {
    if (app1) await app1.close().catch(() => {})
    if (app2) await app2.close().catch(() => {})
  }
}

async function runCancelTiming(userDataDir) {
  const check = { id: 'S3-cancel-timing', ok: false, cancelledDuringRun: false, stopped: false, followUpOk: false }
  const { app, window } = await launchApp({ executor: 'kernel', userDataDir })
  try {
    await ensureAgentPanel(window)
    await sendChat(window, '请用不少于1200字详细介绍 KnowMe 桌面便签的功能、架构、使用场景与最佳实践，分段输出，每段至少200字。')
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const st = await readChatState(window)
      if (st.busy || st.isRunning) {
        check.cancelledDuringRun = true
        await window.locator('#agentSend').click()
        break
      }
      await window.waitForTimeout(150)
    }
    await window.waitForTimeout(2500)
    const afterCancel = await readChatState(window)
    check.stopped = /已停止|停止生成/i.test(afterCancel.logText)
    check.notBusy = !afterCancel.busy && !afterCancel.isRunning
    await window.screenshot({ path: path.join(SHOTS, 'qa-cancel-timing.png') })

    await sendChat(window, '取消后继续：收到')
    const follow = await waitForAssistantDone(window, 90000)
    check.followUpOk = !!follow.assistantText
    check.ok = check.cancelledDuringRun && check.notBusy && check.followUpOk && (check.stopped || afterCancel.assistantText.length > 0)
    return check
  } finally {
    await app.close()
  }
}

async function runNoApiKeyDesktop() {
  const userDataDir = makeUserDataDir({ withSettings: false })
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'auto',
  }, null, 2))
  const check = { id: 'SEC-no-api-key-desktop', ok: false }
  const { app, window } = await launchApp({ executor: 'kernel', userDataDir })
  try {
    await ensureAgentPanel(window)
    await sendChat(window, '你好')
    const state = await waitForAssistantDone(window, 30000)
    check.errorText = state.errorText.slice(0, 200)
    check.ok = /API Key|API 设置|未填写|配置/i.test(state.errorText)
    check.runPhaseLeaked = state.runPhaseVisible
    await window.screenshot({ path: path.join(SHOTS, 'qa-no-api-key-desktop.png') })
    return check
  } finally {
    await app.close()
  }
}

async function runLatencyCompare(userDataDir) {
  const check = { id: 'A6-latency-compare', ok: false, kernelMs: null, legacyMs: null, ratio: null }
  let app = null
  try {
    const kernelLaunch = await launchApp({ executor: 'kernel', userDataDir })
    app = kernelLaunch.app
    const window = kernelLaunch.window
    await ensureAgentPanel(window)
    check.kernelMs = await measureChatLatency(window, '你好')
    await app.close()
    app = null
    killKnowMeProcesses()
    await new Promise(r => setTimeout(r, 3000))

    const legacyLaunch = await launchApp({ executor: 'legacy', userDataDir })
    app = legacyLaunch.app
    const legacyWindow = legacyLaunch.window
    await ensureAgentPanel(legacyWindow)
    check.legacyMs = await measureChatLatency(legacyWindow, '你好')
    check.ratio = check.kernelMs / Math.max(check.legacyMs, 1)
    check.ok = check.ratio < 2.0
    return check
  } finally {
    if (app) await app.close().catch(() => {})
  }
}

async function runAntiPatterns(userDataDir) {
  const checks = []
  const { app, window } = await launchApp({ executor: 'kernel', userDataDir })
  try {
    await ensureAgentPanel(window)

    // A5 runPhase leak baseline
    await sendChat(window, '你好')
    const a5 = await waitForAssistantDone(window, 120000)
    checks.push({
      id: 'A5-no-runPhase-ui',
      ok: !a5.runPhaseVisible,
      runPhaseVisible: a5.runPhaseVisible,
    })

    // A2 timeline stages during tool-ish question
    await sendChat(window, '查一下知识库里关于团队约定的内容')
    const a2 = await waitForAssistantDone(window, 120000)
    checks.push({
      id: 'A2-timeline-stages',
      ok: a2.hasTimeline && /执行过程|准备|检索|知识|上下文/i.test(a2.timelineText + a2.logText),
      timelineSample: a2.timelineText.slice(0, 160),
    })

    // Rapid send while busy (misclick pattern)
    await sendChat(window, '请简要介绍 KnowMe 的三个核心功能，每点一句话。')
    await window.waitForTimeout(400)
    const busyBefore = await readChatState(window)
    if (busyBefore.busy || busyBefore.isRunning) {
      await sendChat(window, '第二条误触消息')
    }
    const rapid = await waitForAssistantDone(window, 120000)
    checks.push({
      id: 'A3-rapid-send-while-busy',
      ok: !rapid.runPhaseVisible && (rapid.assistantText || rapid.errorText),
      note: 'composer accepted or queued without crash',
    })

    await window.screenshot({ path: path.join(SHOTS, 'qa-antipattern-timeline.png') })
    return checks
  } finally {
    await app.close()
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = makeUserDataDir({ withSettings: true })
  const summary = {
    at: new Date().toISOString(),
    change: 'agent-kernel-executor-eval-baseline',
    role: 'tester',
    userDataDir,
    checks: [],
    ok: false,
  }

  summary.checks.push(await runSessionPersistence(userDataDir))
  summary.checks.push(await runCancelTiming(userDataDir))
  summary.checks.push(await runNoApiKeyDesktop())
  summary.checks.push(await runLatencyCompare(userDataDir))
  summary.checks.push(...(await runAntiPatterns(userDataDir)))

  summary.ok = summary.checks.every(c => c.ok !== false)
  fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
