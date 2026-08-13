'use strict'

/**
 * 确定性 Electron fixture：验证 search_web provider 失败时的 UI 降级。
 * 不调用真实 LLM 或实网搜索；仅注入 Output Protocol 事件并检查 Renderer。
 */

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

const ROOT = findProjectRoot(__dirname)
const REPORT = path.join(__dirname, 'realtime-research-failure-fixture-smoke.json')
const SHOT = path.join(__dirname, 'screenshots', 'realtime-research-search-failure.png')

function event(runId, seq, type, payload, lane, phase, round = 1) {
  return { version: 2, runId, seq, type, payload, lane, phase, round }
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-research-fail-'))
  fs.mkdirSync(path.dirname(SHOT), { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: 'electron-fixture-failure',
    userDataDir,
    checks: [],
    consoleErrors: [],
    screenshot: 'screenshots/realtime-research-search-failure.png',
    boundary: 'Deterministic Output Protocol injection; not real LLM or live provider.',
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
      KNOWME_GROUNDING_RUNTIME: 'runtime',
      KNOWME_AGENT_EXECUTOR: 'kernel',
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

    const runId = `run_research_fail_${Date.now()}`
    const mount = await window.evaluate(({ runId: id }) =>
      window.__KnowMeAgentOutputFixture.mount({
        runId: id,
        history: [{ role: 'user', text: '帮我看下今天关于 AI 的资讯' }],
      }),
    { runId })

    const honestAnswer = [
      '暂时无法整理今天的 AI 资讯。',
      '',
      '公开网络搜索失败：搜索服务返回 HTTP 503。',
      '',
      '你可以稍后重试，或提供具体链接让我读取原文核对。',
    ].join('\n')

    const events = [
      event(runId, 1, 'stage', {
        id: 'stage_prepare',
        title: '上下文准备完成',
        status: 'done',
        kind: 'stage',
      }, 'progress', 'CONTEXT'),
      event(runId, 2, 'tool.started', {
        id: 'tool_search_web_1',
        toolCallId: 'call_search_web_1',
        toolName: 'search_web',
        title: '搜索网络',
        status: 'pending',
        kind: 'tool',
      }, 'tool', 'TOOL'),
      event(runId, 3, 'tool.failed', {
        id: 'tool_search_web_1',
        toolCallId: 'call_search_web_1',
        toolName: 'search_web',
        title: '搜索网络',
        status: 'error',
        kind: 'tool',
        summary: '搜索服务返回 HTTP 503',
        code: 'http_error',
      }, 'tool', 'TOOL'),
      event(runId, 4, 'answer.committed', {
        text: honestAnswer,
        hash: 'research-failure-answer-fixture',
      }, 'answer', 'PERSIST'),
      event(runId, 5, 'run.completed', { title: '执行完成' }, 'terminal', 'DONE'),
    ]

    for (const item of events) {
      const result = await window.evaluate(({ item: input }) =>
        window.__KnowMeAgentOutputFixture.dispatchViaIpc(input),
      { item })
      if (!result?.ok) throw new Error(`fixture_dispatch_failed:${item.type}`)
    }

    await window.evaluate(({ assistantIdx }) => {
      const bubble = document.querySelector(`[data-idx="${assistantIdx}"]`)
      const timeline = bubble?.querySelector('[data-execution-timeline="1"]')
      if (timeline) timeline.open = true
    }, { assistantIdx: mount.assistantIdx })
    await window.waitForTimeout(300)

    const state = await window.evaluate(({ assistantIdx }) => {
      const bubble = document.querySelector(`[data-idx="${assistantIdx}"]`)
      const text = bubble?.innerText || ''
      const traceItems = bubble?.querySelectorAll('[data-execution-timeline="1"] li, .agent-trace-item, .agent-timeline-item') || []
      const errorItems = [...traceItems].filter(el => /error|失败|503/i.test(el.className + el.innerText))
      return {
        text,
        linkCount: bubble?.querySelectorAll('a[href^="http"]').length || 0,
        choiceCount: bubble?.querySelectorAll('[data-structured-choice], .structured-choice').length || 0,
        hasSearchTool: /搜索网络|网络搜索/.test(text),
        hasErrorStatus: /503|失败|错误|HTTP/.test(text),
        errorTraceCount: errorItems.length,
      }
    }, { assistantIdx: mount.assistantIdx })

    const forbiddenNewsPatterns = ['示例模型更新', '发布了三个新模型', '今日 AI 资讯摘要', '1. [示例']
    report.checks.push(
      { id: 'prompt-visible', pass: await window.getByText('帮我看下今天关于 AI 的资讯').count() > 0 },
      { id: 'search-timeline-started', pass: state.hasSearchTool },
      { id: 'search-failure-visible', pass: state.hasErrorStatus },
      { id: 'honest-failure-reason', pass: state.text.includes('503') || state.text.includes('搜索服务') },
      {
        id: 'no-fabricated-news',
        pass: !forbiddenNewsPatterns.some(p => state.text.includes(p)),
      },
      { id: 'no-source-links-on-failure', pass: state.linkCount === 0 },
      {
        id: 'no-single-feishu-choice',
        pass: state.choiceCount === 0
          && !state.text.includes('选择一项')
          && !state.text.includes('飞书知识库'),
      },
      { id: 'no-console-errors', pass: report.consoleErrors.length === 0 },
    )
    await window.screenshot({ path: SHOT, scale: 'css' })
    report.ok = report.checks.every(check => check.pass) && fs.existsSync(SHOT)
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
