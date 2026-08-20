'use strict'

const fs = require('fs')
const path = require('path')

const { createCapabilityStore } = require('../src/lib/capability-store')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { listCatalog } = require('../src/lib/capability-catalog')
const { createStore: createWorkbenchModeStore } = require('../src/lib/workbench-mode-store')

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function copyIfPresent(source, targetDir) {
  if (!fs.existsSync(source)) return ''
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, path.basename(source))
  fs.copyFileSync(source, target)
  return target
}

function createRuntime(userData, catalogRoot) {
  const getUserData = () => userData
  const store = createCapabilityStore({ getUserData })
  const packs = createCapabilityPackRuntime({
    userData,
    trustedCatalogRoot: catalogRoot,
    getAvailableCapabilityManifests: () => listCatalog(userData, { bundledRoot: catalogRoot })
      .entries.map(entry => entry.manifest).filter(Boolean),
    getOccupiedSkillIds: () => (store.listEntries({ kind: 'skill' }).entries || []).map(entry => entry.id),
  })
  packs.ensureDefaultPacks()
  const hub = createCapabilityHubService({
    getUserData,
    getKnowledgeDir: () => path.join(userData, 'knowledge'),
    getConnectorsApi: () => null,
    bundledRoot: catalogRoot,
    getPackSkillSources: () => packs.listSkillSources(),
    getPackEmptyStateGroups: () => packs.listEmptyStateGroups(),
    getPackScenesForUi: () => packs.listScenesForUi(),
  })
  return { hub, packs, store }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const userData = process.env.KNOWME_USER_DATA
    ? path.resolve(process.env.KNOWME_USER_DATA)
    : path.join(process.env.APPDATA || '', 'KnowMe')
  const catalogRoot = path.resolve(__dirname, '..', 'src', 'catalog')
  const { hub } = createRuntime(userData, catalogRoot)
  const beforeExperts = (await hub.listCapabilities({ kind: 'expert' })).items
  const beforeSkills = (await hub.listCapabilities({ kind: 'skill' })).items
  const result = {
    generatedAt: new Date().toISOString(),
    userData,
    apply,
    backupDir: '',
    inventory: { experts: beforeExperts.length, skills: beforeSkills.length },
    installs: { skills: [], experts: [] },
    workbench: { modeId: '', bindings: [] },
    validation: { skills: [], experts: [], taskCatalog: null },
  }

  if (apply) {
    const backupDir = path.join(userData, 'audit', `capability-production-${timestamp()}`)
    result.backupDir = backupDir
    copyIfPresent(path.join(userData, 'capabilities', 'install-store.json'), backupDir)
    copyIfPresent(path.join(userData, 'workbench-modes.json'), backupDir)

    for (const item of beforeSkills) {
      if (item.installed && item.enabled) {
        result.installs.skills.push({ id: item.id, ok: true, status: 'already' })
        continue
      }
      const installed = await hub.installCapability({ id: item.id, enabled: true, riskConfirmed: true })
      result.installs.skills.push({
        id: item.id,
        ok: installed.ok === true,
        status: installed.ok ? 'installed' : 'failed',
        code: installed.code || '',
        error: installed.error || '',
        warnings: installed.warnings || [],
      })
    }

    for (const item of beforeExperts) {
      if (item.installed && item.enabled) {
        result.installs.experts.push({ id: item.id, ok: true, status: 'already' })
        continue
      }
      const installed = await hub.installCapability({ id: item.id, enabled: true, riskConfirmed: true })
      result.installs.experts.push({
        id: item.id,
        ok: installed.ok === true,
        status: installed.ok ? 'installed' : 'failed',
        code: installed.code || '',
        error: installed.error || '',
        warnings: installed.warnings || [],
      })
    }

    const modeStore = createWorkbenchModeStore({ userData })
    const modeState = modeStore.load()
    result.workbench.modeId = modeState.activeModeId
    for (const item of beforeExperts) {
      const bound = modeStore.bindExpert(item.id, { modeId: modeState.activeModeId })
      result.workbench.bindings.push({
        id: item.id,
        ok: bound.ok === true,
        status: bound.ok ? (bound.alreadyBound ? 'already' : 'bound') : 'failed',
        error: bound.error || '',
      })
    }
  }

  const afterExperts = (await hub.listCapabilities({ kind: 'expert' })).items
  const afterSkills = (await hub.listCapabilities({ kind: 'skill' })).items
  const skillRuntime = hub.skillRuntime()
  for (const item of afterSkills) {
    const record = skillRuntime.findSkillRecord(item.id)
    const loaded = skillRuntime.loadSkillL1(item.id, { maxChars: 12000 })
    const grounding = skillRuntime.loadSkillGroundingContract(item.id)
    result.validation.skills.push({
      id: item.id,
      name: item.name,
      installed: item.installed,
      enabled: item.enabled,
      source: item.source,
      ownerPackId: item.ownerPackId || '',
      recordFound: Boolean(record),
      loadOk: loaded.ok === true,
      bodyChars: loaded.ok ? loaded.body.length : 0,
      groundingOk: grounding.ok === true,
      groundingIssues: grounding.issues || [],
      experienceWarnings: item.experienceWarnings || [],
      error: loaded.ok ? '' : (loaded.message || loaded.code || 'load failed'),
    })
  }

  const expertRuntime = hub.expertRuntime()
  for (const item of afterExperts) {
    const loaded = expertRuntime.loadExpert(item.id)
    const sessionId = `audit-${item.id}-${Date.now()}`
    const snapshot = loaded.ok ? expertRuntime.createSessionSnapshot(sessionId, item.id) : loaded
    result.validation.experts.push({
      id: item.id,
      name: item.name,
      installed: item.installed,
      enabled: item.enabled,
      loadOk: loaded.ok === true,
      promptChars: loaded.ok ? loaded.systemPrompt.length : 0,
      snapshotOk: snapshot.ok === true,
      degraded: snapshot.degraded === true,
      issues: snapshot.issues || loaded.issues || [],
      error: loaded.ok ? (snapshot.ok ? '' : (snapshot.message || snapshot.error || 'snapshot failed')) : (loaded.message || loaded.error || 'load failed'),
    })
  }

  const tasks = hub.listSkillTasks()
  result.validation.taskCatalog = {
    tasks: tasks.tasks?.length || 0,
    issues: tasks.issues || [],
    revision: tasks.revision || '',
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})
