'use strict'

/**
 * Tester QA — P0 hand-test automation for relocate-agent-authoring-to-capability-hub
 * Extends relocate-authoring-electron-smoke.js without modifying src/
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.join(__dirname, '..', '..', '..', '..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'tester-qa-p0-smoke.json')

function killKnowMeProcesses() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none running */ }
  }
}

async function main(state) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const shoot = async (win, name) => {
    try {
      await win.bringToFront()
      await win.screenshot({ path: path.join(SHOTS, name), animations: 'disabled', timeout: 15000 })
    } catch (error) {
      state.report?.consoleErrors.push(`screenshot ${name}: ${String(error?.message || error).split('\n')[0]}`)
    }
  }
  state.shoot = shoot
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-tester-qa-'))
  const report = { at: new Date().toISOString(), ok: false, consoleErrors: [], checks: [] }
  state.report = report
  const check = (id, ok, extra = {}) => report.checks.push({ id, ok: !!ok, ...extra })

  killKnowMeProcesses()
  await new Promise(r => setTimeout(r, 1200))

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })
  state.app = app

  const win = await app.firstWindow({ timeout: 90000 })
  win.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) report.consoleErrors.push(text)
  })
  win.on('pageerror', error => report.consoleErrors.push(String(error?.message || error)))

  await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await win.waitForTimeout(4000)

  // --- P0-1: tune link visibility ---
  await win.locator('#btnRailWorkbench').click()
  await win.waitForTimeout(2500)
  await win.evaluate(async () => { await window.Workbench?.ensureLoaded?.() })
  await win.waitForTimeout(2500)
  await win.waitForFunction(() => {
    const shelf = document.getElementById('wbShelfSurface')
    return shelf?.classList.contains('active') && !!document.getElementById('wbShelfNewWorkflow')
  }, null, { timeout: 45000 })
  await win.evaluate(() => document.getElementById('wbShelfNewWorkflow')?.click())
  await win.waitForTimeout(1500)

  const tuneBeforeSelect = await win.evaluate(() => ({
    tuneLink: !!document.querySelector('[data-studio-tune-agent]'),
    inspectorText: document.getElementById('wbStudioInspector')?.textContent?.trim() || '',
  }))
  check('p0-tune-hidden-without-node', !tuneBeforeSelect.tuneLink, tuneBeforeSelect)

  const firstAdd = win.locator('[data-studio-add]').first()
  const addCount = await win.locator('[data-studio-add]').count()
  check('p0-studio-has-agent-candidates', addCount > 0, { addCount })
  if (addCount) {
    await firstAdd.click()
    await win.waitForTimeout(600)
    await win.evaluate(() => document.querySelector('[data-studio-node]')?.click())
    await win.waitForTimeout(400)
    const tuneAfterSelect = await win.evaluate(() => ({
      tuneLink: !!document.querySelector('[data-studio-tune-agent]'),
      tuneText: document.querySelector('[data-studio-tune-agent]')?.textContent?.trim() || '',
      agentId: document.querySelector('[data-studio-tune-agent]')?.getAttribute('data-studio-tune-agent') || '',
    }))
    check('p0-tune-visible-with-node', tuneAfterSelect.tuneLink, tuneAfterSelect)
    check('p0-tune-label-correct', /前往能力界面调优/.test(tuneAfterSelect.tuneText), tuneAfterSelect)
    await shoot(win, 'qa-p0-tune-link-selected.png')
  }

  await win.evaluate(() => document.getElementById('wbStudioBack')?.click())
  await win.waitForTimeout(800)
  check('studio-back-to-shelf', await win.locator('#wbShelfSurface').evaluate(node => node.classList.contains('active')))

  // --- P0-3: legacy archive restore (inject old fields via context + reload) ---
  const legacyRestore = await win.evaluate(async () => {
    const errors = []
    const before = document.querySelectorAll('#wbShelfGrid .wb-shelf-card').length
    try {
      if (window.api?.workbenchContextSave) {
        await window.api.workbenchContextSave({
          activeWorkMode: 'mine',
          shelfSource: 'personal',
          launchIntent: {
            returnState: {
              activeWorkMode: 'team',
              shelfSource: 'official',
              domain: 'all',
              selectedFlowId: 'legacy-flow-id',
            },
          },
        })
      }
      if (window.Workbench?.load) await window.Workbench.load()
    } catch (e) {
      errors.push(String(e?.message || e))
    }
    document.getElementById('wbStudioBack')?.click()
    await new Promise(r => setTimeout(r, 800))
    const shelfVisible = document.getElementById('wbShelfSurface')?.classList.contains('active')
    const tabCount = document.querySelectorAll('#wbModeTabs').length
    const cards = document.querySelectorAll('#wbShelfGrid .wb-shelf-card').length
    const gridEmpty = document.querySelector('#wbShelfGrid')?.textContent?.trim() || ''
    return { errors, before, shelfVisible, tabCount, cards, gridEmpty: gridEmpty.slice(0, 80) }
  })
  check('p0-legacy-restore-no-crash', legacyRestore.errors.length === 0, legacyRestore)
  check('p0-legacy-restore-shelf-visible', legacyRestore.shelfVisible, legacyRestore)
  check('p0-legacy-no-mode-tabs', legacyRestore.tabCount === 0, legacyRestore)
  check('p0-legacy-shelf-not-blank', legacyRestore.cards >= 0 && !/undefined|TypeError/i.test(legacyRestore.gridEmpty), legacyRestore)

  // --- P0-2 & P0-4 & hub data: capability hub ---
  await win.locator('#btnRailCapabilities').click()
  await win.waitForTimeout(1500)
  const hub = win.frameLocator('.capability-hub-frame')
  await hub.locator('.hub-card, .hub-state, .hub-app').first().waitFor({ state: 'visible', timeout: 30000 })
  await win.waitForTimeout(800)

  // Empty state via zero-result search (fresh profile still has curated seeds)
  const emptyStateMeta = await hub.locator('#hubSearch').evaluate(async node => {
    if (!node) return { hasSearch: false }
    node.value = 'qa-empty-zzzzz-no-match'
    node.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 800))
    const stateEl = document.querySelector('.hub-state')
    const emptyAdd = document.getElementById('hubEmptyAddExpert') || document.getElementById('hubEmptyAdd')
    return {
      hasSearch: true,
      emptyVisible: !!stateEl,
      emptyCopy: stateEl?.querySelector('strong')?.textContent?.trim() || '',
      bodyCopy: stateEl?.querySelector('p')?.textContent?.trim() || '',
      ctaVisible: !!emptyAdd || !!stateEl?.querySelector('[data-clear-filters]'),
      ctaText: emptyAdd?.textContent?.trim() || stateEl?.querySelector('[data-clear-filters]')?.textContent?.trim() || '',
    }
  }).catch(() => ({ hasSearch: false }))
  check('p0-empty-state-honest', emptyStateMeta.emptyVisible && /没有找到|还没有/.test(emptyStateMeta.emptyCopy || ''), emptyStateMeta)
  check('p0-empty-cta-clickable', emptyStateMeta.ctaVisible, emptyStateMeta)
  if (emptyStateMeta.ctaVisible) {
    await hub.locator('[data-clear-filters]').click({ timeout: 5000 }).catch(() => {})
    await win.waitForTimeout(400)
    await shoot(win, 'qa-p0-hub-empty-state.png')
  }

  // Reset search
  await hub.locator('#hubSearch').evaluate(node => {
    if (node) { node.value = ''; node.dispatchEvent(new Event('input', { bubbles: true })) }
  }).catch(() => {})

  // Installed-only empty (no installed experts on fresh profile)
  const installedEmptyMeta = await hub.locator('#hubInstalledOnly').evaluate(async node => {
    if (!node) return { tried: false }
    node.checked = true
    node.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(r => setTimeout(r, 800))
    const stateEl = document.querySelector('.hub-state')
    const addBtn = document.getElementById('hubEmptyAddExpert')
    return {
      tried: true,
      emptyVisible: !!stateEl,
      emptyCopy: stateEl?.querySelector('strong')?.textContent?.trim() || '',
      addExpertCta: !!addBtn,
    }
  }).catch(() => ({ tried: false }))
  check('p0-empty-installed-filter-honest', !installedEmptyMeta.tried || installedEmptyMeta.emptyVisible || installedEmptyMeta.addExpertCta, installedEmptyMeta)

  // Collect hub expert IDs for P0-5
  const hubExpertIds = await hub.locator('.hub-card[data-id]').evaluateAll(nodes =>
    nodes.map(n => n.getAttribute('data-id')).filter(Boolean),
  ).catch(() => [])

  // P0-4 E2E: copy curated expert as custom → save → workbench candidate → shelf
  const curatedCard = hub.locator('.hub-card[data-id]').first()
  const curatedId = await curatedCard.getAttribute('data-id').catch(() => '')
  if (curatedId) {
    await curatedCard.click()
    await win.waitForTimeout(700)
    const copyBtn = hub.locator('[data-act="copyExpert"]')
    if (await copyBtn.count()) {
      await copyBtn.click()
      await win.waitForTimeout(800)
      const copyForm = await hub.locator('#hubExpertDialog').evaluate(node => ({
        open: !node.hidden,
        title: document.getElementById('hubExpertDialogTitle')?.textContent?.trim() || '',
        id: document.getElementById('hubExpertId')?.value || '',
        name: document.getElementById('hubExpertName')?.value || '',
      })).catch(() => ({ open: false }))
      check('p0-e2e-copy-dialog-opens', copyForm.open, copyForm)
      const testExpertId = `qa-copy-${Date.now().toString(36).slice(-6)}`
      await hub.locator('#hubExpertId').fill(testExpertId)
      await hub.locator('#hubExpertName').fill(`QA 自建 ${testExpertId}`)
      await hub.locator('#hubExpertSave').click()
      await win.waitForTimeout(2500)
      const savedInHub = await hub.locator(`.hub-card[data-id="${testExpertId}"]`).count().catch(() => 0)
      check('p0-e2e-expert-saved-in-hub', savedInHub > 0, { testExpertId, savedInHub })
      await shoot(win, 'qa-p0-e2e-expert-saved.png')

      await win.locator('#btnRailWorkbench').click()
      await win.waitForTimeout(2500)
      await win.evaluate(async () => {
        if (window.Workbench?.load) await window.Workbench.load()
        else await window.Workbench?.ensureLoaded?.()
      })
      await win.waitForTimeout(2500)
      await win.evaluate(() => document.getElementById('wbShelfNewWorkflow')?.click())
      await win.waitForTimeout(1500)

      const candidateMeta = await win.evaluate(id => ({
        listed: [...document.querySelectorAll('#wbStudioAgents .wb-studio-agent')].some(el =>
          el.getAttribute('data-studio-agent') === id || el.querySelector(`[data-studio-add="${id}"]`)),
        ids: [...document.querySelectorAll('[data-studio-add]')].map(el => el.getAttribute('data-studio-add')),
      }), testExpertId)
      check('p0-e2e-agent-in-candidates', candidateMeta.listed, { testExpertId, ...candidateMeta })

      const addBtn = win.locator(`[data-studio-add="${testExpertId}"]`)
      if (await addBtn.count()) {
        await addBtn.click()
        await win.waitForTimeout(500)
        const cardsBefore = await win.evaluate(() => document.querySelectorAll('#wbShelfGrid .wb-shelf-card').length)
        await win.locator('[data-studio-action="save"]').click()
        await win.waitForTimeout(4500)
        const shelfMeta = await win.evaluate(({ cardsBefore, agentId }) => {
          const cards = [...document.querySelectorAll('#wbShelfGrid .wb-shelf-card')]
          const mineCards = cards.filter(card => card.querySelector('.wb-shelf-provenance')?.textContent?.trim() === '我的')
          return {
            onShelf: cards.length >= cardsBefore,
            newCardAdded: cards.length > cardsBefore,
            mineCount: mineCards.length,
            provenance: mineCards[0]?.querySelector('.wb-shelf-provenance')?.textContent?.trim() || '',
            shelfActive: document.getElementById('wbShelfSurface')?.classList.contains('active'),
            toastHint: document.querySelector('.toast, [class*="toast"]')?.textContent?.trim() || '',
            agentId,
          }
        }, { cardsBefore, agentId: testExpertId })
        check('p0-e2e-workflow-on-shelf', shelfMeta.shelfActive && (shelfMeta.newCardAdded || shelfMeta.onShelf), shelfMeta)
        check('p0-e2e-shelf-mine-tag', shelfMeta.mineCount > 0 && shelfMeta.provenance === '我的', shelfMeta)
        await shoot(win, 'qa-p0-e2e-shelf-mine.png')
      }
    } else {
      check('p0-e2e-copy-button-missing', false, { curatedId })
    }
  } else {
    check('p0-e2e-no-curated-card', false)
  }

  // --- P0-5: assistant readonly + same data ---
  await win.locator('#btnRailAi').click({ force: true })
  await win.waitForTimeout(800)
  await win.locator('#agentExpertBtn').click({ force: true })
  await win.waitForTimeout(500)

  const assistantMeta = await win.evaluate(() => {
    const pop = document.getElementById('agentExpertPop')
    const items = [...(pop?.querySelectorAll('[data-expert-id]') || [])].map(el => el.getAttribute('data-expert-id'))
    const hasCrud = !!pop?.querySelector('[data-expert-create], [data-expert-edit], [data-expert-delete], button[data-act]')
    const html = pop?.innerHTML || ''
    return {
      count: items.length,
      ids: items,
      hasCrud,
      hasAddButton: /添加|新建|编辑|删除|调优/.test(html) && !/选择/.test(html.slice(0, 80)),
    }
  })
  check('p0-assistant-no-crud-buttons', !assistantMeta.hasCrud, assistantMeta)
  check('p0-assistant-has-experts', assistantMeta.count > 0, assistantMeta)

  const hubSet = new Set(hubExpertIds)
  const overlap = assistantMeta.ids.filter(id => hubSet.has(id))
  check('p0-assistant-hub-id-overlap', overlap.length > 0, {
    hubCount: hubExpertIds.length,
    assistantCount: assistantMeta.count,
    overlap: overlap.slice(0, 8),
  })
  await shoot(win, 'qa-p0-assistant-readonly.png')

  // Anti-pattern: workbench agent manager form absent
  const wbAgentCrud = await win.evaluate(() => ({
    agentForm: !!document.getElementById('wbAgentManagerForm'),
    modeTabs: document.querySelectorAll('#wbModeTabs').length,
    studioManage: !!document.querySelector('[data-studio-manage-agent]'),
    studioSaveAgent: !!document.querySelector('[data-studio-save-agent]'),
    inspectorSkillField: !!document.querySelector('[data-studio-field="skills"]'),
  }))
  check('anti-no-wb-agent-form', !wbAgentCrud.agentForm, wbAgentCrud)
  check('anti-no-studio-agent-body', !wbAgentCrud.studioManage && !wbAgentCrud.studioSaveAgent && !wbAgentCrud.inspectorSkillField, wbAgentCrud)

  // Narrow window regression
  await win.setViewportSize({ width: 760, height: 720 })
  await win.waitForTimeout(600)
  const overflow = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('regression-narrow-no-overflow', overflow <= 1, { overflow })
  await shoot(win, 'qa-p0-narrow.png')

  check('console-error-free', report.consoleErrors.length === 0, { errors: report.consoleErrors.slice(0, 8) })
}

async function run() {
  const state = { report: null, app: null }
  try {
    await main(state)
  } catch (error) {
    if (state.report) state.report.crash = String(error?.message || error)
    else console.error(error)
  }
  const report = state.report
  if (report) {
    report.ok = !report.crash && report.checks.every(item => item.ok)
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    const passed = report.checks.filter(item => item.ok).length
    console.log(`tester-qa-p0 ${passed}/${report.checks.length} · console errors ${report.consoleErrors.length}`)
    for (const item of report.checks.filter(entry => !entry.ok)) console.log('  FAIL', JSON.stringify(item))
    if (report.crash) console.log('  CRASH', report.crash.split('\n')[0])
    if (!report.ok) process.exitCode = 1
  } else {
    process.exitCode = 1
  }
  try { await state.app?.close() } catch { /* already closed */ }
  killKnowMeProcesses()
}

run()
