'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function capture(changeName, steps) {
  const evidence = path.join(ROOT, 'openspec/changes', changeName, 'evidence')
  const shots = path.join(evidence, 'screenshots')
  fs.mkdirSync(shots, { recursive: true })
  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `km-${changeName}-`))
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  const pageErrors = []
  const consoleErrors = []
  window.on('pageerror', error => pageErrors.push(error?.message || String(error)))
  window.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(4000)
  const report = { at: new Date().toISOString(), change: changeName, shots: [], checks: [] }
  for (const step of steps) {
    if (step.resize) await window.setViewportSize(step.resize)
    if (step.action) await window.evaluate(step.action)
    if (step.click) await window.locator(step.click).click()
    if (step.waitMs) await window.waitForTimeout(step.waitMs)
    if (step.check) {
      const ok = await window.locator(step.check).isVisible()
      report.checks.push({ id: step.id || step.check, ok })
    }
    if (step.assert) {
      const result = await window.evaluate(step.assert)
      const detail = typeof result === 'object' && result !== null ? result : { ok: Boolean(result) }
      report.checks.push({ id: step.id || 'assert', ...detail, ok: Boolean(detail.ok) })
    }
    if (step.file) {
      const target = path.join(shots, step.file)
      await window.screenshot({ path: target, fullPage: false })
      report.shots.push(step.file)
      report.checks.push({ id: `shot-${step.file}`, ok: fs.existsSync(target) })
    }
  }
  report.pageErrors = pageErrors
  report.consoleErrors = consoleErrors
  report.checks.push({ id: 'page-errors', ok: pageErrors.length === 0, count: pageErrors.length })
  report.checks.push({ id: 'console-errors', ok: consoleErrors.length === 0, count: consoleErrors.length })
  report.ok = report.checks.every(item => item.ok)
  fs.writeFileSync(path.join(evidence, 'electron-evidence.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await app.close()
  if (!report.ok) process.exit(1)
}

async function main() {
  const change = process.argv[2]
  if (change === 'align-capability-hub-tabs') {
    await capture(change, [
      { click: '#btnRailCapabilities', waitMs: 3000, check: '.drawer-capability-tabs', id: 'hub-open', file: 'electron-hub-outer-topbar.png' },
    ])
    return
  }
  if (change === 'swap-automation-capability-rail-order') {
    await capture(change, [
      { check: '#btnRailWorkbench', id: 'rail-workbench', file: 'electron-rail-order.png' },
    ])
    return
  }
  if (change === 'polish-workbench-navigation-shell') {
    await capture(change, [
      { click: '#btnRailWorkbench', waitMs: 300 },
      {
        click: '#wbTabHome',
        waitMs: 700,
        id: 'default-navigation-layout',
        assert: () => {
          const shell = document.getElementById('appShell')
          const rail = document.querySelector('.side-rail')
          const home = document.getElementById('wbTabHome')
          const tabs = document.querySelector('.wb-tabs-group')
          const moduleTitle = document.querySelector('.wb-head-title')
          if (!shell || !rail || !home || !tabs || !moduleTitle) return { ok: false, reason: 'missing navigation nodes' }
          const railRect = rail.getBoundingClientRect()
          const shellRect = shell.getBoundingClientRect()
          const tabStyle = getComputedStyle(tabs)
          const moduleTitleDisplay = getComputedStyle(moduleTitle).display
          return {
            ok: Math.round(railRect.width) === 120
              && Math.abs(shellRect.width - document.documentElement.clientWidth) < 1
              && home.classList.contains('active')
              && home.getAttribute('aria-selected') === 'true'
              && tabStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
              && tabStyle.boxShadow === 'none'
              && moduleTitleDisplay === 'none',
            railWidth: railRect.width,
            shellWidth: shellRect.width,
            viewportWidth: document.documentElement.clientWidth,
            homeActive: home.classList.contains('active'),
            homeSelected: home.getAttribute('aria-selected'),
            tabBackground: tabStyle.backgroundColor,
            tabShadow: tabStyle.boxShadow,
            moduleTitleDisplay,
          }
        },
        file: 'workbench-navigation-default.png',
      },
      {
        resize: { width: 900, height: 650 },
        waitMs: 500,
        id: 'minimum-navigation-layout',
        assert: () => {
          const railRect = document.querySelector('.side-rail')?.getBoundingClientRect()
          const mainRect = document.querySelector('.main')?.getBoundingClientRect()
          return {
            ok: Math.round(railRect?.width || 0) === 120
              && (mainRect?.width || 0) > 0
              && document.documentElement.scrollWidth === document.documentElement.clientWidth,
            railWidth: railRect?.width || 0,
            mainWidth: mainRect?.width || 0,
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          }
        },
        file: 'workbench-navigation-minimum.png',
      },
      {
        click: '#wbTabTasks',
        waitMs: 400,
        id: 'flat-tab-switch',
        assert: () => {
          const tasks = document.getElementById('wbTabTasks')
          const page = document.getElementById('wbTaskPage')
          const indicator = tasks ? getComputedStyle(tasks, '::after') : null
          return {
            ok: Boolean(tasks?.classList.contains('active')
              && tasks.getAttribute('aria-selected') === 'true'
              && page?.classList.contains('active')
              && indicator?.transform !== 'none'),
            indicatorTransform: indicator?.transform || '',
          }
        },
        file: 'workbench-flat-workflow-tab.png',
      },
      {
        action: () => {
          const drawer = document.getElementById('drawer')
          if (!drawer?.classList.contains('open')) document.getElementById('btnRailCapabilities')?.click()
        },
        waitMs: 1200,
        id: 'overlay-rail-alignment',
        assert: () => {
          const railRect = document.querySelector('.side-rail')?.getBoundingClientRect()
          const drawerRect = document.querySelector('#drawer.open')?.getBoundingClientRect()
          const brand = document.querySelector('.drawer-capability-brand')
          const tabs = document.querySelector('.drawer-capability-tabs')
          const activeTab = document.querySelector('.drawer-capability-tab.active')
          const tabsStyle = tabs ? getComputedStyle(tabs) : null
          const activeStyle = activeTab ? getComputedStyle(activeTab) : null
          const indicator = activeTab ? getComputedStyle(activeTab, '::after') : null
          return {
            ok: Boolean(railRect && drawerRect
              && Math.abs(railRect.right - drawerRect.left) < 1
              && brand && getComputedStyle(brand).display === 'none'
              && tabsStyle && tabsStyle.display !== 'none'
              && tabsStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
              && tabsStyle.boxShadow === 'none'
              && parseFloat(tabsStyle.borderTopWidth) === 0
              && activeStyle && activeStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
              && activeStyle.boxShadow === 'none'
              && indicator && indicator.transform !== 'none'),
            railRight: railRect?.right || 0,
            drawerLeft: drawerRect?.left || 0,
            capabilityBrandDisplay: brand ? getComputedStyle(brand).display : '',
            tabGroupBackground: tabsStyle?.backgroundColor || '',
            tabGroupShadow: tabsStyle?.boxShadow || '',
            activeTabBackground: activeStyle?.backgroundColor || '',
            activeIndicatorTransform: indicator?.transform || '',
          }
        },
        file: 'capability-overlay-aligned.png',
      },
      {
        click: '[data-capability-hub-tab="skills"]',
        waitMs: 800,
        id: 'capability-flat-tab-switch',
        assert: () => {
          const skills = document.querySelector('[data-capability-hub-tab="skills"]')
          const experts = document.querySelector('[data-capability-hub-tab="experts"]')
          const indicator = skills ? getComputedStyle(skills, '::after') : null
          return {
            ok: Boolean(skills?.classList.contains('active')
              && skills?.getAttribute('aria-selected') === 'true'
              && !experts?.classList.contains('active')
              && indicator?.transform !== 'none'),
            skillsActive: skills?.classList.contains('active') || false,
            skillsSelected: skills?.getAttribute('aria-selected') || '',
            indicatorTransform: indicator?.transform || '',
          }
        },
        file: 'capability-flat-skills-tab.png',
      },
      {
        click: '#btnKnowledgeOs',
        waitMs: 800,
        id: 'knowledge-title-deduplicated',
        assert: () => {
          const title = document.getElementById('drawerTitle')
          const close = document.getElementById('drawerClose')
          const closeRect = close?.getBoundingClientRect()
          return {
            ok: Boolean(title && getComputedStyle(title).display === 'none'
              && close && getComputedStyle(close).display !== 'none'
              && closeRect && document.documentElement.clientWidth - closeRect.right < 24),
            drawerTitleDisplay: title ? getComputedStyle(title).display : '',
            closeRightGap: closeRect ? document.documentElement.clientWidth - closeRect.right : -1,
          }
        },
        file: 'knowledge-without-duplicate-title.png',
      },
      {
        click: '#btnSettings',
        waitMs: 800,
        id: 'settings-title-deduplicated',
        assert: () => {
          const title = document.getElementById('drawerTitle')
          const close = document.getElementById('drawerClose')
          const closeRect = close?.getBoundingClientRect()
          return {
            ok: Boolean(title && getComputedStyle(title).display === 'none'
              && close && getComputedStyle(close).display !== 'none'
              && closeRect && document.documentElement.clientWidth - closeRect.right < 24),
            drawerTitleDisplay: title ? getComputedStyle(title).display : '',
            closeRightGap: closeRect ? document.documentElement.clientWidth - closeRect.right : -1,
          }
        },
        file: 'settings-without-duplicate-title.png',
      },
    ])
    return
  }
  if (change === 'unify-knowledge-settings-tabs') {
    await capture(change, [
      {
        click: '#btnKnowledgeOs',
        waitMs: 1400,
        id: 'knowledge-browse-tabs',
        assert: () => {
          const tabs = [...document.querySelectorAll('[data-center-surface-kind="knowledge"]')]
          const active = tabs.find(tab => tab.classList.contains('active'))
          const group = document.getElementById('drawerSurfaceTabs')
          const style = group ? getComputedStyle(group) : null
          return {
            ok: tabs.map(tab => tab.textContent.trim()).join('|') === '浏览|知识源|知识体检'
              && active?.dataset.centerSurfaceTab === 'browse'
              && active?.getAttribute('aria-selected') === 'true'
              && style?.backgroundColor === 'rgba(0, 0, 0, 0)'
              && style?.boxShadow === 'none'
              && document.getElementById('drawerBody')?.getAttribute('role') === 'tabpanel',
            labels: tabs.map(tab => tab.textContent.trim()),
            active: active?.dataset.centerSurfaceTab || '',
            background: style?.backgroundColor || '',
          }
        },
        file: 'knowledge-browse-tabs.png',
      },
      {
        click: '[data-center-surface-kind="knowledge"][data-center-surface-tab="sources"]',
        waitMs: 1000,
        id: 'knowledge-sources-tab',
        assert: () => {
          const active = document.querySelector('[data-center-surface-kind="knowledge"].active')
          const providers = document.querySelectorAll('[data-knowledge-provider]')
          return {
            ok: active?.dataset.centerSurfaceTab === 'sources'
              && active?.getAttribute('aria-selected') === 'true'
              && providers.length > 0
              && !!document.getElementById('pageAddRemote')
              && !!document.getElementById('pageManageLocal'),
            active: active?.dataset.centerSurfaceTab || '',
            providers: providers.length,
          }
        },
        file: 'knowledge-sources-tab.png',
      },
      {
        click: '[data-center-surface-kind="knowledge"][data-center-surface-tab="health"]',
        waitMs: 1200,
        id: 'knowledge-health-tab',
        assert: () => {
          const active = document.querySelector('[data-center-surface-kind="knowledge"].active')
          const panel = document.querySelector('#kosReader .knowledge-panel')
          return {
            ok: active?.dataset.centerSurfaceTab === 'health'
              && active?.getAttribute('aria-selected') === 'true'
              && !!panel
              && (panel.textContent.includes('知识状态') || panel.textContent.includes('发现')),
            active: active?.dataset.centerSurfaceTab || '',
            panelText: panel?.textContent.trim().slice(0, 80) || '',
          }
        },
        file: 'knowledge-health-tab.png',
      },
      {
        click: '#btnSettings',
        waitMs: 1300,
        id: 'settings-shell-tabs',
        assert: () => {
          const tabs = [...document.querySelectorAll('[data-center-surface-kind="settings"]')]
          const active = tabs.find(tab => tab.classList.contains('active'))
          const frame = document.querySelector('.drawer-settings-frame')
          const innerTitle = frame?.contentDocument?.querySelector('.titlebar')
          return {
            ok: tabs.length === 7
              && tabs.map(tab => tab.textContent.trim()).join('|') === '内容源|AI 接口|助手模式|系统配置|连接器|我的记忆|关于'
              && active?.dataset.centerSurfaceTab === 'sources'
              && frame?.contentDocument?.documentElement.classList.contains('embedded-settings')
              && innerTitle && getComputedStyle(innerTitle).display === 'none',
            labels: tabs.map(tab => tab.textContent.trim()),
            active: active?.dataset.centerSurfaceTab || '',
            innerTitleDisplay: innerTitle ? getComputedStyle(innerTitle).display : '',
          }
        },
        file: 'settings-shell-tabs.png',
      },
      {
        click: '[data-center-surface-kind="settings"][data-center-surface-tab="assistant"]',
        waitMs: 1000,
        id: 'settings-tab-sync',
        assert: () => {
          const active = document.querySelector('[data-center-surface-kind="settings"].active')
          const frame = document.querySelector('.drawer-settings-frame')
          const innerActive = frame?.contentDocument?.querySelector('.tab.active')
          const panel = frame?.contentDocument?.getElementById('panel-assistant')
          return {
            ok: active?.dataset.centerSurfaceTab === 'assistant'
              && active?.getAttribute('aria-selected') === 'true'
              && innerActive?.dataset.tab === 'assistant'
              && panel?.classList.contains('active')
              && frame?.src.includes('tab=assistant'),
            outerActive: active?.dataset.centerSurfaceTab || '',
            innerActive: innerActive?.dataset.tab || '',
            src: frame?.src || '',
          }
        },
        file: 'settings-assistant-tab.png',
      },
      {
        resize: { width: 900, height: 650 },
        waitMs: 500,
        id: 'settings-tabs-minimum-width',
        assert: () => {
          const group = document.getElementById('drawerSurfaceTabs')
          const close = document.getElementById('drawerClose')
          const closeRect = close?.getBoundingClientRect()
          return {
            ok: !!group
              && getComputedStyle(group).overflowX === 'auto'
              && [...group.querySelectorAll('.drawer-surface-tab')].every(tab => getComputedStyle(tab).whiteSpace === 'nowrap')
              && closeRect && document.documentElement.clientWidth - closeRect.right < 24,
            clientWidth: group?.clientWidth || 0,
            scrollWidth: group?.scrollWidth || 0,
            closeRightGap: closeRect ? document.documentElement.clientWidth - closeRect.right : -1,
          }
        },
        file: 'settings-tabs-minimum.png',
      },
    ])
    return
  }
  console.error('Usage: node scripts/electron-rail-evidence.js <align-capability-hub-tabs|swap-automation-capability-rail-order|polish-workbench-navigation-shell|unify-knowledge-settings-tabs>')
  process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
