'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const store = require('../src/lib/knowledge-steward-store')
const steward = require('../src/lib/knowledge-steward')

describe('knowledge-steward-store', () => {
  it('persists tasks and proposals under the Knowledge OS root', () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-steward-store-'))
    try {
      const task = store.createTask(userData, { scope: { mode: 'selected', paths: ['a.md'] } })
      const draft = steward.createProposal({
        taskId: task.id,
        sourcePath: 'a.md',
        sourceContent: 'a',
        proposedContent: 'b',
      })
      const added = store.addProposals(userData, task.id, [draft, draft])
      assert.equal(added.ok, true)
      assert.equal(store.listProposals(userData, task.id).length, 1)
      assert.equal(store.getTask(userData, task.id).status, 'review')

      const rejected = store.updateProposal(userData, draft.id, { status: 'rejected' })
      assert.equal(rejected.ok, true)
      assert.equal(store.listProposals(userData, task.id)[0].status, 'rejected')
      assert.ok(fs.existsSync(store.storePath(userData)))

      const cancelled = store.updateTask(userData, task.id, 'cancelled')
      assert.equal(cancelled.ok, true)
      const resumed = store.updateTask(userData, task.id, 'scanning')
      assert.equal(resumed.ok, true)
    } finally {
      fs.rmSync(userData, { recursive: true, force: true })
    }
  })
})
