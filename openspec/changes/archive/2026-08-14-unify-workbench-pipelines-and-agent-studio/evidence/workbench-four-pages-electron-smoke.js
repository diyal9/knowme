'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-four-pages-electron-smoke.json')

function check(report, id, ok, detail = '') {
  report.checks.push({ id, ok: Boolean(ok), detail })
  if (!ok) report.failures.push({ id, detail })
}

function writeFixtureExperts(userDataDir) {
  for (const [id, name, description] of [
    ['developer', '本地开发 Agent', '负责实现与自测。'],
    ['tester', '本地测试 Agent', '负责验证与体验审查。'],
  ]) {
    const dir = path.join(userDataDir, 'capabilities', 'experts', id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'EXPERT.md'), `---
name: ${name}
description: ${description}
skills: []
connectors: []
---

按职责完成任务并输出可验证结果。
`, 'utf8')
  }
}

function createDaemonFixture() {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/health') return res.end(JSON.stringify({ ok: true, service: 'fixture' }))
    if (req.url === '/api/workflows') {
      return res.end(JSON.stringify({
        workflows: [{
          id: 'daemon-delivery',
          name: 'Daemon 交付模式',
          summary: '固定阵容完成规划、实现和验收',
          agentIds: ['daemon-planner', 'daemon-reviewer'],
        }],
      }))
    }
    if (req.url === '/api/tasks' && req.method === 'POST') {
      return res.end(JSON.stringify({ ok: true, task: { slug: 'daemon-new-run' } }))
    }
    if (req.url === '/api/tasks' && req.method === 'GET') {
      return res.end(JSON.stringify({
        tasks: [{ slug: 'daemon-delivery-demo', workflow: 'daemon-delivery', intent: '演示任务', job: { state: 'running' } }],
      }))
    }
    if (req.url === '/api/tasks/daemon-new-run/run' && req.method === 'POST') {
      return res.end(JSON.stringify({ ok: true, job: { state: 'queued' } }))
    }
    if (req.url === '/api/tasks/daemon-new-run' && req.method === 'GET') {
      return res.end(JSON.stringify({
        slug: 'daemon-new-run',
        workflow: 'daemon-delivery',
        intent: '执行真实 Daemon 烟测任务',
        job: { state: 'running' },
      }))
    }
    if (req.url === '/api/agents-team/overview') {
      return res.end(JSON.stringify({
        agents: [
          { id: 'daemon-planner', label_zh: 'Daemon 规划', description: '固定规划角色', display_order: 1 },
          { id: 'daemon-reviewer', label_zh: 'Daemon 验收', description: '固定验收角色', display_order: 2 },
        ],
      }))
    }
    if (req.url === '/api/workflows/daemon-delivery/launch-context') {
      return res.end(JSON.stringify({ defaults: { meta: { source: 'smoke' } } }))
    }
    res.statusCode = 404
    res.end(JSON.stringify({ ok: false }))
  })
  return {
    listen: () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

function launch(userDataDir, daemonPort) {
  return electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userDataDir,
      KNOWME_AGENT_TEAM_RUNTIME: '1',
      KNOWME_WORKBENCH_URL: `http://127.0.0.1:${daemonPort}`,
    },
    timeout: 120000,
  })
}

function observeConsole(window, report) {
  window.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
      report.consoleErrors.push(text)
    }
  })
  window.on('dialog', dialog => dialog.accept())
}

async function openWorkbench(app, report, viewport) {
  const window = await app.firstWindow({ timeout: 90000 })
  observeConsole(window, report)
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.setViewportSize(viewport)
  await window.locator('#btnRailWorkbench').click()
  await window.locator('#wbHomePage.active').waitFor({ state: 'visible', timeout: 30000 })
  return window
}

