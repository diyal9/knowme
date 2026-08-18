'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'workbench-task-lifecycle-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* no matching process */ }
  }
}

function createDaemonFixture() {
  let phase = 0
  let created = false
  let activeSlug = 'fixture-task'
  const requests = []
  const task = () => ({
    slug: activeSlug,
    workflow: 'fixture-flow',
    intent: '整理会议纪要并生成跟进待办',
    state: phase >= 2 ? 'completed' : 'running',
    status: { state: phase >= 2 ? 'completed' : 'running' },
    pending_gates: phase === 0 ? [{ node: 'review', title: '本地确认' }] : [],
    pending_clarifications: phase === 1 ? [{ node: 'details', question: '请补充会议日期' }] : [],
    terminal: phase >= 2,
  })
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, path: req.url })
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET' && req.url === '/api/health') return json(200, { ok: true })
    if (req.method === 'GET' && req.url === '/api/workflows') {
      return json(200, {
        workflows: [{
          id: 'fixture-flow',
          name: '会议纪要闭环',
          summary: '整理会议纪要并生成待办',
          catalog: { visibility: 'primary', category: 'general', order: 1 },
        }],
      })
    }
    if (req.method === 'GET' && req.url === '/api/agents-team/overview') {
      return json(200, { agents: [] })
    }
    if (req.method === 'GET' && req.url === '/api/tasks') {
      return json(200, { tasks: created ? [task()] : [] })
    }
    if (req.method === 'GET' && req.url === '/api/workflows/fixture-flow/launch-context') {
      return json(200, { context: { meta: { sceneId: 'fixture' } } })
    }
    if (req.method === 'POST' && req.url === '/api/tasks') {
      created = true
      return json(201, { task: { ...task(), state: 'queued' } })
    }
    const runMatch = req.method === 'POST' && req.url.match(/^\/api\/tasks\/([^/]+)\/run$/)
    if (runMatch) {
      activeSlug = decodeURIComponent(runMatch[1])
      return json(200, { job: { state: 'running' } })
    }
    const taskMatch = req.url.match(/^\/api\/tasks\/([^/]+)$/)
    if (req.method === 'GET' && taskMatch) return json(200, task())
    if (req.method === 'POST' && req.url === `/api/tasks/${activeSlug}/gate`) {
      phase = 1
      return json(200, { ok: true })
    }
    if (req.method === 'POST' && req.url === `/api/tasks/${activeSlug}/clarify`) {
      phase = 2
      return json(200, { ok: true })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${activeSlug}/artifacts`) {
      return json(200, { files: [{ name: '会议纪要.md', url: 'https://example.com/fixture-result.md', local: false }] })
    }
    return json(404, { detail: 'fixture route not found' })
  })
  return {
    server,
    requests,
    get slug() {
      return activeSlug
    },
    async listen() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      return server.address().port
    },
    close() {
      return new Promise(resolve => server.close(resolve))
    },
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))
  const fixture = createDaemonFixture()
  const port = await fixture.listen()
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-task-lifecycle-'))
  fs.writeFileSync(
    path.join(userDataDir, 'settings.json'),
    JSON.stringify({ workbenchAuth: { endpoint: `http://127.0.0.1:${port}` } }),
    'utf8'
  )
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
        KNOWME_WORKBENCH_URL: `http://127.0.0.1:${port}`,
      },
      timeout: 120000,
    })
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        consoleErrors.push(text)
      }
    })
    window.on('dialog', dialog => dialog.accept())
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1360, height: 860 })
    await window.locator('#btnRailWorkbench').click()
    await window.locator('#wbGoalInput').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('.wb-advanced-context summary').click()
    await window.locator('#wbModeSelect').selectOption('engineering')
    await window.waitForFunction(() => document.querySelector('#wbOverviewTitle')?.textContent?.includes('软件研发'))
    await window.locator('#wbGoalInput').fill('整理会议纪要并生成跟进待办')
    await window.locator('#wbGoalSubmit').click()
    await window.locator('#wbTaskPage.active').waitFor({ state: 'visible', timeout: 30000 })
    if (!(await window.locator('#wbWorkflowModal').isVisible())) {
      const workflowCard = window.locator('[data-workflow="fixture-flow"]').first()
      if (!(await workflowCard.count())) {
        const debug = await window.evaluate(async () => ({
          daemon: await window.api.workbenchDaemonOverview(),
          taskText: document.querySelector('#wbTaskPage')?.textContent || '',
        }))
        throw new Error(`fixture workflow missing: ${JSON.stringify(debug)}`)
      }
      await workflowCard.click()
    }
    await window.locator('#wbWorkflowModal').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#wbModalConfirm').click()
    await window.waitForTimeout(1000)
    const launchDebug = await window.evaluate(() => ({
      runnerHidden: document.querySelector('#wbRunner')?.hidden,
      modalHidden: document.querySelector('#wbWorkflowModal')?.hidden,
      runnerText: document.querySelector('#wbRunner')?.textContent || '',
      modalText: document.querySelector('#wbWorkflowModal')?.textContent || '',
    }))
    if (launchDebug.runnerHidden) {
      throw new Error(`runner did not open: ${JSON.stringify({ ...launchDebug, requests: fixture.requests })}`)
    }
    await window.locator('#wbRunStatus').waitFor({ state: 'visible', timeout: 30000 })
    await window.waitForFunction(() => document.querySelector('#wbRunStatus')?.textContent?.includes('等待你确认'))
    const gateVisible = await window.locator('[data-run-action="daemon-approve"]').isVisible()
    await window.locator('[data-run-action="daemon-approve"]').click()
    await window.waitForFunction(() => document.querySelector('#wbRunStatus')?.textContent?.includes('等待你补充信息'))
    const clarifyVisible = await window.locator('[data-run-action="daemon-clarify"]').isVisible()
    await window.locator('[data-run-action="daemon-clarify"]').click()
    await window.waitForFunction(() => document.querySelector('#wbRunStatus')?.textContent?.includes('已完成'))
    const artifactVisible = await window.locator('[data-artifact-url]').isVisible()
    await window.screenshot({ path: path.join(SHOTS, 'task-lifecycle-completed.png'), scale: 'css' })

    await window.reload({ waitUntil: 'domcontentloaded' })
    await window.locator('#btnRailWorkbench').click()
    await window.locator(`#wbGoalTaskList [data-goal-task="${fixture.slug}"]`).waitFor({ state: 'visible', timeout: 30000 })
    await window.locator(`#wbGoalTaskList [data-goal-task="${fixture.slug}"]`).click()
    await window.waitForFunction(() => document.querySelector('#wbRunStatus')?.textContent?.includes('已完成'))
    const reloadRecovered = await window.locator('#wbRunStatus').isVisible()
    const bounds = await window.locator('#wbHomePage').evaluate(element => ({
      overflowX: element.scrollWidth > element.clientWidth,
    }))
    await window.screenshot({ path: path.join(SHOTS, 'task-lifecycle-reload.png'), scale: 'css' })

    const createIndex = fixture.requests.findIndex(item => item.method === 'POST' && item.path === '/api/tasks')
    const runIndex = fixture.requests.findIndex(item => item.method === 'POST' && item.path === '/api/tasks/fixture-task/run')
    const checks = [
      { id: 'goal-opens-preparation', pass: true, detail: 'goal modal opened' },
      { id: 'launch-order-create-before-run', pass: createIndex >= 0 && runIndex > createIndex, detail: { createIndex, runIndex } },
      { id: 'gate-next-action', pass: gateVisible, detail: gateVisible },
      { id: 'clarification-next-action', pass: clarifyVisible, detail: clarifyVisible },
      { id: 'completed-artifact', pass: artifactVisible, detail: artifactVisible },
      { id: 'reload-recovers-task', pass: reloadRecovered, detail: reloadRecovered },
      { id: 'home-no-horizontal-overflow', pass: !bounds.overflowX, detail: bounds },
      { id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    ]
    const report = {
      generatedAt: new Date().toISOString(),
      pass: checks.every(check => check.pass),
      checks,
      requests: fixture.requests,
    }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    if (!report.pass) process.exitCode = 1
  } finally {
    if (app) await app.close().catch(() => {})
    await fixture.close().catch(() => {})
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
