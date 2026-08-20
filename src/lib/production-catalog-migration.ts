'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { LEGACY_DEMO_SEED_IDS } = require('./official-workflows')

const MIGRATION_ID = 'personal-expert-roster-v7'
const PRODUCTION_EXPERT_IDS = Object.freeze([
  'product-manager', 'user-researcher', 'requirement-reviewer',
  'content-strategist', 'longform-editor', 'presentation-writer',
  'creative-director', 'visual-designer', 'image-producer',
  'office-partner', 'meeting-scribe', 'action-owner',
  'data-analyst', 'business-insight-analyst', 'data-report-editor',
  'solution-architect', 'software-engineer', 'qa-engineer',
  'research-analyst', 'knowledge-curator', 'fact-checker',
  'external-capability-importer',
])
const RETIRED_EXPERT_IDS = Object.freeze([
  'producer', 'developer', 'tester', 'copywriter', 'game-studio-partner',
])
const TEST_ID_RE = /^(?:demo|test|qa[-_.]?copy)(?:[-_.]|$)/i

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

function shouldRemoveExpert(id, entry = {}) {
  const key = String(id || '').trim()
  if (RETIRED_EXPERT_IDS.includes(key)) return true
  const label = `${entry.name || ''} ${entry.description || ''}`
  return TEST_ID_RE.test(key) || /(?:测试用|演示数据|demo expert)/i.test(label)
}

function isEmptyShell(pkg = {}) {
  const refs = Array.isArray(pkg.agentRefs) ? pkg.agentRefs.filter(Boolean) : []
  const nodes = Array.isArray(pkg.graph?.nodes) ? pkg.graph.nodes.filter(Boolean) : []
  const goal = String(pkg.graph?.goal || '').trim()
  const genericDraftName = /^我的专家协作(?:-|$)/.test(String(pkg.name || '').trim())
  const onlyPlaceholderNodes = nodes.every(node => {
    if (node?.type === 'terminal' || node?.type === 'start' || node?.type === 'end') return true
    return node?.type === 'agent'
      && String(node.id || '') === 'agent'
      && String(node.agentPackageId || '') === 'office-partner'
      && (!String(node.intent || node.name || '').trim() || genericDraftName)
  })
  return refs.length === 0 && onlyPlaceholderNodes && !goal
}

function shouldRemoveWorkflow(id, pkg = {}) {
  const key = String(id || '').trim()
  const parentId = String(pkg.parentRef?.id || '').trim()
  if (LEGACY_DEMO_SEED_IDS.includes(key)) return true
  if (LEGACY_DEMO_SEED_IDS.includes(parentId) && pkg.status === 'archived') return true
  if (TEST_ID_RE.test(key) || /(?:测试流程|演示流程|demo workflow)/i.test(String(pkg.name || ''))) return true
  return isEmptyShell(pkg)
}

function backupProductionData(userData, files, expertIds) {
  const backupRoot = path.join(userData, 'migrations', `${MIGRATION_ID}-backup`)
  fs.mkdirSync(backupRoot, { recursive: true })
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    fs.copyFileSync(file, path.join(backupRoot, path.basename(file)))
  }
  const expertRoot = path.join(userData, 'capabilities', 'experts')
  const backupExperts = path.join(backupRoot, 'experts')
  for (const id of expertIds) {
    const source = path.join(expertRoot, id)
    if (!fs.existsSync(source)) continue
    fs.cpSync(source, path.join(backupExperts, id), { recursive: true })
  }
  return backupRoot
}

function pruneOverlay(file, removeIds) {
  const raw = readJson(file)
  if (!raw?.entries || typeof raw.entries !== 'object') return 0
  let removed = 0
  for (const id of removeIds) {
    if (!raw.entries[id]) continue
    delete raw.entries[id]
    removed += 1
  }
  if (removed) writeJsonAtomic(file, { ...raw, updatedAt: new Date().toISOString() })
  return removed
}

function pruneWorkflows(file) {
  const raw = readJson(file)
  if (!raw?.packages || typeof raw.packages !== 'object') return []
  const removed = []
  for (const [id, pkg] of Object.entries(raw.packages)) {
    if (!shouldRemoveWorkflow(id, pkg)) continue
    delete raw.packages[id]
    removed.push(id)
  }
  if (removed.length) writeJsonAtomic(file, { ...raw, updatedAt: new Date().toISOString() })
  return removed
}

function shouldRemoveTask(task = {}) {
  const goal = String(task.goal || task.brief?.goal || '').trim()
  const title = String(task.title || task.name || '').trim()
  const expertId = String(task.expertId || task.owner?.expertId || '').trim()
  return goal === '三元礼包'
    || TEST_ID_RE.test(String(task.id || ''))
    || /(?:测试任务|演示任务|demo task)/i.test(`${title} ${goal}`)
    || (RETIRED_EXPERT_IDS.includes(expertId) && /^(?:Brief 出图审阅|三角色协作交付)$/.test(title))
}

