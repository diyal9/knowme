'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { loadBundledCatalog } = require('../src/lib/capability-catalog')
const { installCurated } = require('../src/lib/capability-import')
const { resolvePaths } = require('../src/lib/capability-store')
const { createExpertRuntime } = require('../src/lib/expert-runtime')
const {
  IMPORT_EXPERT_ID,
  buildCapabilityImportTools,
} = require('../src/lib/agent-capability-import-tools')

describe('external capability importer expert tools', () => {
  it('is published and installed only as a first-class Expert Agent', () => {
    const bundledRoot = path.resolve(__dirname, '../src/catalog')
    const catalog = loadBundledCatalog(bundledRoot)
    const published = catalog.entries.filter(item => (
      item.id === IMPORT_EXPERT_ID || item.id === 'external-capability-import'
    ))
    assert.deepEqual(published.map(item => ({ id: item.id, kind: item.kind })), [
      { id: IMPORT_EXPERT_ID, kind: 'expert' },
    ])

    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-import-expert-'))
    const installed = installCurated(userData, IMPORT_EXPERT_ID, { bundledRoot, riskConfirmed: true })
    assert.equal(installed.ok, true)
    assert.equal(installed.entry.kind, 'expert')
    assert.equal(installed.entry.id, IMPORT_EXPERT_ID)
    assert.ok(fs.existsSync(path.join(installed.installDir, 'EXPERT.md')))
    assert.equal(fs.existsSync(path.join(installed.installDir, 'SKILL.md')), false)
    const expert = createExpertRuntime({ capabilitiesRoot: resolvePaths(userData).root })
      .loadExpert(IMPORT_EXPERT_ID)
    assert.equal(expert.ok, true)
    assert.equal(expert.name, '智能体运维专员')
    assert.match(expert.systemPrompt, /preview_external_project/)
    assert.deepEqual(expert.skills, [])
  })

  it('previews before write and preserves the opaque snapshot token', async () => {
    const calls = []
    const tools = buildCapabilityImportTools({
      hub: {
        scanCursorRepositoryForHub: async (payload) => {
          calls.push(['preview', payload])
          return { ok: true, previewToken: 'snapshot-1', counts: { skills: 2, experts: 1, workflows: 1 } }
        },
        importCursorRepository: async (payload) => {
          calls.push(['import', payload])
          return { ok: true, counts: { installed: 4 } }
        },
      },
    })
    assert.equal(IMPORT_EXPERT_ID, 'external-capability-importer')
    const preview = await tools.handlers.preview_external_project({ path: 'D:/project' })
    assert.equal(preview.ok, true)
    assert.equal(preview.meta.previewToken, 'snapshot-1')
    assert.deepEqual(calls, [['preview', { path: 'D:/project' }]])
  })

  it('designs a workflow dependency closure and verifies the imported workflow', async () => {
    const calls = []
    const tools = buildCapabilityImportTools({
      hub: {
        planCursorRepositoryForHub: async payload => {
          calls.push(['plan', payload])
          return { ok: true, planToken: 'plan-1', plan: { counts: { workflows: 1, experts: 2, skills: 10 } } }
        },
        importCursorRepository: async payload => {
          calls.push(['import', payload])
          return { ok: true, counts: { installed: 13 }, idMaps: { workflows: { source: 'workflow-1' } } }
        },
        verifyImportedWorkflow: async payload => {
          calls.push(['verify', payload])
          return { ok: true, workflow: { id: payload.workflowId, nodes: 17, gates: 5 } }
        },
      },
    })
    const plan = await tools.handlers.design_external_workflow_import({
      preview_token: 'snapshot-1',
      workflow_ids: ['th-art-psd-to-artbundle'],
      additional_skill_ids: ['th-art-artbundle-workflow', 'th-art-creator-debug'],
    })
    assert.equal(plan.ok, true)
    assert.equal(plan.meta.planToken, 'plan-1')

    const imported = await tools.handlers.import_external_project({ plan_token: 'plan-1', trust_confirmed: true })
    assert.equal(imported.ok, true)
    const verified = await tools.handlers.verify_imported_workflow({ workflow_id: 'workflow-1' })
    assert.equal(verified.ok, true)
    assert.deepEqual(calls.map(item => item[0]), ['plan', 'import', 'verify'])
  })

  it('refuses commit without explicit trust confirmation', async () => {
    let imported = false
    const tools = buildCapabilityImportTools({
      hub: {
        importCursorRepository: async () => { imported = true; return { ok: true } },
      },
    })
    const refused = await tools.handlers.import_external_project({ preview_token: 'snapshot-1', trust_confirmed: false })
    assert.equal(refused.ok, false)
    assert.equal(refused.code, 'trust_required')
    assert.equal(imported, false)

    const accepted = await tools.handlers.import_external_project({ preview_token: 'snapshot-1', trust_confirmed: true })
    assert.equal(accepted.ok, true)
    assert.equal(imported, true)
  })
})
