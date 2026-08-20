'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createStore: createWorkflowStore } = require('../src/lib/workflow-package-store')

async function main() {
  const sourceRoot = path.resolve(process.argv[2] || 'D:/aiworkspace/th-art')
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-th-art-agent-'))
  try {
    const workflowStore = createWorkflowStore({ userData })
    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getWorkflowStore: () => workflowStore,
      bundledRoot: path.resolve(__dirname, '../src/catalog'),
    })
    const preview = await hub.scanCursorRepositoryForHub({ path: sourceRoot })
    if (!preview.ok) throw new Error(preview.error || preview.code || 'preview_failed')
    const planned = await hub.planCursorRepositoryForHub({
      previewToken: preview.previewToken,
      workflowIds: ['th-art-psd-to-artbundle'],
      additionalSkillIds: ['th-art-artbundle-workflow', 'th-art-creator-debug'],
      includeOptionalSkills: false,
      includeConnectors: true,
    })
    if (!planned.ok) throw new Error(planned.error || planned.code || 'plan_failed')
    const imported = await hub.importCursorRepository({
      planToken: planned.planToken,
      trustConfirmed: true,
      riskConfirmed: true,
    })
    const workflowId = imported.idMaps?.workflows?.['th-art-psd-to-artbundle'] || ''
    const verified = await hub.verifyImportedWorkflow({ workflowId })
    process.stdout.write(`${JSON.stringify({
      preview: preview.counts,
      plan: planned.plan?.counts,
      planExperts: planned.plan?.experts?.map(item => item.id),
      planSkills: planned.plan?.skills?.map(item => item.id),
      importCounts: imported.counts,
      complete: imported.complete,
      workflowId,
      verification: {
        ok: verified.ok,
        nodes: verified.workflow?.nodes,
        gates: verified.workflow?.gates,
        experts: verified.experts?.map(item => item.id),
        skills: verified.skills?.length,
        issues: verified.issues,
      },
    }, null, 2)}\n`)
    if (!imported.complete || !verified.ok) process.exitCode = 1
  } finally {
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`)
  process.exitCode = 1
})
