'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')
const { stableHash, VERSION } = require('../../../../src/lib/agent-output-protocol')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'chat-layout-electron-smoke.json')

function event(runId, seq, type, payload, lane) {
  return { version: VERSION, runId, seq, type, payload, lane, phase: 'PERSIST', round: 1 }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-chat-layout-'))
  const runtimeErrors = []
  const report = {
    generatedAt: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    userDataDir,
    checks: [],
    metrics: {},
    runtimeErrors,
    screenshot: 'screenshots/chat-response-layout.png',
  }

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
        KNOWME_AGENT_OUTPUT_FIXTURE: '1',
      },
      timeout: 30000,
    })
    const window = await app.firstWindow({ timeout: 20000 })
    window.on('pageerror', err => runtimeErrors.push(`pageerror: ${err.message}`))
    window.on('console', msg => {
      if (msg.type() === 'error') runtimeErrors.push(`console: ${msg.text()}`)
    })

    await window.evaluate(() => localStorage.setItem('__knowme_agent_output_fixture', '1'))
    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    const rail = window.locator('#btnRailAi')
    if (await rail.count()) await rail.click()
    await window.locator('#agentChatLog').waitFor({ state: 'visible', timeout: 20000 })
    await window.waitForFunction(() => window.__KnowMeAgentOutputFixture, { timeout: 30000 })
    await window.waitForTimeout(1200)

    const answer = [
      '为帮你快速落地，我建议按这个顺序推进：',
      '',
      '## 下一步建议',
      '',
      '1. **读取知识库开发架构文档**：获取知识库开发的标准流程、目录规范与验证清单。',
      '2. **读取 AI Agent 落地宣讲稿**：提取手游 AI 落地的典型场景、技术栈与验收指标。',
      '3. **结合服务端与 AI 架构角色**：整理成一份可执行的手游服务端 AI 落地路线图。',
      '',
      '完成资料读取后，我会直接给出接入点、Agent 编排接口和版本交付节奏。',
    ].join('\n')
    const hash = stableHash(answer)
    const runId = `run_chat_layout_${Date.now()}`
    const mounted = await window.evaluate(({ runId }) => window.__KnowMeAgentOutputFixture.mount({
      runId,
      history: [{ role: 'user', text: '帮我规划手游服务端 AI 落地路线', streaming: false }],
    }), { runId })

    const events = [
      event(runId, 1, 'answer.committed', { text: answer, hash }, 'answer'),
      event(runId, 2, 'choice.ready', {
        hash,
        ui: [{
          kind: 'choice',
          title: '建议先做',
          items: [
            {
              id: 'read-architecture',
              label: '读取知识库开发架构文档',
              description: '加载完整架构文档，提取目录规范、标准流程和验证清单',
              action: 'send',
              payload: '读取知识库开发架构文档',
            },
            {
              id: 'read-agent-guide',
              label: '读取 AI Agent 落地宣讲稿',
              description: '加载完整宣讲稿，提取手游场景、技术栈与验收指标',
              action: 'send',
              payload: '读取 AI Agent 落地宣讲稿',
            },
          ],
        }],
      }, 'ui'),
      event(runId, 3, 'run.completed', { title: '执行完成' }, 'terminal'),
    ]

    for (const item of events) {
      const result = await window.evaluate(
        ({ item }) => window.__KnowMeAgentOutputFixture.dispatch(item),
        { item },
      )
      if (!result?.ok) throw new Error(`fixture dispatch failed: ${JSON.stringify(result)}`)
    }

    await window.waitForTimeout(400)
    report.metrics = await window.evaluate(({ assistantIdx }) => {
      const bubble = document.querySelector(`.agent-bubble.assistant[data-idx="${assistantIdx}"]`)
      const body = bubble?.querySelector('.agent-response-body')
      const choices = bubble?.querySelector('.agent-structured-ui')
      const description = bubble?.querySelector('.sug-desc')
      const composer = document.getElementById('agentComposer')
      const textarea = document.getElementById('agentInput')
      const rect = node => node?.getBoundingClientRect?.()
      return {
        bubbleWidth: Math.round(rect(bubble)?.width || 0),
        bodyWidth: Math.round(rect(body)?.width || 0),
        choiceWidth: Math.round(rect(choices)?.width || 0),
        composerHeight: Math.round(rect(composer)?.height || 0),
        textareaHeight: Math.round(rect(textarea)?.height || 0),
        choiceDescriptionWhiteSpace: description ? getComputedStyle(description).whiteSpace : '',
        choiceCount: bubble?.querySelectorAll('.agent-suggest-item').length || 0,
        visibleText: bubble?.innerText || '',
      }
    }, { assistantIdx: mounted.assistantIdx })

    const metrics = report.metrics
    report.checks = [
      {
        id: 'focused-reading-track',
        pass: metrics.bodyWidth > 0 && metrics.bodyWidth <= 782 && metrics.bodyWidth < metrics.bubbleWidth,
        detail: { bodyWidth: metrics.bodyWidth, bubbleWidth: metrics.bubbleWidth },
      },
      {
        id: 'choice-aligns-with-reading-track',
        pass: metrics.choiceWidth === metrics.bodyWidth,
        detail: { choiceWidth: metrics.choiceWidth, bodyWidth: metrics.bodyWidth },
      },
      {
        id: 'choice-description-wraps',
        pass: metrics.choiceDescriptionWhiteSpace !== 'nowrap' && metrics.choiceCount === 2,
        detail: {
          whiteSpace: metrics.choiceDescriptionWhiteSpace,
          choiceCount: metrics.choiceCount,
        },
      },
      {
        id: 'conversation-composer-compact',
        pass: metrics.composerHeight <= 114 && metrics.textareaHeight === 66,
        detail: { composerHeight: metrics.composerHeight, textareaHeight: metrics.textareaHeight },
      },
      {
        id: 'answer-and-actions-visible',
        pass: metrics.visibleText.includes('下一步建议') && metrics.visibleText.includes('建议先做'),
      },
      {
        id: 'no-runtime-errors',
        pass: runtimeErrors.length === 0,
        detail: runtimeErrors,
      },
    ]

    const log = window.locator('#agentChatLog')
    await log.evaluate(node => { node.scrollTop = node.scrollHeight })
    await window.screenshot({ path: path.join(SHOTS, 'chat-response-layout.png'), scale: 'css' })
    report.ok = report.checks.every(check => check.pass)
  } catch (err) {
    report.error = String(err?.stack || err)
  } finally {
    if (app) await app.close().catch(() => {})
  }

  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
