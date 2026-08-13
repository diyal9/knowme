'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'skill-driven-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-driven-'))
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
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        KNOWME_TEST_SEAM: '1',
        KNOWME_TEST_USER_DATA_DIR: userDataDir,
      },
      timeout: 120000,
    })

    let window = await app.firstWindow({ timeout: 90000 })
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1800)

    const preload = await window.evaluate(() => ({
      tasks: typeof window.api?.skillTaskList === 'function',
      nestedTasks: typeof window.knowme?.skill?.tasks === 'function',
      skillLoad: typeof window.api?.skillLoad === 'function',
      packInstall: typeof window.api?.capabilityPackInstall === 'function',
    }))
    checks.push({ id: 'preload-task-apis', pass: Object.values(preload).every(Boolean), detail: preload })

    const installed = await window.evaluate(() => (
      window.api.capabilityPackInstall({ packId: 'game-studio', source: 'bundled' })
    ))
    checks.push({ id: 'install-game-studio-pack', pass: installed?.ok === true, detail: installed })

    await window.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await window.waitForTimeout(2200)

    const legacyFallback = await window.evaluate(() => {
      const cards = window.SkillTaskUi?.resolveEmptyStateCards?.('general', {
        general: [{
          id: 'legacy-smoke',
          title: '旧入口回退',
          subtitle: 'scene-only compatibility',
          prompt: 'legacy prompt',
        }],
      }, new Map())
      return Array.isArray(cards) ? cards[0] : null
    })
    checks.push({
      id: 'legacy-scene-fallback',
      pass: legacyFallback?.id === 'legacy-smoke'
        && legacyFallback?.prompt === 'legacy prompt'
        && legacyFallback?.dynamic === false,
      detail: legacyFallback,
    })

    const catalog = await window.evaluate(() => window.api.skillTaskList())
    const requiredTaskIds = [
      'relatedChats',
      'meetingSummary',
      'todayPriority',
      'docKbSuggest',
      'writingRequirementsDoc',
      'writingOfficeDoc',
      'writingOutlineDraft',
      'writingFinalize',
    ]
    const byId = new Map((catalog?.tasks || []).map(task => [task.id, task]))
    checks.push({
      id: 'eight-office-skill-tasks',
      pass: catalog?.ok === true && requiredTaskIds.every(id => byId.has(id)),
      detail: { count: catalog?.tasks?.length || 0, missing: requiredTaskIds.filter(id => !byId.has(id)) },
    })
    checks.push({
      id: 'dynamic-task-provenance',
      pass: byId.get('relatedChats')?.source === 'pack'
        && byId.get('relatedChats')?.ownerPackId === 'game-studio'
        && byId.get('relatedChats')?.skillId === 'feishu-related-chats',
      detail: byId.get('relatedChats'),
    })
    checks.push({
      id: 'display-safe-dto',
      pass: (catalog?.tasks || []).every(task => (
        !('dir' in task) && !('path' in task) && !('body' in task) && !('script' in task)
      )),
    })

    const loaded = await window.evaluate(() => window.api.skillLoad({ skillId: 'feishu-related-chats' }))
    checks.push({
      id: 'pack-skill-l1-loads',
      pass: loaded?.ok === true
        && /飞书相关聊天/.test(String(loaded.body || ''))
        && /feishu\.related_chats/.test(String(loaded.body || '')),
    })

    await window.locator('#btnRailAi').click()
    await window.waitForTimeout(1200)
    const visibleCards = await window.locator('button.agent-empty-act[data-pack-id="game-studio"]').allTextContents()
    checks.push({
      id: 'general-empty-cards-visible',
      pass: visibleCards.some(text => text.includes('分析跟我相关的聊天'))
        && visibleCards.some(text => text.includes('会议总结'))
        && visibleCards.some(text => text.includes('今日优先级'))
        && visibleCards.some(text => text.includes('需求梳理'))
        && visibleCards.length === 5,
      detail: visibleCards,
    })
    await window.screenshot({
      path: path.join(SHOTS, 'skill-driven-office-home.png'),
      scale: 'css',
    })

    await window.keyboard.press('Control+K')
    await window.waitForTimeout(300)
    const quickText = await window.locator('#agentQuickMenu').textContent().catch(() => '')
    checks.push({
      id: 'quick-menu-uses-skill-tasks',
      pass: /相关(?:的)?聊天/.test(String(quickText || '')) && /今日优先级/.test(String(quickText || '')),
      detail: String(quickText || '').slice(0, 500),
    })
    await window.keyboard.press('Escape')

    const connectorDisabled = await window.evaluate(() => (
      window.api.connectorsUpsert({ id: 'feishu', enabled: false })
    ))
    checks.push({
      id: 'disable-feishu-for-preflight',
      pass: connectorDisabled?.ok !== false,
      detail: connectorDisabled,
    })
    const connectorStatus = await window.evaluate(() => window.api.connectorsStatus('feishu'))
    checks.push({
      id: 'feishu-status-is-disabled',
      pass: connectorStatus?.connector?.enabled === false,
      detail: connectorStatus?.connector,
    })
    const relatedClicked = await window.evaluate(() => {
      const button = document.querySelector('button.agent-empty-act[data-shortcut="relatedChats"]')
      if (!button) return false
      button.click()
      return true
    })
    checks.push({ id: 'related-task-entry-clickable', pass: relatedClicked })
    await window.waitForTimeout(900)
    const chatText = await window.locator('#agentChatLog').textContent().catch(() => '')
    checks.push({
      id: 'unauthorized-preflight-blocks-generation',
      pass: /设置\s*→\s*连接器|授权飞书/.test(String(chatText || '')),
      detail: String(chatText || '').slice(-500),
    })
    await window.screenshot({
      path: path.join(SHOTS, 'skill-driven-auth-preflight.png'),
      scale: 'css',
    })

    await window.locator('#agentExpertBtn').click()
    const writingOption = window.locator('#agentExpertPop [data-expert-id="writing"]')
    const writingSelected = await writingOption.isVisible().catch(() => false)
    if (writingSelected) {
      await writingOption.click()
      await window.waitForTimeout(1000)
    }
    const writingCards = await window.locator(
      'button.agent-empty-act[data-shortcut="writingRequirementsDoc"],'
      + 'button.agent-empty-act[data-shortcut="writingOfficeDoc"],'
      + 'button.agent-empty-act[data-shortcut="writingOutlineDraft"],'
      + 'button.agent-empty-act[data-shortcut="writingFinalize"]',
    ).allTextContents()
    const writingState = await window.evaluate(async () => ({
      sessions: await window.api.agentSessionList(),
      shortcuts: [...document.querySelectorAll('button.agent-empty-act[data-shortcut]')]
        .map(button => button.dataset.shortcut),
      emptyText: document.querySelector('#agentChatLog')?.textContent || '',
    }))
    checks.push({
      id: 'writing-empty-uses-pack-skill-tasks',
      pass: writingSelected && writingCards.length === 4,
      detail: { writingSelected, writingCards, writingState },
    })
    await window.screenshot({
      path: path.join(SHOTS, 'skill-driven-writing-empty.png'),
      scale: 'css',
    })

    checks.push({ id: 'no-renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors })
  } catch (error) {
    checks.push({ id: 'electron-smoke-runtime', pass: false, detail: String(error?.stack || error) })
  } finally {
    if (app) await app.close().catch(() => {})
    killElectron()
  }

  const report = {
    at: new Date().toISOString(),
    change: 'externalize-agent-capabilities-to-skills',
    userDataDir,
    ok: checks.every(check => check.pass),
    checks,
    consoleErrors,
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch(error => {
  fs.writeFileSync(REPORT, JSON.stringify({ ok: false, error: String(error?.stack || error) }, null, 2))
  console.error(error)
  process.exit(1)
})
