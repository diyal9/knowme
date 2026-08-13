'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')
const { VERSION, Lane, EventType, stableHash } = require('../../../../src/lib/agent-output-protocol')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'agent-team-runtime-electron-smoke.json')

function event(runId, seq, type, payload, lane = Lane.PROGRESS) {
  return {
    version: VERSION,
    runId,
    seq,
    type,
    lane,
    phase: 'ORCHESTRATE',
    round: 1,
    payload,
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-team-runtime-'))
  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    checks: [],
    consoleErrors: [],
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
    const window = await app.firstWindow({ timeout: 30000 })
    window.on('console', message => {
      if (message.type() === 'error' && !/favicon|DevTools|Autofill/i.test(message.text())) {
        report.consoleErrors.push(message.text())
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 30000 })
    await window.evaluate(() => localStorage.setItem('__knowme_agent_output_fixture', '1'))
    await window.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await window.locator('#btnRailAi').click()
    await window.locator('#agentChatLog').waitFor({ state: 'visible', timeout: 20000 })
    await window.waitForFunction(() => Boolean(window.__KnowMeAgentOutputFixture), null, { timeout: 20000 })

    const runId = `team_runtime_smoke_${Date.now()}`
    const mounted = await window.evaluate(id => window.__KnowMeAgentOutputFixture.mount({ runId: id }), runId)

    const events = [
      event(runId, 1, EventType.SUBRUN_STARTED, {
        subRunId: 'sub_research',
        subRunSeq: 1,
        expertId: 'researcher',
        builderId: 'cursor-package',
        inputSummary: '核验生产事实',
      }),
      event(runId, 2, EventType.SUBRUN_PROGRESS, {
        subRunId: 'sub_research',
        subRunSeq: 2,
        kind: 'handoff',
        handoffType: 'handoff.request',
        sourceExpertId: 'researcher',
        targetExpertId: 'writer',
        summary: '将已核验事实交给写作 Agent',
      }),
      event(runId, 3, EventType.CHOICE_READY, {
        subRunId: 'sub_research',
        draftId: 'draft_runtime_smoke',
        requiresApproval: true,
        risk: 'write',
        ui: [{ kind: 'approval', title: '发布前审批', items: [] }],
      }, Lane.UI),
      event(runId, 4, EventType.SUBRUN_PROGRESS, {
        subRunId: 'sub_research',
        subRunSeq: 3,
        kind: 'artifact',
        artifactRefs: [{ id: 'artifact_report', kind: 'report', title: '运行时核验报告' }],
        evidence: [{ id: 'evidence_1', digest: 'sha256-runtime-evidence', summary: '事实已核验' }],
        budget: { remainingMs: 2400, remainingToolCalls: 3 },
        security: { promptInjectionSuspected: true, trust: 'untrusted-child-output' },
      }),
      event(runId, 5, EventType.SUBRUN_COMPLETED, {
        subRunId: 'sub_research',
        subRunSeq: 4,
        terminal: 'completed',
        summary: '调研子 Run 已完成',
        artifactRefs: ['artifact_report'],
        evidenceRefs: [{ id: 'evidence_1', digest: 'sha256-runtime-evidence', summary: '事实已核验' }],
      }),
      event(runId, 6, EventType.SUBRUN_STARTED, {
        subRunId: 'sub_failed',
        subRunSeq: 1,
        expertId: 'reviewer',
        builderId: 'claude-package',
      }),
      event(runId, 7, EventType.SUBRUN_FAILED, {
        subRunId: 'sub_failed',
        subRunSeq: 2,
        terminal: 'failed',
        retriable: true,
        stopReason: 'remote_timeout',
        summary: '远程 Agent 超时，可安全重试',
      }),
      event(runId, 8, EventType.SUBRUN_TERMINAL, {
        subRunId: 'sub_interrupted',
        subRunSeq: 1,
        expertId: 'publisher',
        builderId: 'knowme-local',
        terminal: 'interrupted',
        status: 'interrupted',
        stopReason: 'interrupted',
        summary: '进程重启后等待恢复',
      }),
    ]

    let cancelControlSeen = false
    for (const item of events) {
      const dispatched = await window.evaluate(evt => window.__KnowMeAgentOutputFixture.dispatchViaIpc(evt), item)
      if (!dispatched?.ok) throw new Error(`fixture dispatch failed: ${JSON.stringify(dispatched)}`)
      if (item.seq === 1) {
        cancelControlSeen = await window.evaluate(() =>
          Boolean(document.querySelector('[data-run-cancel="sub_research"]')))
      }
    }

    const beforeTerminal = await window.evaluate((cancelSeen) => {
      const text = document.querySelector('.agent-run-tree')?.textContent || ''
      return {
        nodeCount: document.querySelectorAll('.agent-run-tree [data-subrun-id]').length,
        hasCancel: cancelSeen,
        hasRetry: Boolean(document.querySelector('[data-run-retry="sub_failed"]')),
        hasResume: Boolean(document.querySelector('[data-run-resume="sub_interrupted"]')),
        hasHandoff: text.includes('Handoff'),
        hasApproval: text.includes('审批'),
        hasArtifact: text.includes('产物'),
        hasEvidence: text.includes('证据'),
        hasBudget: text.includes('预算'),
        hasSecurity: text.includes('安全'),
      }
    }, cancelControlSeen)
    report.beforeTerminal = beforeTerminal
    for (const [id, ok] of Object.entries(beforeTerminal)) {
      report.checks.push({ id, ok: id === 'nodeCount' ? ok === 3 : Boolean(ok) })
    }

    const answer = '父 Run 已汇聚两个 Builder 的结果，并保留审批、产物与证据。'
    const finalEvents = [
      event(runId, 9, EventType.ANSWER_COMMITTED, {
        text: answer,
        hash: stableHash(answer),
      }, Lane.ANSWER),
      event(runId, 10, EventType.RUN_COMPLETED, {
        title: '团队工作流完成',
        artifactRefs: ['artifact_report'],
        evidenceRefs: ['evidence_1'],
      }, Lane.TERMINAL),
    ]
    for (const item of finalEvents) {
      const dispatched = await window.evaluate(evt => window.__KnowMeAgentOutputFixture.dispatchViaIpc(evt), item)
      if (!dispatched?.ok) throw new Error(`terminal dispatch failed: ${JSON.stringify(dispatched)}`)
    }

    const finalMessage = await window.evaluate(
      idx => window.__KnowMeAgentOutputFixture.getMessage(idx),
      mounted.assistantIdx,
    )
    const finalState = finalMessage?.state || null
    report.finalState = finalState
    report.checks.push({ id: 'parent-terminal-once', ok: finalState?.terminalType === 'run.completed' })
    report.checks.push({ id: 'answer-committed', ok: finalState?.answerCommitted === true })
    report.checks.push({ id: 'console-error-free', ok: report.consoleErrors.length === 0 })

    await window.locator('.agent-run-tree').evaluate(node => { node.open = true })
    for (const node of await window.locator('.agent-run-node').all()) {
      await node.evaluate(item => { item.open = true })
    }
    await window.screenshot({
      path: path.join(SHOTS, 'agent-team-runtime-run-tree.png'),
      fullPage: false,
    })

    report.ok = report.checks.every(check => check.ok)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    if (!report.ok) throw new Error(`Electron smoke failed: ${JSON.stringify(report.checks)}`)
  } finally {
    await app?.close().catch(() => {})
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* Electron may release late */ }
  }
}

main().catch(error => {
  let existing = {}
  try { existing = JSON.parse(fs.readFileSync(REPORT, 'utf8')) } catch { /* no prior report */ }
  const failed = { ...existing, at: new Date().toISOString(), ok: false, error: String(error?.stack || error) }
  fs.writeFileSync(REPORT, `${JSON.stringify(failed, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
