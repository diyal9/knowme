const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  MAX_REPO_WORKFLOWS,
  resolveAgentId,
  graphFromDefinition,
  buildWorkflowSupply,
} = require('../src/lib/workflow-supply')

const TEAM_RUN_DEFINITION = {
  id: 'team-run',
  name: '三角色协作开发',
  entry_node: 'plan',
  nodes: [
    { id: 'plan', type: 'agent', agent: 'producer', node_key: '规划', next: 'build' },
    { id: 'build', type: 'agent', agent: 'developer', node_key: '实现', next: 'gate' },
    { id: 'gate', type: 'gate', gate_id: 'dev-self-test', on_approve: 'qa', on_reject: 'build' },
    { id: 'qa', type: 'agent', agent: 'tester', node_key: '测试', next: 'done' },
    { id: 'done', type: 'terminal' },
  ],
}

function repoEntry(overrides = {}) {
  return {
    id: 'team-run',
    name: '三角色协作开发',
    description: '制作人规划 → 开发实现 → 测试 QA',
    tags: ['团队'],
    path: 'team-run.json',
    definition: TEAM_RUN_DEFINITION,
    ...overrides,
  }
}

function supply(input = {}) {
  return buildWorkflowSupply({
    repoWorkflows: [],
    daemon: { online: true, workflows: [] },
    personal: [],
    verticals: [],
    agents: [],
    repoActive: true,
    localTeamEnabled: true,
    ...input,
  })
}

describe('graphFromDefinition', () => {
  it('carries nodes, edges and agent refs out of a repository definition', () => {
    const graph = graphFromDefinition(TEAM_RUN_DEFINITION, { id: 'team-run', path: 'team-run.json' })
    assert.equal(graph.nodes.length, 5)
    assert.ok(graph.edges.length >= 4)
    assert.deepEqual(graph.agentRefs.map(ref => ref.id), ['producer', 'developer', 'tester'])
    assert.equal(graph.entryNode, 'plan')
  })

  it('normalizes historical agent aliases inside graph nodes', () => {
    const graph = graphFromDefinition({
      entry_node: 'only',
      nodes: [{ id: 'only', type: 'agent', agent: 'office-assistant' }],
    }, { id: 'demo' })
    assert.equal(graph.nodes[0].agentPackageId, 'office-partner')
    assert.deepEqual(graph.agentRefs.map(ref => ref.id), ['office-partner'])
  })

  it('tolerates a definition without nodes', () => {
    const graph = graphFromDefinition({}, { id: 'empty' })
    assert.deepEqual(graph.nodes, [])
    assert.deepEqual(graph.agentRefs, [])
  })
})

describe('resolveAgentId', () => {
  it('maps a known alias and passes other ids through', () => {
    assert.equal(resolveAgentId('office-assistant'), 'office-partner')
    assert.equal(resolveAgentId('developer'), 'developer')
    assert.equal(resolveAgentId(''), '')
  })
})

describe('workflow supply collection', () => {
  it('does not invent built-in demo vertical seeds when verticals are empty', () => {
    const result = supply({ verticals: [] })
    for (const id of ['office-meeting-to-actions', 'engineering-delivery', 'visual-brief-to-export']) {
      assert.equal(result.packages.find(item => item.id === id), undefined)
    }
    assert.equal(result.stats.byOrigin.seed || 0, 0)
    assert.equal(result.stats.byOrigin.official || 0, 0)
  })

  it('keeps official reference packages when supplied as verticals', () => {
    const official = require('../src/lib/official-workflows').listOfficialWorkflowPackages()
    const experts = require('../src/lib/official-workflows').requiredExpertIds().map(id => ({ id }))
    const result = supply({
      verticals: official,
      agents: experts,
    })
    assert.equal(result.packages.filter(item => item.source === 'official').length, 3)
    assert.ok(result.packages.every(item => !['office-meeting-to-actions', 'engineering-delivery', 'visual-brief-to-export'].includes(item.id)))
  })

  it('keeps the executable content of repository workflows', () => {
    const result = supply({
      repoWorkflows: [repoEntry()],
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    })
    const pkg = result.packages.find(item => item.id === 'team-run')
    assert.ok(pkg, 'team-run should reach the shelf')
    assert.equal(pkg.graph.nodes.length, 5)
    assert.equal(pkg.agentRefs.length, 3)
    assert.equal(pkg.origin, 'repo')
    assert.equal(pkg.readiness.runnable, true)
  })

  it('drops an entry that has neither graph nodes nor agent refs', () => {
    const result = supply({ repoWorkflows: [repoEntry({ id: 'hollow', definition: null })] })
    assert.equal(result.packages.find(item => item.id === 'hollow'), undefined)
    const note = result.diagnostics.find(item => item.id === 'hollow')
    assert.equal(note.code, 'empty-shell')
  })

  it('keeps deprecated and internal catalog entries off the shelf', () => {
    const result = supply({
      repoWorkflows: [repoEntry({ id: 'legacy-flow', catalog: { visibility: 'deprecated' } })],
      daemon: {
        online: true,
        workflows: [{ id: 'internal-flow', name: 'Internal', agentIds: ['producer'], catalog: { visibility: 'internal' } }],
      },
    })
    assert.equal(result.packages.length, 0)
    assert.deepEqual(
      result.diagnostics.filter(item => item.code === 'hidden').map(item => item.id).sort(),
      ['internal-flow', 'legacy-flow'],
    )
  })

  it('admits daemon catalog workflows onto the shelf', () => {
    const result = supply({
      daemon: {
        online: true,
        workflows: [{ id: 'daemon-flow', name: '守护流程', agentIds: ['producer'] }],
      },
      agents: [{ id: 'producer' }],
    })
    const pkg = result.packages.find(item => item.id === 'daemon-flow')
    assert.equal(pkg.origin, 'daemon')
    assert.equal(pkg.readiness.runnable, true)
    assert.equal(pkg.readiness.backend, 'daemon')
  })

  it('reports daemon workflows as unavailable while offline', () => {
    const result = supply({ daemon: { online: false, workflows: [] } })
    const note = result.diagnostics.find(item => item.origin === 'daemon' && item.code === 'offline')
    assert.equal(note.fixAction.kind, 'connect-daemon')
    assert.equal(result.stats.daemonOnline, false)
  })
})

