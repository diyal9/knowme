'use strict'

const fs = require('fs')
const path = require('path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createStore: createWorkflowStore } = require('../src/lib/workflow-package-store')
const { createWorkflowV2Runtime } = require('../src/lib/workflow-v2-runtime')

const TARGET_WORKFLOW = 'th-art-psd-to-artbundle'
const ENTRY_SKILLS = ['th-art-artbundle-workflow', 'th-art-creator-debug']

function resolveUserData() {
  const explicit = String(process.argv[3] || '').trim()
  const appData = String(process.env.APPDATA || '').trim()
  const userData = path.resolve(explicit || path.join(appData, 'KnowMe'))
  if (!appData || path.basename(userData).toLowerCase() !== 'knowme') {
    throw new Error(`拒绝写入非 KnowMe 用户目录: ${userData}`)
  }
  return userData
}

function backupCurrentState(userData) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupRoot = path.join(userData, 'backups', `th-art-import-${stamp}`)
  fs.mkdirSync(backupRoot, { recursive: true })
  const capabilities = path.join(userData, 'capabilities')
  const workflows = path.join(userData, 'workbench-workflows.json')
  if (fs.existsSync(capabilities)) {
    fs.cpSync(capabilities, path.join(backupRoot, 'capabilities'), { recursive: true })
  }
  if (fs.existsSync(workflows)) {
    fs.copyFileSync(workflows, path.join(backupRoot, 'workbench-workflows.json'))
  }
  return backupRoot
}

async function main() {
  const sourceRoot = path.resolve(process.argv[2] || 'D:/aiworkspace/th-art')
  const userData = resolveUserData()
  if (!fs.existsSync(sourceRoot)) throw new Error(`源项目不存在: ${sourceRoot}`)
  if (!fs.existsSync(userData)) throw new Error(`KnowMe 用户目录不存在: ${userData}`)

  const backupRoot = backupCurrentState(userData)
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
    workflowIds: [TARGET_WORKFLOW],
    additionalSkillIds: ENTRY_SKILLS,
    includeOptionalSkills: false,
    includeConnectors: true,
  })
  if (!planned.ok) throw new Error(planned.error || planned.code || 'plan_failed')

  const imported = await hub.importCursorRepository({
    planToken: planned.planToken,
    trustConfirmed: true,
    riskConfirmed: true,
  })
  const workflowId = imported.idMaps?.workflows?.[TARGET_WORKFLOW] || ''
  const verified = await hub.verifyImportedWorkflow({ workflowId })
  const persisted = workflowStore.list().packages.find(item => item.id === workflowId)
  const runtimeValidation = persisted
    ? createWorkflowV2Runtime({ userData, workflowStore }).validate({ package: persisted })
    : { ok: false, issues: [{ code: 'workflow_not_found', message: '导入后未读取到工作流' }] }
  const result = {
    userData,
    backupRoot,
    sourceRoot,
    preview: preview.counts,
    plan: planned.plan?.counts,
    idMaps: imported.idMaps,
    importCounts: imported.counts,
    complete: imported.complete === true,
    workflow: persisted ? {
      id: persisted.id,
      name: persisted.name,
      status: persisted.status,
      nodes: persisted.graph?.nodes?.length || 0,
      gates: persisted.qualityGates?.length || 0,
      agentRefs: persisted.agentRefs?.map(item => item.id) || [],
      skillRefs: persisted.skillRefs?.map(item => item.id) || [],
    } : null,
    verification: {
      ok: verified.ok === true,
      nodes: verified.workflow?.nodes,
      gates: verified.workflow?.gates,
      experts: verified.experts?.map(item => item.id) || [],
      skills: verified.skills?.map(item => item.id) || [],
      issues: verified.issues || [],
    },
    runtimeValidation: {
      ok: runtimeValidation.ok === true,
      issues: runtimeValidation.issues || [],
    },
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.complete || !result.verification.ok || !result.runtimeValidation.ok || !result.workflow) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})
