'use strict'

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { validateAgentPackage, validateTeamPackage } = require('../src/lib/agent-package-runtime')
const { AgentRunStore } = require('../src/lib/agent-run-store')
const { AgentRunScheduler } = require('../src/lib/agent-run-scheduler')
const { AgentRunLauncher } = require('../src/lib/agent-run-launcher')
const { AgentRunManager } = require('../src/lib/agent-run-manager')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { AgentTeamWorkflowRunner } = require('../src/lib/agent-team-workflow-runner')

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'agent-team-runtime')
const tempDirs = []

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, ...parts), 'utf8'))
}

function loadPackages() {
  const cursor = validateAgentPackage(readJson('agents', 'cursor-research-agent', 'agent.package.json'))
  const claude = validateAgentPackage(readJson('agents', 'claude-writer-agent', 'agent.package.json'))
  assert.equal(cursor.ok, true)
  assert.equal(claude.ok, true)
  return new Map([
    [cursor.manifest.packageId, cursor],
    [claude.manifest.packageId, claude],
  ])
}

function createStack(packages) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-team-workflow-'))
  tempDirs.push(rootDir)
  const store = new AgentRunStore({ rootDir })
  const scheduler = new AgentRunScheduler({ maxParallel: 2, maxChildren: 4 })
  let active = 0
  let maxActive = 0
  const launcher = new AgentRunLauncher({
    buildPorts: ({ runId, expertId }) => {
      const ports = createMockRunPorts({
        input: { runId, prompt: `execute ${expertId}`, tier: 'chat' },
        session: {
          id: `session_${runId}`,
          messages: [],
          run: {},
          artifacts: [{ id: `artifact_${runId}`, type: 'report', title: `${expertId} report` }],
        },
        llmScript: [{ response: { text: `${expertId} completed` } }],
      })
      const complete = ports.llm.complete.bind(ports.llm)
      ports.llm.complete = async (...args) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        try {
          await new Promise(resolve => setTimeout(resolve, 25))
          return await complete(...args)
        } finally {
          active -= 1
        }
      }
      return ports
    },
  })
  const remoteClient = builder => ({
    handshake: async () => ({
      protocolVersion: 1,
      capabilities: ['executeAgentRun', 'cancelRun', 'fetchRunStatus'],
      builderId: builder,
    }),
    executeAgentRun: async ({ runId, agentPackageId }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      try {
        await new Promise(resolve => setTimeout(resolve, 25))
        return {
          taskId: `${builder}_${runId}`,
          terminal: 'completed',
          summary: `${agentPackageId} completed by ${builder}`,
        }
      } finally {
        active -= 1
      }
    },
    fetchRunStatus: async runId => ({ runId, status: 'completed', terminal: 'completed' }),
    cancelRun: async () => ({ ok: true, status: 'cancelled' }),
  })
  launcher.registerRemoteBackends({
    cursor: remoteClient('cursor'),
    claude: remoteClient('claude'),
  })
  const manager = new AgentRunManager({
    runStore: store,
    scheduler,
    launcher,
    authorizeChild: spec => packages.has(spec.expertId)
      ? { ok: true }
      : { ok: false, code: 'unknown_agent' },
  })
  return { rootDir, store, scheduler, launcher, manager, getMaxActive: () => maxActive }
}

