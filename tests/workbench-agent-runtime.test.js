const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeLocalAgentPackage,
} = require('../src/lib/agent-package-runtime')
const { compileWorkbenchAgentGraph } = require('../src/lib/workbench-agent-graph')
const { AgentTeamWorkflowRunner } = require('../src/lib/agent-team-workflow-runner')

function packageFor(id) {
  return normalizeLocalAgentPackage({
    packageId: id,
    name: id,
    persona: { role: id },
    inputs: { type: 'object', properties: {} },
    outputs: { type: 'object', properties: {} },
  })
}

class FakeRunManager {
  constructor() {
    this.runs = new Map()
    this.nextId = 0
    this.launcher = { probeHealth: () => ({ ok: true }) }
  }

  adoptRunningRun(spec) {
    const run = this.runs.get(spec.runId) || {
      runId: spec.runId,
      status: 'running',
      childRunIds: [],
      rootRunId: spec.runId,
      meta: {},
    }
    Object.assign(run, spec, { status: 'running' })
    this.runs.set(spec.runId, run)
    return { ok: true, runId: spec.runId, run }
  }

  createChildRun(parentRunId, spec) {
    const runId = spec.runId || `child_${++this.nextId}`
    const run = {
      ...spec,
      runId,
      parentRunId,
      rootRunId: parentRunId,
      status: 'completed',
      artifactRefs: [`artifact:${runId}`],
      evidenceRefs: [`evidence:${runId}`],
    }
    this.runs.set(runId, run)
    this.runs.get(parentRunId).childRunIds.push(runId)
    return { ok: true, runId, run }
  }

  awaitRun(runId) {
    return Promise.resolve({
      ok: true,
      status: 'completed',
      terminal: 'completed',
      summary: `完成 ${runId}`,
    })
  }

  getRun(runId) {
    const run = this.runs.get(runId)
    return run ? { ok: true, run } : { ok: false, code: 'not_found' }
  }

  completeAdoptedRun(runId, result) {
    Object.assign(this.runs.get(runId), result, { status: result.status || 'completed' })
    return { ok: true }
  }
}

describe('workbench-agent-runtime', () => {
  it('executes a confirmed serial graph through the Team Workflow Runner', async () => {
    const packages = {
      researcher: packageFor('researcher'),
      writer: packageFor('writer'),
    }
    const compiled = compileWorkbenchAgentGraph({
      goal: '整理调研并写成摘要',
      template: 'serial',
      members: [
        { id: 'research', agentPackageId: 'researcher', role: '调研 Agent' },
        { id: 'write', agentPackageId: 'writer', role: '写作 Agent' },
      ],
    }, {
      resolveAgentPackage: id => packages[id],
    })
    assert.equal(compiled.ok, true)

    const manager = new FakeRunManager()
    const events = []
    const runner = new AgentTeamWorkflowRunner({
      runManager: manager,
      resolveAgentPackage: id => packages[id],
      requestGateDecision: async () => ({ approved: true }),
      emit: event => events.push(event),
    })
    const result = await runner.run(compiled.teamPackage, { source: 'test' }, {
      rootRunId: 'root_graph_test',
    })

    assert.equal(result.ok, true)
    assert.equal(result.status, 'completed')
    assert.deepEqual(
      [...manager.runs.values()].filter(run => run.parentRunId).map(run => run.expertId),
      ['researcher', 'writer'],
    )
    assert.ok(events.some(event => event.type === 'team.node.completed'))
  })

  it('keeps a gate as a blocking decision before the next Agent', async () => {
    const packages = { first: packageFor('first'), second: packageFor('second') }
    const compiled = compileWorkbenchAgentGraph({
      goal: '审批后继续',
      template: 'gate',
      members: [
        { id: 'first', agentPackageId: 'first', role: '准备 Agent' },
        { id: 'second', agentPackageId: 'second', role: '执行 Agent' },
      ],
      gates: [{ id: 'review', title: '人工审批' }],
    }, {
      resolveAgentPackage: id => packages[id],
    })
    assert.equal(compiled.ok, true)

    let gateRequested = false
    const manager = new FakeRunManager()
    const runner = new AgentTeamWorkflowRunner({
      runManager: manager,
      resolveAgentPackage: id => packages[id],
      requestGateDecision: async () => {
        gateRequested = true
        assert.deepEqual(
          [...manager.runs.values()].filter(run => run.parentRunId).map(run => run.expertId),
          ['first'],
        )
        return { approved: true }
      },
    })
    const result = await runner.run(compiled.teamPackage, {}, { rootRunId: 'root_gate_test' })
    assert.equal(result.ok, true)
    assert.equal(gateRequested, true)
    assert.deepEqual(
      [...manager.runs.values()].filter(run => run.parentRunId).map(run => run.expertId),
      ['first', 'second'],
    )
  })
})