describe('workflow supply preference', () => {
  it('prefers the definition with more executable content over first-seen order', () => {
    const result = supply({
      repoWorkflows: [repoEntry()],
      daemon: { online: true, workflows: [{ id: 'team-run', name: '三角色协作开发' }] },
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    })
    const matches = result.packages.filter(item => item.id === 'team-run')
    assert.equal(matches.length, 1)
    assert.equal(matches[0].origin, 'repo')
    assert.equal(matches[0].graph.nodes.length, 5)
    const note = result.diagnostics.find(item => item.id === 'team-run' && item.code === 'superseded')
    assert.equal(note.origin, 'daemon')
  })

  it('lets a personal workflow win when executable content ties', () => {
    const personal = {
      id: 'team-run',
      name: '我的三角色流程',
      source: 'personal',
      status: 'published',
      executionBackends: ['local-team'],
      agentRefs: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
      graph: { nodes: TEAM_RUN_DEFINITION.nodes.map(node => ({ id: node.id, type: node.type })) },
    }
    const result = supply({
      repoWorkflows: [repoEntry()],
      personal: [personal],
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    })
    const pkg = result.packages.find(item => item.id === 'team-run')
    assert.equal(pkg.origin, 'personal')
  })

  it('truncates an oversized repository index and records it', () => {
    const entries = Array.from({ length: MAX_REPO_WORKFLOWS + 3 }, (_, index) => repoEntry({
      id: `flow-${index}`,
    }))
    const result = supply({ repoWorkflows: entries, agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }] })
    assert.equal(result.packages.length, MAX_REPO_WORKFLOWS)
    const note = result.diagnostics.find(item => item.code === 'truncated')
    assert.equal(note.count, 3)
  })
})

describe('workflow readiness', () => {
  it('blocks a workflow whose agent does not exist and names the agent', () => {
    const result = supply({
      verticals: [{
        id: 'visual-brief-to-export',
        name: 'Brief → 导出',
        source: 'official',
        status: 'published',
        executionBackends: ['local-team'],
        agentRefs: [{ id: 'copywriter' }, { id: 'designer' }],
      }],
      agents: [{ id: 'office-partner' }],
    })
    const pkg = result.packages.find(item => item.id === 'visual-brief-to-export')
    assert.equal(pkg.readiness.runnable, false)
    assert.deepEqual(pkg.readiness.blockers.map(item => item.agentId), ['copywriter', 'designer'])
    assert.equal(pkg.readiness.blockers[0].fixAction.kind, 'install-agent')
  })

  it('resolves an aliased agent reference against the installed agent', () => {
    const result = supply({
      verticals: [{
        id: 'office-meeting-to-actions',
        name: '会议 → 待办',
        source: 'official',
        status: 'published',
        executionBackends: ['local-team'],
        agentRefs: [{ id: 'office-assistant' }],
      }],
      agents: [{ id: 'office-partner' }],
    })
    const pkg = result.packages.find(item => item.id === 'office-meeting-to-actions')
    assert.deepEqual(pkg.agentRefs.map(ref => ref.id), ['office-partner'])
    assert.equal(pkg.readiness.runnable, true)
  })

  it('blocks a daemon-only workflow when the daemon is offline', () => {
    const result = supply({
      daemon: { online: false, workflows: [] },
      personal: [{
        id: 'daemon-only',
        name: '仅守护执行',
        source: 'personal',
        status: 'published',
        executionBackends: ['daemon'],
        agentRefs: [{ id: 'producer' }],
      }],
      agents: [{ id: 'producer' }],
    })
    const pkg = result.packages.find(item => item.id === 'daemon-only')
    assert.equal(pkg.readiness.runnable, false)
    assert.equal(pkg.readiness.blockers[0].code, 'daemon-offline')
  })

  it('blocks a repository workflow when no content source is active', () => {
    const result = supply({
      repoWorkflows: [repoEntry()],
      repoActive: false,
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    })
    const pkg = result.packages.find(item => item.id === 'team-run')
    assert.equal(pkg.readiness.runnable, false)
    assert.equal(pkg.readiness.blockers[0].code, 'repo-required')
  })

  it('summarises runnable and blocked counts for the shelf', () => {
    const result = supply({
      repoWorkflows: [repoEntry()],
      verticals: [{
        id: 'visual-brief-to-export',
        name: 'Brief → 导出',
        source: 'official',
        status: 'published',
        executionBackends: ['local-team'],
        agentRefs: [{ id: 'designer' }],
      }],
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    })
    assert.equal(result.stats.total, 2)
    assert.equal(result.stats.runnable, 1)
    assert.equal(result.stats.blocked, 1)
    assert.equal(result.stats.byOrigin.repo, 1)
  })
})
