/**
 * workbench-model 纯数据模型
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const M = require('../src/lib/workbench-model')

const MANIFEST = {
  id: 'f9-storyleader',
  title: 'F9 StoryLeader',
  model: 'composer-2.5-fast',
  version: '1.0.0',
  modes: ['vibe', 'workflow'],
  persona: { role: 'PM StoryLeader', stance: 'confirmatory', behavior: '先校验需求' },
  skills: { required: ['workflow-status'], optional: ['rdpi-source-repo-reader'] },
  workflow_nodes: ['s2-story-intake'],
  node_specs: {
    's2-story-intake': {
      role: 'StoryIntake',
      what: '整理需求为 story-intake',
      how: '读 ingest → 写 story-intake',
      anti: ['不写 plan/代码', '禁止跳过 Gate'],
      focus: '推断 FE/BE/TE',
      stop_rule: '无需求正文 → NEED_INPUT',
    },
  },
}

const AGENT_MD = `---
name: f9-storyleader
model: composer-2.5-fast
description: F9 StoryLeader（PM）。校验需求输入完整性。
default_readonly: true
persona:
  role: PM StoryLeader
  stance: confirmatory
---

# F9 StoryLeader
正文...`

const WORKFLOW = {
  schema_version: '1.0',
  id: 'feat-code-lite',
  name: '特性编码（轻量后端）',
  description: '需求 → Gate → BE Plan',
  entry_node: 'n1-storyleader',
  nodes: [
    { id: 'n1-storyleader', type: 'agent', agent: 'f9-storyleader', node_key: 's2-story-intake', intent: '整理需求', input: { from: 'ingest' }, output: { kind: 'story_intake_doc', path: 'artifacts/story-intake.md' }, next: 'gate-story-intake' },
    { id: 'gate-story-intake', type: 'gate', gate_id: 'story-intake-approve', on_approve: 'n2-plan', on_reject: 'n1-storyleader', on_revise: 'n1-storyleader' },
    { id: 'n2-plan', type: 'agent', agent: 'f9-arch-be', node_key: 's2-plan-backend', input: { paths: ['artifacts/story-intake.md'] }, next: 'n3-loop' },
    { id: 'n3-loop', type: 'loop', check: 'n3-build', body: 'n3-fix', max_iterations: 2, on_success: 'n4-done', on_exhausted: 'gate-build' },
    { id: 'n3-build', type: 'script', script: 'go-build' },
    { id: 'n3-fix', type: 'agent', agent: 'f9-coder-be' },
    { id: 'gate-build', type: 'gate', gate_id: 'build-pass', on_approve: 'n4-done', on_reject: 'n3-loop' },
    { id: 'n4-done', type: 'terminal', status: 'completed' },
  ],
}

describe('workbench-model · manifest', () => {
  it('parses manifest into normalized agent', () => {
    const a = M.parseAgentManifest(MANIFEST)
    assert.equal(a.id, 'f9-storyleader')
    assert.equal(a.title, 'F9 StoryLeader')
    assert.equal(a.persona.role, 'PM StoryLeader')
    assert.deepEqual(a.skills.required, ['workflow-status'])
    assert.deepEqual(a.workflowNodes, ['s2-story-intake'])
    assert.equal(a.nodeSpecs['s2-story-intake'].role, 'StoryIntake')
  })

  it('is defensive against garbage input', () => {
    const a = M.parseAgentManifest(null)
    assert.equal(a.id, '')
    assert.deepEqual(a.skills.required, [])
    assert.deepEqual(a.workflowNodes, [])
  })
})

describe('workbench-model · frontmatter', () => {
  it('extracts description/model/persona.role from AGENT.md', () => {
    const fm = M.parseAgentFrontmatter(AGENT_MD)
    assert.match(fm.description, /校验需求输入完整性/)
    assert.equal(fm.model, 'composer-2.5-fast')
    assert.equal(fm.persona.role, 'PM StoryLeader')
  })

  it('returns empty struct when no frontmatter', () => {
    const fm = M.parseAgentFrontmatter('# no fm')
    assert.equal(fm.description, '')
    assert.deepEqual(fm.persona, {})
  })
})

describe('workbench-model · workflow', () => {
  it('normalizes workflow and nodes', () => {
    const w = M.parseWorkflow(WORKFLOW)
    assert.equal(w.id, 'feat-code-lite')
    assert.equal(w.entryNode, 'n1-storyleader')
    assert.equal(w.nodes.length, 8)
    const gate = w.nodes.find(n => n.id === 'gate-story-intake')
    assert.equal(gate.type, 'gate')
    assert.equal(gate.onApprove, 'n2-plan')
  })

  it('collects node input paths', () => {
    const w = M.parseWorkflow(WORKFLOW)
    assert.deepEqual(M.nodeInputPaths(w.nodes[0]), ['ingest'])
    assert.deepEqual(M.nodeInputPaths(w.nodes[2]), ['artifacts/story-intake.md'])
  })
})

describe('workbench-model · graph', () => {
  it('builds order and edges from entry node via BFS', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const g = M.buildWorkflowGraph(w)
    assert.equal(g.order[0], 'n1-storyleader')
    assert.ok(g.order.includes('n4-done'))
    // 所有节点都应出现在 order 中
    assert.equal(g.order.length, w.nodes.length)
    const approve = g.edges.find(e => e.from === 'gate-story-intake' && e.to === 'n2-plan')
    assert.equal(approve.label, '通过')
  })

  it('handles loop node edges', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const g = M.buildWorkflowGraph(w)
    const success = g.edges.find(e => e.from === 'n3-loop' && e.to === 'n4-done')
    assert.equal(success.label, '成功')
  })
})

describe('workbench-model · advance', () => {
  it('advances gate by outcome', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const gate = w.nodes.find(n => n.id === 'gate-story-intake')
    assert.equal(M.nextNodeId(gate, 'approve'), 'n2-plan')
    assert.equal(M.nextNodeId(gate, 'reject'), 'n1-storyleader')
    assert.equal(M.nextNodeId(gate, 'revise'), 'n1-storyleader')
  })

  it('advances agent node to next', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const n1 = w.nodes[0]
    assert.equal(M.nextNodeId(n1), 'gate-story-intake')
  })

  it('loop success/exhausted routing', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const loop = w.nodes.find(n => n.id === 'n3-loop')
    assert.equal(M.nextNodeId(loop, 'success'), 'n4-done')
    assert.equal(M.nextNodeId(loop, 'exhausted'), 'gate-build')
  })

  it('terminal has no next', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const term = w.nodes.find(n => n.id === 'n4-done')
    assert.equal(M.nextNodeId(term), '')
  })
})

describe('workbench-model · dispatch prompt', () => {
  it('composes prompt from agent persona + node spec', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const agentsById = { 'f9-storyleader': M.parseAgentManifest(MANIFEST) }
    const p = M.composeDispatchPrompt(w.nodes[0], w, agentsById)
    assert.match(p, /F9 StoryLeader/)
    assert.match(p, /整理需求为 story-intake/)
    assert.match(p, /不写 plan\/代码/)
    assert.match(p, /ingest/)
  })

  it('nodeTitle prefers node_spec role', () => {
    const w = M.parseWorkflow(WORKFLOW)
    const agentsById = { 'f9-storyleader': M.parseAgentManifest(MANIFEST) }
    assert.equal(M.nodeTitle(w.nodes[0], agentsById), 'StoryIntake')
  })
})
