'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')

const ROOT = path.join(__dirname, '..')
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/catalog/catalog.json'), 'utf8'))
const governance = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'openspec/changes/production-qualify-all-experts/expert-portfolio-governance.json',
), 'utf8'))

const allowedDispositions = new Set(['keep', 'merge_to_expert', 'skill_only', 'workflow_only', 'deferred'])

describe('expert portfolio governance', () => {
  it('records every original expert decision and exposes only retained packages', () => {
    const catalogIds = catalog.entries.filter(item => item.kind === 'expert').map(item => item.id).sort()
    const governedIds = governance.entries.map(item => item.id).sort()
    const retainedIds = governance.entries.filter(item => item.disposition === 'keep').map(item => item.id).sort()
    assert.deepEqual(catalogIds, retainedIds)
    assert.equal(new Set(governedIds).size, governedIds.length)
  })

  it('matches the approved disposition totals', () => {
    const totals = Object.fromEntries([...allowedDispositions].map(disposition => [
      disposition,
      governance.entries.filter(item => item.disposition === disposition).length,
    ]))
    assert.deepEqual(totals, {
      keep: 7,
      merge_to_expert: 12,
      skill_only: 3,
      workflow_only: 1,
      deferred: 2,
    })
    assert.equal(governance.entries.length, governance.targetSummary.totalBundledExperts)
  })

  it('only merges into retained experts and preserves a capability path', () => {
    const retained = new Set(governance.entries.filter(item => item.disposition === 'keep').map(item => item.id))
    for (const entry of governance.entries) {
      assert.ok(allowedDispositions.has(entry.disposition), entry.id)
      assert.ok(entry.category, entry.id)
      assert.ok(entry.reason, entry.id)
      assert.ok(entry.retainedCapabilities.length > 0, entry.id)
      if (entry.disposition === 'merge_to_expert') assert.ok(retained.has(entry.targetExpertId), entry.id)
      if (entry.disposition === 'workflow_only') assert.ok(entry.targetWorkflowId, entry.id)
    }
  })

  it('requires capability migration and direct retired-data cleanup', () => {
    const gates = governance.policy.deletionGate.join('\n')
    assert.match(gates, /工作流.*模式绑定.*用户入口/)
    assert.match(gates, /自定义.*绝不自动删除/)
    assert.match(gates, /安装记录.*任务记录.*目录包.*删除/)
    assert.match(gates, /保留专家.*安装.*升级.*重开验证/)
  })
})