async function pageHasNoOverflow(window, selector) {
  return window.evaluate((target) => {
    const page = document.querySelector(target)
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth
      && (!page || page.scrollWidth <= page.clientWidth + 1)
  }, selector)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-four-pages-'))
  const daemon = createDaemonFixture()
  const daemonPort = await daemon.listen()
  writeFixtureExperts(userDataDir)
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workbenchAuth: { endpoint: `http://127.0.0.1:${daemonPort}` },
  }), 'utf8')

  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    checks: [],
    failures: [],
    consoleErrors: [],
  }
  let app
  try {
    app = await launch(userDataDir, daemonPort)
    let window = await openWorkbench(app, report, { width: 1360, height: 860 })
    await window.locator('#wbReload').click()
    await window.waitForTimeout(1000)

    const tabs = await window.locator('.wb-tabs-primary .wb-tab').allTextContents()
    check(report, 'four-primary-tabs', JSON.stringify(tabs.map(value => value.trim())) === JSON.stringify([
      '开始工作', '工作流', '智能体管理', 'Daemon 模式',
    ]), JSON.stringify(tabs))

    await window.locator('#wbTabAgents').click()
    await window.waitForTimeout(400)
    const agentPageState = await window.evaluate(() => ({
      pageClass: document.querySelector('#wbTeamPage')?.className,
      pageDisplay: getComputedStyle(document.querySelector('#wbTeamPage')).display,
      layout: document.querySelector('#workbench')?.dataset.layout,
      activeTabs: [...document.querySelectorAll('.wb-tab.active')].map(item => item.id),
    }))
    check(report, 'agent-manager-page-opens', agentPageState.pageClass?.includes('active') && agentPageState.pageDisplay !== 'none', JSON.stringify(agentPageState))
    if (!report.checks.at(-1).ok) throw new Error(`Agent manager page did not open: ${JSON.stringify(agentPageState)}`)
    await window.locator('[data-manager-agent="developer"]').click()
    await window.locator('#wbManagerName').waitFor({ state: 'visible' })
    await window.locator('#wbManagerName').fill('开发搭档')
    await window.locator('#wbManagerDescription').fill('负责实现、验证和可追溯交付。')
    await window.locator('#wbManagerSystemPrompt').fill('先理解目标，再实现并完成测试。')
    await window.locator('#wbManagerRole').fill('负责工程实现与开发自测')
    await window.locator('#wbManagerPromptOverlay').fill('不得跳过测试；输出改动与证据。')
    await window.locator('[data-manager-action="save"]').click()
    await window.waitForTimeout(1200)
    const savedAgent = await window.evaluate(async () => {
      const expert = await window.api.expertGet('developer')
      const profiles = await window.api.agentProfileList('developer')
      return {
        name: expert.expert?.name,
        prompt: expert.expert?.systemPrompt,
        profile: profiles.profiles?.find(item => item.provenance?.scope === 'default-agent'),
      }
    })
    check(report, 'local-agent-package-profile-save', savedAgent.name === '开发搭档'
      && savedAgent.prompt.includes('完成测试')
      && savedAgent.profile?.promptOverlay.includes('不得跳过测试'), JSON.stringify(savedAgent))
    await window.screenshot({ path: path.join(SHOTS, 'four-pages-agent-manager-desktop.png'), fullPage: false })

    await window.locator('#wbTabStudio').click()
    await window.locator('#wbStudioPage.active').waitFor({ state: 'visible' })
    const candidates = await window.locator('[data-studio-agent]').evaluateAll(items => items.map(item => item.getAttribute('data-studio-agent')))
    check(report, 'workflow-local-agents-only', candidates.includes('developer')
      && candidates.includes('tester')
      && !candidates.includes('daemon-planner')
      && !candidates.includes('daemon-reviewer'), JSON.stringify(candidates))
    await window.locator('[data-studio-add="developer"]').click()
    await window.locator('[data-studio-add="tester"]').click()
    await window.locator('[data-studio-node]').first().click()
    await window.locator('[data-studio-field="intent"]').fill('完成实现并提交自测证据')
    await window.locator('[data-studio-relation]').selectOption('parallel')
    check(report, 'workflow-step-scoped-editor', await window.locator('[data-studio-manage-agent]').isVisible()
      && await window.locator('[data-studio-skill]').count() === 0
      && await window.locator('[data-studio-field="prompt"]').count() === 0)
    await window.locator('[data-studio-action="save"]').click()
    await window.waitForTimeout(1400)
    const savedWorkflow = await window.evaluate(async () => {
      const packages = await window.api.workbenchWorkflowPackageList({})
      const item = packages.packages?.find(entry => entry.source === 'personal' && entry.graph?.nodes?.length)
      const node = item?.graph?.nodes?.find(entry => entry.type === 'agent')
      return {
        id: item?.id || '',
        origin: node?.agentOrigin || '',
        packageHash: node?.packageHash || '',
        profileId: node?.profileId || '',
        profileHash: node?.profileHash || '',
        relation: node?.relation || '',
      }
    })
    check(report, 'workflow-node-snapshot', savedWorkflow.id
      && savedWorkflow.origin === 'local'
      && savedWorkflow.packageHash
      && savedWorkflow.profileId
      && savedWorkflow.profileHash
      && savedWorkflow.relation === 'parallel', JSON.stringify(savedWorkflow))
    await window.screenshot({ path: path.join(SHOTS, 'four-pages-workflow-desktop.png'), fullPage: false })

    await window.locator('#wbTabDaemon').click()
    await window.locator('#wbDaemonPage.active').waitFor({ state: 'visible' })
    await window.locator('[data-daemon-workflow="daemon-delivery"]').click()
    const daemonView = await window.evaluate(() => ({
      roster: [...document.querySelectorAll('.wb-daemon-agent strong')].map(item => item.textContent.trim()),
      readOnlyLabels: document.querySelectorAll('.wb-daemon-agent small').length,
      editInputs: document.querySelectorAll('#wbDaemonPage input,#wbDaemonPage textarea').length,
      startEnabled: !document.querySelector('[data-daemon-action="start"]')?.disabled,
      tasks: document.querySelectorAll('#wbDaemonRunList [data-task]').length,
    }))
    check(report, 'daemon-fixed-readonly-roster', daemonView.roster.length === 2
      && daemonView.readOnlyLabels === 2
      && daemonView.editInputs === 0, JSON.stringify(daemonView))
    check(report, 'daemon-launch-and-monitor', daemonView.startEnabled && daemonView.tasks === 1, JSON.stringify(daemonView))
    await window.screenshot({ path: path.join(SHOTS, 'four-pages-daemon-desktop.png'), fullPage: false })

    await window.setViewportSize({ width: 720, height: 640 })
    for (const [tab, page] of [
      ['#wbTabHome', '#wbHomePage'],
      ['#wbTabStudio', '#wbStudioPage'],
      ['#wbTabAgents', '#wbTeamPage'],
      ['#wbTabDaemon', '#wbDaemonPage'],
    ]) {
      await window.locator(tab).click()
      await window.waitForTimeout(200)
      check(report, `narrow-no-overflow-${page.slice(3).toLowerCase()}`, await pageHasNoOverflow(window, page))
    }
    await window.screenshot({ path: path.join(SHOTS, 'four-pages-daemon-narrow.png'), fullPage: false })
    await window.locator('#wbTabHome').click()
    await window.screenshot({ path: path.join(SHOTS, 'four-pages-home-narrow.png'), fullPage: false })

    await app.close()
    app = await launch(userDataDir, daemonPort)
    window = await openWorkbench(app, report, { width: 1360, height: 860 })
    const restored = await window.evaluate(async () => {
      const packages = await window.api.workbenchWorkflowPackageList({})
      const item = packages.packages?.find(entry => entry.source === 'personal' && entry.graph?.nodes?.length)
      const node = item?.graph?.nodes?.find(entry => entry.type === 'agent')
      return {
        workflowId: item?.id || '',
        origin: node?.agentOrigin || '',
        packageHash: node?.packageHash || '',
        profileHash: node?.profileHash || '',
      }
    })
    check(report, 'restart-preserves-workflow-snapshot', restored.workflowId
      && restored.origin === 'local'
      && restored.packageHash
      && restored.profileHash, JSON.stringify(restored))
    check(report, 'console-error-free', report.consoleErrors.length === 0, report.consoleErrors.join('\n'))

    report.ok = report.checks.every(item => item.ok)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    if (!report.ok) throw new Error(`Electron smoke failed: ${JSON.stringify(report.failures)}`)
  } finally {
    await app?.close().catch(() => {})
    await daemon.close().catch(() => {})
  }
}

main().catch(error => {
  let current = {}
  try { current = JSON.parse(fs.readFileSync(REPORT, 'utf8')) } catch { /* first failure */ }
  fs.writeFileSync(REPORT, `${JSON.stringify({
    ...current,
    at: new Date().toISOString(),
    ok: false,
    error: String(error?.stack || error),
  }, null, 2)}\n`, 'utf8')
  console.error(error)
  process.exitCode = 1
})
