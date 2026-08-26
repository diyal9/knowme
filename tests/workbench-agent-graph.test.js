'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')

const pkg = require('../src/lib/agent-package-runtime')
const graph = require('../src/lib/workbench-agent-graph')

function validAgentRaw(overrides = {}) {
  return {
    schemaVersion: 1,
    packageId: 'demo-agent',
    name: 'Demo Agent',
    version: '1.2.3',
    builder: 'local',
    persona: { role: 'Tester' },
    inputs: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
    outputs: { type: 'object', properties: { result: { type: 'string' } } },
    ...overrides,
  }
}

function validAgent(overrides = {}) {
  const validated = pkg.validateAgentPackage(validAgentRaw(overrides))
  assert.equal(validated.ok, true, validated.error || 'agent fixture invalid')
  return validated
}

function makeResolver(...agents) {
  const byId = new Map(agents.map(item => [item.manifest.packageId, item]))
  return (agentPackageId) => byId.get(agentPackageId) || { ok: false }
}

function baseMembers(overrides = []) {
  const defaults = [
    {
      id: 'researcher',
      expertId: 'research-agent',
      agentPackageId: 'research-agent',
      role: 'researcher',
      intent: '收集资料',
    },
    {
      id: 'writer',
      expertId: 'writer-agent',
      agentPackageId: 'writer-agent',
      role: 'writer',
      intent: '撰写交付物',
    },
  ]
  return overrides.length ? overrides : defaults
}

