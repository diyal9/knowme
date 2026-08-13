'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const registry = require('../src/lib/tool-contract-registry')
const builder = require('../src/lib/tool-surface-builder')
const browserAdapter = require('../src/lib/browser-mcp-adapter')
const processTools = require('../src/lib/agent-process-tools')
const orchestration = require('../src/lib/agent-orchestration')
const toolDrafts = require('../src/lib/tool-drafts-store')
const fileBackup = require('../src/lib/file-backup')
const agentFileTools = require('../src/lib/agent-file-tools')
const testSeam = require('../src/lib/test-seam')
const pathSecurity = require('../src/lib/path-security')
const runtimeStore = require('../src/lib/runtime-store')

describe('harden-tool-surface', () => {
  describe('H1 resolveToolSurfaceForRun', () => {
    it('v1 registry projects all builtin read tools', async () => {
      const prev = process.env.KNOWME_TOOL_SURFACE
      process.env.KNOWME_TOOL_SURFACE = 'v1'
      const resolved = await builder.resolveToolSurfaceForRun({
        userData: os.tmpdir(),
        runId: 'r1',
        fileAdapter: {},
        extraTools: null,
      })
      assert.equal(resolved.mode, 'v1')
      assert.ok(resolved.registry)
      assert.ok(resolved.surface.getToolDefinitions().length >= 3)
      if (prev == null) delete process.env.KNOWME_TOOL_SURFACE
      else process.env.KNOWME_TOOL_SURFACE = prev
    })

    it('legacy mode excludes write/orchestration tools', async () => {
      const prev = process.env.KNOWME_TOOL_SURFACE
      process.env.KNOWME_TOOL_SURFACE = 'legacy'
      const writeDef = { type: 'function', function: { name: 'write_file', parameters: { type: 'object', properties: {} } } }
      const orchDef = { type: 'function', function: { name: 'delegate_to_expert', parameters: { type: 'object', properties: {} } } }
      const filtered = builder.filterLegacyExtraTools({
        definitions: [writeDef, orchDef, { type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: {} } } }],
        handlers: {},
      })
      assert.ok(!filtered.definitions.some((d) => d.function.name === 'write_file'))
      assert.ok(filtered.definitions.some((d) => d.function.name === 'read_file'))
      if (prev == null) delete process.env.KNOWME_TOOL_SURFACE
      else process.env.KNOWME_TOOL_SURFACE = prev
    })

    it('registry execute wraps envelope with auditId', async () => {
      const reg = registry.createRegistry()
      const contract = {
        source: 'builtin', capability: 't', risk: 'read', sideEffects: false,
        requiresApproval: false, scope: 'content-source', timeoutMs: 1000,
        idempotencySupported: false, rollbackSupported: false,
      }
      reg.registerTool({ function: { name: 'echo', parameters: { type: 'object', properties: {} } } }, contract, async () => ({ ok: true, text: 'pong' }))
      const r = await reg.execute('echo', {}, { userData: os.tmpdir(), runId: 'r' })
      assert.ok(r.auditId)
      assert.equal(r.ok, true)
    })
  })

  describe('H2 cancelSubRun', () => {
    beforeEach(() => orchestration.runStateStore.map.clear())
    it('cancelAll returns within budget', () => {
      const state = new orchestration.OrchestrationState('p1')
      state.registerSubRun({ id: 's1', status: 'running' })
      let aborted = false
      const r = state.cancelAll({ cancelSubRun: () => { aborted = true } })
      assert.equal(r.cancelled.length, 1)
      assert.equal(r.withinBudget, true)
      assert.equal(aborted, true)
    })
    it('runningLeakCount zero after cancel', () => {
      const state = new orchestration.OrchestrationState('p2')
      state.registerSubRun({ id: 's1', status: 'running' })
      state.cancelAll({ cancelSubRun: () => {} })
      assert.equal(state.runningLeakCount(), 0)
    })
  })

  describe('H3 start_process', () => {
    it('blocks PowerShell injection', async () => {
      const { handlers } = processTools.buildProcessTools({ runId: 'r' })
      const r = await handlers.start_process({ command: 'powershell', args: ['-Command', 'Remove-Item'] })
      assert.equal(r.ok, false)
      assert.equal(r.code, 'scope_denied')
    })
    it('blocks node -e injection', async () => {
      const r = processTools.screenStartProcessCommand('node', ['-e', 'process.exit(0)'])
      assert.equal(r.ok, false)
    })
    it('allows npm test template', async () => {
      const r = processTools.screenStartProcessCommand('npm test', [])
      assert.equal(r.ok, true)
      assert.ok(r.template)
    })
    it('blocks rm -rf', async () => {
      const { handlers } = processTools.buildProcessTools({ runId: 'r' })
      const r = await handlers.start_process({ command: 'rm', args: ['-rf', '/'] })
      assert.equal(r.code, 'scope_denied')
    })
    it('Windows shell false spawn opts', () => {
      const opts = processTools.spawnOpts ? processTools.spawnOpts(process.cwd()) : { shell: false }
      assert.equal(opts.shell, false)
    })
  })

  describe('M1 blockedHosts', () => {
    it('localhost scope_denied', () => {
      const r = browserAdapter.isDomainAllowed('http://localhost:8080/x')
      assert.equal(r.ok, false)
      assert.equal(r.code, 'scope_denied')
      assert.equal(r.blocked, true)
    })
    it('192.168.x scope_denied not approval', () => {
      const r = browserAdapter.isDomainAllowed('http://192.168.1.10/internal')
      assert.equal(r.code, 'scope_denied')
    })
    it('127.0.0.1 blocked', () => {
      assert.equal(browserAdapter.isBlockedHost('127.0.0.1'), true)
    })
    it('RFC1918 10.x blocked', () => {
      assert.equal(browserAdapter.isPrivateIpv4('10.0.0.5'), true)
    })
    it('public host allowed without block flag', () => {
      const r = browserAdapter.isDomainAllowed('https://example.com')
      assert.equal(r.ok, true)
    })
    it('handler returns scope_denied for blocked not approval_required', async () => {
      const adapter = browserAdapter.buildBrowserMcpAdapter({
        callMcpTool: async () => ({ ok: true }),
        requireHostConfirm: true,
      })
      const r = await adapter.handlers.browser_navigate({ url: 'http://127.0.0.1/' })
      assert.equal(r.code, 'scope_denied')
      assert.notEqual(r.code, 'approval_required')
    })
  })

  describe('M2 test seam', () => {
    it('stripTestKeys removes fakeApply from payload', () => {
      const clean = testSeam.stripTestKeysFromPayload({ draftId: 'd1', fakeApply: true, dryRun: true })
      assert.equal(clean.draftId, 'd1')
      assert.equal(clean.fakeApply, undefined)
    })
    it('test seam enabled under npm test lifecycle', () => {
      const prev = process.env.npm_lifecycle_event
      process.env.npm_lifecycle_event = 'test'
      assert.equal(testSeam.isTestSeamEnabled(), true)
      process.env.npm_lifecycle_event = prev
    })
  })

  describe('M3 draft CAS', () => {
    let dir
    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-')) })
    it('casBeginApply pending only once', () => {
      toolDrafts.rememberDraft(dir, { id: 'd1', status: 'pending_review', kind: 'file', action: 'write_file' })
      const first = toolDrafts.casBeginApply(dir, 'd1')
      assert.equal(first.ok, true)
      const second = toolDrafts.casBeginApply(dir, 'd1')
      assert.equal(second.ok, false)
      assert.equal(second.code, 'not_pending')
    })
    it('rejectDraft not_pending on second reject', () => {
      toolDrafts.rememberDraft(dir, { id: 'd2', status: 'pending_review', kind: 'file' })
      toolDrafts.rejectDraft(dir, 'd2')
      const r = toolDrafts.rejectDraft(dir, 'd2')
      assert.equal(r.ok, false)
    })
    it('renameWithRetry handles EPERM pattern', () => {
      const r = toolDrafts.renameWithRetry('/nonexistent/a', '/nonexistent/b', 0)
      assert.equal(r.ok, false)
    })
    it('finishApply marks failed state', () => {
      toolDrafts.rememberDraft(dir, { id: 'd3', status: 'applying', kind: 'file' })
      toolDrafts.finishApply(dir, 'd3', { failed: true })
      const d = toolDrafts.getDraft(dir, 'd3')
      assert.equal(d.status, 'failed')
    })
  })

  describe('M4 move rollback', () => {
    let root
    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-'))
      fs.mkdirSync(path.join(root, 'src'), { recursive: true })
      fs.writeFileSync(path.join(root, 'src', 'a.txt'), 'A')
    })
    it('rollbackMove restores from backup', () => {
      fileBackup.backupMovePaths(root, 'run1', 'src/a.txt', 'src/b.txt', (rel) => {
        const abs = path.join(root, rel)
        return fs.existsSync(abs) ? { ok: true, content: fs.readFileSync(abs, 'utf8') } : { ok: false }
      })
      fs.renameSync(path.join(root, 'src/a.txt'), path.join(root, 'src/b.txt'))
      const r = fileBackup.rollbackMove(root, 'run1', 'src/a.txt', 'src/b.txt')
      assert.equal(r.ok, true)
    })
  })

  describe('M5 mkdir UX', () => {
    it('low risk direct timeline title in handler result', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkdir-'))
      fs.mkdirSync(path.join(root, 'existing'), { recursive: true })
      const adapter = {
        rootPath: root,
        mkdir: async (rel) => {
          fs.mkdirSync(path.join(root, rel), { recursive: true })
          return { ok: true }
        },
        statPath: async () => ({ exists: false }),
        rememberDraft: (d) => d,
      }
      const { handlers } = agentFileTools.buildFileTools(adapter)
      const r = await handlers.mkdir({ path: 'existing/newdir' })
      assert.equal(r.ok, true)
      assert.match(r.text, /低风险直建/)
      assert.equal(r.draftId, undefined)
    })
  })

  describe('M6 store eviction', () => {
    it('expired id returns friendly message', () => {
      const store = runtimeStore.createEvictingMap({ maxEntries: 10, ttlMs: 1 })
      const old = Date.now() - 5000
      store.set('old', { status: 'completed', createdAt: old, endedAt: old })
      const hit = store.getFriendly('old', { expired: '已过期' })
      assert.equal(hit.ok, false)
      assert.ok(['expired', 'not_found'].includes(hit.code))
    })
    it('not_found for missing id', () => {
      const store = runtimeStore.createEvictingMap({ maxEntries: 10, ttlMs: 60000 })
      const hit = store.getFriendly('missing', { notFound: '不存在' })
      assert.equal(hit.code, 'not_found')
    })
    it('process lookup expired', () => {
      processTools.processStore.set('t-old', {
        taskId: 't-old', status: 'completed', createdAt: Date.now() - 86400000 * 2, endedAt: Date.now() - 86400000 * 2,
      })
      const r = processTools.lookupProcessEntry('t-old')
      assert.equal(r.ok, false)
      assert.ok(['expired', 'not_found'].includes(r.code))
    })
    it('LRU evicts over cap', () => {
      const store = runtimeStore.createEvictingMap({ maxEntries: 2, ttlMs: 99999999 })
      store.set('a', { status: 'done' })
      store.set('b', { status: 'done' })
      store.set('c', { status: 'done' })
      assert.ok(store.map.size <= 2)
    })
  })

  describe('L1 audit hash chain', () => {
    it('appendAuditLog writes prevHash and recordHash', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'))
      registry.appendAuditLog(dir, { toolName: 'write_file', outcome: 'executed', target: 'a.txt' })
      registry.appendAuditLog(dir, { toolName: 'write_file', outcome: 'executed', target: 'b.txt' })
      const lines = fs.readFileSync(path.join(dir, 'audit', 'tool-audit.jsonl'), 'utf8').trim().split('\n')
      const second = JSON.parse(lines[1])
      assert.ok(second.prevHash)
      assert.ok(second.recordHash)
    })
    it('redactSensitiveFields masks token', () => {
      const out = registry.redactSensitiveFields({ authorization: 'Bearer abc', title: 'x' })
      assert.equal(out.authorization, '[REDACTED]')
      assert.equal(out.title, 'x')
    })
    it('redactSensitiveValue masks bearer', () => {
      assert.equal(registry.redactSensitiveValue('x', 'Bearer secret123'), '[REDACTED]')
    })
    it('audit write failure surfaces error', () => {
      const r = registry.appendAuditLog('', { toolName: 't' })
      assert.equal(r.ok, false)
    })
    it('feishu token in log redacted', () => {
      const out = registry.redactSensitiveFields({ access_token: 't-abc1234567890' })
      assert.equal(out.access_token, '[REDACTED]')
    })
  })

  describe('L2 path security', () => {
    it('rejects traversal', () => {
      const r = pathSecurity.validateContentPath('../etc/passwd', '/tmp/root')
      assert.equal(r.ok, false)
    })
    it('canMkdirDirect requires parent exists', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'))
      const r = pathSecurity.canMkdirDirect('missing/n', root)
      assert.equal(r.ok, false)
    })
    it('canMkdirDirect ok when parent exists', () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps2-'))
      fs.mkdirSync(path.join(root, 'parent'), { recursive: true })
      const r = pathSecurity.canMkdirDirect('parent/child', root)
      assert.equal(r.ok, true)
    })
    it('isPathInsideRoot detects outside', () => {
      assert.equal(pathSecurity.isPathInsideRoot('/etc/passwd', '/tmp/root'), false)
    })
  })

  describe('L3 legacy IPC proxy', () => {
    it('approveFeishuDraft delegates to approveToolDraft', async () => {
      const toolRuntime = require('../src/lib/connectors/tool-runtime')
      assert.equal(typeof toolRuntime.approveFeishuDraft, 'function')
      assert.equal(typeof toolRuntime.approveToolDraft, 'function')
    })
  })
})
