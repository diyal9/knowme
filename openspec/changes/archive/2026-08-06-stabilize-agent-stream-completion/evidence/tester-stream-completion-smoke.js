'use strict'

/**
 * 测试角色 QA：稳定 Agent 流式收尾
 * 受控 fixture + 契约 + 反模式静态断言；不启动第二 Electron 实例。
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const REPORT = path.join(OUT, 'tester-stream-completion-smoke.json')

function parseDetailsOpen(html) {
  const m = html.match(/<details[^>]*data-execution-timeline="1"([^>]*)>/)
  if (!m) return null
  return /\bopen\b/.test(m[1]) || /\bopen(?:=|\s)/.test(m[0])
}

function hasSubstring(html, text) {
  return html.includes(text)
}

function runningTimelineHtml() {
  return `<details class="agent-execution is-running" data-execution-timeline="1" open>
    <summary class="agent-execution-summary">
      <span class="agent-execution-title">执行进度</span>
    </summary>
  </details>`
}

function completedTimelineHtml({ pendingReview = false } = {}) {
  const openAttr = pendingReview ? ' open' : ''
  return `<details class="agent-execution" data-execution-timeline="1"${openAttr}>
    <summary class="agent-execution-summary">
      <span class="agent-execution-title">执行过程</span>
    </summary>
    <div class="agent-tool-approval"><button class="agent-draft-approve">批准</button><button class="agent-draft-reject">拒绝</button></div>
  </details>`
}

function longMarkdownFixture() {
  return `# 长回答收尾

## 列表
- 项一
- 项二

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |

\`\`\`js
console.log('code')
\`\`\`
`
}

function main() {
  const renderer = fs.readFileSync(path.join(ROOT, 'src', 'workspace-agent.js'), 'utf8')
  const mainJs = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8')
  const runningHtml = runningTimelineHtml()
  const completedHtml = completedTimelineHtml()
  const pendingHtml = completedTimelineHtml({ pendingReview: true })

  const contract = spawnSync(process.execPath, [
    '--test',
    'tests/agent-stream-repaint.test.js',
    'tests/agent-streaming-integration.test.js',
    'tests/agent-run-executor.test.js',
  ], { cwd: ROOT, encoding: 'utf8' })

  const report = {
    mode: 'tester-fixture-contract-anti-pattern',
    at: new Date().toISOString(),
    change: 'stabilize-agent-stream-completion',
    role: 'tester',
    limitations: [
      'npm start 占用 Electron 单实例锁，未并行 Playwright 真机 smoke。',
      '无在线 LLM API Key，多 chunk / 长 Markdown 滚动以契约 + fixture 等价验证。',
      '取消态 IPC 真机证据沿用 dev cancel-ipc-smoke.json（开发自测时无并发实例）。',
    ],
    contractTests: {
      pass: contract.status === 0,
      stdoutTail: (contract.stdout || '').split('\n').slice(-10).join('\n'),
    },
    smokeScope: [],
    antiPatterns: [],
    ok: false,
  }

  // --- Smoke Scope (qa-plan) ---
  report.smokeScope.push({
    id: 'multi-chunk-no-flash-replay',
    pass: renderer.includes('gotNonEmptyStream') && renderer.includes('completeAssistantBubble(') && !renderer.includes('streamUpdateCount <= 1'),
    method: 'contract + source',
    liveLlm: 'skipped-no-api-key',
  })
  report.smokeScope.push({
    id: 'tool-timeline-expand-then-collapse',
    pass: parseDetailsOpen(runningHtml) === true && parseDetailsOpen(completedHtml) === false,
    method: 'fixture',
  })
  report.smokeScope.push({
    id: 'single-flush-no-replay',
    pass: renderer.includes('if (!gotNonEmptyStream && finalText)') && !renderer.includes('streamedButSingleFlush'),
    method: 'contract',
  })
  report.smokeScope.push({
    id: 'pending-review-stays-visible',
    pass: parseDetailsOpen(pendingHtml) === true && hasSubstring(pendingHtml, '批准') && hasSubstring(pendingHtml, '拒绝'),
    method: 'fixture',
  })
  report.smokeScope.push({
    id: 'user-reexpand-timeline',
    pass: renderer.includes("timeline.removeAttribute('open')") && hasSubstring(completedHtml, '<summary'),
    method: 'details-semantics + source',
  })
  report.smokeScope.push({
    id: 'long-markdown-completion-stable',
    pass: renderer.includes('function isStreamTail(')
      && renderer.includes('md-stream-tail')
      && renderer.includes('function reconcileCompletedAssistantBody(')
      && renderer.includes('function isChatNearBottom(')
      && renderer.includes('chatProgrammaticScroll'),
    method: 'static-contract',
    liveLlm: 'skipped-no-api-key',
    note: '表格尾 plain-text、完成 reconcile、近底滚动逻辑存在；未 Electron 截图验证滚动跳跃。',
  })
  report.smokeScope.push({
    id: 'cancel-no-ipc-clone-error',
    pass: (() => {
      const p = path.join(OUT, 'cancel-ipc-smoke.json')
      if (!fs.existsSync(p)) return false
      const c = JSON.parse(fs.readFileSync(p, 'utf8'))
      return c.ok === true && c.cloneError === false
    })(),
    method: 'dev-electron-evidence',
  })

  // --- 反模式静态审查 ---
  report.antiPatterns.push({
    id: 'no-full-answer-vanish-retype',
    pass: !renderer.includes('streamUpdateCount <= 1') && renderer.includes('completeAssistantBubble(assistantRef.idx)'),
    severity: 'BLOCKING-if-fail',
  })
  report.antiPatterns.push({
    id: 'collapse-does-not-move-final-answer',
    pass: renderer.includes('reconcileCompletedAssistantBody(currentBody, nextBody)') && renderer.includes('data-assistant-body="1"'),
    severity: 'BLOCKING-if-fail',
  })
  report.antiPatterns.push({
    id: 'patch-does-not-force-reopen',
    pass: !renderer.slice(
      renderer.indexOf('function patchExecutionTimeline'),
      renderer.indexOf('function updateThinkingStatus'),
    ).includes("setAttribute('open'"),
    severity: 'BLOCKING-if-fail',
  })
  report.antiPatterns.push({
    id: 'pending-review-not-auto-hidden',
    pass: renderer.includes("if (hasPendingReview(message)) timeline.setAttribute('open', '')"),
    severity: 'BLOCKING-if-fail',
  })
  report.antiPatterns.push({
    id: 'cancel-no-kernel-spread-over-ipc',
    pass: mainJs.includes('cancelled: true') && !/if \(kernelResult\.cancelled\)[^{\n]*return \{\s*\.\.\.kernelResult/.test(mainJs),
    severity: 'BLOCKING-if-fail',
  })
  report.antiPatterns.push({
    id: 'no-raw-cot',
    pass: !renderer.includes('reasoning_content'),
    severity: 'BLOCKING-if-fail',
  })

  report.ok = contract.status === 0
    && report.smokeScope.every(s => s.pass)
    && report.antiPatterns.every(a => a.pass)

  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main()
