'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const artifactTools = require('../src/lib/agent-artifact-tools')

describe('agent-artifact-tools', () => {
  it('creates markdown artifact with ref', async () => {
    const { handlers, store } = artifactTools.buildArtifactTools({ runId: 'r1' })
    const r = await handlers.create_artifact({ kind: 'markdown', title: 'Report', content: '# Hi' })
    assert.equal(r.ok, true)
    assert.equal(r.artifactRefs.length, 1)
    assert.ok(store.get(r.artifactRefs[0].id))
  })

  it('updates artifact content', async () => {
    const { handlers } = artifactTools.buildArtifactTools({ runId: 'r1' })
    const created = await handlers.create_artifact({ kind: 'text', content: 'a' })
    const id = created.artifactRefs[0].id
    const updated = await handlers.update_artifact({ id, content: 'b' })
    assert.equal(updated.ok, true)
  })

  it('exports csv from rows', async () => {
    const { handlers } = artifactTools.buildArtifactTools({ runId: 'r1' })
    const r = await handlers.export_artifact_csv({ title: 't', rows: [{ a: 1, b: 2 }] })
    assert.equal(r.ok, true)
    assert.match(r.text, /CSV/)
  })

  it('rejects pdf over page limit', async () => {
    const { handlers } = artifactTools.buildArtifactTools({ runId: 'r1' })
    const huge = 'x'.repeat(artifactTools.MAX_PDF_PAGES * 4000)
    const r = await handlers.export_artifact_pdf({ markdown: huge })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'pdf_too_large')
  })

  it('rowsToCsv escapes commas and quotes', () => {
    const csv = artifactTools.rowsToCsv([{ name: 'a,b', val: 'q"u' }])
    assert.match(csv, /"a,b"/)
    assert.match(csv, /""/)
  })
})
