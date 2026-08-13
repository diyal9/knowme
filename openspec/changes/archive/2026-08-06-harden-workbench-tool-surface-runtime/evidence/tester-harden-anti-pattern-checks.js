'use strict'

/**
 * harden-workbench-tool-surface-runtime anti-pattern checks (AP1–AP15 subset)
 * Run: node openspec/changes/harden-workbench-tool-surface-runtime/evidence/tester-harden-anti-pattern-checks.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const agentFileTools = require('../../../../src/lib/agent-file-tools')
const browserMcp = require('../../../../src/lib/browser-mcp-adapter')
const toolRuntime = require('../../../../src/lib/connectors/tool-runtime')
const toolDraftsStore = require('../../../../src/lib/tool-drafts-store')
const fileBackup = require('../../../../src/lib/file-backup')
const sourcesLib = require('../../../../src/lib/sources')
const processTools = require('../../../../src/lib/agent-process-tools')
const orchestration = require('../../../../src/lib/agent-orchestration')
const registry = require('../../../../src/lib/tool-contract-registry')
const testSeam = require('../../../../src/lib/test-seam')
const builder = require('../../../../src/lib/tool-surface-builder')

const OUT = path.join(__dirname, 'tester-harden-anti-pattern-checks.json')
const checks = []

function record(id, ok, detail, level = 'blocking') {
  checks.push({ id, ok, level, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${detail}`)
}

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `knowme-harden-${label}-`))
}

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

async function main() {
  // AP1/AP2 CAS 连点 / 双批准
  {
    const userData = tmpDir('cas')
    toolDraftsStore.rememberDraft(userData, { id: 'd-cas', kind: 'file', action: 'write_file', status: 'pending_review', path: 'x.txt' })
    const first = toolDraftsStore.casBeginApply(userData, 'd-cas')
    const second = toolDraftsStore.casBeginApply(userData, 'd-cas')
    record('AP1/rapid-approve-once', first.ok && !second.ok, `second=${second.code}`)
    record('AP2/cross-window-not-pending', second.code === 'not_pending', second.code)
  }

  // AP3 拒绝无副作用
  {
    const root = tmpDir('reject')
    const userData = tmpDir('reject-ud')
    const target = path.join(root, 'keep.txt')
    fs.writeFileSync(target, 'original')
    const before = hashFile(target)
    const adapter = fileBackup.buildFileWriteAdapter(root, sourcesLib, { runId: 'qa', rootPath: root })
    adapter.rememberDraft = (d) => toolDraftsStore.rememberDraft(userData, { ...d, kind: 'file' })
    const { handlers } = agentFileTools.buildFileTools(adapter, { includeWrite: true })
    const r = await handlers.write_file({ path: 'keep.txt', content: 'hack' })
    const rej = await toolRuntime.approveToolDraft(userData, r.draftId, { reject: true })
    record('AP3/reject-no-write', hashFile(target) === before && rej.rejected, 'disk unchanged')
  }

  // AP4 cancel 子 Run
  {
    orchestration.runStateStore.map.clear()
    const state = new orchestration.OrchestrationState('parent')
    state.registerSubRun({ id: 'sub1', status: 'running' })
    let cancelled = false
    const r = state.cancelAll({ cancelSubRun: () => { cancelled = true } })
    record('AP4/cancel-subrun', cancelled && r.withinBudget, `elapsed=${r.elapsedMs}ms`)
  }

  // AP5/AP6 注入
  {
    const ps = processTools.screenStartProcessCommand('powershell', ['-Command', 'Write-Host x'])
    record('AP5/powershell-injection', !ps.ok, ps.text || ps.code)
    const ne = processTools.screenStartProcessCommand('node', ['-e', '1'])
    record('AP6/node-eval-injection', !ne.ok, ne.text || ne.code)
  }

  // AP7 内网硬拦截
  {
    const r = browserMcp.isDomainAllowed('http://192.168.0.1/admin')
    record('AP7/intranet-scope-denied', !r.ok && r.code === 'scope_denied', r.message)
  }

  // AP8 token 脱敏
  {
    const red = registry.redactSensitiveFields({ access_token: 't-secret', title: 'ok' })
    record('AP8/token-redaction', red.access_token === '[REDACTED]' && red.title === 'ok', 'masked')
  }

  // AP9 move 回滚
  {
    const root = tmpDir('mv')
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src', 'a.txt'), 'A')
    fileBackup.backupMovePaths(root, 'run-mv', 'src/a.txt', 'src/b.txt', (rel) => {
      const abs = path.join(root, rel)
      return fs.existsSync(abs) ? { ok: true, content: fs.readFileSync(abs, 'utf8') } : { ok: false }
    })
    fs.renameSync(path.join(root, 'src/a.txt'), path.join(root, 'src/b.txt'))
    const rb = fileBackup.rollbackMove(root, 'run-mv', 'src/a.txt', 'src/b.txt')
    record('AP9/move-rollback', rb.ok && fs.existsSync(path.join(root, 'src/a.txt')), rb.text)
  }

  // AP10 mkdir 认知
  {
    const root = tmpDir('mkdir')
    fs.mkdirSync(path.join(root, 'parent'), { recursive: true })
    const adapter = {
      rootPath: root,
      mkdir: async (rel) => { fs.mkdirSync(path.join(root, rel), { recursive: true }); return { ok: true } },
      statPath: async () => ({ exists: false }),
      rememberDraft: (d) => d,
    }
    const { handlers } = agentFileTools.buildFileTools(adapter)
    const r = await handlers.mkdir({ path: 'parent/child' })
    record('AP10/mkdir-low-risk-label', /低风险直建/.test(r.text || ''), r.text)
  }

  // AP11/AP12 store 上限
  {
    const store = require('../../../../src/lib/runtime-store').createEvictingMap({ maxEntries: 2, ttlMs: 99999999 })
    store.set('a', { status: 'done' })
    store.set('b', { status: 'done' })
    store.set('c', { status: 'done' })
    record('AP11/store-lru-cap', store.map.size <= 2, `size=${store.map.size}`)
    const miss = processTools.lookupProcessEntry('never-existed-task')
    record('AP12/old-id-friendly', !miss.ok && miss.code === 'not_found', miss.text)
  }

  // AP15 legacy 回退
  {
    const prev = process.env.KNOWME_TOOL_SURFACE
    process.env.KNOWME_TOOL_SURFACE = 'legacy'
    const filtered = builder.filterLegacyExtraTools({
      definitions: [
        { function: { name: 'write_file' } },
        { function: { name: 'read_file' } },
      ],
      handlers: {},
    })
    record('AP15/legacy-no-write', !filtered.definitions.some((d) => d.function.name === 'write_file'), 'filtered')
    if (prev == null) delete process.env.KNOWME_TOOL_SURFACE
    else process.env.KNOWME_TOOL_SURFACE = prev
  }

  // AP14 IPC roundtrip (logic)
  record('AP14/approve-ipc-handler', typeof toolRuntime.approveToolDraft === 'function', 'exported')

  // AP13 Hub 点击流（静态）
  const hubJs = fs.readFileSync(path.join(__dirname, '../../../../src/capability-hub.js'), 'utf8')
  record('AP13/hub-playwright-link', hubJs.includes('data-hub-open-url') && hubJs.includes('@playwright/mcp'), 'click handler', 'advisory')

  // M2 seam strip
  const stripped = testSeam.stripTestKeysFromPayload({ draftId: 'x', fakeApply: true })
  record('M2/strip-fakeApply', stripped.fakeApply === undefined, 'stripped')

  const summary = {
    change: 'harden-workbench-tool-surface-runtime',
    at: new Date().toISOString(),
    total: checks.length,
    pass: checks.filter((c) => c.ok).length,
    fail: checks.filter((c) => !c.ok).length,
    checks,
  }
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`\nWrote ${OUT} (${summary.pass}/${summary.total} pass)`)
  process.exit(summary.fail ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
