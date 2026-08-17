'use strict'

/**
 * 为本 change 采集签字面截图到 evidence/screenshots/{assistant,workbench,settings-hub}/
 * 用法：npm run renderer:build && node scripts/capture-production-ui-parity.js
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { chromium } = require('playwright')

const ROOT = path.join(__dirname, '..')
const EVIDENCE = path.join(
  ROOT,
  'openspec/changes/align-production-ui-visual-parity/evidence/screenshots',
)
const PORT = 18912
const BASE = `http://127.0.0.1:${PORT}`

function stubApi() {
  window.api = {
    workbenchLoad: async () => ({ workflows: [], workflowPackages: [] }),
    workbenchModeList: async () => ({ ok: true, modes: [], activeModeId: '' }),
    workbenchAutomationList: async () => ({ ok: true, jobs: [], templates: [] }),
    workbenchTaskList: async () => ({ items: [] }),
    workbenchWorkflowPackageList: async () => ({ items: [] }),
    workbenchDaemonOverview: async () => ({}),
    appInfo: async () => ({ name: 'KnowMe', version: '0.3.0' }),
    getSettings: () => ({ model: 'gpt-4o-mini' }),
    initSettings: (cb) => cb({ model: 'gpt-4o-mini' }),
    saveSettings: async () => ({ ok: true }),
    llmProfile: async () => ({ model: 'gpt-4o-mini' }),
    llmModels: async () => ({ presets: [{ id: 'gpt-4o-mini', label: 'GPT-4o mini' }] }),
    llmSetModel: async () => ({ ok: true }),
    agentSessionList: async () => ({ items: [] }),
    agentSessionNew: async () => ({ id: 'n1', title: '新对话' }),
    agentSessionGet: async () => null,
    agentSessionSetUi: async () => ({ ok: true }),
    aiGenerate: async () => ({ text: '已收到。' }),
    aiCancelRun: async () => ({}),
    onAiStreamChunk: () => () => undefined,
    knowledgeOsList: async () => ({ ok: true, wiki: [], okf: [] }),
    knowledgeSearch: async () => ({ ok: true, hits: [] }),
    knowledgeExport: async () => ({ ok: true }),
    knowledgeImport: async () => ({ ok: true }),
    capabilityList: async () => ({
      ok: true,
      items: [
        { id: 'e1', kind: 'expert', name: '产品经理', description: '需求澄清', category: '办公', installed: true },
      ],
    }),
    capabilityPackList: async () => ({ ok: true, items: [] }),
    capabilityPackEmptyState: async () => ({ groups: [] }),
    sourcesList: async () => ({ sources: [], activeSourceId: null }),
    sourcesTree: async () => ({ ok: true, nodes: [] }),
    connectorsList: async () => ({ items: [] }),
    connectorsStatus: async () => ({ ok: false, message: '未连接', missing: [] }),
    logsQuery: async () => ({ ok: true, entries: [], date: '2026-08-17' }),
    logsCounts: async () => ({ ok: true, counts: {} }),
    initMemory: (cb) => cb([]),
    openSettingsWindow: () => undefined,
    openLogsWindow: () => undefined,
    openMemoryPanel: () => undefined,
  }
}

function waitHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url).then((res) => {
        if (res.ok) resolve()
        else if (Date.now() > deadline) reject(new Error(`preview not ready: ${res.status}`))
        else setTimeout(tick, 250)
      }).catch(() => {
        if (Date.now() > deadline) reject(new Error(`preview not ready ${url}`))
        else setTimeout(tick, 250)
      })
    }
    tick()
  })
}

async function main() {
  for (const dir of ['assistant', 'workbench', 'settings-hub']) {
    fs.mkdirSync(path.join(EVIDENCE, dir), { recursive: true })
  }
  const dist = path.join(ROOT, 'dist', 'renderer')
  if (!fs.existsSync(path.join(dist, 'workspace', 'index.html'))) {
    throw new Error('缺少 dist/renderer；请先 npm run renderer:build')
  }
  const preview = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', dist], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  try {
    await waitHttp(`${BASE}/workspace/index.html`)
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(stubApi)

    const shot = async (folder, name) => {
      await page.waitForTimeout(350)
      await page.screenshot({ path: path.join(EVIDENCE, folder, name), fullPage: false })
    }

    await page.goto(`${BASE}/workspace/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    await shot('assistant', 'current-assistant-empty.png')

    await page.getByRole('button', { name: '工作台' }).click()
    await page.waitForTimeout(500)
    await shot('workbench', 'current-taskhome.png')

    await page.getByRole('tab', { name: '工作流' }).click()
    await page.waitForTimeout(400)
    await shot('workbench', 'current-shelf.png')

    await page.getByRole('button', { name: '专家库：专家、技能与 MCP 连接器' }).click()
    await page.waitForTimeout(500)
    await shot('settings-hub', 'current-hub.png')

    await page.goto(`${BASE}/settings/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await shot('settings-hub', 'current-settings.png')

    await browser.close()
    console.log(JSON.stringify({ ok: true, dir: EVIDENCE }, null, 2))
  } finally {
    preview.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
