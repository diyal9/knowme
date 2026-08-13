'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const feishuCli = require('../src/lib/connectors/feishu-cli')
const toolRuntime = require('../src/lib/connectors/tool-runtime')

describe('fake-feishu-write', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-draft-'))

  const draftTools = [
    ['feishu.draft_send_message', { text: 'hello' }],
    ['feishu.draft_create_task', { title: 'task' }],
    ['feishu.draft_update_doc', { doc_token: 'd1', body: 'body' }],
    ['feishu.draft_calendar_event', { title: 'meet' }],
    ['feishu.draft_drive_upload', { file_path: '/tmp/a.txt' }],
    ['feishu.draft_wiki_node', { space_id: 's1', title: 'node' }],
    ['feishu.draft_bitable_record', { app_token: 'a1', table_id: 't1' }],
    ['feishu.draft_write_doc', { body: 'doc body', title: 'T' }],
  ]

  for (const [toolName, args] of draftTools) {
    it(`creates pending draft for ${toolName} without external write`, async () => {
      const handler = toolRuntime.buildFeishuDraftHandler?.(toolName, userData)
        || (async (a) => {
          const built = toolName === 'feishu.draft_write_doc'
            ? feishuCli.buildDraftWrite(a)
            : feishuCli.FEISHU_EXTENDED_DRAFT_BUILDERS[toolName](a)
          const draft = require('../src/lib/tool-drafts-store').rememberDraft(userData, { ...built.draft, kind: 'feishu' })
          return { ok: true, draft, requiresApproval: true, draftId: draft.id }
        })
      let externalCalls = 0
      const orig = feishuCli.runLarkCli
      feishuCli.runLarkCli = async () => { externalCalls += 1; return { ok: true } }
      try {
        const r = await handler(args)
        assert.equal(r.ok, true)
        assert.equal(r.requiresApproval, true)
        assert.equal(externalCalls, 0)
        const pending = require('../src/lib/tool-drafts-store').loadDrafts(userData).filter(d => d.status === 'pending_review')
        assert.ok(pending.length >= 1)
      } finally {
        feishuCli.runLarkCli = orig
      }
    })
  }

  it('approve with fakeApply does not call lark cli', async () => {
    const built = feishuCli.buildDraftSendMessage({ text: 'x' })
    const draft = require('../src/lib/tool-drafts-store').rememberDraft(userData, built.draft)
    let calls = 0
    const orig = feishuCli.runLarkCli
    feishuCli.runLarkCli = async () => { calls += 1; return { ok: true } }
    try {
      const r = await toolRuntime.approveToolDraft(userData, draft.id, { fakeApply: true })
      assert.equal(r.ok, true)
      assert.match(r.text, /FAKE_APPLY/)
      assert.equal(calls, 0)
    } finally {
      feishuCli.runLarkCli = orig
    }
  })

  it('idempotencyKey prevents duplicate pending drafts', () => {
    const store = require('../src/lib/tool-drafts-store')
    const d1 = store.rememberDraft(userData, { kind: 'feishu', action: 'draft_send_message', idempotencyKey: 'k1', status: 'pending_review' })
    const d2 = store.rememberDraft(userData, { kind: 'feishu', action: 'draft_send_message', idempotencyKey: 'k1', status: 'pending_review' })
    assert.equal(d1.id, d2.id)
  })
})
