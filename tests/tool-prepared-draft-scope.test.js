'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { buildV1Registry } = require('../src/lib/tool-surface-builder')
const { buildFeishuDraftHandler, approveToolDraft } = require('../src/lib/connectors/tool-runtime')
const draftStore = require('../src/lib/tool-drafts-store')
const feishu = require('../src/lib/connectors/feishu-cli')
const files = require('../src/lib/agent-file-tools')
const { createCapabilityExecutionCheck } = require('../src/lib/agent-capability-execution-check')
const { resolveAgentCapabilityScope } = require('../src/lib/agent-capability-scope')
const { recordTaskCapabilityGrant, revokeTaskCapabilityGrant } = require('../src/lib/agent-task-capability-grants')

async function prepared(t, kind) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-prepared-scope-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const session = { id: 's', expertId: 'expert', run: { id: 'r', status: 'running' } }
  const policy = { denylist: [] }
  const grant = recordTaskCapabilityGrant(userData, session, 'connectors', 'feishu', 'scope-draft')
  const adapter = { rememberDraft: draft => draftStore.rememberDraft(userData, draft), readFile: async () => ({ ok: true, content: 'old' }) }
  const registry = buildV1Registry({ fileAdapter: adapter })
  const toolName = kind === 'file' ? 'write_file' : 'feishu.draft_write_doc'
  if (kind === 'feishu') registry.registerTool({ function: { name: toolName } }, {
    source: 'feishu', capability: 'feishu-write', risk: 'write', sideEffects: true, requiresApproval: true,
    scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false,
  }, buildFeishuDraftHandler(toolName, userData))
  const ctx = { userData, runId: 'r', sessionId: 's', approvalFileRoot: path.join(userData, 'source-a'),
    validateExecutionApproval: createCapabilityExecutionCheck({ session, runId: 'r', getSession: () => session,
      getConnectors: () => [{ id: 'feishu', enabled: true }],
      getState: () => ({ governancePolicy: policy, scope: resolveAgentCapabilityScope({ userData, session,
        expertSnapshot: { ok: true, bindings: { connectors: [] } } }) }),
    }),
  }
  let effects = 0
  const original = kind === 'file' ? files.applyFileDraft : feishu.applyFeishuWrite
  if (kind === 'file') files.applyFileDraft = async () => { effects++; return { ok: true, text: 'applied' } }
  else feishu.applyFeishuWrite = async () => { effects++; return { ok: true, text: 'applied' } }
  t.after(() => { if (kind === 'file') files.applyFileDraft = original; else feishu.applyFeishuWrite = original })
  const result = await registry.execute(toolName, kind === 'file' ? { path: 'a.txt', content: 'new' } : { title: 'doc', body: 'text' }, ctx)
  assert.equal(result.ok, true)
  assert.equal(result.draft.kind, kind)
  assert.deepEqual(result.draft.approvalScope, { runId: 'r', sessionId: 's', toolName })
  assert.equal(effects, 0)
  return { userData, session, policy, grant, toolName, result, ctx,
    approve: () => approveToolDraft(userData, result.draftId, { ...ctx, fileAdapter: { rootPath: ctx.approvalFileRoot } }),
    effects: () => effects }
}

for (const kind of ['file', 'feishu']) {
  test(`${kind} task draft prepares without double approval, applies once after fresh scope check`, async t => {
    const f = await prepared(t, kind)
    assert.equal((await f.approve()).ok, true)
    assert.equal(f.effects(), 1)
    assert.equal((await f.approve()).ok, false)
    assert.equal(f.effects(), 1)
  })
  test(`${kind} task draft cannot apply after capability or tool authorization revocation`, async t => {
    const f = await prepared(t, kind)
    if (kind === 'feishu') revokeTaskCapabilityGrant(f.userData, f.session, f.grant.id)
    else f.policy.denylist.push(f.toolName)
    assert.equal((await f.approve()).code, 'scope_denied')
    assert.equal(f.effects(), 0)
  })
  test(`${kind} task draft cannot apply after cancellation or body mutation`, async t => {
    const f = await prepared(t, kind)
    f.session.run.status = 'cancelled'
    assert.equal((await f.approve()).code, 'scope_denied')
    assert.equal(f.effects(), 0)
  })
  test(`${kind} task draft detects changed contents even if the serialized scope stamp is removed`, async t => {
    const f = await prepared(t, kind)
    draftStore.markDraft(f.userData, f.result.draftId, { approvalScope: undefined, body: 'different', content: 'different' })
    assert.equal((await f.approve()).code, 'approval_mismatch')
    assert.equal(f.effects(), 0)
  })
}

test('file task draft cannot apply under a different active source root', async t => {
  const f = await prepared(t, 'file')
  const result = await approveToolDraft(f.userData, f.result.draftId, { ...f.ctx, fileAdapter: { rootPath: path.join(f.userData, 'source-b') } })
  assert.equal(result.code, 'approval_mismatch')
  assert.equal(f.effects(), 0)
})

test('manual unbound Feishu draft retains its explicit host approval path', async t => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-manual-feishu-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const original = feishu.applyFeishuWrite
  let effects = 0
  feishu.applyFeishuWrite = async () => { effects++; return { ok: true } }
  t.after(() => { feishu.applyFeishuWrite = original })
  const result = await buildFeishuDraftHandler('feishu.draft_write_doc', userData)({ title: 'Manual', body: 'text' })
  assert.equal((await approveToolDraft(userData, result.draftId)).ok, true)
  assert.equal(effects, 1)
})