function pruneTasks(file) {
  const raw = readJson(file)
  if (!raw) return []
  const removed = []
  if (Array.isArray(raw.tasks)) {
    raw.tasks = raw.tasks.filter(task => {
      if (!shouldRemoveTask(task)) return true
      removed.push(String(task.id || ''))
      return false
    })
  } else if (raw.tasks && typeof raw.tasks === 'object') {
    for (const [id, task] of Object.entries(raw.tasks)) {
      if (!shouldRemoveTask({ ...task, id: task?.id || id })) continue
      delete raw.tasks[id]
      removed.push(id)
    }
  }
  if (removed.length) writeJsonAtomic(file, { ...raw, updatedAt: new Date().toISOString() })
  return removed
}

function taskExpertIds(raw) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks : Object.values(raw?.tasks || {})
  return new Set(tasks.map(task => String(task?.expertId || task?.owner?.expertId || '').trim()).filter(Boolean))
}

function boundExpertIds(raw) {
  const ids = new Set()
  for (const rows of Object.values(raw?.bindings || {})) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = String(row?.expertId || '').trim()
      if (id) ids.add(id)
    }
  }
  return ids
}

/** v6 曾把整个公开目录批量安装；只回退该次生成且未驻场、无任务的本地副本。 */
function autoInstalledCatalogIds(userData, installed, modeFile, taskFile) {
  const marker = readJson(path.join(userData, 'migrations', 'formal-catalog-v6.json'))
  const completedAt = Date.parse(marker?.completedAt || '')
  if (!Number.isFinite(completedAt)) return []
  const protectedIds = new Set([...boundExpertIds(readJson(modeFile)), ...taskExpertIds(readJson(taskFile))])
  return (Array.isArray(marker?.installedExperts) ? marker.installedExperts : []).filter(id => {
    const entry = installed[id]
    const installedAt = Date.parse(entry?.installedAt || '')
    return entry?.kind === 'expert'
      && entry?.source === 'curated'
      && !protectedIds.has(id)
      && Number.isFinite(installedAt)
      && Math.abs(completedAt - installedAt) <= 15 * 60 * 1000
  })
}

async function migrateProductionCatalog(options = {}) {
  const userData = String(options.userData || '').trim()
  const hub = options.hub
  if (!userData || !hub) return { ok: false, error: '缺少迁移上下文' }

  const migrationRoot = path.join(userData, 'migrations')
  const marker = path.join(migrationRoot, `${MIGRATION_ID}.json`)
  if (fs.existsSync(marker)) return { ok: true, skipped: true, migrationId: MIGRATION_ID }

  const capabilityRoot = path.join(userData, 'capabilities')
  const installFile = path.join(capabilityRoot, 'install-store.json')
  const overlayFile = path.join(capabilityRoot, 'catalog-overlay.json')
  const workflowFile = path.join(userData, 'workbench-workflows.json')
  const taskFile = path.join(userData, 'workbench-tasks.json')
  const modeFile = path.join(userData, 'workbench-modes.json')
  const installed = readJson(installFile)?.entries || {}
  const retiredIds = Object.entries(installed)
    .filter(([id, entry]) => entry?.kind === 'expert' && shouldRemoveExpert(id, entry))
    .map(([id]) => id)
  const resetCatalogExperts = autoInstalledCatalogIds(userData, installed, modeFile, taskFile)
  const removeIds = [...new Set([...retiredIds, ...resetCatalogExperts])]
  const backupRoot = backupProductionData(
    userData,
    [installFile, overlayFile, workflowFile, taskFile, modeFile],
    removeIds,
  )

  const removedExperts = []
  for (const id of removeIds) {
    const result = await hub.uninstallCapability({ id })
    if (result?.ok) removedExperts.push(id)
  }
  const removedOverlayEntries = pruneOverlay(overlayFile, removeIds)
  const removedWorkflows = pruneWorkflows(workflowFile)
  const removedTasks = pruneTasks(taskFile)

  const result = {
    ok: true, migrationId: MIGRATION_ID, backupRoot,
    removedExperts, resetCatalogExperts, removedOverlayEntries, removedWorkflows, removedTasks,
    completedAt: new Date().toISOString(),
  }
  writeJsonAtomic(marker, result)
  return result
}

module.exports = {
  MIGRATION_ID, PRODUCTION_EXPERT_IDS, RETIRED_EXPERT_IDS, TEST_ID_RE,
  shouldRemoveExpert, isEmptyShell, shouldRemoveWorkflow, shouldRemoveTask,
  taskExpertIds, boundExpertIds, autoInstalledCatalogIds, migrateProductionCatalog,
}
