const { describe, it } = require('node:test')
const assert = require('node:assert')
const trace = require('../src/lib/workbench-task-trace')

describe('workbench task trace', () => {
  it('extracts scene and skill from context meta', () => {
    const result = trace.extractTaskTrace({
      context: {
        meta: {
          sceneId: 'game-dev',
          skillId: 'game-dev-delivery',
          connectors: ['feishu'],
          sources: ['feishu:docx:abc'],
          handoffFrom: 'game-requirement',
        },
      },
      slug: 'demo-task-1',
      workflow: 'team-run',
      session: { id: 'sess-1', run: { id: 'run-1' } },
    })
    assert.equal(result.sceneId, 'game-dev')
    assert.equal(result.skillId, 'game-dev-delivery')
    assert.deepEqual(result.connectors, ['feishu'])
    assert.equal(result.sessionId, 'sess-1')
    assert.equal(result.runId, 'run-1')
  })

  it('builds visible rows', () => {
    const rows = trace.traceRows({
      sceneId: 'game-design',
      skillId: 'game-requirement-doc',
      connectors: ['feishu'],
    })
    assert.ok(rows.length >= 3)
    assert.ok(trace.hasVisibleTrace({ sceneId: 'game-design' }))
  })
})
