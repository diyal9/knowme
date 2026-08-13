'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const review = require('../src/lib/workbench-daemon-review')

describe('workbench-daemon-review', () => {
  it('projects process transcript with empty progress and logs', () => {
    const view = review.projectProcessTranscript({
      slug: 'demo',
      intent: '验收',
      status: 'failed',
      progressText: '',
      logsText: '',
    })
    assert.equal(view.progress.empty, true)
    assert.match(view.progress.emptyLabel, /过程/)
    assert.equal(view.progress.title, '全部过程')
    assert.equal(view.logs.empty, true)
    assert.equal(view.tip, '')
  })

  it('truncates log tail and keeps progress text', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `line-${i}`)
    const view = review.projectProcessTranscript({
      progressText: '# ok\nbody',
      logsText: lines.join('\n'),
    })
    assert.equal(view.progress.empty, false)
    assert.equal(view.progress.title, '全部过程')
    assert.equal(view.tip, '')
    assert.equal(view.logs.lines.length, 200)
    assert.equal(view.logs.lines[0], 'line-50')
    assert.equal(view.logs.lines.at(-1), 'line-249')
  })

  it('recommends artifacts tab when done with files', () => {
    const tab = review.recommendTab({
      status: 'completed',
      steps: [{ id: 'a' }],
      artifacts: [{ name: 'a.md' }],
    })
    assert.equal(tab, 'artifacts')
  })

  it('projects review surface tabs and empty artifacts', () => {
    const surface = review.projectReviewSurface({
      slug: 't1',
      intent: 'team-run',
      nodes: [{ id: 'n1', label: '制作人', status: 'done' }],
      artifacts: [],
      events: [{ type: 'job', message: 'failed' }],
      changes: { files: [] },
      status: 'failed',
      progressText: '',
      logsText: 'line-a\nline-b',
    })
    assert.equal(surface.activeTab, 'logs')
    assert.equal(surface.tabs.length, 5)
    assert.equal(surface.tabs.map(t => t.id).join(','), 'steps,artifacts,changes,events,logs')
    assert.equal(surface.tabs.at(-1).label, '过程日志')
    assert.equal(surface.artifacts.length, 0)
    assert.equal(surface.steps[0].label, '制作人')
    assert.equal(surface.events[0].message, 'failed')
    assert.equal(surface.changes.empty, true)
    assert.equal(surface.process.logs.empty, false)
    assert.deepEqual(surface.process.logs.lines, ['line-a', 'line-b'])
    assert.equal(surface.recommendation, '')
  })

  it('recommends logs tab when failed', () => {
    const tab = review.recommendTab({
      status: 'failed',
      steps: [{ id: 'a' }],
      artifacts: [],
    })
    assert.equal(tab, 'logs')
  })

  it('passes through step detail fields for micro cards', () => {
    const steps = review.projectSteps({
      nodes: [{
        id: 'ProtoDesigner',
        label: 'ProtoDesigner',
        meta: 'Agent · 执行型后端工匠',
        status: 'active',
        owner: '执行型后端工匠',
        type: 'agent',
        handoff: 'proto_changes_doc · artifacts/proto-changes.md',
        outputLabel: 'proto-changes.md',
        outputTitle: 'artifacts/proto-changes.md',
      }],
    })
    assert.equal(steps[0].outputLabel, 'proto-changes.md')
    assert.equal(steps[0].outputTitle, 'artifacts/proto-changes.md')
    assert.equal(steps[0].owner, '执行型后端工匠')
    assert.equal(steps[0].type, 'agent')
    assert.match(steps[0].handoff, /proto-changes/)
  })

  it('artifact empty state differs for failed vs running', () => {
    const failed = review.artifactEmptyState('failed')
    const running = review.artifactEmptyState('running')
    const done = review.artifactEmptyState('completed')
    assert.match(failed.body, /失败|未能|步骤/)
    assert.match(running.body, /执行|生成/)
    assert.match(done.body, /结束|未发现/)
    assert.notEqual(failed.body, running.body)
    assert.equal(failed.showStepsCta, true)
  })

  it('projects artifact size metadata when present', () => {
    const files = review.projectArtifacts([
      { name: 'report.md', path: '/tmp/report.md', size: 2048, local: true },
    ])
    assert.equal(files.length, 1)
    assert.equal(files[0].name, 'report.md')
    assert.equal(files[0].size, 2048)
    assert.equal(files[0].local, true)
  })

  it('projects a compact chat progress card without log dump', () => {
    const card = review.projectChatProgressCard({
      status: 'waiting',
      waitingKind: 'clarification',
      steps: [
        { id: 'a', label: '需求', status: 'done' },
        { id: 'b', label: '协议定义', status: 'active' },
        { id: 'c', label: '实现', status: 'pending' },
      ],
    })
    assert.equal(card.kind, 'chat-progress')
    assert.equal(card.title, '管线进度')
    assert.equal(card.currentLabel, '协议定义')
    assert.equal(card.statusLabel, '等待你补充信息')
    assert.match(card.progressLine, /1\/3/)
    assert.match(card.tip, /过程日志/)
  })

  it('does not force 100% when waitingKind set even if status is done', () => {
    const card = review.projectChatProgressCard({
      status: 'done',
      waitingKind: 'clarification',
      currentLabel: 'ProtoDesigner',
      steps: Array.from({ length: 12 }, (_, i) => ({
        id: `n${i}`,
        label: i === 2 ? 'ProtoDesigner' : `step-${i}`,
        status: i < 2 ? 'done' : (i === 2 ? 'active' : 'pending'),
      })),
    })
    assert.equal(card.statusLabel, '等待你补充信息')
    assert.match(card.progressLine, /2\/12/)
    assert.notEqual(card.ratio, 100)
  })
})
