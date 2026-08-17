'use strict'

const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const ROOT = path.join(__dirname, '..')
const SHOTS = path.join(ROOT, 'openspec/changes/migrate-renderer-react-ts/evidence/screenshots')
const html = path.join(ROOT, 'src/_legacy-preview.html')

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: ':root,.app{--titlebar-height:32px !important}' })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.KnowMeIcons && window.KnowMeIcons.mount(document))
  await page.screenshot({ path: path.join(SHOTS, 'baseline-assistant.png') })

  await page.evaluate(() => {
    const app = document.getElementById('appShell')
    if (app) app.className = 'app mode-workbench side-collapsed'
    const wb = document.getElementById('workbench')
    if (wb) wb.hidden = false
    const agent = document.getElementById('agentCol')
    if (agent) agent.hidden = true
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, 'baseline-workbench.png') })

  await page.evaluate(() => {
    document.querySelectorAll('[data-wb-surface]').forEach((el) => el.classList.remove('active'))
    const shelf = document.getElementById('wbShelfSurface')
    if (shelf) shelf.classList.add('active')
    document.querySelectorAll('[data-wb-mode]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-wb-mode') === 'workflows')
    })
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, 'baseline-shelf.png') })

  await page.evaluate(() => {
    document.querySelectorAll('[data-wb-surface]').forEach((el) => el.classList.remove('active'))
    const manage = document.getElementById('wbManageSurface')
    if (manage) {
      manage.classList.add('active', 'wb-manage-daemon')
    }
    const daemon = document.getElementById('wbDaemonPage')
    if (daemon) daemon.classList.add('active')
    document.querySelectorAll('[data-wb-mode]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-wb-mode') === 'daemon')
    })
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, 'baseline-daemon.png') })

  await browser.close()
  console.log('baseline shots written')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
