'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')

for (const approval of [false, true]) it(`production result projection preserves ${approval ? 'approval' : 'resource'} attention from the real executor`, async () => {
  const fixture = { input: { prompt: '处理目标', tier: 'assist', forceTools: true },
    llmScript: [0, 1].map(() => ({ response: { toolCalls: [{ name: 'target', arguments: '{}' }] } })),
  }
  const ports = createMockRunPorts(fixture)
  ports.tools.execute = async () => approval
    ? { ok: true, requiresApproval: true, code: 'approval_required', draftId: 'approval-test', text: '等待审批' }
    // This fixture models a pre-dispatch resource check, not a failed write.
    : { ok: false, code: 'missing_resource', text: 'ENOENT: no such file', executionStarted: false }
  const session = { id: 'isolated-projection', run: { artifacts: [] } }
  const prepared = { session, s: {}, tier: 'assist', modelProfile: {}, prompt: fixture.input.prompt,
    effectivePersonalization: { applied: [], omitted: [] }, tokenCalBefore: { samples: 0 } }
  const completeRuns = []
  const surface = { session, resolvedSurface: {}, connectorRuntime: { close: async () => {} },
    teamRuntime: { manager: { completeAdoptedRun: (_id, result) => completeRuns.push(result),
      cancelAllChildren: async () => {}, saveCheckpoint: () => {} }, store: { writeReceipt: () => {} } } }
  const modules = {
    './agent-generate-libs': { AgentRunExecutor, buildProductionRunPorts: () => ports,
      resolveAgentExecutorMode: () => 'kernel', productMemory: { capture: () => {} },
      agentProcessTools: { cancelProcessesForRun: () => {} },
      contextEngine: { isToolExecutionAllowed: () => true, recordContextOutcome: () => {} },
      logger: { error: () => {} } },
    './agent-generate-prepare': { prepareAgentGenerate: async () => prepared },
    './agent-generate-tool-surface': { buildRunToolSurface: async () => surface },
    './agent-generate-child-ports': { createChildRunPortFactory: () => ({}), makeOrchestrationPort: () => () => ({}) },
  }
  // Execute the production projection with only its environment-bound imports
  // stubbed. No Electron import, profile, connector or provider is contacted.
  const loaded = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/lib/agent-generate-execute.ts'), 'utf8'), {
    module: loaded, exports: loaded.exports,
    require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name] },
  })
  const result = await loaded.exports.executeAgentGenerate({
    deps: { agentRuntimePortFactories: new Map(), agentRuntimeOutputBridges: new Map(), activeAgentRuns: new Map() },
    payload: fixture.input, runId: 'projection-qa', signal: new AbortController().signal,
    stage: () => {}, emit: () => {}, fail: error => ({ error: String(error) }), metrics: {}, runStartedAt: Date.now(),
  })
  assert.equal(result.error, undefined)
  assert.equal(result.attention?.action, 'provide_input')
  assert.equal(result.attention?.kind, approval ? 'approval_required' : 'missing_information')
  assert.equal(result.executionEvidence.verificationPassed, false)
  assert.equal(result.artifactRefs.length, 0)
  assert.equal(completeRuns.length, 1)
})

it('RQA68 production failure projection preserves typed review diagnostics and metrics', async () => {
  const kernelFailure = {
    error: '专家答复未通过专业质量复核，需修正：补全验收边界。',
    code: 'professional_review_failed',
    terminal: 'ERROR',
    errorInfo: { code: 'professional_review_failed', message: '专业质量复核失败' },
    metrics: {
      qualityReview: {
        enabled: true,
        passed: false,
        rewritten: false,
        initialIssues: [{ criterion: 1, problem: '缺少边界', requiredChange: '补全验收边界' }],
      },
      finalizationBudget: { maxModelCalls: 3, usedModelCalls: 2, exhausted: true },
    },
    report: { terminal: 'ERROR', error: { code: 'professional_review_failed', message: '专业质量复核失败' } },
  }
  const session = { id: 'failure-projection', messages: [], run: { artifacts: [] } }
  const prepared = {
    session, s: {}, tier: 'assist', modelProfile: { model: 'offline-fixture' }, prompt: '执行任务',
    effectivePersonalization: { applied: [], omitted: [] }, tokenCalBefore: { samples: 0 },
  }
  const surface = {
    session, resolvedSurface: {}, connectorRuntime: { close: async () => {} },
    teamRuntime: { manager: { completeAdoptedRun: () => {}, cancelAllChildren: async () => {}, saveCheckpoint: () => {} },
      store: { writeReceipt: () => {} } },
  }
  const modules = {
    './agent-generate-libs': {
      AgentRunExecutor: { run: async () => kernelFailure },
      buildProductionRunPorts: () => ({}), resolveAgentExecutorMode: () => 'kernel',
      productMemory: { capture: () => {} }, agentProcessTools: { cancelProcessesForRun: () => {} },
      contextEngine: { isToolExecutionAllowed: () => true, recordContextOutcome: () => {} },
      logger: { error: () => {} },
    },
    './agent-generate-prepare': { prepareAgentGenerate: async () => prepared },
    './agent-generate-tool-surface': { buildRunToolSurface: async () => surface },
    './agent-generate-child-ports': { createChildRunPortFactory: () => ({}), makeOrchestrationPort: () => () => ({}) },
  }
  const loaded = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/lib/agent-generate-execute.ts'), 'utf8'), {
    module: loaded, exports: loaded.exports,
    require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name] },
  })
  const result = await loaded.exports.executeAgentGenerate({
    deps: { agentRuntimePortFactories: new Map(), agentRuntimeOutputBridges: new Map(), activeAgentRuns: new Map() },
    payload: { prompt: '执行任务' }, runId: 'failure-projection-run', signal: new AbortController().signal,
    stage: () => {}, emit: () => {}, fail: error => ({ error: String(error), runId: 'failure-projection-run' }),
    metrics: {}, runStartedAt: Date.now(),
  })

  assert.equal(result.error, kernelFailure.error)
  assert.equal(result.code, 'professional_review_failed')
  assert.equal(result.terminal, 'ERROR')
  assert.deepEqual(result.metrics, kernelFailure.metrics)
  assert.deepEqual(result.errorInfo, kernelFailure.errorInfo)
  assert.deepEqual(result.report, kernelFailure.report)
})
