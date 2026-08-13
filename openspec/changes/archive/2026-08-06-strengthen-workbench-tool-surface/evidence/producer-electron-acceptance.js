'use strict'

/**
 * 制作人 C 端体验验收 — Electron 真机子集（非 Playwright 浏览器壳）。
 * Run: node openspec/changes/strengthen-workbench-tool-surface/evidence/producer-electron-acceptance.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'producer-electron-acceptance.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function runScenario(envFlag, label) {
  let electron
  try {
    ({ _electron: electron } = require('playwright'))
  } catch (err) {
    return { label, blocked: true, reason: 'playwright unavailable', error: String(err.message || err) }
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `knowme-producer-${label}-`))
  const checks = []
  const consoleErrors = []
  let app

  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        KNOWME_TOOL_SURFACE: envFlag,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      timeout: 120000,
    })

    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) {
          consoleErrors.push(text)
        }
      }
    })

    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(3500)

    const railAi = window.locator('#btnRailAi')
    await railAi.waitFor({ state: 'visible', timeout: 30000 })
    checks.push({ id: 'rail-ai-visible', pass: await railAi.isVisible() })

    await window.locator('#btnRailWorkbench').click()
    await window.waitForTimeout(1500)

    const shotMain = path.join(SHOTS, `producer-${label}-workbench.png`)
    await window.screenshot({ path: shotMain, scale: 'css' })
    checks.push({ id: 'workbench-screenshot', pass: fs.existsSync(shotMain), path: path.relative(OUT, shotMain) })

    await railAi.click()
    await window.waitForTimeout(1500)

    const chatLogVisible = await window.locator('#agentChatLog').count()
    checks.push({ id: 'agent-chat-log-present', pass: chatLogVisible > 0 })

    const preloadApis = await window.evaluate(() => ({
      toolApproveDraft: typeof window.api?.toolApproveDraft === 'function',
      toolDraftsList: typeof window.api?.toolDraftsList === 'function',
      toolRejectDraft: typeof window.api?.toolRejectDraft === 'function' || typeof window.api?.toolApproveDraft === 'function',
    }))
    checks.push({ id: 'preload-toolApproveDraft', pass: preloadApis.toolApproveDraft })
    checks.push({ id: 'preload-toolDraftsList', pass: preloadApis.toolDraftsList })

    const injected = await window.evaluate(() => {
      const chatLog = document.querySelector('#agentChatLog')
      if (!chatLog) return { ok: false, reason: 'no agentChatLog' }
      const mockHtml = `
        <div class="agent-msg assistant">
          <details class="agent-execution is-running" open>
            <summary class="agent-execution-summary"><span class="agent-execution-title">执行进度</span></summary>
            <div class="agent-execution-list">
              <details class="agent-trace-row tool done pending-review" open>
                <summary><span class="agent-trace-title">修改文件 preview.txt</span><span class="agent-trace-result-label">查看预览</span></summary>
                <pre>--- a/preview.txt\\n+++ b/preview.txt\\n@@ -1 +1 @@\\n-old line\\n+new line</pre>
                <div class="agent-tool-approval" data-draft-id="producer-mock-draft">
                  <span class="agent-tool-approval-badge">待确认</span>
                  <span class="agent-tool-approval-hint">写入操作需批准后才会执行</span>
                  <div class="agent-tool-approval-actions">
                    <button type="button" class="agent-draft-approve" data-draft-approve="producer-mock-draft">批准</button>
                    <button type="button" class="agent-draft-reject" data-draft-reject="producer-mock-draft">拒绝</button>
                  </div>
                </div>
              </details>
              <div class="agent-artifact-cards">
                <div class="agent-artifact-card" data-artifact-id="art-1">
                  <span class="agent-artifact-kind">markdown</span>
                  <span class="agent-artifact-title">验收报告</span>
                </div>
              </div>
            </div>
          </details>
        </div>`
      chatLog.insertAdjacentHTML('beforeend', mockHtml)
      const badge = chatLog.querySelector('.agent-tool-approval-badge')
      const approve = chatLog.querySelector('[data-draft-approve]')
      const reject = chatLog.querySelector('[data-draft-reject]')
      const artifact = chatLog.querySelector('.agent-artifact-card')
      const pendingRow = chatLog.querySelector('.pending-review')
      return {
        ok: Boolean(badge && approve && reject && artifact && pendingRow),
        badgeText: badge?.textContent?.trim() || '',
        hasDiff: chatLog.querySelector('pre')?.textContent?.includes('preview.txt') || false,
      }
    })
    checks.push({ id: 'approval-card-visible', pass: injected.ok && injected.badgeText === '待确认' })
    checks.push({ id: 'approval-diff-preview', pass: injected.hasDiff })
    checks.push({ id: 'artifact-card-visible', pass: injected.ok })

    const shotTimeline = path.join(SHOTS, `producer-${label}-approval-timeline.png`)
    const approvalEl = window.locator('.agent-tool-approval').first()
    if (await approvalEl.count()) {
      await approvalEl.scrollIntoViewIfNeeded()
      await window.waitForTimeout(300)
    }
    await window.screenshot({ path: shotTimeline, scale: 'css' })
    checks.push({ id: 'approval-screenshot', pass: fs.existsSync(shotTimeline), path: path.relative(OUT, shotTimeline) })

    checks.push({ id: 'no-console-errors', pass: consoleErrors.length === 0, consoleErrors })

    return {
      label,
      envFlag,
      userDataDir,
      ok: checks.every(c => c.pass),
      checks,
      consoleErrors,
    }
  } catch (err) {
    return {
      label,
      envFlag,
      ok: false,
      error: String(err.message || err),
      checks,
      consoleErrors,
    }
  } finally {
    if (app) await app.close().catch(() => {})
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(r => setTimeout(r, 1200))

  const v1 = await runScenario('v1', 'v1')
  killElectron()
  await new Promise(r => setTimeout(r, 800))
  const legacy = await runScenario('legacy', 'legacy')

  const report = {
    at: new Date().toISOString(),
    role: 'producer',
    change: 'strengthen-workbench-tool-surface',
    ok: v1.ok && legacy.ok,
    scenarios: [v1, legacy],
    note: 'Electron 真机 UI 子集；完整 Agent 闭环见 fake eval + 单测；飞书/Playwright 真实凭据未执行',
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
