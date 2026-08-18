#!/usr/bin/env node
/**
 * Electron 核心路径 smoke：长对话、会话菜单、话题轨、工作台 CSS、内容预览。
 * 种子写入 userData/agent-sessions.json，不打真实 LLM。
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'core-path-electron-smoke.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch {
      /* none */
    }
  }
}

function longMarkdown() {
  const table = '| 项 | 状态 |\n| --- | --- |\n| **A** | `ok` |\n| B | wait |\n'
  const pad = '段落正文。'.repeat(220)
  return [
    '## 长回复',
    '',
    '见 [纪要](https://sample.feishu.cn/docx/abc123)',
    '',
    table,
    '',
    pad,
  ].join('\n')
}

function seedSessions() {
  const now = new Date().toISOString()
  const messages = []
  for (let i = 0; i < 12; i++) {
    messages.push({ role: 'user', text: i === 0 ? '整理本周纪要并列出表格' : `补充主题 ${i + 1}：进度如何` })
    messages.push({
      role: 'assistant',
      text: i === 0 ? longMarkdown() : `**主题 ${i + 1}**\n\n- 已完成\n- 待确认`,
    })
  }
  const id = 'smoke_core_session'
  return {
    sessions: [
      {
        id,
        agentId: 'general',
        title: '核心路径长对话',
        createdAt: now,
        updatedAt: now,
        messages,
        pinned: false,
      },
    ],
    ui: { openSessionIds: [id], activeSessionId: id },
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise((r) => setTimeout(r, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-core-smoke-'))
  fs.writeFileSync(path.join(userDataDir, 'agent-sessions.json'), JSON.stringify(seedSessions(), null, 2), 'utf8')

  const report = {
    at: new Date().toISOString(),
    ok: false,
    userDataDir,
    consoleErrors: [],
    checks: [],
  }

  const app = await electron.launch({
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

  try {
    const window = await app.firstWindow({ timeout: 90000 })
    window.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.locator('#appShell, #btnRailAi').first().waitFor({ state: 'visible', timeout: 45000 })
    await window.waitForTimeout(2500)

    const chatLog = window.locator('[data-testid="agent-chat-log"]')
    await chatLog.waitFor({ state: 'visible', timeout: 30000 })
    report.checks.push({ id: 'long-thread-log', ok: await chatLog.isVisible() })

    const virtuoso = window.locator('[data-testid="agent-message-virtuoso"]')
    const staticList = window.locator('[data-testid="agent-message-static-list"]')
    const longList = (await virtuoso.count()) > 0 || (await staticList.count()) > 0
    report.checks.push({ id: 'long-thread-list', ok: longList })

    const contentView = window.locator('[data-testid="content-view"]').first()
    await contentView.waitFor({ state: 'attached', timeout: 20000 }).catch(() => null)
    report.checks.push({ id: 'content-preview', ok: (await contentView.count()) > 0 })

    const feishu = window.locator('[data-testid="feishu-resource-card"]')
    const table = window.locator('[data-testid="content-table"]')
    report.checks.push({
      id: 'rich-card-or-table',
      ok: (await feishu.count()) > 0 || (await table.count()) > 0,
    })

    const topicNav = window.locator('[data-testid="agent-topic-nav"]')
    await topicNav.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null)
    report.checks.push({ id: 'topic-rail', ok: await topicNav.isVisible().catch(() => false) })

    await window.locator('#agentMoreBtn').click()
    const morePop = window.locator('[data-testid="agent-more-pop"]')
    await morePop.waitFor({ state: 'visible', timeout: 8000 })
    const moreText = await morePop.innerText()
    const moreVisible = await morePop.isVisible()
    report.checks.push({
      id: 'session-menu-more',
      ok: moreVisible && /新对话/.test(moreText) && !/Pin|动作表现|管理对话/.test(moreText),
    })
    await window.locator('#agentMoreBtn').click().catch(() => null)

    await window.screenshot({ path: path.join(SHOTS, 'assistant-core.png'), fullPage: false })

    await window.locator('#btnRailWorkbench').click()
    await window.waitForTimeout(2000)
    const pending = window.locator('[data-testid="km-surface-pending"]')
    if (await pending.count()) {
      await pending.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => null)
    }
    const taskhome = window.locator('[data-testid="taskhome-surface"]')
    await taskhome.waitFor({ state: 'visible', timeout: 25000 })
    const cssOk = await window.evaluate(() => {
      const head = document.querySelector('.wb-head')
      const tab = document.querySelector('.wb-mode-tab')
      if (!head || !tab) return { ok: false, reason: 'missing-chrome' }
      const hs = getComputedStyle(head)
      const ts = getComputedStyle(tab)
      const height = parseFloat(hs.height)
      const pad = parseFloat(ts.paddingLeft)
      const ok = height >= 50 && ts.borderTopWidth === '0px' && pad >= 8
      return { ok, height: hs.height, tabBorder: ts.borderTopWidth, tabPad: ts.paddingLeft }
    })
    report.checks.push({ id: 'workbench-css', ok: Boolean(cssOk && cssOk.ok), detail: cssOk })
    report.checks.push({ id: 'taskhome-visible', ok: await taskhome.isVisible() })
    await window.screenshot({ path: path.join(SHOTS, 'workbench-css.png'), fullPage: false })

    const manageTab = window.locator('[data-wb-mode="daemon"]')
    if (await manageTab.count()) {
      await manageTab.click()
      await window.waitForTimeout(1200)
    }
    const manage = window.locator('[data-testid="manage-surface"]')
    await manage.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null)
    report.checks.push({ id: 'manage-visible', ok: (await manage.count()) > 0 && (await manage.isVisible().catch(() => false)) })

    await window.locator('#btnToggleSide').click()
    const files = window.locator('[data-testid="files-pane"]')
    await files.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null)
    report.checks.push({ id: 'files-pane', ok: await files.isVisible().catch(() => false) })

    await window.locator('#btnSettings').click()
    const settings = window.locator('[data-testid="settings-surface"]')
    await settings.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null)
    report.checks.push({ id: 'settings-surface', ok: await settings.isVisible().catch(() => false) })
    await window.screenshot({ path: path.join(SHOTS, 'settings.png'), fullPage: false })

    report.ok = report.checks.every((c) => c.ok) && report.consoleErrors.length === 0
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    process.stdout.write(`${report.ok ? 'PASS' : 'FAIL'} ${REPORT}\n`)
    process.stdout.write(JSON.stringify(report.checks, null, 2) + '\n')
    if (!report.ok) process.exitCode = 1
  } finally {
    await app.close().catch(() => null)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
