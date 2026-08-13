'use strict'

/*
 * 端到端：四个内置助手模式的缺省入口能否完整使用。
 * 真机启动 Electron（playwright._electron），逐模式验证：
 *   1. “+” 菜单只列四个内置模式
 *   2. 每个模式空态卡片正确渲染
 *   3. 需材料/需授权的入口在空输入时先追问、不空发（preflight 生效）
 *   4. 写作模式补料后能真正进入发送链路（出现用户气泡）
 *   5. 知识管家 lint 入口走通本地 IPC 并回填结果
 * 不依赖外部 LLM / 飞书：只走到「用户气泡出现」与本地 IPC 回填即判定链路已启动。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const REPORT = path.join(__dirname, 'mode-entries-e2e.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.')",
    '}',
    '$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique',
    'if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }',
  ].join(' ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch { /* no matching KnowMe process */ }
}

async function openExpertPop(window) {
  const shown = await window.evaluate(() =>
    document.querySelector('#agentExpertPop')?.classList.contains('show') || false)
  if (!shown) {
    await window.locator('#agentExpertBtn').click()
    await window.waitForTimeout(250)
  }
}

async function switchMode(window, modeId) {
  await openExpertPop(window)
  await window.locator(`#agentExpertPop [data-expert-id="${modeId}"]`).click()
  await window.waitForTimeout(700)
}

async function emptyCardState(window) {
  return window.evaluate(() => {
    const cards = [...document.querySelectorAll('.agent-empty-actions .agent-empty-act')]
    return {
      label: document.querySelector('.agent-empty-tips')?.getAttribute('aria-label') || '',
      cardCount: cards.length,
      titles: cards.map(c => c.querySelector('strong')?.textContent?.trim() || ''),
      stewardCount: cards.filter(c => c.hasAttribute('data-steward')).length,
      shortcutCount: cards.filter(c => c.hasAttribute('data-shortcut')).length,
    }
  })
}

async function main() {
  stopKnowMeDevProcesses()
  await new Promise(resolve => setTimeout(resolve, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-mode-e2e-'))
  const checks = []
  const consoleErrors = []
  let app

  const record = (id, pass, detail) => checks.push({ id, pass: !!pass, detail })

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
      const text = message.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1600)
    await window.locator('#btnRailAi').click()
    await window.waitForTimeout(700)

    // 1) “+” 菜单只列四个内置模式
    await openExpertPop(window)
    await window.waitForTimeout(200)
    const menu = await window.evaluate(() => {
      const items = [...document.querySelectorAll('#agentExpertPop [data-expert-id]')]
      return { ids: items.map(i => i.getAttribute('data-expert-id')) }
    })
    record('plus-menu-lists-only-four-builtin-modes',
      menu.ids.length === 4
      && ['general', 'steward', 'writing', 'coding'].every(id => menu.ids.includes(id)),
      menu)

    // 2) 写作模式：卡片渲染 + 空输入追问 + 补料后进入发送
    await switchMode(window, 'writing')
    const writingEmpty = await emptyCardState(window)
    record('writing-empty-cards-render',
      writingEmpty.label === '写作模式入口' && writingEmpty.cardCount === 4 && writingEmpty.shortcutCount === 4,
      writingEmpty)

    await window.evaluate(() => { document.querySelector('#agentInput').value = '' })
    await window.locator('.agent-empty-actions .agent-empty-act').first().click()
    await window.waitForTimeout(500)
    const writingPreflight = await window.evaluate(() => ({
      trail: document.querySelector('.agent-trail')?.textContent?.trim() || '',
      userBubbles: document.querySelectorAll('.agent-bubble.user').length,
    }))
    record('writing-empty-input-asks-for-material-without-sending',
      /贴进输入框|@ 文件|材料/.test(writingPreflight.trail) && writingPreflight.userBubbles === 0,
      writingPreflight)

    await window.locator('#agentInput').fill('帮我把这段季度复盘草稿定稿：本季度完成三项目标，风险两项。')
    await window.locator('#agentSend').click()
    await window.waitForTimeout(900)
    const writingSend = await window.evaluate(() => ({
      userBubbles: document.querySelectorAll('.agent-bubble.user').length,
      launch: document.querySelector('#agentCol')?.classList.contains('agent-launch-state') || false,
    }))
    record('writing-after-material-enters-send-flow',
      writingSend.userBubbles >= 1 && writingSend.launch === false,
      writingSend)
    // 停止本次运行，避免真实生成占用
    await window.evaluate(() => { try { document.querySelector('#agentSend')?.click() } catch {} })
    await window.waitForTimeout(300)

    // 3) 编程模式：卡片渲染 + 空输入追问
    await switchMode(window, 'coding')
    const codingEmpty = await emptyCardState(window)
    record('coding-empty-cards-render',
      codingEmpty.label === '编程模式入口' && codingEmpty.cardCount === 4 && codingEmpty.shortcutCount === 4,
      codingEmpty)

    await window.evaluate(() => { document.querySelector('#agentInput').value = '' })
    await window.locator('.agent-empty-actions .agent-empty-act').first().click()
    await window.waitForTimeout(500)
    const codingPreflight = await window.evaluate(() => ({
      trail: document.querySelector('.agent-trail')?.textContent?.trim() || '',
      userBubbles: document.querySelectorAll('.agent-bubble.user').length,
    }))
    record('coding-empty-input-asks-for-material-without-sending',
      codingPreflight.trail.length > 0 && codingPreflight.userBubbles === 0,
      codingPreflight)

    // 4) 通用模式：需授权入口在未连飞书时先追问
    await switchMode(window, 'general')
    await window.evaluate(() => { document.querySelector('#agentInput').value = '' })
    await window.locator('.agent-empty-actions .agent-empty-act').first().click()
    await window.waitForTimeout(600)
    const generalPreflight = await window.evaluate(() => ({
      trail: document.querySelector('.agent-trail')?.textContent?.trim() || '',
      userBubbles: document.querySelectorAll('.agent-bubble.user').length,
    }))
    record('general-feishu-task-asks-for-auth-without-sending',
      /飞书|授权|连接器/.test(generalPreflight.trail) && generalPreflight.userBubbles === 0,
      generalPreflight)

    // 5) 知识管家：四入口渲染 + lint 走通本地 IPC
    await switchMode(window, 'steward')
    const stewardEmpty = await emptyCardState(window)
    record('steward-empty-cards-render',
      stewardEmpty.label === '知识管家入口' && stewardEmpty.cardCount === 4 && stewardEmpty.stewardCount === 4,
      stewardEmpty)

    await window.locator('.agent-empty-actions [data-steward="lint"]').click()
    await window.waitForTimeout(1500)
    const stewardLint = await window.evaluate(() => ({
      trail: [...document.querySelectorAll('.agent-trail')].map(n => n.textContent.trim()).join(' | '),
    }))
    record('steward-lint-runs-local-ipc-and-reports',
      /健康检查|问题|扫描/.test(stewardLint.trail),
      stewardLint)

    record('renderer-console-errors', consoleErrors.length === 0, consoleErrors)
  } finally {
    if (app) await app.close().catch(() => {})
  }

  const report = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(c => c.pass),
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
