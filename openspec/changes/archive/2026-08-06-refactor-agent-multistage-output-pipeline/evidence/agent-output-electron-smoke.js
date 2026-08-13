'use strict'

/**
 * Agent v2 输出管线受控 fixture 冒烟：
 * - 优先独立 userDataDir 的 Electron
 * - 单实例锁冲突时 fallback 到 Chromium + workspace.html（不 kill 用户进程）
 */

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { stableHash, VERSION } = require('../../../../src/lib/agent-output-protocol')
const { assertNoSensitiveFields } = require('../../../../src/lib/agent-output-metrics')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'agent-output-electron-smoke.json')

const RAW_JSON_MARKERS = [
  '```suggestion',
  '"action":"send"',
  '"action": "send"',
  '"reasoning":',
  '"thinking":',
  '"steps":',
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function relShot(filename) {
  return path.relative(OUT, path.join(SHOTS, filename)).replace(/\\/g, '/')
}

async function screenshotAssistantBubble(window, assistantIdx, outputPath) {
  await window.evaluate(({ assistantIdx: idx }) => {
    document.getElementById('agent-output-evidence-overlay')?.remove()
    const bubble = document.querySelector(`[data-idx="${idx}"]`)
    if (!bubble) throw new Error('assistant bubble missing for screenshot')
    const clone = bubble.cloneNode(true)
    clone.id = 'agent-output-evidence-overlay'
    clone.style.cssText = [
      'position:fixed',
      'left:150px',
      'right:150px',
      'bottom:120px',
      'z-index:2147483647',
      'max-height:calc(100vh - 180px)',
      'overflow:auto',
      'box-shadow:0 18px 60px rgba(0,0,0,.24)',
    ].join(';')
    document.body.appendChild(clone)
  }, { assistantIdx })
  try {
    await window.screenshot({ path: outputPath, scale: 'css' })
  } finally {
    await window.evaluate(() => document.getElementById('agent-output-evidence-overlay')?.remove())
  }
}

function buildEvent(runId, seq, type, payload, lane, phase = 'MODEL', round = 1) {
  return {
    version: VERSION,
    runId,
    seq,
    lane,
    type,
    payload,
    phase,
    round,
  }
}

function buildScenario(runId) {
  const canonicalText = '这是 canonical 回答正文，已移除 suggestion 与 thinking 协议块。'
  const hash = stableHash(canonicalText)
  const events = [
    buildEvent(runId, 1, 'stage', { id: 'stage_prepare', title: '正在准备上下文…', status: 'done', kind: 'stage' }, 'progress', 'PREPARE'),
    buildEvent(runId, 2, 'tool.started', {
      id: 'tool_write_1',
      toolCallId: 'call_write_1',
      toolName: 'write_path',
      title: '写入文件',
      status: 'pending',
      kind: 'tool',
    }, 'tool', 'TOOL'),
    buildEvent(runId, 3, 'tool.completed', {
      id: 'tool_write_1',
      toolCallId: 'call_write_1',
      toolName: 'write_path',
      title: '写入文件',
      status: 'done',
      kind: 'tool',
      requiresApproval: true,
      draftId: 'draft_fixture_1',
      draftStatus: 'pending_review',
      summary: '写入 preview/example.txt',
    }, 'tool', 'TOOL'),
  ]

  for (let i = 0; i < 10; i += 1) {
    events.push(buildEvent(runId, 4 + i, 'stage', {
      id: `stage_progress_${i + 1}`,
      title: `进度更新 ${i + 1}`,
      status: 'pending',
      kind: 'stage',
    }, 'progress', 'MODEL'))
  }

  const answerSeq = 14
  events.push(buildEvent(runId, answerSeq, 'answer.committed', { text: canonicalText, hash }, 'answer', 'PERSIST'))
  events.push(buildEvent(runId, answerSeq + 1, 'choice.ready', {
    ui: [{
      kind: 'choice',
      title: '下一步',
      items: [{ label: '继续分析', action: 'send', payload: '继续' }],
    }],
    hash,
  }, 'ui', 'PERSIST'))
  events.push(buildEvent(runId, answerSeq + 2, 'run.completed', { title: '执行完成' }, 'terminal', 'DONE'))

  return {
    runId,
    canonicalText,
    hash,
    events,
    duplicateEvent: buildEvent(runId, answerSeq + 1, 'choice.ready', {
      ui: [{ kind: 'choice', title: '重复', items: [{ label: '不应出现', action: 'send', payload: 'x' }] }],
      hash: 'deadbeef',
    }, 'ui', 'PERSIST'),
    lateEvent: buildEvent(runId, 1, 'stage', { id: 'late_stage', title: '迟到阶段', status: 'done', kind: 'stage' }, 'progress', 'PREPARE'),
  }
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0])
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
    const filePath = path.join(rootDir, safePath === path.sep ? 'workspace.html' : safePath.replace(/^\//, ''))
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      const ext = path.extname(filePath).toLowerCase()
      const type = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.js' ? 'text/javascript; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': type })
      res.end(data)
    })
  })
}

