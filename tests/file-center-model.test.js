'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const model = require('../src/lib/file-center-model')

test('normalizes generated artifact with session provenance', () => {
  const item = model.normalizeGeneratedArtifact(
    { id: 'a1', title: '报告', status: 'accepted', targetPath: 'reports/a.md' },
    { id: 's1', displayTitle: '会议整理', updatedAt: '2026-08-01T01:00:00.000Z' },
  )
  assert.deepEqual(item, {
    id: 'a1',
    sessionId: 's1',
    title: '报告',
    type: 'text',
    status: 'accepted',
    sessionTitle: '会议整理',
    updatedAt: '2026-08-01T01:00:00.000Z',
    targetPath: 'reports/a.md',
  })
  assert.equal(model.artifactStatusLabel('accepted'), '已接受')
  assert.equal(model.artifactMetaLabel(item), '已接受 · a.md')
})

test('collects recent artifacts without mixing invalid entries', () => {
  const rows = model.collectGeneratedArtifacts([
    {
      id: 'old',
      displayTitle: '旧会话',
      updatedAt: '2026-07-30T01:00:00.000Z',
      run: { artifacts: [{ id: 'a', title: '旧产物' }] },
    },
    {
      id: 'new',
      displayTitle: '新会话',
      updatedAt: '2026-08-01T01:00:00.000Z',
      run: {
        artifacts: [
          { id: 'b', title: '新产物' },
          { id: 'c', title: '第二产物' },
          null,
        ],
      },
    },
  ], 2)
  assert.deepEqual(rows.map((row) => row.id), ['c', 'b'])
  assert.equal(rows[0].sessionId, 'new')
})
