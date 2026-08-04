'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const ROOT = path.join(__dirname, '..')
const CHANGE = process.env.GAME_STUDIO_CHANGE
  ? path.resolve(process.env.GAME_STUDIO_CHANGE)
  : path.join(ROOT, 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon')
const SHOTS = path.join(CHANGE, 'evidence/screenshots')

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const htmlPath = path.join(CHANGE, 'evidence/uat-preview.html')
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(fs.readFileSync(htmlPath))
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const url = `http://127.0.0.1:${port}/`

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(SHOTS, 'game-studio-empty-scenes.png'), fullPage: true })
  await page.locator('#daemonOffline').screenshot({ path: path.join(SHOTS, 'daemon-offline-blocked.png') })
  await page.evaluate(() => {
    document.getElementById('daemonOffline').style.display = 'none'
    document.getElementById('daemonReady').style.display = 'block'
  })
  await page.locator('#daemonReady').screenshot({ path: path.join(SHOTS, 'daemon-ready-handoff.png') })
  await browser.close()
  server.close()
  console.log('UAT screenshots written to', SHOTS)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
