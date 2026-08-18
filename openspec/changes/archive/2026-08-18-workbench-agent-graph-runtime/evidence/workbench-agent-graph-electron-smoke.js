'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-agent-graph-electron-smoke.json')

function writeFixtureExperts(userDataDir) {
  const experts = [
    ['researcher', '资料研究 Agent', '负责检索和核验目标相关资料。', '研究、检索、核验'],
    ['writer', '交付写作 Agent', '负责整理研究结果并形成可交付内容。', '写作、整理、交付'],
  ]
  for (const [id, name, description, skills] of experts) {
    const dir = path.join(userDataDir, 'capabilities', 'experts', id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'EXPERT.md'), `---
name: ${name}
description: ${description}
skills: [${skills}]
---

你是 KnowMe 的本地测试 Expert，按目标完成职责并输出结构化结果。
`, 'utf8')
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-graph-'))
  writeFixtureExperts(userDataDir)
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workbenchAuth: { endpoint: 'http://127.0.0.1:9' },
  }), 'utf8')

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
      },
      timeout: 120000,
    })
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1360, height: 860 })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#wbGoalInput').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#wbGoalInput').fill('调研资料并整理成可交付方案')
    await window.locator('#wbGoalSubmit').click()
    await window.locator('#wbTaskPage.active').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#wbWorkflowModal').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#wbModalBody').waitFor({ state: 'visible', timeout: 30000 })

    const proposal = await window.evaluate(() => ({
      title: document.querySelector('#wbModalTitle')?.textContent || '',
      body: document.querySelector('#wbModalBody')?.textContent || '',
      nodeCount: document.querySelectorAll('#wbModalBody .wb-launch-extra-item').length,
      confirmText: document.querySelector('#wbModalConfirm')?.textContent || '',
    }))
    report.proposal = proposal
    report.checks.push({ id: 'proposal-title', ok: proposal.title.includes('Agent') })
    report.checks.push({ id: 'proposal-goal', ok: proposal.body.includes('调研资料并整理成可交付方案') })
    report.checks.push({ id: 'proposal-has-multiple-agents', ok: proposal.nodeCount >= 2 })
    report.checks.push({ id: 'proposal-requires-confirmation', ok: proposal.confirmText.includes('确认并启动') })

    await window.screenshot({
      path: path.join(SHOTS, 'agent-graph-proposal.png'),
      fullPage: false,
    })

    await window.locator('#wbModalConfirm').click()
    await window.waitForFunction(
      () => document.querySelector('#wbModalHint')?.textContent?.includes('API Key'),
      null,
      { timeout: 30000 },
    )
    const guard = await window.evaluate(() => ({
      modalVisible: !document.querySelector('#wbWorkflowModal')?.hidden,
      hint: document.querySelector('#wbModalHint')?.textContent || '',
      runnerHidden: Boolean(document.querySelector('#wbRunner')?.hidden),
    }))
    report.startGuard = guard
    report.checks.push({ id: 'start-requires-runtime-config', ok: guard.hint.includes('API Key') })
    report.checks.push({ id: 'failed-start-keeps-proposal', ok: guard.modalVisible && guard.runnerHidden })
    report.checks.push({ id: 'console-error-free', ok: report.consoleErrors.length === 0 })
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
  fs.writeFileSync(REPORT, `${JSON.stringify({
    ...existing,
    at: new Date().toISOString(),
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
