'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  FEISHU_AUTH_DOMAIN_LIST,
  FEISHU_AUTH_DOMAINS,
  FEISHU_AUTH_SCOPES,
  FEISHU_AUTH_SCOPE_LIST,
  buildAuthLoginAttempts,
  findUnrequestedPermissionCategories,
  isInvalidScopeErrorMessage,
  missingPermissionCategoryIds,
  planFeishuScopeRequest,
  sanitizeExtraScopes,
  summarizeFeishuCapabilityReadiness,
  summarizeFeishuPermissions,
} = require('../src/lib/connectors/feishu-auth')

describe('feishu auth scope coverage', () => {
  it('covers every Feishu domain used by the current connector', () => {
    const domains = String(FEISHU_AUTH_DOMAINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    const scopes = String(FEISHU_AUTH_SCOPES || '').split(',').map((s) => s.trim()).filter(Boolean)

    assert.deepEqual(domains, FEISHU_AUTH_DOMAIN_LIST)
    assert.ok(domains.includes('drive'), 'auth domains include drive')
    assert.ok(domains.includes('base'), 'auth domains include base')
    assert.ok(domains.includes('calendar'), 'auth domains include calendar')
    assert.ok(domains.includes('task'), 'auth domains include task')
    assert.ok(scopes.includes('search:docs:read'), 'auth scopes include document search')
    assert.ok(scopes.includes('docx:document:create'), 'auth scopes include document write')
    assert.ok(scopes.includes('im:message.send_as_user'), 'auth scopes include user message send')
    assert.ok(scopes.includes('task:task:read'), 'auth scopes include task read')
  })

  // Without this invariant a category can demand a prefix that is never
  // requested, making `permissions.complete` unreachable and pinning the
  // settings card on "补充扩展权限" forever.
  it('requests at least one scope for every permission category it grades', () => {
    assert.deepEqual(findUnrequestedPermissionCategories(), [])
  })

  it('uses the real Feishu bitable scope rather than the lark-cli domain alias', () => {
    assert.ok(FEISHU_AUTH_SCOPE_LIST.includes('bitable:app:readonly'))
    assert.ok(FEISHU_AUTH_SCOPE_LIST.some((s) => s.startsWith('drive:')))
    assert.ok(FEISHU_AUTH_SCOPE_LIST.some((s) => s.startsWith('calendar:')))
    const complete = summarizeFeishuPermissions(FEISHU_AUTH_SCOPE_LIST.join(' '))
    assert.equal(complete.complete, true, 'granting everything we request marks permissions complete')
  })

  it('plans an authorization round with capability labels and raw scopes', () => {
    const permissions = summarizeFeishuPermissions('contact:user:search docx:document:readonly')
    const plan = planFeishuScopeRequest(permissions)
    assert.equal(plan.mode, 'topup')
    assert.ok(plan.categories.some((item) => item.id === 'contact' && item.state === 'ready'))
    assert.ok(plan.missingCategories.some((item) => item.id === 'wiki'))
    assert.ok(plan.categories.every((item) => item.scopes.length > 0))
    assert.deepEqual(plan.scopes, FEISHU_AUTH_SCOPE_LIST)
  })

  it('exposes a scope signature that changes only when the granted set changes', () => {
    const a = summarizeFeishuPermissions('wiki:node:read wiki:space:read')
    const reordered = summarizeFeishuPermissions('wiki:space:read wiki:node:read')
    const grown = summarizeFeishuPermissions('wiki:node:read wiki:space:read drive:drive:readonly')
    assert.equal(a.signature, reordered.signature)
    assert.notEqual(a.signature, grown.signature)
    assert.equal(summarizeFeishuPermissions('').signature, '')
    assert.deepEqual(missingPermissionCategoryIds(''), [])
  })

  it('has compatibility fallback attempts for older lark-cli scope parsing', () => {
    const attempts = buildAuthLoginAttempts()
    assert.ok(Array.isArray(attempts) && attempts.length >= 4, 'has preferred and fallback attempts')
    assert.ok(attempts[0].includes('--scope'), 'first attempt uses explicit scopes')
    assert.ok(attempts[0].includes('--recommend'), 'first attempt includes recommended scopes')
    assert.ok(attempts[1].includes('--recommend'), 'second attempt uses recommend fallback')
    assert.ok(!attempts[3].includes('--scope'), 'last attempt is domain-only')
  })

  // Feishu rejects the entire device-authorization request when one scope name is
  // unknown, so a malformed runtime-discovered scope must never reach the CLI.
  it('drops malformed runtime scopes and can retry without the discovered ones', () => {
    const { accepted, rejected } = sanitizeExtraScopes([
      'space:document:retrieve',
      'not a scope',
      'wiki:node:read',
      '',
      'drive:drive:readonly',
    ])
    assert.deepEqual(accepted, ['space:document:retrieve'])
    assert.deepEqual(rejected, ['not a scope'])

    const attempts = buildAuthLoginAttempts(['space:document:retrieve', 'not a scope'])
    const first = attempts[0][attempts[0].indexOf('--scope') + 1]
    assert.ok(first.includes('space:document:retrieve'), 'first attempt requests the discovered scope')
    assert.ok(!first.includes('not a scope'), 'malformed scope never reaches the CLI')
    const second = attempts[1][attempts[1].indexOf('--scope') + 1]
    assert.equal(second, FEISHU_AUTH_SCOPES, 'falls back to the curated known-good set')
    assert.ok(!attempts[attempts.length - 1].includes('--scope'), 'last attempt is domain-only')
  })

  it('reports missing permission categories without exposing raw token scopes', () => {
    const result = summarizeFeishuPermissions('contact:user:search docx:document:readonly')
    assert.equal(result.known, true)
    assert.equal(result.complete, false)
    assert.ok(result.categories.some(item => item.id === 'drive' && item.state === 'missing'))
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'scope'))
  })

  it('treats docs and wiki as ready even when optional calendar scope is missing', () => {
    const permissions = summarizeFeishuPermissions([
      'drive:file:download',
      'search:docs:read',
      'docx:document:readonly',
      'docx:document:create',
      'wiki:node:read',
      'wiki:space:read',
    ].join(' '))
    const docKb = summarizeFeishuCapabilityReadiness(permissions, 'docs_kb')
    const todayPriority = summarizeFeishuCapabilityReadiness(permissions, 'today_priority')
    assert.equal(docKb.known, true)
    assert.equal(docKb.ready, true)
    assert.equal(todayPriority.ready, false)
    assert.deepEqual(todayPriority.missing, ['日程', '待办', '聊天读写'])
  })

  it('detects malformed scope errors from lark-cli output', () => {
    assert.equal(
      isInvalidScopeErrorMessage('Device authorization failed: provided scope list contains invalid or malformed scopes'),
      true
    )
    assert.equal(isInvalidScopeErrorMessage('network timeout'), false)
  })
})