afterEach(() => {
  while (tempDirs.length) {
    try { fs.rmSync(tempDirs.pop(), { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

describe('AgentTeamWorkflowRunner production workflow', () => {
  it('validates the checked-in cross-builder Team Package', () => {
    const packages = loadPackages()
    const team = validateTeamPackage(
      readJson('teams', 'cross-builder-delivery', 'team.package.json'),
      { resolveAgentPackage: id => packages.get(id) || { ok: false } },
    )
    assert.equal(team.ok, true)
    assert.equal(team.manifest.workflow.parallelism, 2)
    assert.equal(team.manifest.workflow.joinStrategy, 'allSucceeded')
    assert.deepEqual(
      new Set(team.manifest.members.map(member => packages.get(member.agentPackageId).manifest.builder)),
      new Set(['cursor', 'claude']),
    )
    const gate = team.manifest.gates.find(item => item.id === 'approval-draft')
    assert.equal(gate.params.onReject.action, 'rollback')
    assert.equal(gate.params.onReject.targetNodeId, 'n-research')
  })

  it('runs serial handoff, one gate rollback, parallel join, and final aggregation', async () => {
    const packages = loadPackages()
    const stack = createStack(packages)
    const emitted = []
    let gateCalls = 0
    const runner = new AgentTeamWorkflowRunner({
      runManager: stack.manager,
      resolveAgentPackage: id => packages.get(id),
      requestGateDecision: async () => {
        gateCalls += 1
        return gateCalls === 1
          ? { approved: false, reason: 'revise_research' }
          : { approved: true }
      },
      emit: event => emitted.push(event),
      defaultTimeoutMs: 5000,
    })

    const result = await runner.run(
      readJson('teams', 'cross-builder-delivery', 'team.package.json'),
      { topic: 'production runtime' },
      { rootRunId: 'run_cross_builder_workflow' },
    )

    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.status, 'completed')
    assert.equal(result.gateRollbacks, 1)
    assert.equal(gateCalls, 2)
    assert.equal(result.nodeStates['n-done'], 'completed')
    assert.equal(result.results['n-parallel-c'].builder, 'cursor')
    assert.equal(result.results['n-parallel-d'].builder, 'claude')
    assert.ok(stack.getMaxActive() >= 2, 'parallel branches must overlap')
    assert.ok(emitted.some(event => event.type === 'team.gate.rollback'))
    assert.ok(emitted.some(event => event.type === 'team.join.completed'))

    const root = stack.manager.getRun('run_cross_builder_workflow')
    assert.equal(root.ok, true)
    assert.equal(root.run.status, 'done')
    assert.equal(root.run.meta.metrics.gateRollbacks, 1)
    assert.equal(root.run.terminal, true)

    const tree = stack.manager.getRunTree('run_cross_builder_workflow')
    assert.equal(tree.ok, true)
    assert.ok(Object.keys(tree.nodes).length >= 7)
    const childBuilders = new Set(
      Object.values(tree.nodes)
        .filter(node => node.parentRunId)
        .map(node => node.meta?.builderId),
    )
    assert.ok(childBuilders.has('cursor'))
    assert.ok(childBuilders.has('claude'))
  })

  it('fails closed when a Team member cannot be resolved', async () => {
    const packages = loadPackages()
    const stack = createStack(packages)
    const runner = new AgentTeamWorkflowRunner({
      runManager: stack.manager,
      resolveAgentPackage: id => id === 'claude-writer-agent' ? null : packages.get(id),
    })
    const result = await runner.run(
      readJson('teams', 'cross-builder-delivery', 'team.package.json'),
      {},
      { rootRunId: 'run_unresolved_team' },
    )
    assert.equal(result.ok, false)
    assert.ok(result.issues.some(issue => issue.code === 'unresolved_member'))
    assert.equal(stack.manager.getRun('run_unresolved_team').ok, false)
  })

  it('persists adopted root start without calling an undefined persistence method', () => {
    const packages = loadPackages()
    const stack = createStack(packages)
    const adopted = stack.manager.adoptRunningRun({ runId: 'run_adopt_regression' })
    assert.equal(adopted.ok, true)
    assert.equal(stack.manager.getRun('run_adopt_regression').run.status, 'running')
    const replay = stack.store.replay('run_adopt_regression')
    assert.equal(replay.ok, true)
    assert.ok(replay.events.some(event => event.type === 'run.started'))
  })

  it('notifies waiters immediately when a child backend cannot launch', async () => {
    const packages = loadPackages()
    const stack = createStack(packages)
    stack.manager.adoptRunningRun({ runId: 'run_launch_failure_parent' })
    const child = stack.manager.createChildRun('run_launch_failure_parent', {
      expertId: 'cursor-research-agent',
      backend: 'missing-production-backend',
      prompt: 'must fail closed',
    })
    assert.equal(child.ok, true)
    const startedAt = Date.now()
    const terminal = await stack.manager.awaitRun(child.runId, 1000)
    assert.equal(terminal.ok, true)
    assert.equal(terminal.status, 'error')
    assert.match(terminal.stopReason, /Unknown launcher backend/)
    assert.ok(Date.now() - startedAt < 900)
  })
})