async function launchElectron(playwrightElectron, userDataDir) {
  const app = await playwrightElectron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userDataDir,
      KNOWME_AGENT_OUTPUT_FIXTURE: '1',
    },
    timeout: 20000,
  })
  const window = await app.firstWindow({ timeout: 15000 })
  return { app, window, mode: 'electron' }
}

async function launchChromiumFallback(playwright) {
  const server = createStaticServer(ROOT)
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => (err ? reject(err) : resolve()))
  })
  const address = server.address()
  const fixturePath = '/openspec/changes/refactor-agent-multistage-output-pipeline/evidence/agent-output-fixture-host.html'
  const baseUrl = `http://127.0.0.1:${address.port}${fixturePath}`

  const browser = await playwright.chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('pageerror', err => {
    console.error('[fixture-host pageerror]', err.message)
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => window.__KnowMeAgentOutputFixture, { timeout: 90000 })
  return {
    app: browser,
    window: page,
    mode: 'node-dom-fixture',
    limitations: [
      'Electron 单实例锁不可用，未使用真实 Electron 壳',
      'Chromium 加载 agent-output-fixture-host.html，仅覆盖 renderer fixture 与 DOM 契约',
      '未验证 preload/IPC 真实路径',
    ],
    close: async () => {
      await browser.close().catch(() => {})
      await new Promise(resolve => server.close(resolve))
    },
  }
}

async function preparePage(window, mode) {
  if (mode === 'electron') {
    await window.evaluate(() => localStorage.setItem('__knowme_agent_output_fixture', '1'))
    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    const agentRail = window.locator('#btnRailAi')
    if (await agentRail.count()) {
      await agentRail.click()
      await window.locator('#agentChatLog').waitFor({ state: 'visible', timeout: 20000 })
    }
  }
  await window.waitForFunction(() => window.__KnowMeAgentOutputFixture, { timeout: 90000 })
}

