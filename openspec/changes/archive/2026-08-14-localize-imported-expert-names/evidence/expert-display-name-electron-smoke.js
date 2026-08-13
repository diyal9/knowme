'use strict'

/**
 * 桌面冒烟：导入专家的中文展示名、原始标识降级展示、按 slug 搜索与手动改名持久化。
 * 使用临时用户数据目录，不触碰真实 %APPDATA%\KnowMe。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')
const { createCapabilityStore } = require('../../../../src/lib/capability-store')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'expert-display-name-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

function seedImportedExpert(userDataDir) {
  const expertDir = path.join(userDataDir, 'capabilities', 'experts', 'artbundle-expert')
  fs.mkdirSync(expertDir, { recursive: true })
  fs.writeFileSync(path.join(expertDir, 'EXPERT.md'), `---
name: "artbundle-expert"
description: "ArtBundle 专家：负责制品标准化打包、校验、验证与发布前门禁控制。"
avatar: ""
skills: []
connectors: []
systemPrompt: "你是 ArtBundle 交付专家，先校验后导出。"
---
`, 'utf8')
  createCapabilityStore({ userData: userDataDir }).upsertEntry({
    id: 'artbundle-expert',
    kind: 'expert',
    source: 'local-repo',
    status: 'enabled',
    enabled: true,
    trust: 'user_confirmed',
    name: 'artbundle-expert',
    description: 'ArtBundle 专家：负责制品标准化打包、校验、验证与发布前门禁控制。',
  })
}

function readStoredExpert(userDataDir) {
  const file = path.join(userDataDir, 'capabilities', 'install-store.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')).entries['artbundle-expert']
}

async function readCard(hub) {
  return hub.locator('#hubGrid').evaluate((grid) => {
    const card = [...grid.querySelectorAll('.hub-card')]
      .find((node) => node.dataset.id === 'artbundle-expert')
    return card
      ? {
        title: card.querySelector('.hub-card-title')?.textContent || '',
        sub: card.querySelector('.hub-card-sub')?.textContent || '',
      }
      : null
  })
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise((resolve) => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-name-'))
  seedImportedExpert(userDataDir)
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
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1100, height: 820 })
    await window.locator('#btnRailCapabilities').click()

    const frame = window.locator('.capability-hub-frame')
    await frame.waitFor({ state: 'visible', timeout: 30000 })
    const hub = window.frameLocator('.capability-hub-frame')
    await hub.locator('#hubGrid .hub-card').first().waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForTimeout(400)

    const backfilled = await readCard(hub)
    const stored = readStoredExpert(userDataDir)
    await window.screenshot({ path: path.join(SHOTS, 'experts-chinese-display-name.png'), scale: 'css' })

    await hub.locator('#hubSearch').fill('artbundle-expert')
    await window.waitForTimeout(400)
    const searched = await readCard(hub)
    await hub.locator('#hubSearch').fill('')
    await window.waitForTimeout(400)

    await hub.locator('#hubGrid .hub-card[data-id="artbundle-expert"]').click()
    await hub.locator('#hubDrawer').waitFor({ state: 'visible', timeout: 15000 })
    const drawer = await hub.locator('#hubDrawer').evaluate((node) => ({
      title: node.querySelector('#hubDrawerTitle')?.textContent || '',
      hasOriginRow: [...node.querySelectorAll('dt')].some((dt) => dt.textContent === '原始标识'),
      originValue: [...node.querySelectorAll('dt')]
        .find((dt) => dt.textContent === '原始标识')?.nextElementSibling?.textContent || '',
    }))
    await window.screenshot({ path: path.join(SHOTS, 'expert-drawer-origin-identifier.png'), scale: 'css' })

    await hub.locator('#hubDrawer [data-act="tuneExpert"]').click()
    await hub.locator('#hubExpertName').waitFor({ state: 'visible', timeout: 15000 })
    await hub.locator('#hubExpertName').fill('我的打包专家')
    await hub.locator('#hubExpertSave').click()
    await window.waitForTimeout(1200)
    await hub.locator('#hubDrawerClose').click().catch(() => {})
    await window.waitForTimeout(400)
    const renamed = await readCard(hub)
    const renamedStore = readStoredExpert(userDataDir)
    await window.screenshot({ path: path.join(SHOTS, 'expert-renamed-card.png'), scale: 'css' })

    const checks = [
      { id: 'card-shows-chinese-name', pass: backfilled?.title === 'ArtBundle 专家', detail: backfilled },
      { id: 'card-sub-shows-origin-slug', pass: /artbundle-expert/.test(backfilled?.sub || ''), detail: backfilled?.sub },
      { id: 'store-records-origin-and-source', pass: stored?.originName === 'artbundle-expert' && stored?.nameSource === 'derived', detail: stored },
      { id: 'search-by-origin-slug-hits', pass: searched?.title === 'ArtBundle 专家', detail: searched },
      { id: 'drawer-shows-origin-identifier', pass: drawer.hasOriginRow && drawer.originValue === 'artbundle-expert', detail: drawer },
      { id: 'rename-updates-card', pass: renamed?.title === '我的打包专家', detail: renamed },
      { id: 'rename-marked-as-user', pass: renamedStore?.nameSource === 'user' && renamedStore?.originName === 'artbundle-expert', detail: renamedStore },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every((check) => check.pass),
      viewport: { width: 1100, height: 820 },
      checks,
    }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    if (!report.pass) process.exitCode = 1
  } finally {
    if (app) await app.close().catch(() => {})
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
