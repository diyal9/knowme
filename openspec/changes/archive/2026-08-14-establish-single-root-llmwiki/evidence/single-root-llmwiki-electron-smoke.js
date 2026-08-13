'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const SHOTS = path.join(__dirname, 'screenshots')
const REPORT = path.join(__dirname, 'single-root-llmwiki-electron-smoke.json')

function stopKnowMeDevProcesses() {
  if (process.platform !== 'win32') return
  const script = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -match 'KnowMe(\\.exe)?|electron(\\.exe)?') -and",
    "($_.CommandLine -match 'knowme|electron \\.' )",
    '}',
    '$ids = $targets | Select-Object -ExpandProperty ProcessId -Unique',
    'if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }',
  ].join(' ')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch { /* no process */ }
}

function seedRoot(userDataDir) {
  const knowledgeOs = require(path.join(ROOT, 'src/lib/knowledge-os'))
  knowledgeOs.ensureDirs(userDataDir)
  knowledgeOs.saveConfig(userDataDir, {
    spaceSourceId: null,
    subDir: '',
    wikiRootOverride: null,
    activeProviderId: 'local-default',
  })
  const ingested = knowledgeOs.ingest(userDataDir, {
    title: '项目约定',
    text: '发布前必须完成回归检查。初始检索词 smoke-alpha。',
  })
  if (!ingested.ok) throw new Error(ingested.error || 'fixture ingest failed')
  const wikiRoot = knowledgeOs.defaultPaths(userDataDir).wiki
  const nestedDir = path.join(wikiRoot, 'raw', '研发')
  fs.mkdirSync(nestedDir, { recursive: true })
  fs.writeFileSync(path.join(nestedDir, '发布规范.md'), '# 发布规范\n\n使用灰度发布。\n', 'utf8')
  knowledgeOs.refreshIndex(userDataDir)
  return ingested.created[0].path
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  stopKnowMeDevProcesses()
  await new Promise(resolve => setTimeout(resolve, 600))

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-root-wiki-smoke-'))
  const seededPath = seedRoot(userDataDir)
  const checks = []
  const consoleErrors = []
  const pageErrors = []
  let app

  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: ['.'],
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
    window.on('pageerror', error => pageErrors.push(String(error?.message || error)))

    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(1000)
    await window.locator('#btnKnowledgeOs').click()
    await window.locator('.knowledge-home').waitFor({ state: 'visible', timeout: 15000 })

    const home = await window.evaluate(() => ({
      railLabel: document.querySelector('#btnKnowledgeOs .rail-label')?.textContent?.trim(),
      drawerTitle: document.getElementById('drawerTitle')?.textContent?.trim(),
      tabs: [...document.querySelectorAll('.drawer-surface-tab')].map(item => item.textContent.trim()),
      bodyText: document.getElementById('drawerBody')?.textContent || '',
      hasSearch: !!document.getElementById('knowledgeHomeSearchInput'),
      hasAdd: !!document.getElementById('statusAddMaterial'),
      hasRootIndex: !!document.querySelector('.knowledge-index-tree'),
      indexText: document.querySelector('.knowledge-index-tree')?.textContent || '',
      directories: [...document.querySelectorAll('.knowledge-index-directory > summary strong')]
        .map(item => item.textContent.trim()),
      openDirectories: document.querySelectorAll('.knowledge-index-directory[open]').length,
      hasProcessMap: !!document.querySelector('.knowledge-root-map'),
      rootReady: (document.querySelector('.knowledge-root-health')?.textContent || '').includes('资料空间正常'),
    }))
    checks.push({
      id: 'single-root-home',
      pass:
        home.railLabel === '知识网' &&
        home.drawerTitle === '我的知识' &&
        JSON.stringify(home.tabs) === JSON.stringify(['我的知识', '待我确认', '来源']) &&
        home.hasSearch &&
        home.hasAdd &&
        home.hasRootIndex &&
        home.directories.includes('资料') &&
        home.directories.includes('研发') &&
        home.directories.includes('已整理知识') &&
        home.openDirectories >= 3 &&
        !home.hasProcessMap &&
        home.rootReady,
      detail: { ...home, bodyText: undefined },
    })
    checks.push({
      id: 'primary-copy-hides-internals',
      pass: !/Fabric|SSOT|authority|qmd|锚点|重织|OKF/.test(home.bodyText),
      detail: { forbiddenMatch: home.bodyText.match(/Fabric|SSOT|authority|qmd|锚点|重织|OKF/)?.[0] || null },
    })
    await window.screenshot({
      path: path.join(SHOTS, 'single-root-knowledge-home.png'),
      scale: 'css',
    })

    await window.locator('#statusBrowse').click()
    const rawRow = window.locator(`[data-path="${seededPath}"]`)
    await rawRow.waitFor({ state: 'visible', timeout: 15000 })
    await rawRow.click()
    await window.locator('#kosRawEditor').waitFor({ state: 'visible', timeout: 15000 })
    const editor = window.locator('#kosRawEditor')
    await editor.fill('# 项目约定\n\n发布前必须完成回归检查。更新检索词 smoke-beta。\n')
    checks.push({
      id: 'raw-editor-dirty-state',
      pass:
        await window.locator('#kosRawSave').isEnabled() &&
        (await window.locator('#kosRawSaveState').textContent()).includes('未保存'),
    })
    await window.locator('#kosRawSave').click()
    await window.waitForFunction(() => {
      const text = document.getElementById('kosRawSaveState')?.textContent || ''
      return text.includes('已安全保存')
    }, null, { timeout: 15000 })
    const saved = await window.evaluate(async filePath => window.api.knowledgeOsRead({
      kind: 'wiki',
      path: filePath,
    }), seededPath)
    checks.push({
      id: 'raw-editor-save-roundtrip',
      pass: saved?.ok && saved.editable === true && saved.content.includes('smoke-beta') && !saved.content.includes('smoke-alpha'),
      detail: { ok: saved?.ok, editable: saved?.editable, path: saved?.path },
    })
    await window.screenshot({
      path: path.join(SHOTS, 'raw-visual-editor.png'),
      scale: 'css',
    })

    await window.locator('.drawer-surface-tab', { hasText: '我的知识' }).click()
    await window.locator('#knowledgeHomeSearchInput').fill('smoke-beta')
    await window.locator('#knowledgeHomeSearch').evaluate(form => form.requestSubmit())
    await window.locator('[data-home-knowledge-path]').waitFor({ state: 'visible', timeout: 15000 })
    const searchHit = await window.locator('[data-home-knowledge-path]').first().getAttribute('data-home-knowledge-path')
    checks.push({
      id: 'saved-content-searchable',
      pass: searchHit === seededPath,
      detail: { expected: seededPath, actual: searchHit },
    })

    checks.push({
      id: 'no-renderer-errors',
      pass: consoleErrors.length === 0 && pageErrors.length === 0,
      detail: { consoleErrors, pageErrors },
    })
  } finally {
    if (app) await app.close().catch(() => {})
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch { /* cleanup */ }
  }

  const passed = checks.filter(check => check.pass).length
  const report = {
    change: 'establish-single-root-llmwiki',
    at: new Date().toISOString(),
    ok: passed === checks.length,
    passed,
    total: checks.length,
    checks,
  }
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
