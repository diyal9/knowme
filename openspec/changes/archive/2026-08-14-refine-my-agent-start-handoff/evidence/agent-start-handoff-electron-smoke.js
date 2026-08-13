'use strict'

/**
 * 「我的智能体 → 开始使用 → 助理对话」交接链路真机冒烟。
 * 覆盖：卡片身份与能力标签、pending 防连点、身份前置、目录失效仍可开聊、失败留在工作台。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'agent-start-handoff-electron-smoke.json')

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

async function shoot(win, name) {
  await win.screenshot({ path: path.join(SHOTS, name), scale: 'css' })
}

/** 干净的用户目录里没有本地 Agent，先种一个带技能与未授权连接器的 Agent 以覆盖降级路径 */
async function seedLocalAgent(win) {
  return win.evaluate(async () => {
    const res = await window.api.expertSave({
      id: 'ui-expert',
      name: 'UI 专家',
      description: 'UI 专家：聚焦界面视觉生产与交互落地，先收敛约束再结构化出图。',
      avatar: '🧩',
      skills: ['humanizer-zh'],
      connectors: ['feishu'],
      systemPrompt: '你是资深 UI 专家，先确认目标与已有材料，再给出最短可执行步骤。',
    })
    return { ok: res?.ok === true, error: res?.error || res?.message || '' }
  })
}

async function openMyAgents(win) {
  await win.locator('#btnRailWorkbench').click()
  await win.waitForTimeout(2000)
  await win.evaluate(async () => { await window.Workbench?.ensureLoaded?.() })
  await win.waitForTimeout(2000)
  await win.locator('#wbModeTabs [data-work-mode="mine"]').click()
  await win.waitForTimeout(900)
}

