'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'expert-task-chat-electron-smoke.json')
const report = { generatedAt: '', pass: false, checks: [], consoleErrors: [] }

function check(id, pass, detail) {
  report.checks.push(detail === undefined ? { id, pass: !!pass } : { id, pass: !!pass, detail })
}

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
  await new Promise(resolve => setTimeout(resolve, 800))
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-expert-task-chat-'))
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
      },
      timeout: 120000,
    })
    const win = await app.firstWindow({ timeout: 90000 })
    win.on('console', message => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    win.on('pageerror', error => report.consoleErrors.push(String(error?.message || error)))
    await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await win.waitForTimeout(2500)

    const seeded = await win.evaluate(async () => window.api.expertSave({
      id: 'task-chat-expert',
      name: '架构顾问',
      description: '负责系统架构分析、知识检索与可执行方案设计。',
      skills: ['humanizer-zh'],
      connectors: [],
      systemPrompt: '你是资深系统架构顾问。',
    }))
    check('seed-expert', seeded?.ok === true, seeded)

    await win.locator('#btnRailWorkbench').click()
    await win.locator('#wbTaskSurface.active').waitFor({ state: 'visible', timeout: 30000 })
    await win.waitForTimeout(1500)
    await win.locator('#wbTaskNew').click()
    await win.locator('#wbTaskComposer').waitFor({ state: 'visible', timeout: 10000 })
    await win.locator('#wbTaskComposerExpert').selectOption('task-chat-expert')
    await win.locator('#wbTaskComposerGoal').fill('设计企业知识检索架构，并列出落地步骤')
    const localKnowledge = win.locator('[data-task-knowledge="local-default"]')
    if (await localKnowledge.count()) await localKnowledge.check()
    const before = await win.evaluate(async () => (await window.api.agentSessionList()).sessions.length)
    await win.screenshot({ path: path.join(SHOTS, 'task-composer-with-knowledge.png'), scale: 'css' })
    await win.locator('[data-task-composer="confirm"]').click()

    await win.locator('.agent-expert-identity').waitFor({ state: 'visible', timeout: 30000 })
    await win.locator('#wbExpertTaskRoom').waitFor({ state: 'visible', timeout: 30000 })
    await win.waitForTimeout(900)
    const room = await win.evaluate(async () => {
      const sessions = await window.api.agentSessionList()
      const activeId = sessions.ui?.activeSessionId || ''
      const active = activeId ? await window.api.agentSessionGet(activeId) : null
      const shell = document.getElementById('appShell')
      return {
        activeId,
        sessionCount: sessions.sessions.length,
        expertName: document.querySelector('#wbExpertTaskRoom .agent-expert-identity-name strong, .agent-empty-expert-side .agent-expert-identity-name strong')?.textContent?.trim() || '',
        input: document.getElementById('agentInput')?.value || '',
        taskRoomVisible: !document.getElementById('wbExpertTaskRoom')?.hidden,
        taskDashboardHidden: document.getElementById('wbTaskDashboard')?.hidden === true,
        layout: shell?.dataset.workbenchLayout || '',
        agentVisible: !!document.getElementById('agentCol')?.offsetParent,
        leftIsChatLike: !!document.querySelector('.agent-empty-expert .agent-launch-intro') && !document.querySelector('.agent-empty-expert .agent-expert-context'),
        roomText: document.querySelector('#wbExpertTaskRoom')?.textContent || '',
        hasAttributes: /专家属性/.test(document.querySelector('#wbExpertTaskRoom')?.textContent || ''),
        hasCapabilities: /技能与连接器/.test(document.querySelector('#wbExpertTaskRoom')?.textContent || ''),
        hasKnowledge: /知识/.test(document.querySelector('#wbExpertTaskRoom')?.textContent || ''),
        toolbarKnowledgeVisible: !!document.getElementById('agentSessionKnowledgeBtn')?.offsetParent,
        knowledgeRefs: active?.session?.knowledgeRefs || [],
        graphModalVisible: !document.getElementById('wbWorkflowModal')?.hidden,
      }
    })
    check('direct-task-room', room.taskRoomVisible && room.taskDashboardHidden && room.layout === 'task-room', room)
    check('expert-chat-visible', room.agentVisible && room.expertName === '架构顾问', room.expertName)
    check('goal-prefilled-not-sent', room.input === '设计企业知识检索架构，并列出落地步骤', room.input)
    check('left-chat-like-empty', room.leftIsChatLike === true, { leftIsChatLike: room.leftIsChatLike })
    check('expert-context-groups', room.hasAttributes && room.hasCapabilities && room.hasKnowledge, room)
    check('knowledge-selection-persisted', room.knowledgeRefs.some(ref => ref.id === 'local-default'), room.knowledgeRefs)
    check('persistent-knowledge-control', room.toolbarKnowledgeVisible, room.toolbarKnowledgeVisible)
    check('agent-graph-skipped', room.graphModalVisible === false, room.graphModalVisible)
    check('one-session-created', room.sessionCount === before + 1, { before, after: room.sessionCount })
    await win.screenshot({ path: path.join(SHOTS, 'expert-task-chat-room.png'), scale: 'css' })

    await win.locator('#agentSessionKnowledgeBtn').click()
    await win.locator('#agentSessionKnowledgeMenu [data-knowledge-default]').click()
    await win.waitForTimeout(500)
    const cleared = await win.evaluate(async activeId => {
      const result = await window.api.agentSessionGet(activeId)
      return result?.session?.knowledgeRefs || []
    }, room.activeId)
    check('knowledge-scope-updates-session', cleared.length === 0, cleared)

    await win.locator('#wbExpertTaskBack').click()
    await win.locator('#wbTaskSurface.active').waitFor({ state: 'visible', timeout: 10000 })
    const recent = win.locator('[data-task-open]').filter({ hasText: '设计企业知识检索架构' }).first()
    await recent.click()
    await win.locator('#wbExpertTaskRoom').waitFor({ state: 'visible', timeout: 20000 })
    const resumed = await win.evaluate(async expectedId => {
      const sessions = await window.api.agentSessionList()
      return {
        activeId: sessions.ui?.activeSessionId || '',
        count: sessions.sessions.length,
        expectedId,
      }
    }, room.activeId)
    check('recent-task-resumes-same-session', resumed.activeId === room.activeId && resumed.count === room.sessionCount, resumed)

    check('renderer-console-errors', report.consoleErrors.length === 0, report.consoleErrors)
  } finally {
    if (app) await app.close().catch(() => {})
  }

  report.generatedAt = new Date().toISOString()
  report.pass = report.checks.every(item => item.pass)
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  report.generatedAt = new Date().toISOString()
  report.checks.push({ id: 'smoke-crashed', pass: false, detail: String(error?.message || error) })
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`)
  process.exitCode = 1
})
