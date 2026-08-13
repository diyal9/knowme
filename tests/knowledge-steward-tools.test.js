'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const tools = require('../src/lib/knowledge-steward-tools')

describe('knowledge-steward-tools', () => {
  it('exposes read, propose, review, and confirmation-gated write contracts', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-steward-tools-'))
    try {
      const names = tools.KNOWLEDGE_STEWARD_TOOL_DEFINITIONS.map(item => item.function.name)
      assert.deepEqual(names, ['knowledge_list', 'knowledge_propose', 'knowledge_review', 'knowledge_commit'])
      assert.equal(tools.KNOWLEDGE_STEWARD_TOOL_DEFINITIONS[3]._knowme.requiresConfirmation, true)

      const surface = tools.buildKnowledgeStewardTools({ userData, sources: [] })
      const blocked = await surface.handlers.knowledge_commit({ proposalId: 'missing' })
      assert.equal(blocked.ok, false)
      assert.equal(blocked.code, 'confirmation_required')
    } finally {
      fs.rmSync(userData, { recursive: true, force: true })
    }
  })
})