async function sessionCount(win) {
  return win.evaluate(async () => {
    const res = await window.api.agentSessionList()
    return Array.isArray(res?.sessions) ? res.sessions.length : -1
  })
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  killElectron()
  await new Promise(resolve => setTimeout(resolve, 800))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-handoff-'))
  let app = null

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
    win.on('console', msg => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    win.on('pageerror', error => report.consoleErrors.push(String(error?.message || error)))
    await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await win.waitForTimeout(4000)

    const seeded = await seedLocalAgent(win)
    check('seed-local-agent', seeded.ok === true, seeded)
    await win.waitForTimeout(600)

    await openMyAgents(win)

    const card = win.locator('#wbAgentGrid .wb-my-agent-card').first()
    await card.waitFor({ state: 'visible', timeout: 30000 })

    // 1) 卡片身份：图标标记（非 emoji）、来源徽标、能力标签
    const identity = await win.evaluate(() => {
      const node = document.querySelector('#wbAgentGrid .wb-my-agent-card')
      if (!node) return null
      return {
        name: node.querySelector('h3')?.textContent?.trim() || '',
        badge: node.querySelector('.wb-shelf-badge')?.textContent?.trim() || '',
        hasSvgMark: !!node.querySelector('.wb-my-agent-mark svg'),
        markText: (node.querySelector('.wb-my-agent-mark')?.textContent || '').trim(),
        chips: [...node.querySelectorAll('.wb-my-agent-chips li')].map(li => li.textContent.trim()),
        agentId: node.getAttribute('data-agent-id') || '',
      }
    })
    check('card-identity-mark-is-icon', identity?.hasSvgMark === true && identity.markText === '', identity)
    check('card-source-badge', /智能体$/.test(identity?.badge || ''), identity?.badge)
    check('card-capability-chips', (identity?.chips || []).length > 0, identity?.chips)

    // 2) 焦点可见：:focus-visible 只对键盘焦点生效，必须用 Tab 走过去才算真验证
    await win.evaluate(() => { document.body.focus() })
    let focusRing = null
    for (let i = 0; i < 60; i += 1) {
      await win.keyboard.press('Tab')
      focusRing = await win.evaluate(() => {
        const active = document.activeElement
        if (!active || !active.matches('#wbAgentGrid [data-agent-action="start"]')) return null
        const style = getComputedStyle(active)
        return {
          focusVisible: active.matches(':focus-visible'),
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
        }
      })
      if (focusRing) break
    }
    check(
      'start-button-focus-ring',
      !!focusRing && focusRing.focusVisible && focusRing.outlineStyle !== 'none' && focusRing.outlineWidth !== '0px',
      focusRing,
    )

    await shoot(win, 'my-agent-shelf-cards.png')

    // 3) 等待态：用可控 gate 挂住启动，观测 pending 与恢复（真实 IPC 太快，观测窗口不稳）
    const pendingState = await win.evaluate(async () => {
      const original = window.WorkspaceAgent.startExpertChat
      let release = null
      const gate = new Promise(resolve => { release = resolve })
      window.WorkspaceAgent.startExpertChat = () => gate
      const button = document.querySelector('#wbAgentGrid [data-agent-action="start"]')
      button.click()
      await new Promise(resolve => setTimeout(resolve, 120))
      const busy = document.querySelector('#wbAgentGrid [data-agent-action="start"]')
      const during = {
        disabled: Boolean(busy?.disabled),
        label: (busy?.textContent || '').trim(),
        busyCard: !!document.querySelector('#wbAgentGrid .wb-my-agent-card.is-starting'),
      }
      release({ ok: false, error: 'pending fixture', notified: true })
      await new Promise(resolve => setTimeout(resolve, 250))
      const restored = document.querySelector('#wbAgentGrid [data-agent-action="start"]')
      window.WorkspaceAgent.startExpertChat = original
      return {
        during,
        after: { disabled: Boolean(restored?.disabled), label: (restored?.textContent || '').trim() },
      }
    })
    check(
      'pending-state-visible',
      pendingState.during.disabled && /正在打开/.test(pendingState.during.label) && pendingState.during.busyCard,
      pendingState.during,
    )
    check(
      'pending-state-released',
      pendingState.after.disabled === false && pendingState.after.label === '开始使用',
      pendingState.after,
    )

    // 4) 连点只开一个会话
    const before = await sessionCount(win)
    await win.evaluate(() => {
      const button = document.querySelector('#wbAgentGrid [data-agent-action="start"]')
      button.click()
      button.click()
    })

    await win.locator('.agent-expert-identity').waitFor({ state: 'visible', timeout: 30000 })
    await win.waitForTimeout(1200)
    const after = await sessionCount(win)
    check('double-click-creates-one-session', after === before + 1, { before, after })

    // 5) 身份在对话主栏右侧：名称 / 职责 / 徽标可见；主栏保留助手式启动区
    const welcome = await win.evaluate(() => {
      const block = document.querySelector('.agent-empty-expert-side .agent-expert-identity, .agent-expert-identity')
      if (!block) return null
      const intro = document.querySelector('.agent-empty-expert .agent-launch-intro')
      const side = document.querySelector('.agent-empty-expert-side')
      const main = document.querySelector('.agent-empty-expert-main')
      return {
        name: block.querySelector('.agent-expert-identity-name strong')?.textContent?.trim() || '',
        badge: block.querySelector('.agent-expert-identity-badge')?.textContent?.trim() || '',
        duty: block.querySelector('p')?.textContent?.trim() || '',
        hasSvgMark: !!block.querySelector('.agent-expert-identity-mark svg, .agent-expert-identity-mark .ico, .agent-expert-identity-mark img'),
        introCopy: intro?.textContent?.trim() || '',
        splitLayout: !!(side && main),
        propsOnRight: !!(side && side.contains(block)),
        degradedNote: document.querySelector('.agent-expert-degraded')?.textContent?.trim() || '',
        limited: document.querySelectorAll('.agent-expert-capability.limited').length,
        placeholder: document.getElementById('agentInput')?.placeholder || '',
        readinessInSide: !!document.querySelector('.agent-empty-expert-side .agent-expert-readiness'),
      }
    })
    check('chat-shows-agent-name', welcome?.name === identity?.name, { chat: welcome?.name, card: identity?.name })
    check('chat-shows-source-badge', /智能体$/.test(welcome?.badge || ''), welcome?.badge)
    check('chat-shows-duty', (welcome?.duty || '').length > 0, welcome?.duty)
    check('chat-identity-mark-is-icon', welcome?.hasSvgMark === true)
    check('expert-split-layout', welcome?.splitLayout === true)
    check('properties-on-right-of-dialog', welcome?.propsOnRight === true)
    check('generic-knowme-copy-replaced', !/把你的问题或任务交给 KnowMe/.test(welcome?.introCopy || ''), welcome?.introCopy)
    check(
      'degraded-explicitly-permits-chat',
      welcome?.limited > 0 ? /仍可直接对话/.test(welcome.degradedNote) : true,
      { limited: welcome?.limited, note: welcome?.degradedNote },
    )
    check('capabilities-in-side-panel', welcome?.readinessInSide === true)
    check(
      'composer-placeholder-names-agent',
      (welcome?.placeholder || '').includes(identity.name),
      welcome?.placeholder,
    )
    check('rail-switched-to-assistant', await win.locator('#agentCol').isVisible())

    await shoot(win, 'expert-chat-identity.png')

    // 5) 专家目录接口失效：仍必须能开聊（权威校验在主进程）
    await openMyAgents(win)
    const degradedStart = await win.evaluate(async agentId => {
      const original = window.api.expertList
      window.api.expertList = async () => { throw new Error('catalog offline (fixture)') }
      if (window.knowme?.expert) window.knowme.expert.list = async () => { throw new Error('catalog offline (fixture)') }
      try {
        const res = await window.WorkspaceAgent.startExpertChat(agentId)
        return { ok: res?.ok === true, error: res?.error || '' }
      } finally {
        window.api.expertList = original
      }
    }, identity.agentId)
    check('start-survives-catalog-failure', degradedStart.ok === true, degradedStart)
    const catalogFailureName = await win.evaluate(
      () => document.querySelector('.agent-expert-identity-name strong')?.textContent?.trim() || '',
    )
    check('identity-survives-catalog-failure', catalogFailureName === identity.name, catalogFailureName)

    // 6) 真失败：只报一条、留在工作台、按钮可恢复
    await openMyAgents(win)
    const failure = await win.evaluate(async () => {
      const res = await window.WorkspaceAgent.startExpertChat('__missing_agent__')
      const button = document.querySelector('#wbAgentGrid [data-agent-action="start"]')
      return {
        ok: res?.ok === true,
        notified: res?.notified === true,
        buttonDisabled: Boolean(button?.disabled),
        buttonLabel: (button?.textContent || '').trim(),
        workbenchVisible: !document.getElementById('workbenchCol')?.hidden,
      }
    })
    check('missing-agent-fails-once', failure.ok === false && failure.notified === true, failure)
    check('failed-start-restores-button', failure.buttonDisabled === false && failure.buttonLabel === '开始使用', failure)

    // 7) 窄窗口：卡片与身份区不得产生横向滚动
    await win.setViewportSize({ width: 760, height: 620 })
    await win.waitForTimeout(900)
    const narrow = await win.evaluate(() => ({
      scrollWidth: document.scrollingElement.scrollWidth,
      innerWidth: window.innerWidth,
      cardVisible: !!document.querySelector('#wbAgentGrid .wb-my-agent-card'),
    }))
    check('narrow-window-no-h-scroll', narrow.scrollWidth <= narrow.innerWidth + 1 && narrow.cardVisible, narrow)
    await shoot(win, 'my-agent-shelf-narrow.png')

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
