'use strict'

/**
 * 受控 UI 冒烟：用 conversation eval 产出的 grounding-status 注入助手气泡并截图。
 * 使用 production renderer 模块 agent-grounding-ui.js。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '../../../..')
const { runConversationScenario, loadConversationFixtures } = require(path.join(ROOT, 'tests/agent-conversation-eval-harness'))

const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'grounding-ui-fixture-smoke.json')

function digestHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16)
}

async function main() {
  const fixtures = loadConversationFixtures()
  const blockedRun = await runConversationScenario(fixtures.find(f => f.name === 'feishu-meeting-pick-2-no-tool'))
  const verifiedRun = await runConversationScenario(fixtures.find(f => f.name === 'feishu-meeting-pick-2-happy'))

  const blockedGs = blockedRun.report.grounding || { status: 'blocked', sources: [], violations: [] }
  const verifiedGs = verifiedRun.report.grounding || { status: 'verified', sources: [], violations: [] }

  const audit = {
    mode: 'controlled-ui-fixture',
    blocked: {
      status: blockedGs.status,
      textLen: String(blockedRun.report.text || '').length,
      hasRawToolInUserText: String(blockedRun.report.text || '').includes('feishu.meeting_read'),
      forbiddenHits: ['议题：', '已读取', '负责人：'].filter(t => String(blockedRun.report.text || '').includes(t)),
      violationUserMessage: blockedGs.violations?.[0]?.userMessage || null,
    },
    verified: {
      status: verifiedGs.status,
      sourceTool: verifiedGs.sources?.[0]?.tool || null,
      sourceStatus: verifiedGs.sources?.[0]?.status || null,
      digestHash: digestHash(verifiedGs.sources?.[0]?.digest),
    },
  }

  let electron
  try {
    ({ _electron: electron } = require('playwright'))
  } catch (err) {
    const report = { ok: false, blocked: true, reason: 'playwright unavailable', audit, error: String(err.message || err) }
    fs.mkdirSync(SHOTS, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }

  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-grounding-ui-'))

  if (process.platform === 'win32') {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', 'electron.exe', '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
    await new Promise(r => setTimeout(r, 1200))
  }

  const report = { ok: false, audit, screenshots: {}, checks: [] }
  let app
  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: { ...process.env, KNOWME_GROUNDING_RUNTIME: 'runtime', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      timeout: 120000,
    })
    const window = await app.firstWindow({ timeout: 90000 })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(2500)

    const injectAndShot = async (id, text, gs, openSources = false) => {
      await window.evaluate(({ text, gs, openSources }) => {
        const log = document.getElementById('agentChatLog')
        if (!log) throw new Error('agentChatLog missing')
        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const meta = window.GroundingUI.renderGroundingStatusMetaHtml(gs, esc)
        log.innerHTML = `<div class="agent-bubble assistant" data-idx="0"><div class="chat-text">${esc(text).replace(/\n/g, '<br>')}</div>${meta}</div>`
        if (openSources) {
          const details = log.querySelector('.agent-grounding-sources')
          if (details) details.open = true
        }
      }, { text, gs, openSources })
      const shotPath = path.join(SHOTS, `${id}.png`)
      await window.screenshot({ path: shotPath, scale: 'css' })
      return path.relative(OUT, shotPath).replace(/\\/g, '/')
    }

    report.screenshots.blocked = await injectAndShot('meeting-blocked', blockedRun.report.text, blockedGs)
    report.checks.push({ id: 'blocked-screenshot', pass: fs.existsSync(path.join(OUT, report.screenshots.blocked)) })
    report.checks.push({
      id: 'blocked-no-raw-tool-in-bubble',
      pass: !(await window.evaluate(() => document.getElementById('agentChatLog')?.innerText || '').then(t => t.includes('feishu.meeting_read'))),
    })
    report.checks.push({
      id: 'blocked-friendly-violation-note',
      pass: await window.evaluate(() => (document.getElementById('agentChatLog')?.innerText || '').includes('缺少必需读取')),
    })

    report.screenshots.verified = await injectAndShot('meeting-verified', verifiedRun.report.text, verifiedGs, true)
    report.checks.push({ id: 'verified-screenshot', pass: fs.existsSync(path.join(OUT, report.screenshots.verified)) })
    report.checks.push({
      id: 'verified-friendly-source-label',
      pass: await window.evaluate(() => (document.getElementById('agentChatLog')?.innerText || '').includes('飞书会议妙记读取')),
    })

    // A2: simulate renderChat rebuild preserving details open
    report.checks.push({
      id: 'details-open-survives-rerender',
      pass: await window.evaluate(() => {
        const log = document.getElementById('agentChatLog')
        const UI = window.GroundingUI
        if (!log || !UI) return false
        const state = UI.captureGroundingDetailsOpenState(log)
        const html = log.innerHTML
        log.innerHTML = html
        UI.restoreGroundingDetailsOpenState(log, state)
        return log.querySelector('.agent-grounding-sources')?.open === true
      }),
    })

    report.ok = report.checks.every(c => c.pass)
  } catch (err) {
    report.error = String(err.message || err)
  } finally {
    if (app) await app.close().catch(() => {})
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
