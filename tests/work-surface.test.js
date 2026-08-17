/**
 * work-surface 状态机
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createWorkSurface, summarizeArtifact } = require('../src/domain/work-surface')

describe('work-surface', () => {
  it('defaults to doc mode', () => {
    const s = createWorkSurface()
    assert.equal(s.getMode(), 'doc')
    assert.equal(s.getArtifactId(), null)
  })

  it('opens review and returns to doc without clearing artifact id memory path', () => {
    const s = createWorkSurface()
    s.openReview('art_1')
    assert.equal(s.getMode(), 'review')
    assert.equal(s.getArtifactId(), 'art_1')
    s.backToDoc()
    assert.equal(s.getMode(), 'doc')
  })

  it('auto-opens first draft from doc', () => {
    const s = createWorkSurface()
    const snap = s.onArtifactsChanged([
      { id: 'a', status: 'draft', title: '提案' },
    ], { autoOpen: true })
    assert.equal(snap.mode, 'review')
    assert.equal(snap.artifactId, 'a')
  })

  it('does not auto-open when already back on doc with autoOpen false', () => {
    const s = createWorkSurface()
    s.openReview('a')
    s.backToDoc()
    const snap = s.onArtifactsChanged([{ id: 'a', status: 'draft' }], { autoOpen: false })
    assert.equal(snap.mode, 'doc')
  })

  it('returns to doc when reviewed artifact leaves draft', () => {
    const s = createWorkSurface()
    s.openReview('a')
    const snap = s.onArtifactsChanged([{ id: 'a', status: 'accepted' }], { autoOpen: true })
    assert.equal(snap.mode, 'doc')
  })

  it('summarizes long artifact body', () => {
    const t = summarizeArtifact({ body: 'x'.repeat(200) }, 50)
    assert.ok(t.endsWith('…'))
    assert.ok(t.length <= 51)
  })
})
