'use strict'

/**
 * persist-studio-canvas-layout-on-save — 画布坐标经 package / fromGraph 往返。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  normalizeWorkflowPackage,
} = require('../src/lib/workflow-package')
const {
  compileWorkbenchAgentGraph,
} = require('../src/lib/workbench-agent-graph')

const src = path.join(__dirname, '..', 'src')
const workbenchJs = fs.readFileSync(path.join(src, 'workbench.js'), 'utf8')
const studioModel = require('../src/lib/workbench-studio-model')

describe('persist-studio-canvas-layout-on-save', () => {
  it('normalizeWorkflowPackage keeps layout and node coordinates', () => {
    const result = normalizeWorkflowPackage({
      id: 'wf-layout-1',
      name: '布局往返',
      source: 'personal',
      status: 'draft',
      graph: {
        goal: '对齐后保存',
        template: 'serial',
        members: [{ id: 'a1', agentPackageId: 'copywriter', role: '文案' }],
        nodes: [
          { id: 'a1', type: 'agent', agentPackageId: 'copywriter', x: 120, y: 80 },
          { id: 'n-terminal', type: 'terminal', status: 'completed', x: 900, y: 80 },
        ],
        edges: [{ from: 'a1', to: 'n-terminal' }],
        layout: {
          mode: 'free',
          start: { x: 40, y: 80 },
          end: { x: 900, y: 80 },
          nodes: { a1: { x: 120, y: 80, kind: 'agent' } },
        },
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.package.graph.layout.mode, 'free')
    assert.equal(result.package.graph.layout.start.x, 40)
    assert.equal(result.package.graph.nodes.find(n => n.id === 'a1').x, 120)
    assert.equal(result.package.graph.nodes.find(n => n.id === 'a1').y, 80)
  })

  it('agent-graph compile preserves layout coordinates', () => {
    const compiled = compileWorkbenchAgentGraph({
      goal: '保留坐标',
      template: 'serial',
      members: [{ id: 'a1', agentPackageId: 'copywriter', role: '文案' }],
      nodes: [
        { id: 'a1', type: 'agent', agentPackageId: 'copywriter', x: 200, y: 140 },
        { id: 'n-terminal', type: 'terminal', status: 'completed' },
      ],
      edges: [{ from: 'a1', to: 'n-terminal' }],
      layout: {
        mode: 'free',
        start: { x: 48, y: 140 },
        end: { x: 720, y: 140 },
        nodes: { a1: { x: 200, y: 140 } },
      },
    }, {
      resolveAgentPackage: id => ({
        ok: true,
        manifest: {
          schemaVersion: '1.0.0',
          packageId: id,
          name: id,
          version: '1.0.0',
          kind: 'expert',
          capabilities: { tools: [], skills: [], connectors: [], knowledge: [] },
          profiles: [{ id: 'default', name: 'default' }],
        },
        contentHash: 'hash',
      }),
    })
    assert.equal(compiled.ok, true, JSON.stringify(compiled.issues || []))
    assert.equal(compiled.composition.layout.start.x, 48)
    assert.equal(compiled.composition.nodes.find(n => n.id === 'a1').x, 200)
  })

  it('fromGraph restores saved layout coordinates', () => {
    const draft = studioModel.fromGraph({
      goal: '还原布局',
      members: [{ id: 'a1', agentPackageId: 'copywriter', role: '文案' }],
      nodes: [
        { id: 'a1', type: 'agent', agentPackageId: 'copywriter', x: 333, y: 222 },
        { id: 'n-terminal', type: 'terminal', status: 'completed' },
      ],
      edges: [{ from: 'a1', to: 'n-terminal' }],
      layout: {
        mode: 'free',
        start: { x: 11, y: 22 },
        end: { x: 880, y: 22 },
        nodes: { a1: { x: 333, y: 222 } },
      },
    }, { name: '布局草稿' })
    assert.equal(draft.graphMode, 'free')
    const start = draft.nodes.find(n => n.kind === 'start')
    const agent = draft.nodes.find(n => n.id === 'a1')
    const end = draft.nodes.find(n => n.kind === 'end')
    assert.equal(start.x, 11)
    assert.equal(start.y, 22)
    assert.equal(agent.x, 333)
    assert.equal(agent.y, 222)
    assert.equal(end.x, 880)
    assert.equal(end.y, 22)
  })

  it('saveStudioWorkflow merges studio layout into graph before save', () => {
    assert.ok(workbenchJs.includes('function mergeStudioLayoutIntoGraph('))
    assert.ok(workbenchJs.includes('mergeStudioLayoutIntoGraph(plan.composition, composition)'))
  })
})
