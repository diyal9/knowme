'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeRunStatus,
  domainOf,
  buildConsoleProjection,
  buildVerticalPipelineFacts,
  resolveVerticalPipeline,
  resolveVerticalPipelines,
  buildAutomationLaunchRequest,
  filterByDomain,
} = require('../src/lib/workbench-console-model')

describe('workbench-console-model', () => {
  it('normalizes terminal and attention states without treating terminal as success', () => {
    assert.equal(normalizeRunStatus('completed'), 'success')
    assert.equal(normalizeRunStatus('failed'), 'failure')
    assert.equal(normalizeRunStatus('cancelled'), 'cancelled')
    assert.equal(normalizeRunStatus('approval_required'), 'waiting')
    assert.equal(normalizeRunStatus('terminal'), 'idle')
  })

  it('classifies the three professional domains from explicit metadata and content', () => {
    assert.equal(domainOf({ workModes: ['visual'] }), 'visual')
    assert.equal(domainOf({ title: '开发功能并完成测试' }), 'engineering')
    assert.equal(domainOf({ title: '整理会议纪要与待办' }), 'office')
  })

  it('builds bounded readiness, unified runs and honest automation state', () => {
    const projection = buildConsoleProjection({
      modes: {
        activeModeId: 'office',
        modes: [
          {
            id: 'office',
            name: '日常办公',
            providers: [{ id: 'local-agent', label: '本机 Agent', status: 'available' }],
          },
          {
            id: 'engineering',
            name: '软件研发',
            providers: [{ id: 'daemon', label: '研发服务', status: 'offline' }],
          },
          {
            id: 'visual',
            name: '视觉创作',
            providers: [{ id: 'image-provider', label: '图像服务', kind: 'image', status: 'setup_required' }],
          },
        ],
      },
      workflows: [
        { id: 'meeting-minutes', name: '会议纪要', workModes: ['office'] },
        { id: 'dev-delivery', name: '研发交付', workModes: ['engineering'] },
        { id: 'visual-campaign', name: '视觉海报', workModes: ['visual'] },
      ],
      daemon: {
        online: true,
        tasks: [
          { slug: 'dev-1', intent: '完成研发交付', state: 'running', updatedAt: '2026-08-08T10:00:00Z' },
          { slug: 'dev-2', intent: '处理失败测试', state: 'failed', error: '测试失败', updatedAt: '2026-08-08T11:00:00Z' },
        ],
      },
      agents: [{ id: 'developer' }],
      agentRuns: [{ runId: 'visual-1', goal: '生成宣传图', status: 'waiting', domain: 'visual' }],
      automation: {
        jobs: [{ id: 'auto-1', name: '每日简报', enabled: true, lastStatus: 'idle' }],
      },
    })

    assert.equal(projection.domains.find(item => item.id === 'engineering').ready, true)
    assert.equal(projection.domains.find(item => item.id === 'visual').ready, false)
    assert.equal(projection.runs.length, 3)
    assert.equal(projection.attention.length, 2)
    assert.equal(projection.automation[0].runCapable, false)
    assert.equal(filterByDomain(projection.runs, 'visual').length, 1)
  })

  it('keeps a legacy draft explicit and non-recoverable after terminal state', () => {
    const projection = buildConsoleProjection({
      taskDraft: {
        id: 'legacy-draft',
        goal: '旧本地流程',
        phase: 'failed',
        executionSource: 'legacy-local',
      },
    })
    assert.equal(projection.runs[0].executionSource, 'legacy-local')
    assert.equal(projection.runs[0].recoverable, false)
  })

  it('requires both an office Agent and meeting connector without faking readiness', () => {
    const blocked = resolveVerticalPipeline(
      { id: 'office-meeting-to-actions', provenance: { domain: 'office' }, executionBackends: ['local-team'] },
      buildVerticalPipelineFacts({ modes: { modes: [{ id: 'office', providers: [] }] } }),
    )
    assert.equal(blocked.package.status, 'unavailable')
    assert.equal(blocked.readiness.ready, false)
    assert.ok(blocked.readiness.blockers.length >= 1)
    assert.ok(blocked.readiness.repairAction)

    const ready = resolveVerticalPipeline(
      { id: 'office-meeting-to-actions', provenance: { domain: 'office' }, executionBackends: ['local-team'] },
      buildVerticalPipelineFacts({
        connectors: [{ id: 'feishu', kind: 'connector', enabled: true, ready: true }],
        availableExperts: ['office-assistant'],
      }),
    )
    assert.equal(ready.package.status, 'published')
    assert.equal(ready.readiness.backend, 'local-team')
    assert.equal(ready.readiness.workflowSummary.backend, 'local-team')
  })

  it('resolves engineering vertical pipeline from daemon workflows or local team runtime', () => {
    const daemonReady = resolveVerticalPipelines(buildVerticalPipelineFacts({
      daemon: { online: true, workflows: [{ id: 'team-run' }] },
    })).find(item => item.package.id === 'engineering-delivery')
    assert.equal(daemonReady.readiness.ready, true)
    assert.equal(daemonReady.readiness.backend, 'daemon')

    const localReady = resolveVerticalPipelines(buildVerticalPipelineFacts({
      daemon: { online: false, workflows: [] },
      agents: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
      availableExperts: ['producer', 'developer', 'tester'],
    })).find(item => item.package.id === 'engineering-delivery')
    assert.equal(localReady.readiness.ready, true)
    assert.equal(localReady.readiness.backend, 'local-team')
  })

  it('blocks visual vertical pipeline until image provider and visual capability are ready', () => {
    const blocked = resolveVerticalPipelines(buildVerticalPipelineFacts({
      modes: {
        modes: [{
          id: 'visual',
          providers: [{ id: 'image-provider', kind: 'image', status: 'setup_required' }],
          professionalCapabilities: [{ id: 'copywriting', status: 'available' }],
        }],
      },
    })).find(item => item.package.id === 'visual-brief-to-export')
    assert.equal(blocked.readiness.ready, false)
    assert.ok(blocked.readiness.blockers.some(item => item.id === 'image-provider'))

    const ready = resolveVerticalPipelines(buildVerticalPipelineFacts({
      modes: {
        modes: [{
          id: 'visual',
          providers: [{ id: 'image-provider', kind: 'image', status: 'available' }],
          professionalCapabilities: [{ id: 'copywriting', status: 'available' }],
        }],
      },
      availableExperts: ['copywriter'],
    })).find(item => item.package.id === 'visual-brief-to-export')
    assert.equal(ready.readiness.ready, true)
    assert.equal(ready.readiness.workflowSummary.backend, 'local-team')
  })

  it('returns structured launch request for bound automation when pipeline is ready', () => {
    const facts = buildVerticalPipelineFacts({
      connectors: [{ id: 'feishu', kind: 'connector', enabled: true, ready: true }],
      availableExperts: ['office-assistant'],
    })
    const launch = buildAutomationLaunchRequest({
      id: 'auto-1',
      workflowId: 'office-meeting-to-actions',
      domain: 'office',
      backend: 'local-team',
      prompt: '整理今日会议待办',
    }, facts)
    assert.equal(launch.ok, true)
    assert.equal(launch.launchRequest.resourceType, 'workflow')
    assert.equal(launch.launchRequest.backend, 'local-team')
    assert.equal(launch.launchRequest.goal, '整理今日会议待办')

    const blocked = buildAutomationLaunchRequest({
      id: 'auto-2',
      workflowId: 'office-meeting-to-actions',
      domain: 'office',
      backend: 'local-team',
      prompt: '整理今日会议待办',
    }, buildVerticalPipelineFacts({}))
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, 'pipeline_blocked')

    const unbound = buildAutomationLaunchRequest({ id: 'auto-3', prompt: 'x' }, facts)
    assert.equal(unbound.ok, false)
    assert.equal(unbound.code, 'scheduler_unavailable')
  })
})
