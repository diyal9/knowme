'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-dual-track-electron-smoke.json')

function check(report, id, ok, detail = '') {
  report.checks.push({ id, ok: Boolean(ok), detail })
  if (!ok) report.failures.push({ id, detail })
}

function writeFixtureExperts(userDataDir) {
  const experts = [
    ['developer', '开发 Agent', '负责实现、验证和交付。'],
    ['tester', '测试 Agent', '负责质量验证和体验审查。'],
  ]
  for (const [id, name, description] of experts) {
    const dir = path.join(userDataDir, 'capabilities', 'experts', id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'EXPERT.md'), `---
name: ${name}
description: ${description}
skills: []
---

你是 KnowMe 双轨工作台烟测 Agent，按职责完成任务并输出可验证结果。
`, 'utf8')
  }
}

function createDaemonFixture() {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/health') return res.end(JSON.stringify({ ok: true }))
    if (req.url === '/api/workflows') return res.end(JSON.stringify({ workflows: [] }))
    if (req.url === '/api/tasks') return res.end(JSON.stringify({ tasks: [] }))
    if (req.url === '/api/agents-team/overview') {
      return res.end(JSON.stringify({
        agents: [
          { id: 'developer', label_zh: '开发 Agent', description: '负责实现、验证和交付。', display_order: 1 },
          { id: 'tester', label_zh: '测试 Agent', description: '负责质量验证和体验审查。', display_order: 2 },
        ],
      }))
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

async function bindFixtureAgents(window) {
  await window.evaluate(async () => {
    for (const expertId of ['developer', 'tester']) {
      await window.api.workbenchModeBindExpert?.({ modeId: 'office', expertId }).catch(() => {})
    }
  })
  await window.locator('#wbReload').click()
  await window.waitForTimeout(1200)
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-dual-track-'))
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
    userDataDir,
    checks: [],
    failures: [],
    consoleErrors: [],
  }
  let app

  try {
    app = await launch(userDataDir, daemonPort)
    let window = await openWorkbench(app, report, { width: 1360, height: 860 })
    await bindFixtureAgents(window)

    const home = await window.evaluate(() => ({
      tabs: [...document.querySelectorAll('.wb-tabs-primary .wb-tab')].map(item => item.textContent.trim()),
      quickGoal: Boolean(document.querySelector('#wbQuickGoalForm')),
      readyFlows: Boolean(document.querySelector('#wbFlowLibraryGroups')),
      myWork: Boolean(document.querySelector('#wbMyWorkTitle')),
      widthOk: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }))
    check(report, 'two-user-paths', JSON.stringify(home.tabs) === JSON.stringify(['开始工作', '搭建 Agent']), JSON.stringify(home.tabs))
    check(report, 'start-work-closure', home.quickGoal && home.readyFlows && home.myWork)
    check(report, 'desktop-no-page-overflow', home.widthOk)
    await window.screenshot({ path: path.join(SHOTS, 'dual-track-start-work-desktop.png'), fullPage: false })

    await window.locator('#wbTabStudio').click()
    await window.locator('#wbStudioPage.active').waitFor({ state: 'visible', timeout: 15000 })
    await window.locator('[data-studio-add="developer"]').click()
    await window.locator('[data-studio-add="tester"]').click()
    await window.locator('[data-studio-node]').first().click()
    await window.locator('[data-studio-field="name"]').fill('实现与自测')
    await window.locator('[data-studio-field="role"]').fill('负责实现功能并完成开发自测')
    await window.locator('[data-studio-field="prompt"]').fill('先理解目标，再实现；不得跳过测试；输出改动与证据。')
    await window.locator('[data-studio-relation]').selectOption('parallel')

    const studio = await window.evaluate(() => ({
      nodes: document.querySelectorAll('[data-studio-node]').length,
      relation: document.querySelector('[data-studio-relation]')?.value,
      prompt: document.querySelector('[data-studio-field="prompt"]')?.value,
      skillsVisible: Boolean(document.querySelector('[data-studio-skill], .wb-studio-checks')),
      knowledgeVisible: Boolean(document.querySelector('[data-studio-knowledge], [data-studio-work-memory]')),
    }))
    check(report, 'editable-agent-steps', studio.nodes === 2 && studio.relation === 'parallel')
    check(report, 'inline-node-settings', studio.prompt.includes('不得跳过测试') && studio.skillsVisible && studio.knowledgeVisible)
    await window.screenshot({ path: path.join(SHOTS, 'dual-track-build-agent-desktop.png'), fullPage: false })

    await window.locator('[data-studio-action="save"]').click()
    await window.waitForTimeout(1800)
    const saved = await window.evaluate(async () => {
      const packages = await window.api.workbenchWorkflowPackageList({})
      const profiles = await window.api.agentProfileList('developer')
      return {
        workflow: packages.packages?.find(item => item.source === 'personal' && item.graph?.nodes?.length),
        profile: profiles.profiles?.find(item => item.promptOverlay?.includes('不得跳过测试')),
        packageError: packages.error || '',
        visibleText: document.body.innerText.slice(-1200),
      }
    })
    check(report, 'workflow-and-profile-saved', Boolean(saved.workflow && saved.profile), JSON.stringify({
      profileSaved: Boolean(saved.profile),
      packageError: saved.packageError,
      visibleText: saved.visibleText,
    }))
    check(report, 'profile-snapshot-fields', Boolean(
      saved.profile?.promptOverlay
      && Array.isArray(saved.profile?.knowledgeRefs)
      && saved.workflow?.graph?.nodes?.some(node => node.profileId === saved.profile.id)
    ))

    await window.setViewportSize({ width: 720, height: 640 })
    await window.waitForTimeout(300)
    const narrow = await window.evaluate(() => ({
      pageWidthOk: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      graphWidthOk: document.querySelector('#wbStudioGraph')?.scrollWidth <= document.querySelector('#wbStudioGraph')?.clientWidth + 1,
      inspectorVisible: Boolean(document.querySelector('#wbStudioInspector')),
    }))
    check(report, 'narrow-layout-usable', narrow.pageWidthOk && narrow.graphWidthOk && narrow.inspectorVisible, JSON.stringify(narrow))
    await window.screenshot({ path: path.join(SHOTS, 'dual-track-build-agent-narrow.png'), fullPage: false })

    await app.close()
    app = await launch(userDataDir, daemonPort)
    window = await openWorkbench(app, report, { width: 1360, height: 860 })
    const restored = await window.evaluate(async () => {
      const packages = await window.api.workbenchWorkflowPackageList({})
      const item = packages.packages?.find(entry => entry.source === 'personal' && entry.graph?.nodes?.length)
      const profileId = item?.graph?.nodes?.find(node => node.type === 'agent')?.profileId
      const profile = profileId ? await window.api.agentProfileGet(profileId) : null
      return {
        workflowId: item?.id || '',
        relation: item?.graph?.nodes?.find(node => node.type === 'agent')?.relation || '',
        prompt: profile?.profile?.promptOverlay || '',
      }
    })
    check(report, 'restart-restores-node-settings', Boolean(
      restored.workflowId && restored.relation === 'parallel' && restored.prompt.includes('不得跳过测试')
    ), JSON.stringify(restored))
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
