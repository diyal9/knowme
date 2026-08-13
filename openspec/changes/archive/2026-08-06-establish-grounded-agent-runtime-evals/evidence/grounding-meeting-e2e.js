'use strict'

/**
 * Task 7.5/8.3 综合 E2E 证据编排：
 * 1) AgentRunExecutor + conversation eval（production executor 链）
 * 2) 飞书只读 API 探针（候选 #2 meeting_read）
 * 3) Electron renderer production 模块 + 截图
 * 4) details 展开状态保持
 *
 * 可接受标准（等价 E2E，无伪造）：
 * - blocked：eval accident fixture PASS + UI 无 raw tool + 无 forbiddenClaims
 * - verified：eval happy PASS + meeting_read ok + UI 友好来源标签
 * - 飞书：readonly probe 至少一次 meeting_read ok（bodyLen 统计）或 CLI 错误路径 documented
 * - renderer：grounding-ui-fixture-smoke 全绿含 details-open-survives-rerender
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'grounding-meeting-e2e.json')

function hash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16)
}

function runNode(script) {
  try {
    execFileSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GROUNDING_EVIDENCE_DIR: OUT },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 400) }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function runEvalScenarios() {
  const { runConversationScenario, loadConversationFixtures } = require(path.join(ROOT, 'tests/agent-conversation-eval-harness'))
  const fixtures = loadConversationFixtures()
  const blocked = await runConversationScenario(fixtures.find(f => f.name === 'feishu-meeting-pick-2-no-tool'))
  const verified = await runConversationScenario(fixtures.find(f => f.name === 'feishu-meeting-pick-2-happy'))
  return {
    blocked: {
      passed: blocked.passed,
      status: blocked.report?.grounding?.status,
      textLen: String(blocked.report?.text || '').length,
      forbiddenHits: ['议题：', '已读取', '负责人：'].filter(t => String(blocked.report?.text || '').includes(t)),
      toolCalls: blocked.ports?.toolLedger?.calls?.map(c => ({ name: c.name, status: c.status })) || [],
      runPhases: blocked.report?.runPhases || [],
    },
    verified: {
      passed: verified.passed,
      status: verified.report?.grounding?.status,
      toolCalls: verified.ports?.toolLedger?.calls?.filter(c => c.status === 'ok').map(c => c.name) || [],
      sourceDigest: hash(verified.report?.grounding?.sources?.[0]?.digest),
      bodyLen: verified.ports?.evidenceLedger?.entries?.[0]?.chars || null,
    },
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const report = {
    at: new Date().toISOString(),
    writeBlocked: true,
    acceptanceCriteria: {
      task75: '会议候选→选2→无 meeting_read 则 OutputGate blocked；happy path 展示来源',
      task83: 'Electron 无业务 console error；blocked/verified/workspace 截图',
      equivalence: 'AgentRunExecutor(conversation eval) + feishu readonly probe + Electron GroundingUI',
    },
    layers: {},
    checks: [],
    ok: false,
  }

  report.layers.executor = await runEvalScenarios()
  report.checks.push({ id: 'eval-blocked-pass', pass: report.layers.executor.blocked.passed === true })
  report.checks.push({ id: 'eval-blocked-no-forbidden', pass: report.layers.executor.blocked.forbiddenHits.length === 0 })
  report.checks.push({ id: 'eval-verified-pass', pass: report.layers.executor.verified.passed === true })
  report.checks.push({ id: 'eval-verified-meeting-read', pass: report.layers.executor.verified.toolCalls.includes('feishu.meeting_read') })

  try {
    const feishuRun = runNode(path.join(ROOT, 'scripts/feishu-readonly-meeting-probe.js'))
    report.layers.feishuReadonly = JSON.parse(fs.readFileSync(path.join(OUT, 'feishu-readonly-meeting-probe.json'), 'utf8'))
    report.layers.feishuReadonly._runner = feishuRun
    report.checks.push({
      id: 'feishu-candidates',
      pass: report.layers.feishuReadonly?.candidates?.candidateCount > 0,
    })
    report.checks.push({
      id: 'feishu-read-attempt',
      pass: Array.isArray(report.layers.feishuReadonly?.readAttempts) && report.layers.feishuReadonly.readAttempts.length > 0,
    })
  } catch (err) {
    report.layers.feishuReadonly = { error: String(err.message || err).slice(0, 300) }
    report.checks.push({ id: 'feishu-probe-ran', pass: false })
  }

  await sleep(2000)

  try {
    const uiRun = runNode(path.join(OUT, 'grounding-ui-fixture-smoke.js'))
    report.layers.uiFixture = JSON.parse(fs.readFileSync(path.join(OUT, 'grounding-ui-fixture-smoke.json'), 'utf8'))
    report.layers.uiFixture._runner = uiRun
    for (const check of report.layers.uiFixture.checks || []) {
      report.checks.push({ id: `ui-${check.id}`, pass: check.pass === true })
    }
  } catch (err) {
    report.layers.uiFixture = { error: String(err.message || err).slice(0, 300) }
    report.checks.push({ id: 'ui-fixture-smoke', pass: false })
  }

  await sleep(2000)

  try {
    const bootRun = runNode(path.join(OUT, 'grounding-electron-smoke.js'))
    report.layers.electronBoot = JSON.parse(fs.readFileSync(path.join(OUT, 'grounding-electron-smoke.json'), 'utf8'))
    report.layers.electronBoot._runner = bootRun
    for (const check of report.layers.electronBoot.checks || []) {
      report.checks.push({ id: `electron-${check.id}`, pass: check.pass === true })
    }
  } catch (err) {
    report.layers.electronBoot = { error: String(err.message || err).slice(0, 300) }
    report.checks.push({ id: 'electron-boot-smoke', pass: false })
  }

  report.screenshots = {
    workspace: fs.existsSync(path.join(SHOTS, 'workspace-load.png')) ? 'screenshots/workspace-load.png' : null,
    blocked: fs.existsSync(path.join(SHOTS, 'meeting-blocked.png')) ? 'screenshots/meeting-blocked.png' : null,
    verified: fs.existsSync(path.join(SHOTS, 'meeting-verified.png')) ? 'screenshots/meeting-verified.png' : null,
  }
  report.checks.push({ id: 'screenshots-blocked-verified', pass: Boolean(report.screenshots.blocked && report.screenshots.verified) })

  report.ok = report.checks.every(c => c.pass)
  report.task75Complete = report.ok
  report.task83Complete = report.ok && report.layers.electronBoot?.consoleErrors?.length === 0

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
