'use strict'

/** 真机截图：使用真实 %APPDATA%\KnowMe 数据，确认导入专家卡片展示中文名。 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')

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
  await new Promise((resolve) => setTimeout(resolve, 800))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.'],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  try {
    const window = await app.firstWindow({ timeout: 90000 })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1180, height: 820 })
    await window.locator('#btnRailCapabilities').click()
    const hub = window.frameLocator('.capability-hub-frame')
    await hub.locator('#hubGrid .hub-card').first().waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForTimeout(600)
    const cards = await hub.locator('#hubGrid').evaluate((grid) => [...grid.querySelectorAll('.hub-card')].map((node) => ({
      id: node.dataset.id,
      title: node.querySelector('.hub-card-title')?.textContent || '',
      sub: node.querySelector('.hub-card-sub')?.textContent || '',
    })))
    console.log(JSON.stringify(cards, null, 2))
    await window.screenshot({ path: path.join(SHOTS, 'real-app-expert-cards.png'), scale: 'css' })
  } finally {
    await app.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