describe('workbench-agent-graph', () => {
  it('compiles a serial template into a validated team package', () => {
    const research = validAgent({ packageId: 'research-agent', version: '1.0.0' })
    const writer = validAgent({ packageId: 'writer-agent', version: '1.0.1' })

    const result = graph.compileWorkbenchAgentGraph({
      goal: '完成调研并撰写报告',
      template: 'serial',
      members: baseMembers(),
    }, {
      resolveAgentPackage: makeResolver(research, writer),
    })

    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(result.composition.template, 'serial')
    assert.equal(result.composition.members.length, 2)
    assert.deepEqual(
      result.composition.edges.map(edge => `${edge.from}->${edge.to}`),
      ['researcher->writer', `writer->${graph.TERMINAL_NODE_ID}`],
    )
    assert.equal(result.teamPackage.workflow.nodes.length, 3)
    assert.equal(result.teamPackage.members.length, 2)
    assert.match(result.snapshot.compositionHash, /^[a-f0-9]{64}$/)
    assert.match(result.snapshot.teamPackageHash, /^[a-f0-9]{64}$/)
    assert.equal(result.snapshot.goal, '完成调研并撰写报告')
    assert.deepEqual(Object.keys(result.snapshot.contentHashes).sort(), ['research-agent', 'writer-agent'])
    assert.equal(result.snapshot.packageRefs.length, 2)
    assert.equal(result.snapshot.packageRefs[0].contentHash, research.contentHash)
  })

  it('compiles parallel and gate templates with explicit workflow nodes', () => {
    const research = validAgent({ packageId: 'research-agent' })
    const writer = validAgent({ packageId: 'writer-agent' })
    const resolve = makeResolver(research, writer)

    const parallel = graph.compileWorkbenchAgentGraph({
      goal: '并行调研与写作',
      template: 'parallel',
      members: baseMembers(),
      parallelism: 2,
      joinStrategy: 'allSucceeded',
    }, { resolveAgentPackage: resolve })

    assert.equal(parallel.ok, true, JSON.stringify(parallel.issues))
    assert.ok(parallel.composition.nodes.some(node => node.type === 'join'))
    assert.equal(parallel.teamPackage.workflow.parallelism, 2)
    assert.deepEqual(
      parallel.composition.edges.filter(edge => edge.to === graph.JOIN_NODE_ID).map(edge => edge.from).sort(),
      ['researcher', 'writer'],
    )

    const gate = graph.compileWorkbenchAgentGraph({
      goal: '审批后交付',
      template: 'gate',
      members: baseMembers(),
      gates: [{
        id: 'approval-draft',
        title: 'Draft 审批',
        type: 'approval',
        params: { requiresUserApproval: true },
      }],
    }, { resolveAgentPackage: resolve })

    assert.equal(gate.ok, true, JSON.stringify(gate.issues))
    assert.ok(gate.composition.nodes.some(node => node.type === 'gate' && node.gateRef === 'approval-draft'))
    assert.deepEqual(
      gate.composition.edges.map(edge => `${edge.from}->${edge.to}`),
      [
        'researcher->n-gate-approval-draft',
        'n-gate-approval-draft->writer',
        `writer->${graph.TERMINAL_NODE_ID}`,
      ],
    )
    assert.equal(gate.teamPackage.gates[0].id, 'approval-draft')
  })

  it('rejects cycles, unknown agents and dangling edges', () => {
    const known = validAgent({ packageId: 'known-agent' })
    const resolve = makeResolver(known)

    const cyclic = graph.compileWorkbenchAgentGraph({
      goal: '循环图',
      members: [{
        id: 'a',
        agentPackageId: 'known-agent',
        role: 'a',
      }, {
        id: 'b',
        agentPackageId: 'known-agent',
        role: 'b',
      }],
      nodes: [
        { id: 'a', type: 'agent', agentPackageId: 'known-agent' },
        { id: 'b', type: 'agent', agentPackageId: 'known-agent' },
        { id: graph.TERMINAL_NODE_ID, type: 'terminal' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
        { from: 'a', to: graph.TERMINAL_NODE_ID },
      ],
    }, { resolveAgentPackage: resolve })

    assert.equal(cyclic.ok, false)
    assert.ok(cyclic.issues.some(item => item.code === 'workflow_cycle'))

    const unknown = graph.compileWorkbenchAgentGraph({
      goal: '未知 Agent',
      template: 'single',
      members: [{
        id: 'ghost',
        agentPackageId: 'ghost-agent',
        role: 'ghost',
      }],
    }, { resolveAgentPackage: resolve })

    assert.equal(unknown.ok, false)
    assert.ok(unknown.issues.some(item => item.code === 'unresolved_member'))

    const dangling = graph.compileWorkbenchAgentGraph({
      goal: '悬空边',
      members: [{
        id: 'a',
        agentPackageId: 'known-agent',
        role: 'a',
      }],
      nodes: [
        { id: 'a', type: 'agent', agentPackageId: 'known-agent' },
        { id: graph.TERMINAL_NODE_ID, type: 'terminal' },
      ],
      edges: [{ from: 'a', to: 'missing-node' }],
    }, { resolveAgentPackage: resolve })

    assert.equal(dangling.ok, false)
    assert.ok(dangling.issues.some(item => item.code === 'dangling_edge'))

    const daemonAgent = graph.compileWorkbenchAgentGraph({
      goal: '错误混入 Daemon Agent',
      template: 'single',
      members: [{
        id: 'daemon-node',
        agentPackageId: 'known-agent',
        agentOrigin: 'daemon',
        role: 'fixed daemon role',
      }],
    }, { resolveAgentPackage: resolve })

    assert.equal(daemonAgent.ok, false)
    assert.ok(daemonAgent.issues.some(item => item.code === 'daemon_agent_readonly'))
  })

  it('preserves member metadata and snapshot package hashes', () => {
    const alpha = validAgent({ packageId: 'alpha-agent', version: '2.3.4', builder: 'cursor' })
    const beta = validAgent({ packageId: 'beta-agent', version: '0.9.0', builder: 'claude' })

    const result = graph.applyGraphTemplate('serial', [
      {
        id: 'alpha-node',
        expertId: 'expert-alpha',
        agentPackageId: 'alpha-agent',
        profileId: 'alpha-workflow-profile',
        agentOrigin: 'local',
        packageHash: alpha.contentHash,
        profileHash: 'profile-hash-alpha',
        role: 'planner',
        intent: '规划任务',
        skillRefs: [{ id: 'planning' }],
        knowledgeRefs: [{ id: 'kb-team' }],
        profile: { promptOverlay: '输出可验收计划' },
      },
      {
        id: 'beta-node',
        expertId: 'expert-beta',
        agentPackageId: 'beta-agent',
        role: 'executor',
        intent: '执行交付',
      },
    ], {
      goal: '保留元数据',
      resolveAgentPackage: makeResolver(alpha, beta),
    })

    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(result.composition.members[0].expertId, 'expert-alpha')
    assert.equal(result.composition.members[0].intent, '规划任务')
    assert.equal(result.composition.members[0].profileId, 'alpha-workflow-profile')
    assert.equal(result.composition.members[0].agentOrigin, 'local')
    assert.equal(result.composition.members[0].packageHash, alpha.contentHash)
    assert.equal(result.composition.members[0].profileHash, 'profile-hash-alpha')
    assert.equal(result.composition.members[0].profile.promptOverlay, '输出可验收计划')
    assert.equal(result.composition.members[0].knowledgeRefs[0].id, 'kb-team')
    assert.equal(result.composition.members[1].role, 'executor')

    const alphaRef = result.snapshot.packageRefs.find(item => item.packageId === 'alpha-agent')
    const betaRef = result.snapshot.packageRefs.find(item => item.packageId === 'beta-agent')
    assert.equal(alphaRef.contentHash, alpha.contentHash)
    assert.equal(alphaRef.version, '2.3.4')
    assert.equal(alphaRef.backend, 'cursor-package')
    assert.equal(betaRef.contentHash, beta.contentHash)
    assert.equal(result.snapshot.contentHashes['alpha-agent'], alpha.contentHash)
    assert.match(result.snapshot.teamPackageHash, /^[a-f0-9]{64}$/)
    assert.equal(result.snapshot.teamPackageId, 'workbench-agent-graph')
  })

  it('accepts an imported custom terminal id and preserves tool execution contracts', () => {
    const agent = validAgent({ packageId: 'known-agent' })
    const result = graph.compileWorkbenchAgentGraph({
      goal: '运行导入工作流',
      version: '1.0.0',
      members: [{ id: 'plan', agentPackageId: 'known-agent', role: 'planner' }],
      nodes: [
        { id: 'plan', type: 'agent', agentPackageId: 'known-agent' },
        {
          id: 'emit',
          type: 'tool',
          config: { skillId: 'artbundle', externalAction: 'bundle-build' },
          executionContract: { requiredTools: ['emit_artbundle_specs'] },
        },
        { id: 'terminal_done', type: 'terminal' },
      ],
      edges: [
        { from: 'plan', to: 'emit' },
        { from: 'emit', to: 'terminal_done' },
      ],
    }, { resolveAgentPackage: makeResolver(agent) })

    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(result.composition.nodes.some(node => node.id === graph.TERMINAL_NODE_ID), false)
    assert.deepEqual(
      result.teamPackage.workflow.nodes.find(node => node.id === 'emit').executionContract.requiredTools,
      ['emit_artbundle_specs'],
    )
  })

  it('exposes bounded graph templates', () => {
    assert.deepEqual(Object.keys(graph.GRAPH_TEMPLATES).sort(), ['gate', 'parallel', 'serial', 'single'])
    assert.equal(graph.GRAPH_TEMPLATES.parallel.minMembers, 2)
    assert.equal(graph.GRAPH_TEMPLATES.gate.requiresGate, true)
    assert.equal(graph.MAX_MEMBERS, 8)
  })
})
