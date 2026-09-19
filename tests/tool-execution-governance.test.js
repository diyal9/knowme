'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRegistry, unbindRunRuntimeContext } = require('../src/lib/tool-contract-registry')
const { createToolExecutionAuthorization, markTrustedPreparationHandler } = require('../src/lib/tool-execution-approval')
const { approveToolDraft, buildFeishuDraftHandler, getDraft } = require('../src/lib/connectors/tool-runtime')
const { markDraft } = require('../src/lib/tool-drafts-store')

const contract = { source: 'connector', capability: 'fixture', risk: 'write', sideEffects: true,
  requiresApproval: true, scope: 'external', timeoutMs: 1000, idempotencySupported: false, rollbackSupported: false }

function fixture(t, handler) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-execution-approval-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const registry = createRegistry()
  const definition = { function: { name: 'write', parameters: { type: 'object', properties: {} } } }
  registry.registerTool(definition, contract, handler)
  return { registry, ctx: { userData, runId: 'run', sessionId: 'session', validateExecutionApproval: async () => ({ ok: true }) } }
}

test('real effects wait for host approval; model booleans and copied token cannot authorize', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  const result = await registry.execute('write', { approved: true, trust_confirmed: true }, { ...ctx, approved: true, executionAuthorization: {} })
  assert.equal(calls, 0)
  assert.equal(result.executionStarted, false)
  assert.equal(result.code, 'approval_required')
  assert.equal(result.pendingReview, true)
  assert.equal(result.draft.kind, 'tool-execution')
  const approved = await approveToolDraft(ctx.userData, result.draftId, ctx)
  assert.equal(approved.ok, true)
  assert.equal(approved.executionStarted, true)
  assert.equal(approved.requiresApproval, false)
  assert.equal(calls, 1)
  assert.equal((await approveToolDraft(ctx.userData, result.draftId, ctx)).ok, false)
  assert.equal(calls, 1)
})

test('host token binds exact arguments, target contract, handler, run and session and is single use', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true, requiresApproval: true } })
  const args = { path: '/a', body: { value: 1 } }
  const token = createToolExecutionAuthorization(registry.get('write'), args, ctx)
  for (const [candidate, context] of [[{ ...args, path: '/b' }, ctx], [{ ...args, body: { value: 2 } }, ctx],
    [args, { ...ctx, runId: 'other' }], [args, { ...ctx, sessionId: 'other' }]]) {
    assert.equal((await registry.execute('write', candidate, { ...context, executionAuthorization: token })).code, 'approval_required')
  }
  assert.equal(calls, 0)
  const approved = await registry.execute('write', args, { ...ctx, executionAuthorization: token })
  assert.equal(approved.requiresApproval, false)
  assert.equal(approved.pendingReview, false)
  assert.equal((await registry.execute('write', args, { ...ctx, executionAuthorization: token })).code, 'approval_required')
  assert.equal(calls, 1)
})

test('approval callback retains original args and cannot be retargeted by draft or caller mutation', async t => {
  let observed
  const { registry, ctx } = fixture(t, async args => { observed = args; return { ok: true } })
  const args = { path: '/original', body: { value: 1 } }
  const pending = await registry.execute('write', args, ctx)
  args.body.value = 9
  args.path = '/changed'
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId, ctx)).ok, true)
  assert.deepEqual(observed, { path: '/original', body: { value: 1 } })
  const another = await registry.execute('write', args, ctx)
  markDraft(ctx.userData, another.draftId, { preview: 'different target' })
  assert.equal((await approveToolDraft(ctx.userData, another.draftId, ctx)).code, 'approval_mismatch')
})

test('rejected or expired/unretained drafts do not execute and dry run stays pending', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  const pending = await registry.execute('write', {}, ctx)
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId, { dryRun: true })).dryRun, true)
  assert.equal(getDraft(ctx.userData, pending.draftId).status, 'pending_review')
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId, { reject: true })).rejected, true)
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId)).ok, false)
  assert.equal(calls, 0)
})

