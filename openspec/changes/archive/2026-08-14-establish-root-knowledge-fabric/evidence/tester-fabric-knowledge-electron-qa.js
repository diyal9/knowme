'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'tester-fabric-knowledge-electron-qa.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.')",
    "}",
    '$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique',
    'if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }',
  ].join(' ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch { /* no process */ }
}

function seedWiki(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, { spaceSourceId: null, subDir: '' })
  const wikiDir = path.join(userDataDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(wikiDir, { recursive: true })
  fs.writeFileSync(
    path.join(wikiDir, 'ipc-guide.md'),
    '# Electron IPC\n\n主进程与渲染进程通过 IPC 通信。\n',
    'utf8'
  )
  fs.writeFileSync(
    path.join(wikiDir, 'notes-sync.md'),
    '# 便签同步\n\n桌面便签同步依赖 IPC 通道。\n',
    'utf8'
  )
  knowledgeOs.refreshIndex(userDataDir, {})
}

function seedConflictGraph(userDataDir) {
  const fabricDir = path.join(userDataDir, 'knowledge-os', 'fabric')
  fs.mkdirSync(fabricDir, { recursive: true })
  fs.writeFileSync(path.join(fabricDir, 'graph.json'), JSON.stringify({
    version: 1,
    nodes: [
      { id: 'c:old', kind: 'concept', title: '旧版 IPC 说明', summary: '旧版 IPC 说明', authority: 2, path: 'old-ipc.md', lastSynced: '2020-01-01T00:00:00.000Z' },
      { id: 'c:new', kind: 'concept', title: '新版 IPC 说明', summary: '新版 IPC 说明', authority: 4, path: 'new-ipc.md', lastSynced: '2026-01-01T00:00:00.000Z' },
    ],
    edges: [{ id: 'e:conflict', from: 'c:old', to: 'c:new', type: 'contradicts', weight: 0.9 }],
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8')
  fs.writeFileSync(path.join(fabricDir, 'routing.json'), JSON.stringify({
    version: 1, topics: {}, kbs: {}, updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8')
  fs.writeFileSync(path.join(fabricDir, 'weave-proposals.json'), JSON.stringify({
    version: 1, proposals: [], updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8')
}

async function openKnowledgeTab(window, tabLabel) {
  const drawerOpen = await window.evaluate(() => {
    const drawer = document.getElementById('drawer')
    return Boolean(drawer?.classList.contains('open') && document.querySelector('.drawer-surface-tab'))
  })
  if (!drawerOpen) {
    await window.locator('#btnKnowledgeOs').click()
    await window.waitForTimeout(1400)
  }
  const tab = window.locator('.drawer-surface-tab', { hasText: tabLabel })
  await tab.first().waitFor({ state: 'visible', timeout: 20000 })
  await tab.first().click()
  await window.waitForTimeout(900)
}

async function launchApp(userDataDir) {
  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      KNOWME_QMD: '0',
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userDataDir,
    },
    timeout: 120000,
  })
  const window = await app.firstWindow({ timeout: 90000 })
  const consoleErrors = []
  window.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning/i.test(text)) consoleErrors.push(text)
  })
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await window.waitForTimeout(1000)
  return { app, window, consoleErrors }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(r => setTimeout(r, 500))

  const checks = []

  // --- Phase 1: pristine empty user ---
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fabric-qa-empty-'))
  let app1
  try {
    const { app, window, consoleErrors } = await launchApp(emptyDir)
    app1 = app
    await window.setViewportSize({ width: 1280, height: 860 })
    await openKnowledgeTab(window, '织网')

    const emptyState = await window.evaluate(() => {
      const empty = document.querySelector('.knowledge-fabric-empty')
      const tabs = [...document.querySelectorAll('.drawer-surface-tab')].map(b => b.textContent?.trim())
      return {
        tabs,
        hasEmpty: Boolean(empty),
        hasConnectBtn: Boolean(document.getElementById('fabricEmptyConnect')),
        hasWeaveBtn: Boolean(document.getElementById('fabricEmptyWeave')),
        hasOpenRetrieve: Boolean(document.getElementById('fabricOpenRetrieve')),
        emptyCopy: empty?.textContent?.trim() || '',
        statsConcepts: document.querySelector('.fabric-stats strong')?.textContent || '',
      }
    })
    checks.push({
      id: 'empty-state-actionable-ctas',
      pass: emptyState.hasEmpty
        && emptyState.hasConnectBtn
        && emptyState.hasWeaveBtn
        && emptyState.hasOpenRetrieve
        && /连接资料|织网/.test(emptyState.emptyCopy),
      severity: 'blocking',
      detail: emptyState,
    })
    checks.push({
      id: 'regression-knowledge-tabs',
      pass: emptyState.tabs.some(t => t?.includes('状态'))
        && emptyState.tabs.some(t => t?.includes('连接'))
        && emptyState.tabs.some(t => t?.includes('织网'))
        && emptyState.tabs.some(t => t?.includes('检索')),
      severity: 'blocking',
      detail: { tabs: emptyState.tabs },
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-fabric-empty-state.png'), scale: 'css' })

    await openKnowledgeTab(window, '检索')
    const retrieveEmpty = await window.evaluate(() => ({
      placeholder: document.getElementById('fabricSearchQ')?.getAttribute('placeholder') || '',
      hasIngest: Boolean(document.getElementById('fabricIngestOpen')),
      emptyHint: document.querySelector('.knowledge-fabric-empty')?.textContent?.trim() || '',
    }))
    checks.push({
      id: 'retrieve-empty-guidance',
      pass: retrieveEmpty.hasIngest && /根优先|检索/.test(retrieveEmpty.emptyHint + retrieveEmpty.placeholder),
      severity: 'major',
      detail: retrieveEmpty,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-retrieve-empty.png'), scale: 'css' })

    // empty query toast (no crash)
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(400)
    const toastAfterEmpty = await window.evaluate(() => document.querySelector('.toast')?.textContent || '')
    checks.push({
      id: 'empty-query-no-crash',
      pass: /请输入|查询/.test(toastAfterEmpty),
      severity: 'minor',
      detail: { toast: toastAfterEmpty },
    })

    // special chars search
    await window.locator('#fabricSearchQ').fill('<script>alert(1)</script> 🧪')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1200)
    const specialSearch = await window.evaluate(() => ({
      hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
      routeText: document.getElementById('fabricRouteMeta')?.textContent || '',
    }))
    checks.push({
      id: 'special-chars-search-robust',
      pass: specialSearch.routeText.length > 0,
      severity: 'major',
      detail: specialSearch,
    })

    await window.setViewportSize({ width: 720, height: 640 })
    await openKnowledgeTab(window, '织网')
    const narrow = await window.evaluate(() => {
      const main = document.querySelector('.knowledge-fabric-page')
      const rect = main?.getBoundingClientRect()
      return {
        overflowX: main ? main.scrollWidth > main.clientWidth + 2 : false,
        withinViewport: rect ? rect.right <= window.innerWidth + 2 : false,
      }
    })
    checks.push({
      id: 'narrow-viewport-fabric',
      pass: narrow.withinViewport && narrow.overflowX === false,
      severity: 'minor',
      detail: narrow,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-fabric-narrow.png'), scale: 'css' })

    checks.push({
      id: 'console-clean-empty-session',
      pass: consoleErrors.length === 0,
      severity: 'blocking',
      detail: { consoleErrors },
    })
  } finally {
    if (app1) await app1.close().catch(() => {})
    try { fs.rmSync(emptyDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  // --- Phase 2: wiki + weave + search ---
  const richDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fabric-qa-rich-'))
  seedWiki(richDir)
  let app2
  try {
    const { app, window, consoleErrors } = await launchApp(richDir)
    app2 = app
    await window.setViewportSize({ width: 1280, height: 860 })
    await openKnowledgeTab(window, '检索')

    await window.locator('#fabricSearchQ').fill('IPC')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1600)
    const hitSearch = await window.evaluate(() => {
      const hit = document.querySelector('.knowledge-fabric-hit')
      return {
        hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
        hasKbTag: Boolean(document.querySelector('.knowledge-fabric-tag:not(.authority)')),
        hasAuthority: Boolean(document.querySelector('.knowledge-fabric-tag.authority')),
        routeText: document.getElementById('fabricRouteMeta')?.textContent || '',
        snippet: hit?.querySelector('p')?.textContent || '',
      }
    })
    checks.push({
      id: 'retrieve-hit-with-provenance',
      pass: hitSearch.hitCount >= 1
        && hitSearch.hasKbTag
        && hitSearch.hasAuthority
        && /路由：/.test(hitSearch.routeText)
        && /fallback|qmd/.test(hitSearch.routeText),
      severity: 'blocking',
      detail: hitSearch,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-retrieve-hit.png'), scale: 'css' })

    await window.locator('#fabricSearchQ').fill('xyznonexistentquery999')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1200)
    const noHit = await window.evaluate(() => ({
      hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
      emptyText: document.querySelector('[data-fabric-no-hit]')?.textContent?.trim()
        || document.querySelector('.knowledge-fabric-empty')?.textContent?.trim() || '',
      routeText: document.getElementById('fabricRouteMeta')?.textContent || '',
    }))
    checks.push({
      id: 'retrieve-no-result-guidance',
      pass: noHit.hitCount === 0 && /未找到相关知识/.test(noHit.emptyText),
      severity: 'major',
      detail: noHit,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-retrieve-no-hit.png'), scale: 'css' })

    // weave proposal loop
    await openKnowledgeTab(window, '织网')
    await window.locator('#fabricWeaveRun').click()
    let proposalPending = { pendingButtons: 0, rejectButtons: 0, proposalTitle: '' }
    try {
      await window.waitForFunction(
        () => document.querySelectorAll('[data-fabric-apply]').length >= 1,
        null,
        { timeout: 20000 }
      )
      proposalPending = await window.evaluate(() => ({
        pendingButtons: document.querySelectorAll('[data-fabric-apply]').length,
        rejectButtons: document.querySelectorAll('[data-fabric-reject]').length,
        proposalTitle: document.querySelector('.knowledge-fabric-proposal strong')?.textContent || '',
      }))
    } catch {
      proposalPending = await window.evaluate(() => ({
        pendingButtons: document.querySelectorAll('[data-fabric-apply]').length,
        rejectButtons: document.querySelectorAll('[data-fabric-reject]').length,
        proposalTitle: document.querySelector('.knowledge-fabric-proposal strong')?.textContent || '',
        emptyCopy: document.querySelector('.knowledge-fabric-empty')?.textContent || '',
      }))
    }
    checks.push({
      id: 'weave-generates-pending-proposal',
      pass: proposalPending.pendingButtons >= 1 && proposalPending.rejectButtons >= 1,
      severity: 'blocking',
      detail: proposalPending,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-weave-proposal-pending.png'), scale: 'css' })

    const conceptBefore = await window.evaluate(() => {
      const stats = [...document.querySelectorAll('.fabric-stats strong')].map(el => Number(el.textContent) || 0)
      return { concepts: stats[0] || 0, anchors: stats[1] || 0 }
    })

    if (proposalPending.pendingButtons >= 1) {
      await window.locator('[data-fabric-reject]').first().click()
      await window.waitForFunction(
        () => document.querySelectorAll('[data-fabric-apply]').length === 0,
        null,
        { timeout: 15000 }
      )
      await window.waitForTimeout(600)
    }
    const afterReject = await window.evaluate(() => ({
      pending: document.querySelectorAll('[data-fabric-apply]').length,
      stats: [...document.querySelectorAll('.fabric-stats strong')].map(el => Number(el.textContent) || 0),
    }))
    checks.push({
      id: 'weave-reject-no-write',
      pass: proposalPending.pendingButtons >= 1
        ? afterReject.pending === 0
          && afterReject.stats[0] === conceptBefore.concepts
          && afterReject.stats[1] === conceptBefore.anchors
        : false,
      severity: 'blocking',
      detail: { conceptBefore, afterReject, proposalPending },
    })

    // run again and apply
    await window.waitForFunction(
      () => {
        const b = document.getElementById('fabricWeaveRun')
        return b && !b.disabled && /织入当前库/.test(b.textContent || '')
      },
      null,
      { timeout: 15000 }
    )
    await window.locator('#fabricWeaveRun').click()
    let appliedOk = false
    try {
      await window.waitForFunction(
        () => document.querySelectorAll('[data-fabric-apply]').length >= 1,
        null,
        { timeout: 20000 }
      )
      await window.locator('[data-fabric-apply]').first().click()
      await window.waitForTimeout(1800)
      appliedOk = true
    } catch { /* apply step failed */ }
    const afterApply = await window.evaluate(() => ({
      pending: document.querySelectorAll('[data-fabric-apply]').length,
      stats: [...document.querySelectorAll('.fabric-stats strong')].map(el => Number(el.textContent) || 0),
      hasGraphSections: document.querySelectorAll('.knowledge-fabric-graph section').length,
    }))
    checks.push({
      id: 'weave-apply-increases-graph',
      pass: appliedOk
        && afterApply.pending === 0
        && (afterApply.stats[1] > conceptBefore.anchors || afterApply.hasGraphSections >= 1),
      severity: 'blocking',
      detail: { conceptBefore, afterApply, appliedOk },
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-weave-applied.png'), scale: 'css' })

    // ingest modal opens
    await openKnowledgeTab(window, '检索')
    await window.locator('#fabricIngestOpen').click()
    await window.waitForTimeout(600)
    const ingestModal = await window.evaluate(() => ({
      hasTitle: Boolean(document.getElementById('fabricIngestTitle')),
      hasBody: Boolean(document.getElementById('fabricIngestBody')),
      hasSave: Boolean(document.getElementById('fabricIngestSave')),
    }))
    checks.push({
      id: 'ingest-modal-accessible',
      pass: ingestModal.hasTitle && ingestModal.hasBody && ingestModal.hasSave,
      severity: 'major',
      detail: ingestModal,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-ingest-modal.png'), scale: 'css' })
    await window.keyboard.press('Escape')
    await window.waitForTimeout(400)

    checks.push({
      id: 'console-clean-rich-session',
      pass: consoleErrors.length === 0,
      severity: 'blocking',
      detail: { consoleErrors },
    })
  } finally {
    if (app2) await app2.close().catch(() => {})
    try { fs.rmSync(richDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  // --- Phase 3: conflict display ---
  const conflictDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-fabric-qa-conflict-'))
  seedConflictGraph(conflictDir)
  const wikiDir = path.join(conflictDir, 'knowledge-os', 'wiki')
  fs.mkdirSync(wikiDir, { recursive: true })
  fs.writeFileSync(path.join(wikiDir, 'old-ipc.md'), '# 旧版 IPC\n', 'utf8')
  fs.writeFileSync(path.join(wikiDir, 'new-ipc.md'), '# 新版 IPC\n', 'utf8')
  let app3
  try {
    const { app, window } = await launchApp(conflictDir)
    app3 = app
    await openKnowledgeTab(window, '检索')
    await window.locator('#fabricSearchQ').fill('IPC 说明')
    await window.locator('#fabricSearchRun').click()
    await window.waitForTimeout(1600)
    const conflictUi = await window.evaluate(() => ({
      conflictBlocks: document.querySelectorAll('.knowledge-fabric-conflict').length,
      conflictText: document.querySelector('.knowledge-fabric-conflict')?.textContent || '',
      hitCount: document.querySelectorAll('.knowledge-fabric-hit').length,
    }))
    checks.push({
      id: 'conflict-hint-visible',
      pass: conflictUi.conflictBlocks >= 1 && /新版|冲突|contradict/i.test(conflictUi.conflictText),
      severity: 'major',
      detail: conflictUi,
    })
    await window.screenshot({ path: path.join(SHOTS, 'tester-retrieve-conflict.png'), scale: 'css' })
  } finally {
    if (app3) await app3.close().catch(() => {})
    try { fs.rmSync(conflictDir, { recursive: true, force: true }) } catch { /* cleanup */ }
  }

  const passed = checks.filter(c => c.pass).length
  const blockingFails = checks.filter(c => !c.pass && c.severity === 'blocking')
  const report = {
    change: 'establish-root-knowledge-fabric',
    role: 'tester',
    at: new Date().toISOString(),
    passed,
    total: checks.length,
    ok: blockingFails.length === 0,
    blockingFails: blockingFails.map(c => c.id),
    checks,
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  if (blockingFails.length) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
