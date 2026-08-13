'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

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
const REPORT = path.join(__dirname, 'stream-visibility-electron-smoke.json')
const SHOT = path.join(__dirname, 'screenshots', 'stable-stream-content.png')
const PENDING_SHOT = path.join(__dirname, 'screenshots', 'buffered-pending-content.png')

async function main() {
  const { _electron: electron } = require('playwright')
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-stream-visibility-'))
  fs.mkdirSync(path.dirname(SHOT), { recursive: true })

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
    timeout: 20000,
  })

  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    userDataDir,
    checks: [],
    screenshots: {
      pending: 'screenshots/buffered-pending-content.png',
      stable: 'screenshots/stable-stream-content.png',
    },
  }

  try {
    const window = await app.firstWindow({ timeout: 15000 })
    await window.evaluate(() => localStorage.setItem('__knowme_agent_output_fixture', '1'))
    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    const agentRail = window.locator('#btnRailAi')
    if (await agentRail.count()) {
      await agentRail.click()
      await window.locator('#agentChatLog').waitFor({ state: 'visible', timeout: 20000 })
    }
    await window.waitForFunction(() => window.__KnowMeAgentOutputFixture, { timeout: 90000 })

    const mount = await window.evaluate(() =>
      window.__KnowMeAgentOutputFixture.mountLegacyStream({ runId: 'run_stream_visibility' }),
    )

    async function stepFor(assistantIdx, text) {
      const result = await window.evaluate(({ idx, value }) =>
        window.__KnowMeAgentOutputFixture.stepLegacyStream(idx, value, { append: false }),
      { idx: assistantIdx, value: text })
      await window.waitForTimeout(40)
      return result
    }
    const step = text => stepFor(mount.assistantIdx, text)

    const halfHeading = await step('# 原始标题不应显示')
    report.checks.push({
      id: 'unfinished-heading-hidden',
      pass: halfHeading.visibleText.includes('正在整理')
        && !halfHeading.visibleText.includes('原始标题不应显示')
        && !halfHeading.rawHtml.includes('# 原始标题不应显示'),
    })

    const stableHeading = await step('# 用户标题\n')
    report.checks.push({
      id: 'stable-heading-formatted-directly',
      pass: stableHeading.visibleText.includes('用户标题')
        && stableHeading.rawHtml.includes('<h1>用户标题</h1>')
        && !stableHeading.rawHtml.includes('md-stream-tail'),
    })

    const protocol = await step('# 用户标题\n\n{"thinking":"PRIVATE_REASONING"')
    report.checks.push({
      id: 'incomplete-protocol-zero-leak',
      pass: !protocol.visibleText.includes('PRIVATE_REASONING')
        && !protocol.rawHtml.includes('PRIVATE_REASONING')
        && !protocol.rawHtml.includes('"thinking"'),
    })

    const suggestion = await step('可见段落。\n\n```suggestion\n{"items":[{"label":"PRIVATE_CHOICE"')
    report.checks.push({
      id: 'incomplete-suggestion-zero-leak',
      pass: suggestion.visibleText.includes('可见段落')
        && !suggestion.visibleText.includes('PRIVATE_CHOICE')
        && !suggestion.rawHtml.includes('PRIVATE_CHOICE')
        && !suggestion.rawHtml.includes('```suggestion'),
    })

    const codeFence = await step('代码结果：\n```json\n{"private":"BUFFERED_CODE"')
    report.checks.push({
      id: 'unclosed-code-fence-buffered',
      pass: codeFence.visibleText.includes('代码结果')
        && codeFence.visibleText.includes('正在整理')
        && !codeFence.visibleText.includes('BUFFERED_CODE')
        && !codeFence.rawHtml.includes('BUFFERED_CODE'),
    })

    const pendingLink = await step('参考 [KnowMe](https://example.com')
    report.checks.push({
      id: 'unfinished-link-buffered',
      pass: pendingLink.visibleText.includes('正在整理')
        && !pendingLink.visibleText.includes('https://example.com')
        && !pendingLink.rawHtml.includes('https://example.com'),
    })

    const stableList = await step('- 稳定列表项\n')
    report.checks.push({
      id: 'stable-list-formatted-directly',
      pass: stableList.visibleText.includes('稳定列表项')
        && stableList.rawHtml.includes('<ul>')
        && stableList.rawHtml.includes('<li>稳定列表项</li>'),
    })

    const pendingTable = await step('表格结果：\n| 名称 | 状态 |\n| --- | --- |\n')
    report.checks.push({
      id: 'incomplete-table-buffered',
      pass: pendingTable.visibleText.includes('表格结果')
        && pendingTable.visibleText.includes('正在整理')
        && !pendingTable.visibleText.includes('| 名称 | 状态 |')
        && !pendingTable.rawHtml.includes('| 名称 | 状态 |'),
    })
    await window.screenshot({ path: PENDING_SHOT, scale: 'css' })

    const stableTable = await step('表格结果：\n| 名称 | 状态 |\n| --- | --- |\n| A | 完成 |\n\n')
    report.checks.push({
      id: 'stable-table-formatted-directly',
      pass: stableTable.rawHtml.includes('<table>')
        && stableTable.rawHtml.includes('<td>A</td>')
        && !stableTable.rawHtml.includes('md-stream-pending'),
    })

    const completed = await window.evaluate(({ idx }) =>
      window.__KnowMeAgentOutputFixture.completeLegacyStream(idx),
    { idx: mount.assistantIdx })
    report.checks.push({
      id: 'completion-keeps-stable-shell',
      pass: completed.sameBodyNode
        && completed.sameBubbleNode
        && completed.rawHtml.includes('<table>')
        && !completed.rawHtml.includes('md-stream-pending'),
    })

    await window.screenshot({ path: SHOT, scale: 'css' })

    const cancelMount = await window.evaluate(() =>
      window.__KnowMeAgentOutputFixture.mountLegacyStream({ runId: 'run_stream_cancelled' }),
    )
    await stepFor(cancelMount.assistantIdx, '参考 [KnowMe](https://private.example')
    const cancelled = await window.evaluate(({ idx }) =>
      window.__KnowMeAgentOutputFixture.completeLegacyStream(idx, { cancelled: true }),
    { idx: cancelMount.assistantIdx })
    report.checks.push({
      id: 'cancelled-tail-remains-hidden',
      pass: cancelled.sameBodyNode
        && cancelled.sameBubbleNode
        && cancelled.visibleText.includes('已停止生成')
        && !cancelled.visibleText.includes('private.example')
        && !cancelled.rawHtml.includes('private.example')
        && !cancelled.rawHtml.includes('md-stream-pending'),
    })

    const v2Mount = await window.evaluate(() => {
      const history = Array.from({ length: 28 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        text: `历史消息 ${index + 1}：${'用于验证滚动位置稳定。'.repeat(8)}`,
      }))
      return window.__KnowMeAgentOutputFixture.mount({
        runId: 'run_stream_visibility_v2',
        history,
      })
    })
    const scrollBefore = await window.evaluate(() =>
      window.__KnowMeAgentOutputFixture.scrollUp(260),
    )
    const v2Committed = await window.evaluate(async ({ runId }) =>
      window.__KnowMeAgentOutputFixture.dispatchViaIpc({
        version: 2,
        runId,
        seq: 1,
        lane: 'answer',
        type: 'answer.committed',
        payload: {
          text: '# V2 稳定回答\n\n这是 canonical answer。',
          hash: 'fixture-v2-answer',
        },
        phase: 'PERSIST',
        round: 1,
      }),
    { runId: v2Mount.runId })
    const scrollAfter = await window.evaluate(() =>
      window.__KnowMeAgentOutputFixture.getScrollTop(),
    )
    const v2Html = await window.evaluate(() =>
      window.__KnowMeAgentOutputFixture.getRawHtml(),
    )
    report.checks.push({
      id: 'v2-ipc-and-scroll-stay-stable',
      pass: v2Committed.ok
        && v2Committed.ipcPath
        && v2Committed.sameBodyNode
        && scrollBefore > 0
        && Math.abs(scrollAfter - scrollBefore) < 8
        && v2Html.includes('<h1>V2 稳定回答</h1>')
        && !v2Html.includes('md-stream-tail'),
      scrollBefore,
      scrollAfter,
      driftPx: Math.abs(scrollAfter - scrollBefore),
    })

    report.ok = report.checks.every(item => item.pass)
  } catch (err) {
    report.error = String(err?.stack || err?.message || err)
  } finally {
    await app.close().catch(() => {})
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
