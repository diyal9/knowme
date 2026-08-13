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

const ROOT = findProjectRoot(__dirname)
const REPORT = path.join(__dirname, 'realtime-research-electron-smoke.json')
const SHOT = path.join(__dirname, 'screenshots', 'realtime-research-timeline.png')

function event(runId, seq, type, payload, lane, phase, round = 1) {
  return {
    version: 2,
    runId,
    seq,
    type,
    payload,
    lane,
    phase,
    round,
  }
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-research-smoke-'))
  fs.mkdirSync(path.dirname(SHOT), { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: 'electron-fixture',
    userDataDir,
    checks: [],
    consoleErrors: [],
    screenshot: 'screenshots/realtime-research-timeline.png',
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

    const runId = `run_realtime_research_${Date.now()}`
    const mount = await window.evaluate(({ runId: id }) =>
      window.__KnowMeAgentOutputFixture.mount({
        runId: id,
        history: [{ role: 'user', text: '帮我看下今天关于 AI 的资讯' }],
      }),
    { runId })
    const answer = [
      '## 今日 AI 资讯摘要',
      '',
      '1. [示例模型更新](https://example.com/model-release) — 发布时间：2026-08-07 10:00 UTC。',
      '2. [示例研究进展](https://example.org/research-update) — 发布时间：未知。',
      '',
      '本次检索时间：2026-08-07 08:00 UTC。第二条发布时间尚无法验证。',
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
      event(runId, 3, 'tool.completed', {
        id: 'tool_search_web_1',
        toolCallId: 'call_search_web_1',
        toolName: 'search_web',
        title: '搜索网络',
        status: 'done',
        kind: 'tool',
        summary: '新闻 · AI · 近 1 天',
      }, 'tool', 'TOOL'),
      event(runId, 4, 'tool.started', {
        id: 'tool_fetch_web_1',
        toolCallId: 'call_fetch_web_1',
        toolName: 'fetch_web_page',
        title: '读取网页',
        status: 'pending',
        kind: 'tool',
      }, 'tool', 'TOOL'),
      event(runId, 5, 'tool.completed', {
        id: 'tool_fetch_web_1',
        toolCallId: 'call_fetch_web_1',
        toolName: 'fetch_web_page',
        title: '读取网页',
        status: 'done',
        kind: 'tool',
        summary: 'example.com/model-release',
      }, 'tool', 'TOOL'),
      event(runId, 6, 'stage', {
        id: 'stage_verify',
        title: '核验依据',
        status: 'done',
        kind: 'stage',
        summary: '已保留来源链接、发布时间与检索时间',
      }, 'progress', 'VERIFY_CLAIMS'),
      event(runId, 7, 'answer.committed', {
        text: answer,
        hash: 'research-answer-fixture',
      }, 'answer', 'PERSIST'),
      event(runId, 8, 'run.completed', { title: '执行完成' }, 'terminal', 'DONE'),
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
      return {
        text,
        linkCount: bubble?.querySelectorAll('a[href^="http"]').length || 0,
        choiceCount: bubble?.querySelectorAll('[data-structured-choice], .structured-choice').length || 0,
      }
    }, { assistantIdx: mount.assistantIdx })

    report.checks.push(
      { id: 'prompt-visible', pass: await window.getByText('帮我看下今天关于 AI 的资讯').count() > 0 },
      {
        id: 'search-timeline',
        pass: state.text.includes('搜索网络') || state.text.includes('网络搜索完成'),
      },
      {
        id: 'fetch-timeline',
        pass: state.text.includes('读取网页') || state.text.includes('网页读取完成'),
      },
      { id: 'verify-timeline', pass: state.text.includes('核验依据') },
      { id: 'source-links', pass: state.linkCount >= 2, count: state.linkCount },
      {
        id: 'publication-and-retrieval-time',
        pass: state.text.includes('发布时间') && state.text.includes('本次检索时间'),
      },
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
