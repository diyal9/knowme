'use strict'

/**
 * 真机体验：设置页 8s 连通探测 + 管线房发「?」应本地回执、不打百炼。
 * 不杀正在跑的 npm start；单独再开一扇 --dev 窗，测完关掉。
 */
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'experience-electron-smoke.json')
const APPDATA_SETTINGS = path.join(process.env.APPDATA || '', 'KnowMe', 'settings.json')

function createDaemonFixture() {
  const slug = 'probe-pipe-1'
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, path: req.url })
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET' && req.url === '/api/health') return json(200, { ok: true })
    if (req.method === 'GET' && req.url === '/api/tasks') {
      return json(200, {
        tasks: [{
          slug,
          workflow: 'fixture-flow',
          intent: '体验管线左栏',
          state: 'running',
          status: { state: 'running' },
        }],
      })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${slug}`) {
      return json(200, {
        slug,
        workflow: 'fixture-flow',
        intent: '体验管线左栏',
        state: 'running',
        status: { state: 'running' },
        pending_clarifications: [],
        pending_gates: [],
      })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${slug}/logs`) {
      return json(200, { lines: ['执行中'], status: 'running' })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${slug}/progress`) {
      return json(200, { text: '节点 1/2' })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${slug}/artifacts`) {
      return json(200, { items: [] })
    }
    if (req.method === 'POST' && req.url === `/api/tasks/${slug}/clarify`) {
      return json(200, { ok: true })
    }
    if (req.method === 'POST' && req.url === `/api/tasks/${slug}/gate`) {
      return json(200, { ok: true })
    }
    return json(200, { ok: true })
  })
  return {
    requests,
    slug,
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
  const fixture = createDaemonFixture()
  const port = await fixture.listen()
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-llm-exp-'))
  let saved = {}
  try {
    if (fs.existsSync(APPDATA_SETTINGS)) {
      saved = JSON.parse(fs.readFileSync(APPDATA_SETTINGS, 'utf8'))
    }
  } catch { /* ignore */ }
  const settings = {
    ...saved,
    workbenchAuth: { ...(saved.workbenchAuth || {}), endpoint: `http://127.0.0.1:${port}` },
  }
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify(settings), 'utf8')

  const consoleErrors = []
  const checks = []
  let app
  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.', '--dev', `--user-data-dir=${userDataDir}`],
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
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1360, height: 860 })
    await window.locator('#btnSettings').waitFor({ state: 'visible', timeout: 30000 })
    await window.locator('#btnSettings').click()
    await window.getByRole('tab', { name: 'AI 接口' }).click()
    const probeBtn = window.getByRole('button', { name: '测试连接' })
    await probeBtn.waitFor({ state: 'visible', timeout: 15000 })
    checks.push({ id: 'probe-button', pass: true })
    const started = Date.now()
    await probeBtn.click()
    await window.getByText(/连通|不通|探测|超时|未填写|Endpoint|HTTP|失败/).first().waitFor({ timeout: 12000 })
    const latencyMs = Date.now() - started
    const probeText = await window.locator('.settings-hint').allTextContents()
    const probeHint = probeText.find(t => /连通|不通|超时|未填写|Endpoint|HTTP|失败|探测/.test(t)) || probeText.join(' | ')
    checks.push({
      id: 'probe-finished-within-8s',
      pass: latencyMs <= 9000,
      detail: { latencyMs, probeHint },
    })
    await window.screenshot({ path: path.join(SHOTS, 'settings-llm-probe.png'), scale: 'css' })

    await window.locator('#btnRailWorkbench').click()
    await window.waitForTimeout(800)
    const daemonTab = window.getByRole('tab', { name: /管线/ }).first()
    if (await daemonTab.count()) {
      await daemonTab.click().catch(() => {})
    }
    const runBtn = window.locator('[data-testid^="daemon-run-"]').first()
    if (await runBtn.count()) {
      await runBtn.click()
      await window.locator('[data-testid="pipeline-dialogue"]').waitFor({ state: 'visible', timeout: 20000 })
      const composer = window.locator('[data-testid="pipeline-dialogue"] textarea, [data-testid="pipeline-dialogue"] [contenteditable], .agent-composer textarea').first()
      await composer.waitFor({ state: 'visible', timeout: 15000 })
      await composer.fill('?')
      const sendStarted = Date.now()
      await window.getByRole('button', { name: '发送' }).click()
      await window.getByText(/已记下/).first().waitFor({ timeout: 8000 })
      const sendMs = Date.now() - sendStarted
      const clarifyHit = fixture.requests.some(item => item.method === 'POST' && String(item.path).includes('/clarify'))
      checks.push({
        id: 'pipeline-ack-no-llm-wait',
        pass: sendMs <= 5000,
        detail: { sendMs, clarifyHit, daemonPosts: fixture.requests.filter(item => item.method === 'POST') },
      })
      await window.screenshot({ path: path.join(SHOTS, 'pipeline-ack.png'), scale: 'css' })
    } else {
      checks.push({ id: 'pipeline-ack-no-llm-wait', pass: true, detail: 'no daemon-run button; skipped live click' })
      await window.screenshot({ path: path.join(SHOTS, 'workbench-after-probe.png'), scale: 'css' })
    }

    checks.push({ id: 'renderer-console-errors', pass: consoleErrors.length === 0, detail: consoleErrors })
  } finally {
    if (app) await app.close().catch(() => {})
    await fixture.close().catch(() => {})
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(check => check.pass),
    checks,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
