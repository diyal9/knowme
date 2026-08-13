'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

function findProjectRoot(startDir) {
  let current = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'src'))) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) throw new Error('project_root_not_found')
    current = parent
  }
}

function event(runId, seq, type, payload, lane, phase) {
  return {
    version: 2,
    runId,
    seq,
    type,
    payload,
    lane,
    phase,
    round: 1,
  }
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

const ROOT = findProjectRoot(__dirname)
const REPORT = path.join(__dirname, 'execution-progress-electron-smoke.json')
const DESKTOP_SHOT = path.join(__dirname, 'screenshots', 'execution-progress-desktop.png')
const NARROW_SHOT = path.join(__dirname, 'screenshots', 'execution-progress-narrow.png')

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-execution-progress-'))
  fs.mkdirSync(path.dirname(DESKTOP_SHOT), { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: 'electron-fixture',
    userDataDir,
    checks: [],
    consoleErrors: [],
    screenshots: [
      'screenshots/execution-progress-desktop.png',
      'screenshots/execution-progress-narrow.png',
    ],
  }

  const app = await electron.launch({
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
    timeout: 30000,
  })

  try {
    const window = await app.firstWindow({ timeout: 30000 })
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })

    await window.evaluate(() => localStorage.setItem('__knowme_agent_output_fixture', '1'))
    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    const rail = window.locator('#btnRailAi')
    if (await rail.count()) {
      await rail.click()
      await window.locator('#agentChatLog').waitFor({ state: 'visible', timeout: 20000 })
    }
    await window.waitForFunction(() => window.__KnowMeAgentOutputFixture, { timeout: 90000 })

    const runId = `run_execution_progress_${Date.now()}`
    const mount = await window.evaluate(({ runId: id }) =>
      window.__KnowMeAgentOutputFixture.mount({
        runId: id,
        history: [{ role: 'user', text: '帮我检索并整理这几条资料' }],
      }),
    { runId })

    const initial = await window.evaluate(({ assistantIdx }) => {
      const bubble = document.querySelector(`[data-idx="${assistantIdx}"]`)
      return {
        waitingCount: bubble?.querySelectorAll('[data-thinking-status]').length || 0,
        timelineCount: bubble?.querySelectorAll('[data-execution-timeline]').length || 0,
      }
    }, { assistantIdx: mount.assistantIdx })
    report.checks.push({
      id: 'initial-single-waiting-surface',
      pass: initial.waitingCount === 1 && initial.timelineCount === 0,
      value: initial,
    })

    const sources = Array.from({ length: 5 }, (_, index) => ({
      title: `资料 ${index + 1}`,
      path: `https://example.com/source-${index + 1}`,
      snippet: `用于核验回答的资料摘要 ${index + 1}`,
    }))
    const events = [
      event(runId, 1, 'stage', {
        id: 'stage_prepare',
        title: '上下文准备完成',
        status: 'done',
        kind: 'stage',
      }, 'progress', 'CONTEXT'),
      event(runId, 2, 'tool.completed', {
        id: 'tool_search_web_1',
        toolCallId: 'call_search_web_1',
        toolName: 'search_web',
        title: '搜索网络',
        status: 'done',
        kind: 'tool',
        durationMs: 313,
        summary: '公开网络检索返回 5 条可核验资料',
        sources,
      }, 'tool', 'TOOL'),
      event(runId, 3, 'stage', {
        id: 'stage_answer',
        title: '正在生成回答',
        status: 'pending',
        kind: 'stage',
      }, 'progress', 'SYNTHESIZE'),
    ]
    for (const item of events) {
      const result = await window.evaluate(({ item: input }) =>
        window.__KnowMeAgentOutputFixture.dispatchViaIpc(input),
      { item })
      if (!result?.ok) throw new Error(`fixture_dispatch_failed:${item.type}`)
    }
    await window.waitForTimeout(1250)

    const bubble = window.locator(`[data-idx="${mount.assistantIdx}"]`)
    const toolDetails = bubble.locator('.agent-trace-row.tool')
    const initiallyOpen = await toolDetails.evaluate(element => element.open)
    await toolDetails.locator('summary').click()
    await window.waitForTimeout(1100)
    const openAfterTimerTick = await toolDetails.evaluate(element => element.open)
    await toolDetails.locator('summary').click()
    report.checks.push({
      id: 'tool-detail-open-state-survives-timer',
      pass: initiallyOpen === false && openAfterTimerTick === true,
      value: { initiallyOpen, openAfterTimerTick },
    })

    const state = await bubble.evaluate(element => {
      const title = element.querySelector('.agent-trace-row.tool .agent-trace-title')?.getBoundingClientRect()
      const meta = element.querySelector('.agent-trace-row.tool .agent-trace-meta')?.getBoundingClientRect()
      const text = element.innerText || ''
      return {
        timelineCount: element.querySelectorAll('[data-execution-timeline]').length,
        waitingCount: element.querySelectorAll('[data-thinking-status]').length,
        executionMetaCount: element.querySelectorAll('.agent-execution-meta').length,
        pendingCount: element.querySelectorAll('.agent-trace-row.pending').length,
        traceMetaCount: element.querySelectorAll('.agent-trace-meta').length,
        resultLabel: element.querySelector('.agent-trace-result-label')?.textContent || '',
        duration: element.querySelector('.agent-trace-time')?.textContent || '',
        organizingCount: (text.match(/正在组织回答/g) || []).length,
        titleRect: title ? { left: title.left, right: title.right, top: title.top, bottom: title.bottom } : null,
        metaRect: meta ? { left: meta.left, right: meta.right, top: meta.top, bottom: meta.bottom } : null,
      }
    })
    report.checks.push(
      {
        id: 'timeline-replaces-waiting-surface',
        pass: state.timelineCount === 1 && state.waitingCount === 0,
        value: state,
      },
      {
        id: 'single-running-copy-and-total-time',
        pass: state.organizingCount === 1 && state.executionMetaCount === 1,
        value: {
          organizingCount: state.organizingCount,
          executionMetaCount: state.executionMetaCount,
        },
      },
      {
        id: 'aligned-step-metadata',
        pass: state.traceMetaCount >= 1
          && state.resultLabel.includes('查看 5 条资料')
          && state.duration === '313ms'
          && state.titleRect
          && state.metaRect
          && !overlaps(state.titleRect, state.metaRect),
        value: {
          resultLabel: state.resultLabel,
          duration: state.duration,
          titleRect: state.titleRect,
          metaRect: state.metaRect,
        },
      },
      {
        id: 'single-current-step',
        pass: state.pendingCount === 1,
        value: state.pendingCount,
      },
    )

    await bubble.screenshot({ path: DESKTOP_SHOT, scale: 'css' })
    await window.setViewportSize({ width: 700, height: 720 })
    await window.waitForTimeout(150)
    const narrow = await bubble.evaluate(element => {
      const title = element.querySelector('.agent-trace-row.tool .agent-trace-title')?.getBoundingClientRect()
      const meta = element.querySelector('.agent-trace-row.tool .agent-trace-meta')?.getBoundingClientRect()
      const style = element.querySelector('.agent-trace-meta')
        ? getComputedStyle(element.querySelector('.agent-trace-meta'))
        : null
      return {
        titleRect: title ? { left: title.left, right: title.right, top: title.top, bottom: title.bottom } : null,
        metaRect: meta ? { left: meta.left, right: meta.right, top: meta.top, bottom: meta.bottom } : null,
        gridColumnStart: style?.gridColumnStart || '',
      }
    })
    report.checks.push({
      id: 'narrow-metadata-does-not-overlap',
      pass: narrow.titleRect
        && narrow.metaRect
        && !overlaps(narrow.titleRect, narrow.metaRect)
        && narrow.gridColumnStart === '2',
      value: narrow,
    })
    await bubble.screenshot({ path: NARROW_SHOT, scale: 'css' })

    report.checks.push({
      id: 'no-console-errors',
      pass: report.consoleErrors.length === 0,
      value: report.consoleErrors,
    })

    report.ok = report.checks.every(check => check.pass)
      && fs.existsSync(DESKTOP_SHOT)
      && fs.existsSync(NARROW_SHOT)
  } catch (error) {
    report.error = String(error?.stack || error?.message || error)
  } finally {
    await app.close().catch(() => {})
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
