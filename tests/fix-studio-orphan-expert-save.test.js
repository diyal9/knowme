'use strict'

/**
 * fix-studio-orphan-expert-save — 失效专家保存提示与引用清理。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { currentPage } = require('./helpers/current-src')
const src = path.join(__dirname, '..', 'src')
const workbenchJs = currentPage('workbench.js')
const runtimeJs = fs.readFileSync(path.join(src, 'lib', 'agent-package-runtime.ts'), 'utf8')
const canvasJs = fs.readFileSync(path.join(src, 'lib', 'workbench-studio-canvas.ts'), 'utf8')
const mainJs = require('./helpers/main-ipc-bundle').readMainEntryBundle()
const storeModule = require('../src/lib/workflow-package-store')
const pkg = require('../src/lib/agent-package-runtime')
const canvas = require('../src/lib/workbench-studio-canvas')

describe('fix-studio-orphan-expert-save', () => {
  it.skip('translates unresolved expert errors for save toast', () => {
    assert.ok(workbenchJs.includes('function formatStudioPlanError('), 'formatStudioPlanError helper')
    assert.ok(workbenchJs.includes('formatStudioPlanError(plan)'), 'save uses formatter')
    assert.ok(workbenchJs.includes('（已失效）'), 'orphan select option')
    assert.ok(runtimeJs.includes('执行专家「'), 'runtime message is user-facing')
    assert.ok(canvasJs.includes('已失效'), 'canvas marks orphan expert')
    assert.ok(mainJs.includes('clearExpertRefs'), 'delete hook clears workflow refs')
  })

  it('validateTeamPackage message guides rebind', () => {
    const missing = pkg.validateTeamPackage({
      schemaVersion: 1,
      packageId: 'team-demo',
      name: 'demo',
      version: '1.0.0',
      members: [{ agentPackageId: 'ghost-expert' }],
      workflow: {
        nodes: [
          { id: 'start', type: 'agent', agentPackageId: 'ghost-expert' },
          { id: 'end', type: 'terminal' },
        ],
        edges: [{ from: 'start', to: 'end' }],
      },
    }, {
      resolveAgentPackage: () => ({ ok: false }),
    })
    assert.equal(missing.ok, false)
    const issue = missing.issues.find(item => item.code === 'unresolved_member')
    assert.ok(issue)
    assert.match(issue.message, /执行专家「ghost-expert」已删除或不存在/)
  })

  it('canvas marks missing expert as orphan when knownExpertIds provided', () => {
    const sections = canvas.sectionsFromNode(
      { id: 'n1', kind: 'agent', agentPackageId: 'ghost-x', name: 'Ghost' },
      { knownExpertIds: ['alive-expert'] },
    )
    const expert = sections.find(item => item.title === '执行专家')
    assert.ok(expert)
    assert.equal(expert.tone, 'warn')
    assert.ok(expert.rows.some(row => String(row).includes('已失效')))
  })

  it('clearExpertRefs empties personal package bindings without deleting nodes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-orphan-wf-'))
    const store = storeModule.createStore({ userData: dir })
    assert.equal(store.save({
      id: 'my-orphan',
      name: '我的协作',
      source: 'personal',
      status: 'draft',
      executionBackends: ['local-team'],
      agentRefs: [{ id: 'qa-copy-gone' }],
      graph: {
        nodes: [
          { id: 'node-1', type: 'agent', agentPackageId: 'qa-copy-gone', role: 'QA' },
          { id: 'n-terminal', type: 'terminal' },
        ],
        edges: [{ from: 'node-1', to: 'n-terminal' }],
        members: [{ id: 'node-1', agentPackageId: 'qa-copy-gone', role: 'QA' }],
      },
    }).ok, true)

    const cleared = store.clearExpertRefs('qa-copy-gone')
    assert.equal(cleared.ok, true)
    assert.equal(cleared.clearedPackages, 1)
    const loaded = store.get('my-orphan')
    assert.equal(loaded.ok, true)
    assert.equal((loaded.package.agentRefs || []).length, 0)
    const node = loaded.package.graph.nodes.find(item => item.id === 'node-1')
    assert.ok(node)
    assert.equal(String(node.agentPackageId || ''), '')
    assert.equal(store.clearExpertRefs('qa-copy-gone').clearedPackages, 0)
  })

  it('clearExpertRefs does not mutate official packages', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-orphan-off-'))
    const store = storeModule.createStore({ userData: dir })
    assert.equal(store.save({
      id: 'official-pipe',
      name: '官方',
      source: 'official',
      status: 'published',
      executionBackends: ['local-team'],
      agentRefs: [{ id: 'keep-me' }],
      graph: {
        nodes: [
          { id: 'a', type: 'agent', agentPackageId: 'keep-me' },
          { id: 't', type: 'terminal' },
        ],
        edges: [{ from: 'a', to: 't' }],
      },
    }).ok, true)
    const cleared = store.clearExpertRefs('keep-me')
    assert.equal(cleared.clearedPackages, 0)
    assert.equal(store.get('official-pipe').package.agentRefs[0].id, 'keep-me')
  })
})
