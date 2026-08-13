'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const steward = require('../src/lib/knowledge-steward')

describe('knowledge-steward task model', () => {
  it('creates an incremental task and enforces state transitions', () => {
    const created = steward.createTask({ scope: { mode: 'changed' } })
    assert.equal(created.status, 'idle')
    assert.equal(created.scope.mode, 'changed')

    const scanning = steward.transitionTask(created, 'scanning', { total: 4 })
    assert.equal(scanning.ok, true)
    assert.equal(scanning.task.total, 4)

    const invalid = steward.transitionTask(scanning.task, 'completed')
    assert.equal(invalid.ok, false)
  })

  it('allows a failed task to retry from scanning', () => {
    const task = steward.createTask({ status: 'failed', error: 'timeout' })
    const retry = steward.transitionTask(task, 'scanning', { error: '' })
    assert.equal(retry.ok, true)
    assert.equal(retry.task.status, 'scanning')
    assert.equal(retry.task.error, '')
  })

  it('creates traceable proposals with stable source hashes', () => {
    const proposal = steward.createProposal({
      sourcePath: 'wiki/runtime.md',
      sourceContent: '# Runtime\nold',
      proposedContent: '# Runtime\nnew',
      targetPath: 'concepts/runtime.md',
      confidence: 0.9,
    })
    assert.equal(proposal.type, 'knowledge_proposal')
    assert.equal(proposal.sourcePath, 'wiki/runtime.md')
    assert.equal(proposal.sourceHash, steward.hashContent('# Runtime\nold'))
    assert.equal(proposal.diff.lineDelta, 0)
    assert.equal(proposal.confidence, 0.9)
  })

  it('deduplicates proposals and keeps rejected status intact', () => {
    const base = steward.createProposal({
      sourcePath: 'a.md',
      sourceContent: 'a',
      proposedContent: 'b',
      targetPath: 'concepts/a.md',
    })
    const rejected = { ...base, status: 'rejected' }
    const unique = steward.createProposal({
      sourcePath: 'b.md',
      sourceContent: 'b',
      proposedContent: 'c',
      targetPath: 'concepts/b.md',
    })
    const result = steward.dedupeProposals([base, rejected, unique])
    assert.equal(result.length, 2)
    assert.equal(result.find(item => item.sourcePath === 'a.md').status, 'rejected')
  })
})
