'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadBundledCatalog } = require('../src/lib/capability-catalog')
const { isExpertAvailableForNewTask, isExpertCatalogEntry } = require('../src/domain/capability-hub')
const { workbenchHomeExperts } = require('../src/domain/workbench-home')

const ROOT = path.join(__dirname, '../src/catalog')
const governance = JSON.parse(fs.readFileSync(path.join(
  __dirname, '../openspec/changes/production-qualify-all-experts/expert-portfolio-governance.json',
), 'utf8'))

describe('expert portfolio retirement', () => {
  it('physically removes every non-retained bundled expert package', () => {
    const catalog = loadBundledCatalog(ROOT).entries
    const exiting = governance.entries.filter((entry) => (
      ['merge_to_expert', 'skill_only', 'workflow_only'].includes(entry.disposition)
    ))
    assert.equal(exiting.length, 16)

    for (const decision of exiting) {
      const item = catalog.find((entry) => entry.kind === 'expert' && entry.id === decision.id)
      assert.equal(item, undefined, `${decision.id} must leave the bundled catalog`)
      assert.equal(fs.existsSync(path.join(ROOT, 'experts', decision.id, 'EXPERT.md')), false, decision.id)
    }
  })

  it('keeps exactly the retained experts eligible for new bundled tasks', () => {
    const catalog = loadBundledCatalog(ROOT).entries.filter((entry) => entry.kind === 'expert')
    const retainedIds = governance.entries.filter((entry) => entry.disposition === 'keep').map((entry) => entry.id).sort()
    const eligibleIds = catalog.filter(isExpertAvailableForNewTask).map((entry) => entry.id).sort()
    assert.deepEqual(eligibleIds, retainedIds)
    assert.equal(retainedIds.length, 7)
  })

  it('routes skill-only and workflow-only roles to generic capability surfaces', () => {
    const catalog = loadBundledCatalog(ROOT).entries
    const skillOnly = governance.entries.filter((entry) => entry.disposition === 'skill_only')
    assert.equal(skillOnly.length, 3)
    for (const decision of skillOnly) {
      const successorId = decision.retainedCapabilities[0]
      const successor = catalog.find((entry) => entry.kind === 'skill' && entry.id === successorId)
      assert.ok(successor, `${decision.id} needs an active skill successor`)
      assert.equal(successor.lifecycle.newTasks, true, successorId)
    }

    const workflowOnly = governance.entries.filter((entry) => entry.disposition === 'workflow_only')
    assert.deepEqual(workflowOnly.map((entry) => entry.targetWorkflowId), ['capability-import'])
    const ipc = fs.readFileSync(path.join(__dirname, '../src/lib/capability-hub/ipc.ts'), 'utf8')
    const dialog = fs.readFileSync(path.join(__dirname, '../src/renderer/features/capability-hub/HubAddDialog.tsx'), 'utf8')
    assert.match(ipc, /capability-import-precheck/)
    assert.match(ipc, /capability-import/)
    assert.match(dialog, /capabilityImportPrecheck/)
    assert.match(dialog, /trustConfirmed:\s*true/)
  })

  it('workbench bindings cannot reintroduce a legacy expert into new-task cards', () => {
    const items = loadBundledCatalog(ROOT).entries.filter((entry) => entry.kind === 'expert')
    const modes = [{ id: 'all', bindings: items.map((entry) => ({ expertId: entry.id })) }]
    const visible = workbenchHomeExperts(items, modes)
    assert.equal(visible.length, 7)
    assert.equal(visible.some((entry) => entry.id === 'requirement-reviewer'), false)
    assert.equal(visible.some((entry) => entry.id === 'product-manager'), true)
    assert.equal(visible.some((entry) => entry.id === 'crawl4ai-expert'), false)
    assert.equal(visible.some((entry) => entry.id === 'sentiment-opinion-expert'), false)
  })

  it('does not apply bundled retirement policy to user-created experts', () => {
    const custom = { id: 'my-expert', kind: 'expert', name: '我的专家', lifecycle: undefined }
    assert.equal(isExpertAvailableForNewTask(custom), true)
  })
})