test('trusted draft preparation does not require approval before preparation or write externally', async t => {
  const { registry, ctx } = fixture(t, async () => ({ ok: true }))
  let preparations = 0
  registry.registerTool({ function: { name: 'prepare' } }, contract, markTrustedPreparationHandler(async () => {
    preparations++; return { ok: true, code: 'approval_required', draftId: 'draft-fixture', requiresApproval: true }
  }))
  const prepared = await registry.execute('prepare', {}, ctx)
  assert.equal(preparations, 1)
  assert.equal(prepared.draftId, 'draft-fixture')
  registry.registerTool({ function: { name: 'feishu.draft_write_doc' } }, { ...contract, source: 'feishu' }, buildFeishuDraftHandler('feishu.draft_write_doc', ctx.userData))
  const feishu = await registry.execute('feishu.draft_write_doc', { title: 'Draft only', body: 'content' }, ctx)
  assert.equal(feishu.ok, true)
  assert.equal(feishu.draft.kind, 'feishu')
  assert.equal(feishu.pendingReview, true)
})

test('preparation-looking names/metadata confer no exemption; explicit nonapproval contracts still run', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  const fake = async () => { calls++; return { ok: true } }
  fake.preparationOnly = true
  registry.registerTool({ function: { name: 'feishu.draft_fake' } }, { ...contract, preparationOnly: true }, fake)
  assert.equal((await registry.execute('feishu.draft_fake', {}, ctx)).executionStarted, false)
  registry.registerTool({ function: { name: 'artifact' } }, { ...contract, scope: 'ephemeral', requiresApproval: false }, fake)
  assert.equal((await registry.execute('artifact', {}, ctx)).ok, true)
  assert.equal(calls, 1)
})

test('pending approval still respects host policy denial, schema and cancellation', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  const policy = { allowlist: ['write'] }
  const pending = await registry.execute('write', {}, { ...ctx, governancePolicy: policy })
  policy.allowlist.length = 0
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId, ctx)).code, 'scope_denied')
  assert.equal((await registry.execute('write', {}, { ...ctx, signal: AbortSignal.abort() })).code, 'cancelled')
  assert.equal(calls, 0)
})

test('idempotency receipts never cross tools or changed arguments', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => ({ ok: true }))
  const safe = { ...contract, requiresApproval: false, idempotencySupported: true }
  for (const name of ['a', 'b']) registry.registerTool({ function: { name } }, safe, async () => { calls++; return { ok: true } })
  t.after(() => unbindRunRuntimeContext(ctx.runId))
  await registry.execute('a', { idempotencyKey: 'shared', path: '/a' }, ctx)
  await registry.execute('a', { path: '/a', idempotencyKey: 'shared' }, ctx)
  await registry.execute('a', { idempotencyKey: 'shared', path: '/b' }, ctx)
  await registry.execute('b', { idempotencyKey: 'shared', path: '/a' }, ctx)
  assert.equal(calls, 3)
})

test('deferred approvals revalidate current host scope and cancellation before mint or entry', async t => {
  let calls = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  for (const reason of ['connector_disabled', 'denylist', 'grant_revoked', 'missing_session', 'task_cancelled', 'identity_changed']) {
    let current = true
    const pending = await registry.execute('write', { reason }, { ...ctx, validateExecutionApproval: async () =>
      current ? { ok: true } : { ok: false, code: 'scope_denied', text: reason } })
    current = false
    assert.equal((await approveToolDraft(ctx.userData, pending.draftId, ctx)).code, 'scope_denied')
  }
  const missingGuard = await registry.execute('write', {}, { ...ctx, validateExecutionApproval: undefined })
  assert.equal((await approveToolDraft(ctx.userData, missingGuard.draftId, ctx)).code, 'approval_revalidation_required')
  const abort = new AbortController()
  const pending = await registry.execute('write', {}, { ...ctx, signal: abort.signal })
  abort.abort()
  assert.equal((await approveToolDraft(ctx.userData, pending.draftId, ctx)).code, 'cancelled')
  assert.equal(calls, 0)
})

test('revocation between host draft validation and actual handler entry still blocks', async t => {
  let calls = 0
  let checks = 0
  const { registry, ctx } = fixture(t, async () => { calls++; return { ok: true } })
  const pending = await registry.execute('write', {}, { ...ctx, validateExecutionApproval: async () => ({ ok: ++checks === 1 }) })
  const result = await approveToolDraft(ctx.userData, pending.draftId, ctx)
  assert.equal(result.code, 'scope_denied')
  assert.equal(result.executionStarted, false)
  assert.equal(checks, 2)
  assert.equal(calls, 0)
})
