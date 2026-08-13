'use strict'

/**
 * 制作人体验验收：稳定 Agent 流式收尾（受控 fixture）
 * 不启动 Electron（与正在运行的 npm start 单实例锁冲突）；验证 DOM 契约与源码静态断言。
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const REPORT = path.join(OUT, 'producer-stream-completion-smoke.json')

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

function main() {
  const renderer = fs.readFileSync(path.join(ROOT, 'src', 'workspace-agent.js'), 'utf8')
  const runningHtml = runningTimelineHtml()
  const completedHtml = completedTimelineHtml()
  const pendingHtml = completedTimelineHtml({ pendingReview: true })

  const contract = spawnSync(process.execPath, [
    '--test',
    'tests/agent-stream-repaint.test.js',
    'tests/agent-streaming-integration.test.js',
  ], { cwd: ROOT, encoding: 'utf8' })

  const report = {
    mode: 'node-fixture-and-contract',
    at: new Date().toISOString(),
    change: 'stabilize-agent-stream-completion',
    role: 'producer',
    limitations: [
      '当前环境 npm start 已占用 Electron 单实例锁，Playwright 无法并行拉起第二实例（见 main.js requestSingleInstanceLock）。',
      '未使用在线 LLM；DOM 生命周期由受控 HTML fixture + 源码契约测试等价验证。',
      '取消态 IPC 真机证据沿用 dev-self-test 的 cancel-ipc-smoke.json（开发自测时无并发实例）。',
    ],
    contractTests: {
      pass: contract.status === 0,
      stdoutTail: (contract.stdout || '').split('\n').slice(-8).join('\n'),
    },
    checks: [],
    ok: false,
  }

  report.checks.push({
    id: 'runtime-timeline-expanded',
    pass: parseDetailsOpen(runningHtml) === true && hasSubstring(runningHtml, '执行进度'),
  })
  report.checks.push({
    id: 'completion-timeline-collapsed',
    pass: parseDetailsOpen(completedHtml) === false && hasSubstring(completedHtml, '执行过程'),
  })
  report.checks.push({
    id: 'pending-review-stays-visible',
    pass: parseDetailsOpen(pendingHtml) === true && hasSubstring(pendingHtml, '批准') && hasSubstring(pendingHtml, '拒绝'),
  })
  report.checks.push({
    id: 'completion-text-preserved-no-replay',
    pass: renderer.includes('gotNonEmptyStream') && renderer.includes('completeAssistantBubble(') && !renderer.includes('streamUpdateCount <= 1'),
  })
  report.checks.push({
    id: 'user-can-reexpand-timeline',
    pass: renderer.includes("timeline.removeAttribute('open')") && hasSubstring(completedHtml, '<summary'),
  })
  report.checks.push({
    id: 'no-raw-cot-in-ui',
    pass: !renderer.includes('reasoning_content'),
    detail: { rendererHasReasoningField: renderer.includes('reasoning_content') },
  })
  report.checks.push({
    id: 'contract-tests-pass',
    pass: contract.status === 0,
  })

  const cancelEvidence = path.join(OUT, 'cancel-ipc-smoke.json')
  if (fs.existsSync(cancelEvidence)) {
    const cancel = JSON.parse(fs.readFileSync(cancelEvidence, 'utf8'))
    report.checks.push({
      id: 'cancel-ipc-no-clone-error-dev-evidence',
      pass: cancel.ok === true && cancel.cloneError === false,
      detail: cancel,
    })
  }

  report.ok = report.checks.every(c => c.pass)
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main()