async function runFixtureScenario(window, scenario, shots = {}, options = {}) {
  const useIpc = options.useIpc === true
  const checks = []
  const audit = {
    rollbackCount: 0,
    visibleRawJsonMs: 0,
    terminalDomUpdates: 0,
    duplicateLateDomUpdates: 0,
    scrollDriftPx: null,
    ipcDispatches: 0,
    ipcSuccess: 0,
  }

  async function dispatchEvent(event) {
    return window.evaluate(async ({ event, useIpc }) => {
      const fixture = window.__KnowMeAgentOutputFixture
      if (!fixture) return { ok: false, error: 'fixture_missing' }
      return useIpc ? fixture.dispatchViaIpc(event) : fixture.dispatch(event)
    }, { event, useIpc })
  }

  const mount = await window.evaluate(({ runId }) => window.__KnowMeAgentOutputFixture.mount({
    runId,
    history: Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `历史消息 ${index + 1}\n${Array.from({ length: 8 }, (__, line) => `滚动占位行 ${line + 1}`).join('\n')}`,
      streaming: false,
      ...(index % 2 === 1 ? { protocolVersion: 2 } : {}),
    })),
  }), { runId: scenario.runId })

  const historyRefs = await window.evaluate(() => {
    const log = document.getElementById('agentChatLog')
    return Array.from(log?.querySelectorAll('[data-idx]') || []).map(node => ({
      idx: Number(node.getAttribute('data-idx')),
    }))
  })

  let committedHash = ''
  let scrollBefore = 0

  for (const event of scenario.events) {
    const before = await window.evaluate(() => ({
      text: document.getElementById('agentChatLog')?.innerText || '',
      html: document.getElementById('agentChatLog')?.innerHTML || '',
    }))
    const hit = RAW_JSON_MARKERS.some(marker => before.text.includes(marker) || before.html.includes(marker))
    if (hit) audit.visibleRawJsonMs += 1

    const result = await dispatchEvent(event)
    if (useIpc) {
      audit.ipcDispatches += 1
      if (result?.ok && result.ipcPath) audit.ipcSuccess += 1
    }
    if (event.type === 'answer.committed') {
      committedHash = result.state?.answerHash || ''
    }
    if (event.type === 'answer.committed' || event.type === 'run.completed') {
      if (!result.sameBodyNode || !result.sameStructuredUiNode || !result.sameBubbleNode || !result.historySameNodes) {
        audit.rollbackCount += 1
      }
    }
    if (event.type === 'run.completed') audit.terminalDomUpdates += result.changed ? 1 : 0

    if (event.seq === 4) {
      await window.evaluate(() => {
        const log = document.getElementById('agentChatLog')
        if (log) {
          log.scrollTop = Math.max(0, log.scrollHeight - log.clientHeight - 40)
        }
        window.__KnowMeAgentOutputFixture.scrollUp(40)
      })
      scrollBefore = await window.evaluate(() => window.__KnowMeAgentOutputFixture.getScrollTop())
      await sleep(80)
      if (shots.running) {
        await screenshotAssistantBubble(window, mount.assistantIdx, shots.running)
      }
    }

    if (event.type === 'choice.ready' && shots.canonicalChoice) {
      await screenshotAssistantBubble(window, mount.assistantIdx, shots.canonicalChoice)
    }

    if (event.type === 'run.completed' && shots.terminalPendingReview) {
      await window.evaluate(({ assistantIdx }) => {
        const bubble = document.querySelector(`[data-idx="${assistantIdx}"]`)
        const timeline = bubble?.querySelector('[data-execution-timeline="1"]')
        if (timeline) timeline.open = true
      }, { assistantIdx: mount.assistantIdx })
      await screenshotAssistantBubble(window, mount.assistantIdx, shots.terminalPendingReview)
    }
  }

  const afterCommit = await window.evaluate(({ assistantIdx }) => {
    const fixture = window.__KnowMeAgentOutputFixture
    return {
      message: fixture.getMessage(assistantIdx),
      dom: fixture.getDomRefs(assistantIdx),
      text: fixture.getVisibleText(),
      html: fixture.getRawHtml(),
    }
  }, { assistantIdx: mount.assistantIdx })

  if (afterCommit.message?.answerHash !== scenario.hash) audit.rollbackCount += 1
  if ((afterCommit.message?.textLength || 0) < scenario.canonicalText.length) audit.rollbackCount += 1

  const dup = await dispatchEvent(scenario.duplicateEvent)
  const late = await dispatchEvent(scenario.lateEvent)
  if (useIpc) {
    audit.ipcDispatches += 2
    if (dup?.ok && dup.ipcPath) audit.ipcSuccess += 1
    if (late?.ok && late.ipcPath) audit.ipcSuccess += 1
  }
  if (dup.changed || late.changed) audit.duplicateLateDomUpdates += 1

  const scrollAfter = await window.evaluate(() => window.__KnowMeAgentOutputFixture.getScrollTop())
  audit.scrollDriftPx = Math.abs(scrollAfter - scrollBefore)

  const historyStillSame = await window.evaluate(({ historyRefs }) => {
    const log = document.getElementById('agentChatLog')
    return historyRefs.every(item => {
      const node = log?.querySelector(`[data-idx="${item.idx}"]`)
      return Boolean(node)
    })
  }, { historyRefs })

  const rawLeak = RAW_JSON_MARKERS.some(marker => afterCommit.text.includes(marker) || afterCommit.html.includes(marker))

  checks.push({
    id: 'history-bubble-body-same-node',
    pass: audit.rollbackCount === 0,
    detail: { rollbackCount: audit.rollbackCount, committedHash, expectedHash: scenario.hash },
  })
  checks.push({
    id: 'canonical-hash-stable',
    pass: afterCommit.message?.answerHash === scenario.hash && afterCommit.message?.textLength === scenario.canonicalText.length,
    detail: afterCommit.message,
  })
  checks.push({
    id: 'visible-raw-json-zero',
    pass: audit.visibleRawJsonMs === 0 && !rawLeak,
    detail: { visibleRawJsonMs: audit.visibleRawJsonMs, rawLeak },
  })
  checks.push({
    id: 'scroll-drift-under-8px',
    pass: scrollBefore > 0 && audit.scrollDriftPx < 8,
    detail: { scrollBefore, scrollAfter, scrollDriftPx: audit.scrollDriftPx },
  })
  checks.push({
    id: 'pending-review-timeline-open',
    pass: afterCommit.dom.timelineOpen && afterCommit.dom.approveVisible && afterCommit.dom.rejectVisible,
    detail: afterCommit.dom,
  })
  checks.push({
    id: 'choice-in-structured-ui',
    pass: afterCommit.dom.choiceInStructuredUi,
    detail: afterCommit.dom,
  })
  checks.push({
    id: 'terminal-once-no-duplicate-late-dom',
    pass: audit.terminalDomUpdates === 1 && audit.duplicateLateDomUpdates === 0,
    detail: {
      terminalDomUpdates: audit.terminalDomUpdates,
      duplicateLateDomUpdates: audit.duplicateLateDomUpdates,
      counters: afterCommit.message?.state?.counters || {},
    },
  })
  checks.push({
    id: 'history-nodes-present',
    pass: historyStillSame,
    detail: { historyCount: mount.historyCount },
  })

  const ipcPathVerified = useIpc
    ? audit.ipcDispatches > 0 && audit.ipcSuccess === audit.ipcDispatches
    : false
  if (useIpc) {
    checks.push({
      id: 'ipc-path-verified',
      pass: ipcPathVerified,
      detail: {
        ipcDispatches: audit.ipcDispatches,
        ipcSuccess: audit.ipcSuccess,
      },
    })
  }

  return { checks, audit, mount, ipcPathVerified }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const scenario = buildScenario(`run_output_smoke_${Date.now()}`)
  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: null,
    limitations: [],
    checks: [],
    audit: null,
    screenshots: {},
  }

  let playwright
  try {
    playwright = require('playwright')
  } catch (err) {
    report.mode = 'blocked'
    report.limitations = ['playwright 不可用']
    report.error = String(err.message || err)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  let launcher = null
  let launched = null
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-output-smoke-'))

  try {
    try {
      launched = await launchElectron(playwright._electron, userDataDir)
      report.mode = 'electron'
      report.userDataDir = userDataDir
    } catch (err) {
      report.limitations.push(`Electron 启动失败: ${String(err.message || err).slice(0, 240)}`)
      launcher = await launchChromiumFallback(playwright)
      launched = { app: launcher.app, window: launcher.window, mode: launcher.mode }
      report.mode = launcher.mode
      report.limitations.push(...launcher.limitations)
    }

    await preparePage(launched.window, launched.mode)
    await sleep(launched.mode === 'electron' ? 1500 : 800)

    const shotPaths = {
      running: path.join(SHOTS, 'running-progress.png'),
      canonicalChoice: path.join(SHOTS, 'canonical-choice.png'),
      terminalPendingReview: path.join(SHOTS, 'terminal-pending-review.png'),
    }

    const { checks, audit, ipcPathVerified } = await runFixtureScenario(
      launched.window,
      scenario,
      shotPaths,
      { useIpc: launched.mode === 'electron' },
    )
    report.screenshots.running = relShot('running-progress.png')
    report.screenshots.canonicalChoice = relShot('canonical-choice.png')
    report.screenshots.terminalPendingReview = relShot('terminal-pending-review.png')

    report.checks = checks
    report.audit = audit
    report.ipcPathVerified = ipcPathVerified
    report.ok = checks.every(item => item.pass)
      && (report.mode !== 'electron' || ipcPathVerified === true)

    const metricsSample = {
      runId: scenario.runId,
      seq: scenario.events.length,
      round: 1,
      phase: 'PERSIST',
      hash: scenario.hash,
      length: scenario.canonicalText.length,
      count: audit.terminalDomUpdates,
      timingMs: 0,
      outputDiagnostics: [{ code: 'answer_committed', hash: scenario.hash, timingMs: 1, count: 1 }],
    }
    assertNoSensitiveFields(metricsSample)
    report.checks.push({ id: 'metrics-no-sensitive-fields', pass: true, detail: metricsSample })
  } catch (err) {
    report.error = String(err.message || err)
    report.ok = false
  } finally {
    if (launcher?.close) await launcher.close().catch(() => {})
    else if (launched?.app) await launched.app.close().catch(() => {})
  }

  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
