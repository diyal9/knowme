'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'expert-loop-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

async function launch(userDataDir, consoleErrors) {
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
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1800)
    return { app, window }
  } catch (error) {
    if (app) await app.close().catch(() => {})
    throw error
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-loop-'))
  const consoleErrors = []
  const checks = []
  let app

  try {
    let launched = await launch(userDataDir, consoleErrors)
    app = launched.app
    let window = launched.window

    await window.locator('#btnRailCapabilities').click()
    const hub = window.frameLocator('.capability-hub-frame')
    const expertCard = hub.locator('.hub-card[data-id="office-partner"]')
    await expertCard.waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForTimeout(900)
    await expertCard.click()
    await hub.locator('#hubDrawer.open').waitFor({ state: 'visible', timeout: 10000 })

    const cta = hub.locator('#hubDrawerActions [data-act="startExpert"]')
    const ctaText = (await cta.textContent() || '').trim()
    checks.push({ id: 'available-cta', pass: ctaText === '安装并开始', detail: ctaText })
    await cta.click()

    await window.locator('.agent-empty-expert').waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForFunction(() => {
      const drawer = document.getElementById('drawer')
      return drawer?.getAttribute('aria-hidden') === 'true' && !drawer.classList.contains('open')
    }, null, { timeout: 10000 })
    await window.waitForFunction(() => document.activeElement?.id === 'agentInput', null, { timeout: 10000 })
    const expertTitle = (await window.locator('.agent-empty-expert .agent-empty-hero').textContent() || '').trim()
    const limitedCount = await window.locator('.agent-expert-capability.limited').count()
    const focusState = await window.evaluate(() => {
      const input = document.getElementById('agentInput')
      const rect = input?.getBoundingClientRect()
      return {
        id: document.activeElement?.id || '',
        tag: document.activeElement?.tagName || '',
        activeClass: document.activeElement?.className || '',
        inputDisabled: Boolean(input?.disabled),
        inputRect: rect ? { width: rect.width, height: rect.height } : null,
        inputDisplay: input ? getComputedStyle(input).display : '',
        inputVisibility: input ? getComputedStyle(input).visibility : '',
      }
    })
    checks.push({ id: 'hub-closed', pass: await window.locator('#drawer.open').count() === 0 })
    checks.push({ id: 'expert-identity-visible', pass: expertTitle === 'office-partner', detail: expertTitle })
    checks.push({ id: 'degraded-bindings-visible', pass: limitedCount >= 2, detail: limitedCount })
    checks.push({ id: 'configure-entry-visible', pass: await window.locator('[data-expert-config]').isVisible() })
    checks.push({ id: 'composer-focused', pass: focusState.id === 'agentInput', detail: focusState })

    const active = await window.evaluate(async () => {
      const result = await window.api.agentSessionList()
      const sessionId = result.ui?.activeSessionId
      const detail = sessionId ? await window.api.agentSessionGet(sessionId) : null
      return { sessionId, detail }
    })
    checks.push({
      id: 'durable-expert-session',
      pass: active.detail?.ok === true
        && active.detail.session?.expertId === 'office-partner'
        && active.detail.session?.ephemeral !== true
        && Boolean(active.detail.session?.snapshotPath),
      detail: active,
    })

    await window.screenshot({ path: path.join(SHOTS, 'expert-persona-only-session.png'), scale: 'css' })

    const afterUninstall = await window.evaluate(async sessionId => {
      const removed = await window.api.capabilityUninstall({ id: 'office-partner' })
      const detail = await window.api.agentSessionGet(sessionId)
      return { removed, detail }
    }, active.sessionId)
    checks.push({
      id: 'snapshot-survives-uninstall',
      pass: afterUninstall.removed?.ok === true
        && afterUninstall.detail?.session?.expertName === 'office-partner'
        && afterUninstall.detail?.session?.expert?.source === 'snapshot',
      detail: afterUninstall,
    })

    await app.close()
    app = null
    await new Promise(resolve => setTimeout(resolve, 1200))
    launched = await launch(userDataDir, consoleErrors)
    app = launched.app
    window = launched.window
    await window.locator('.agent-empty-expert').waitFor({ state: 'visible', timeout: 30000 })
    const restoredTitle = (await window.locator('.agent-empty-expert .agent-empty-hero').textContent() || '').trim()
    checks.push({ id: 'restart-restores-expert-snapshot', pass: restoredTitle === 'office-partner', detail: restoredTitle })
    checks.push({ id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors })
  } finally {
    if (app) await app.close().catch(() => {})
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(check => check.pass),
    userDataDir,
    checks,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
