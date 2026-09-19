'use strict'

const fs = require('fs')
const path = require('path')

const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createStore: createWorkbenchModeStore } = require('../src/lib/workbench-mode-store')

function parseArgs(argv) {
  const options = {
    userData: '',
    apply: false,
    removeIds: [],
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = String(argv[index] || '')
    if (value === '--apply') {
      options.apply = true
      continue
    }
    if (value === '--user-data') {
      options.userData = String(argv[++index] || '')
      continue
    }
    if (value === '--remove') {
      options.removeIds = String(argv[++index] || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
      continue
    }
    throw new Error(`Unknown option: ${value}`)
  }
  return options
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function collectReferences(userData, expertId) {
  const modeState = readJson(path.join(userData, 'workbench-modes.json'), {}) || {}
  const bindings = []
  for (const [modeId, items] of Object.entries(modeState.bindings || {})) {
    for (const item of Array.isArray(items) ? items : []) {
      if (String(item?.expertId || '') === expertId) bindings.push({ modeId, expertId })
    }
  }

  const taskState = readJson(path.join(userData, 'workbench-tasks.json'), {}) || {}
  const tasks = Array.isArray(taskState.tasks)
    ? taskState.tasks
    : Object.values(taskState.tasks || {})
  const taskRefs = tasks
    .filter(task => String(task?.expertId || task?.owner?.expertId || '') === expertId)
    .map(task => ({ id: String(task.id || ''), status: String(task.status || '') }))

  return { bindings, tasks: taskRefs }
}

function copyIfPresent(source, target) {
  if (!fs.existsSync(source)) return false
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, { recursive: true })
  return true
}

function createBackup(userData, ids) {
  const backupDir = path.join(userData, 'audit', `production-roster-${timestamp()}`)
  const copied = []
  for (const name of [
    'capabilities/install-store.json',
    'capabilities/catalog-overlay.json',
    'workbench-modes.json',
    'workbench-tasks.json',
  ]) {
    if (copyIfPresent(path.join(userData, name), path.join(backupDir, name))) copied.push(name)
  }
  for (const id of ids) {
    const source = path.join(userData, 'capabilities', 'experts', id)
    if (copyIfPresent(source, path.join(backupDir, 'capabilities', 'experts', id))) {
      copied.push(`capabilities/experts/${id}`)
    }
  }
  return { backupDir, copied }
}

function createRuntime(userData) {
  const modeStore = createWorkbenchModeStore({ userData })
  const hub = createCapabilityHubService({
    getUserData: () => userData,
    getKnowledgeDir: () => path.join(userData, 'knowledge'),
    bundledRoot: path.resolve(__dirname, '..', 'src', 'catalog'),
    onExpertUninstalled: id => modeStore.unbindExpertEverywhere(id),
  })
  return { hub }
}

async function main() {
  const options = parseArgs(process.argv)
  const userData = options.userData
    ? path.resolve(options.userData)
    : process.env.KNOWME_USER_DATA
    ? path.resolve(process.env.KNOWME_USER_DATA)
    : path.join(process.env.APPDATA || '', 'KnowMe')
  const { hub } = createRuntime(userData)
  const experts = (await hub.listCapabilities({ kind: 'expert' })).items
  const selected = options.removeIds.map(id => experts.find(item => item.id === id) || { id, installed: false })
  const plan = selected.map(item => ({
    id: item.id,
    name: item.name || '',
    source: item.source || '',
    installed: item.installed === true,
    references: collectReferences(userData, item.id),
  }))
  const blocked = plan.filter(item => item.references.bindings.length || item.references.tasks.length)
  const missing = plan.filter(item => item.installed !== true)
  const result = {
    ok: true,
    applied: false,
    userData,
    requested: options.removeIds,
    plan,
    backup: null,
    removed: [],
    skipped: [],
  }

  if (!options.apply) {
    result.skipped = plan.map(item => ({ id: item.id, reason: 'dry_run' }))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  if (!options.removeIds.length) throw new Error('使用 --apply 时必须同时提供 --remove id1,id2')
  if (blocked.length) {
    result.ok = false
    result.skipped = blocked.map(item => ({ id: item.id, reason: 'referenced', references: item.references }))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 2
    return
  }
  if (missing.length) {
    result.ok = false
    result.skipped = missing.map(item => ({ id: item.id, reason: 'not_installed' }))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 2
    return
  }

  result.backup = createBackup(userData, options.removeIds)
  result.applied = true
  for (const item of plan) {
    const removed = await hub.deleteExpert({ id: item.id, source: item.source })
    if (removed.ok) result.removed.push({ id: item.id, workbenchCleanup: removed.workbenchCleanup || null })
    else result.skipped.push({ id: item.id, reason: removed.code || removed.error || 'delete_failed' })
  }
  result.ok = result.skipped.length === 0
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) process.exitCode = 2
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = { collectReferences, parseArgs, main }
