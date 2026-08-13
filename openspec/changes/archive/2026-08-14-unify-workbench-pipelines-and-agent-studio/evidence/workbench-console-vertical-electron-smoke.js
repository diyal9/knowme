'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-console-vertical-electron-smoke.json')

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-console-smoke-'))
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workbenchAuth: { endpoint: 'http://127.0.0.1:9' },
  }), 'utf8')

  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    checks: [],
    domains: {},
    consoleErrors: [],
  }
  let app
  const check = (id, ok, detail = '') => report.checks.push({ id, ok: Boolean(ok), detail })

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
      const value = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(value)) {
        report.consoleErrors.push(value)
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1440, height: 900 })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#wbHomePage.active .wb-console-overview').waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForFunction(
      () => document.querySelectorAll('#wbConsoleReadiness .wb-readiness-item').length === 3,
      null,
      { timeout: 30000 },
    )

    const shell = await window.evaluate(() => ({
      nav: [...document.querySelectorAll('.wb-tabs-primary .wb-tab')].map(item => item.textContent.trim()),
      domains: [...document.querySelectorAll('#wbDomainSwitcher [data-domain]')].map(item => item.getAttribute('data-domain')),
      readinessCount: document.querySelectorAll('#wbConsoleReadiness .wb-readiness-item').length,
      newRun: Boolean(document.querySelector('#wbConsoleNewRun')),
    }))
    check('console-navigation', shell.nav.join('/') === '工作/资源/编排', shell.nav.join('/'))
    check('visible-domain-filter', shell.domains.join('/') === 'all/office/engineering/visual', shell.domains.join('/'))
    check('three-domain-readiness', shell.readinessCount === 3, String(shell.readinessCount))
    check('unified-new-run', shell.newRun)

    const domainTitles = {
      office: '会议资料 → 纪要与待办',
      engineering: '需求 → 实现 → 测试 → 交付',
      visual: 'Brief → 生成 → 审阅 → 导出',
    }
    for (const domain of ['office', 'engineering', 'visual']) {
      await window.locator(`[data-domain="${domain}"]`).click()
      await window.locator(`[data-domain="${domain}"].active`).waitFor({ state: 'visible', timeout: 15000 })
      await window.locator('#wbTabFlows').click()
      await window.locator('#wbFlowsPage.active .wb-pipeline-console').waitFor({ state: 'visible', timeout: 15000 })
      await window.waitForFunction(({ currentDomain, expectedTitle }) => (
        document.querySelector('#wbDomainSwitcher .active')?.getAttribute('data-domain') === currentDomain
        && document.querySelector('.wb-pipeline-detail h3')?.textContent?.trim() === expectedTitle
      ), { currentDomain: domain, expectedTitle: domainTitles[domain] }, { timeout: 15000 })
      const state = await window.evaluate((currentDomain) => {
        const detail = document.querySelector('.wb-pipeline-detail')
        const button = detail?.querySelector('[data-flow-action="use"]')
        return {
          domain: document.querySelector('#wbDomainSwitcher .active')?.getAttribute('data-domain') || '',
          title: detail?.querySelector('h3')?.textContent?.trim() || '',
          blocked: Boolean(button?.disabled),
          buttonText: button?.textContent?.trim() || '',
          listCount: document.querySelectorAll('.wb-pipeline-list-item').length,
          currentDomain,
        }
      }, domain)
      report.domains[domain] = state
      check(`${domain}-pipeline-visible`, state.domain === domain && state.listCount > 0, state.title)
      check(`${domain}-pipeline-honest`, !state.blocked || state.buttonText === '暂不可运行', state.buttonText)
    }
    await window.screenshot({ path: path.join(SHOTS, 'workbench-resources-desktop.png'), fullPage: false })

    await window.locator('#wbTabTeam').click()
    await window.locator('#wbTeamPage.active').waitFor({ state: 'visible', timeout: 15000 })
    check('agent-registry-surface', await window.locator('#wbTeamAssetsPanel').isVisible())

    await window.locator('#wbTabStudio').click()
    await window.locator('#wbStudioPage.active .wb-studio-shell').waitFor({ state: 'visible', timeout: 15000 })
    check('dedicated-studio-surface', await window.locator('#wbStudioGraph').isVisible())
    check('studio-new-action', await window.locator('#wbStudioNew').isVisible())
    await window.waitForTimeout(250)
    await window.screenshot({ path: path.join(SHOTS, 'workbench-studio-desktop.png'), fullPage: false })

    await window.locator('#wbTabHome').click()
    await window.locator('#wbGoalViewTasks').click()
    await window.locator('#wbTaskPage.active #wbRecentPanel').waitFor({ state: 'visible', timeout: 15000 })
    const runCopy = await window.locator('#wbRecentTitle').textContent()
    check('unified-run-center', runCopy?.trim() === '运行中心', runCopy || '')

    await window.locator('#wbTabHome').click()
    await window.waitForTimeout(2400)
    await window.screenshot({ path: path.join(SHOTS, 'workbench-console-desktop.png'), fullPage: false })

    await window.setViewportSize({ width: 760, height: 840 })
    await window.locator('#wbHomePage.active .wb-console-overview').waitFor({ state: 'visible', timeout: 15000 })
    const narrow = await window.evaluate(() => ({
      domainVisible: getComputedStyle(document.querySelector('#wbDomainSwitcher')).display !== 'none',
      allDomainVisible: Boolean(document.querySelector('[data-domain="all"]')?.getBoundingClientRect().width),
      newRunVisible: Boolean(document.querySelector('#wbConsoleNewRun')?.getBoundingClientRect().width),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }))
    report.narrow = narrow
    check('narrow-domain-visible', narrow.domainVisible)
    check('narrow-all-domain-visible', narrow.allDomainVisible)
    check('narrow-new-run-visible', narrow.newRunVisible)
    check('narrow-no-page-overflow', !narrow.horizontalOverflow)
    await window.screenshot({ path: path.join(SHOTS, 'workbench-console-narrow.png'), fullPage: false })

    check('console-error-free', report.consoleErrors.length === 0, report.consoleErrors.join('\n'))
    report.ok = report.checks.every(item => item.ok)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    if (!report.ok) throw new Error(`Electron smoke failed: ${JSON.stringify(report.checks.filter(item => !item.ok))}`)
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
