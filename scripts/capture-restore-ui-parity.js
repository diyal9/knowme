'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { chromium } = require('playwright')

const ROOT = path.join(__dirname, '..')
const SHOTS = path.join(ROOT, 'openspec/changes/restore-game-studio-ui-parity/evidence/screenshots/react')
const PORT = 18902
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
        { id: 's1', kind: 'skill', name: '写纪要', description: '会议纪要', category: '办公' },
      ],
    }),
    capabilityPackList: async () => ({ ok: true, items: [] }),
    sourcesList: async () => ({ sources: [], activeSourceId: null }),
    sourcesTree: async () => ({ ok: true, nodes: [] }),
    connectorsList: async () => ({ items: [] }),
    connectorsStatus: async () => ({ ok: false, message: '未连接', missing: ['calendar:readonly'] }),
    logsQuery: async () => ({ ok: true, entries: [], date: '2026-08-15' }),
    logsCounts: async () => ({ ok: true, counts: {} }),
    initMemory: (cb) => cb([{ kind: 'open', summary: '打开工作台', ts: new Date().toISOString() }]),
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
        else if (Date.now() > deadline) reject(new Error(`preview not ready: ${res.status} ${url}`))
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
  fs.mkdirSync(SHOTS, { recursive: true })
  const dist = path.join(ROOT, 'dist', 'renderer')
  const preview = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', dist], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  try {
    await waitHttp(`${BASE}/workspace/index.html`)
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(stubApi)

    const shot = async (name) => {
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(SHOTS, name), fullPage: false })
    }

    await page.goto(`${BASE}/workspace/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await shot('react-assistant.png')

    await page.getByRole('button', { name: '收起或展开左侧文件栏' }).click()
    await shot('react-files.png')
    await page.getByRole('button', { name: '收起或展开左侧文件栏' }).click()

    await page.getByRole('button', { name: '工作台' }).click()
    await page.waitForTimeout(500)
    await shot('react-workbench.png')

    await page.getByRole('tab', { name: '工作流' }).click()
    await page.waitForTimeout(400)
    await shot('react-shelf.png')

    await page.getByRole('tab', { name: '管线服务' }).click()
    await page.waitForTimeout(400)
    await shot('react-daemon.png')

    await page.getByRole('tab', { name: '专家协作' }).click()
    await page.getByRole('button', { name: '+ 新建协作' }).click()
    await page.waitForTimeout(800)
    await shot('react-studio.png')

    await page.getByRole('button', { name: /返回/ }).click().catch(() => null)
    await page.getByRole('button', { name: '专家库：专家、技能与 MCP 连接器' }).click()
    await page.waitForTimeout(600)
    await shot('react-hub.png')

    await page.getByRole('button', { name: '知识网' }).click()
    await page.waitForTimeout(400)
    await shot('react-knowledge.png')

    await page.goto(`${BASE}/settings/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    await shot('react-settings-sources.png')
    const tabs = [
      ['AI 接口', 'ai'],
      ['助手模式', 'assistant'],
      ['系统配置', 'system'],
      ['连接器', 'connectors'],
      ['我的记忆', 'memory'],
      ['关于', 'about'],
    ]
    for (const [label, id] of tabs) {
      await page.getByRole('tab', { name: label }).click()
      await page.waitForTimeout(300)
      await shot(`react-settings-${id}.png`)
    }

    await page.goto(`${BASE}/memory/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await shot('react-memory.png')

    await page.goto(`${BASE}/log-viewer/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await shot('react-log-viewer.png')

    await browser.close()
    console.log(JSON.stringify({ ok: true, dir: SHOTS, files: fs.readdirSync(SHOTS) }, null, 2))
  } finally {
    preview.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
