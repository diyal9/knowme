'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { LEGACY_DEMO_SEED_IDS } = require('./official-workflows')
const { hashDirectory } = require('./capability-store')

const MIGRATION_ID = 'focused-expert-roster-v13'
const IMAGE_PRODUCER_CAPABILITY_IDS = Object.freeze([
  'creative-concept-method',
  'visual-brief-prompt',
  'th-art-intake',
  'th-art-prompt-enrich',
  'th-art-pango-generate',
  'writing-polish',
  'image-producer',
])
const RETAINED_EXPERT_IDS = Object.freeze([
  'image-producer', 'operations-data-analyst', 'agent-operations',
])
const PRODUCTION_EXPERT_IDS = RETAINED_EXPERT_IDS
const REMOVED_BUNDLED_EXPERT_IDS = Object.freeze([
  'product-manager', 'research-analyst', 'software-engineer',
  'office-partner',
  'data-analyst',
  'requirement-reviewer', 'user-researcher',
  'meeting-scribe', 'action-owner',
  'fact-checker', 'knowledge-curator',
  'solution-architect', 'qa-engineer',
  'business-insight-analyst', 'data-report-editor',
  'creative-director', 'visual-designer',
  'presentation-writer', 'content-strategist', 'longform-editor',
  'external-capability-importer',
])
const RETIRED_EXPERT_IDS = Object.freeze([
  'producer', 'developer', 'tester', 'copywriter', 'game-studio-partner',
  ...REMOVED_BUNDLED_EXPERT_IDS,
])
const PRESERVED_RETIRED_TASK_EXPERT_IDS = Object.freeze(['office-partner', 'data-analyst'])
const RETIRED_SYSTEM_WORKFLOW_IDS = Object.freeze([
  'official-product-requirement',
  'official-daily-office', 'daily-summary', 'feishu-daily',
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

function bundledContentHash(bundledRoot, entry) {
  const bundlePath = String(entry?.bundlePath || '').trim()
  if (!bundlePath) return ''
  const root = path.resolve(bundledRoot, bundlePath)
  const relative = path.relative(path.resolve(bundledRoot), root)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(root)) return ''
  try { return hashDirectory(root) } catch { return '' }
}

/**
 * Route dependencies are part of the expert install closure when a route
 * declares a real tool call. This prevents an older installed sidecar from
 * silently downgrading a route Skill to optional.
 */
function mergeRouteDependencies(dependencies = [], manifest = {}) {
  const merged = new Map()
  const add = (dependency, required = false) => {
    const id = String(dependency?.id || '').trim()
    const kind = String(dependency?.kind || '').trim()
    if (!id || (kind !== 'skill' && kind !== 'connector')) return
    const key = `${kind}:${id}`
    const current = merged.get(key)
    merged.set(key, {
      ...(current || {}),
      id,
      kind,
      required: Boolean(current?.required || dependency?.required === true || required),
    })
  }

  for (const dependency of Array.isArray(dependencies) ? dependencies : []) add(dependency)
  const execution = manifest?.metadata?.knowme?.execution || {}
  const addRoute = (route = {}) => {
    const hasToolContract = (Array.isArray(route.requiredTools) && route.requiredTools.length > 0)
      || (Array.isArray(route.toolAllowlist) && route.toolAllowlist.length > 0)
    if (!hasToolContract) return
    for (const id of [
      ...(Array.isArray(route.requiredSkills) ? route.requiredSkills : []),
      route.skillId,
    ]) add({ id, kind: 'skill' }, true)
    // External connectors remain runtime-gated because installation does not
    // imply authorization. Their route readiness is diagnosed separately.
  }
  for (const route of Array.isArray(execution.routes) ? execution.routes : []) addRoute(route)
  for (const deliverable of Array.isArray(execution.deliverables) ? execution.deliverables : []) addRoute(deliverable)
  return [...merged.values()]
}

function shouldRemoveExpert(id, entry = {}) {
  const key = String(id || '').trim()
  if (entry?.source && entry.source !== 'curated') return false
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
  if (RETIRED_SYSTEM_WORKFLOW_IDS.includes(key)) return true
  if (LEGACY_DEMO_SEED_IDS.includes(key)) return true
  if (LEGACY_DEMO_SEED_IDS.includes(parentId) && pkg.status === 'archived') return true
  if (TEST_ID_RE.test(key) || /(?:测试流程|演示流程|demo workflow)/i.test(String(pkg.name || ''))) return true
  return isEmptyShell(pkg)
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

function shouldRemoveTask(task = {}, removedExpertIds = RETIRED_EXPERT_IDS) {
  const goal = String(task.goal || task.brief?.goal || '').trim()
  const title = String(task.title || task.name || '').trim()
  const expertId = String(task.expertId || task.owner?.expertId || '').trim()
  return goal === '三元礼包'
    || TEST_ID_RE.test(String(task.id || ''))
    || /(?:测试任务|演示任务|demo task)/i.test(`${title} ${goal}`)
    || (removedExpertIds.includes(expertId) && !PRESERVED_RETIRED_TASK_EXPERT_IDS.includes(expertId))
}

function pruneTasks(file, removedExpertIds = RETIRED_EXPERT_IDS) {
  const raw = readJson(file)
  if (!raw) return []
  const removed = []
  if (Array.isArray(raw.tasks)) {
    raw.tasks = raw.tasks.filter(task => {
      if (!shouldRemoveTask(task, removedExpertIds)) return true
      removed.push(String(task.id || ''))
      return false
    })
  } else if (raw.tasks && typeof raw.tasks === 'object') {
    for (const [id, task] of Object.entries(raw.tasks)) {
      if (!shouldRemoveTask({ ...task, id: task?.id || id }, removedExpertIds)) continue
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

/**
 * Upgrade the bundled image expert in place while preserving user ownership.
 * Only a currently installed curated expert opts into this dependency bundle;
 * custom/local entries with the same ids are never overwritten.
 */
async function syncImageProducerCapabilities(options = {}) {
  const userData = String(options.userData || '').trim()
  const hub = options.hub
  if (!userData || typeof hub?.installCapability !== 'function') {
    return { ok: true, skipped: true, reason: 'installer_unavailable', updated: [] }
  }

  const installFile = path.join(userData, 'capabilities', 'install-store.json')
  const installed = readJson(installFile)?.entries || {}
  const imageExpert = installed['image-producer']
  if (!imageExpert || imageExpert.source !== 'curated' || ['removed', 'failed', 'available'].includes(imageExpert.status)) {
    return { ok: true, skipped: true, reason: 'curated_image_expert_not_installed', updated: [] }
  }

  const bundledCatalog = readJson(path.join(__dirname, '..', 'catalog', 'catalog.json'))
  const bundledRoot = path.join(__dirname, '..', 'catalog')
  const bundledEntries = new Map((bundledCatalog?.entries || []).map(entry => [String(entry.id || ''), entry]))
  const updated = []
  const updatedDetails = []
  const skipped = []
  for (const id of IMAGE_PRODUCER_CAPABILITY_IDS) {
    const current = installed[id]
    const bundledEntry = bundledEntries.get(id) || {}
    const targetVersion = String(bundledEntry.version || '')
    const targetHash = bundledContentHash(bundledRoot, bundledEntry)
    if (current && current.source !== 'curated') {
      skipped.push({ id, reason: 'user_owned' })
      continue
    }
    const sameVersionContentChanged = current
      && targetVersion
      && String(current.version || '') === targetVersion
      && targetHash
      && String(current.contentHash || '') !== targetHash
    if (current && targetVersion && String(current.version || '') === targetVersion && !sameVersionContentChanged) continue
    const enabled = id === 'image-producer' ? imageExpert.enabled !== false : true
    const result = await hub.installCapability({ id, enabled, riskConfirmed: true })
    if (!result?.ok) {
      return {
        ok: false,
        code: result?.code || 'image_capability_upgrade_failed',
        error: result?.error || `升级能力失败：${id}`,
        updated,
        skipped,
      }
    }
    updated.push(id)
    updatedDetails.push({ id, reason: sameVersionContentChanged ? 'content_changed' : 'version_changed' })
  }
  return { ok: true, updated, updatedDetails, skipped }
}

/**
 * Keep every installed, bundled production expert on the current package
 * version. Retired bundled experts are removed separately, while custom/local
 * experts are never overwritten.
 */
async function syncRetainedExpertCapabilities(options = {}) {
  const userData = String(options.userData || '').trim()
  const hub = options.hub
  if (!userData || typeof hub?.installCapability !== 'function') {
    return { ok: true, skipped: true, reason: 'installer_unavailable', updated: [], ignored: [] }
  }

  const installFile = path.join(userData, 'capabilities', 'install-store.json')
  const installed = readJson(installFile)?.entries || {}
  const bundledCatalog = readJson(path.join(__dirname, '..', 'catalog', 'catalog.json'))
  const bundledRoot = path.join(__dirname, '..', 'catalog')
  const bundledEntries = new Map((bundledCatalog?.entries || []).map(entry => [String(entry.id || ''), entry]))
  const updated = []
  const updatedDetails = []
  const dependencyUpdates = []
  const ignored = []

  const loadBundledDependencies = (bundledEntry) => {
    const bundlePath = String(bundledEntry?.bundlePath || '').trim()
    const bundledRoot = path.join(__dirname, '..', 'catalog')
    const capabilityManifest = bundlePath
      ? readJson(path.join(bundledRoot, bundlePath, 'capability.manifest.json'))
      : null
    const legacyManifest = bundlePath
      ? readJson(path.join(bundledRoot, bundlePath, 'manifest.json'))
      : null
    const manifest = capabilityManifest || legacyManifest || bundledEntry?.manifest || {}
    if (Array.isArray(manifest.dependencies)) return mergeRouteDependencies(manifest.dependencies, manifest)
    const skillIds = Array.isArray(manifest.skills)
      ? manifest.skills
      : (Array.isArray(bundledEntry?.skills) ? bundledEntry.skills : [])
    return mergeRouteDependencies(skillIds.map(id => ({ id, kind: 'skill', required: true })), manifest)
  }

  const syncRequiredDependencies = async (expertId, bundledEntry) => {
    const dependencies = loadBundledDependencies(bundledEntry)
    for (const dependency of dependencies.filter(item => item?.required === true && item.id)) {
      const currentDependency = installed[dependency.id]
      if (currentDependency?.source && currentDependency.source !== 'curated') {
        ignored.push({ id: dependency.id, expertId, reason: 'user_owned_dependency' })
        continue
      }
      const bundledDependency = bundledEntries.get(dependency.id) || {}
      const targetVersion = String(bundledDependency.version || '')
      const targetHash = bundledContentHash(bundledRoot, bundledDependency)
      const versionChanged = Boolean(targetVersion && String(currentDependency?.version || '') !== targetVersion)
      const contentChanged = Boolean(
        currentDependency && targetHash && String(currentDependency.contentHash || '') !== targetHash,
      )
      const ready = currentDependency
        && currentDependency.enabled === true
        && !['removed', 'failed', 'available'].includes(currentDependency.status)
        && !versionChanged
        && !contentChanged
      if (ready) continue
      const result = currentDependency?.source === 'curated'
        && typeof hub.updateCapability === 'function'
        ? await hub.updateCapability({ id: dependency.id, riskConfirmed: true })
        : await hub.installCapability({
          id: dependency.id,
          enabled: true,
          riskConfirmed: true,
        })
      if (!result?.ok) {
        return {
          ok: false,
          code: result?.code || 'retained_expert_dependency_install_failed',
          error: result?.error || `安装专家依赖失败：${dependency.id}`,
        }
      }
      dependencyUpdates.push({
        expertId,
        id: dependency.id,
        kind: dependency.kind || 'skill',
        reason: versionChanged ? 'version_changed' : contentChanged ? 'content_changed' : 'not_ready',
      })
      installed[dependency.id] = {
        id: dependency.id,
        kind: dependency.kind || 'skill',
        version: targetVersion,
        contentHash: targetHash,
        enabled: true,
        status: 'enabled',
      }
    }
    return { ok: true }
  }

  for (const id of RETAINED_EXPERT_IDS) {
    const current = installed[id]
    if (!current || ['removed', 'failed', 'available'].includes(current.status)) continue
    if (current.source !== 'curated') {
      ignored.push({ id, reason: 'user_owned' })
      continue
    }
    const bundledEntry = bundledEntries.get(id) || {}
    const dependencySync = await syncRequiredDependencies(id, bundledEntry)
    if (!dependencySync.ok) {
      return {
        ok: false,
        code: dependencySync.code,
        error: dependencySync.error,
        updated,
        updatedDetails,
        dependencyUpdates,
        ignored,
      }
    }
    const targetVersion = String(bundledEntry.version || '')
    const targetHash = bundledContentHash(bundledRoot, bundledEntry)
    const sameVersionContentChanged = targetVersion
      && String(current.version || '') === targetVersion
      && targetHash
      && String(current.contentHash || '') !== targetHash
    if (targetVersion && String(current.version || '') === targetVersion && !sameVersionContentChanged) continue
    const result = typeof hub.updateCapability === 'function'
      ? await hub.updateCapability({ id, riskConfirmed: true })
      : await hub.installCapability({
        id,
        enabled: current.enabled !== false,
        riskConfirmed: true,
      })
    if (!result?.ok) {
      return {
        ok: false,
        code: result?.code || 'retained_expert_upgrade_failed',
        error: result?.error || `升级保留专家失败：${id}`,
        updated,
        ignored,
      }
    }
    updated.push(id)
    updatedDetails.push({ id, reason: sameVersionContentChanged ? 'content_changed' : 'version_changed' })
  }
  return { ok: true, updated, updatedDetails, dependencyUpdates, ignored }
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
      && !PRODUCTION_EXPERT_IDS.includes(id)
      && !protectedIds.has(id)
      && Number.isFinite(installedAt)
      && Math.abs(completedAt - installedAt) <= 15 * 60 * 1000
  })
}

async function migrateProductionCatalog(options = {}) {
  const userData = String(options.userData || '').trim()
  const hub = options.hub
  if (!userData || !hub) return { ok: false, error: '缺少迁移上下文' }

  const imageProducerUpgrade = await syncImageProducerCapabilities(options)
  if (!imageProducerUpgrade.ok) return imageProducerUpgrade
  const retainedExpertUpgrade = await syncRetainedExpertCapabilities(options)
  if (!retainedExpertUpgrade.ok) return retainedExpertUpgrade

  const migrationRoot = path.join(userData, 'migrations')
  const marker = path.join(migrationRoot, `${MIGRATION_ID}.json`)
  if (fs.existsSync(marker)) {
    return {
      ok: true, skipped: true, migrationId: MIGRATION_ID,
      imageProducerUpgrade, retainedExpertUpgrade,
    }
  }

  const capabilityRoot = path.join(userData, 'capabilities')
  const installFile = path.join(capabilityRoot, 'install-store.json')
  const overlayFile = path.join(capabilityRoot, 'catalog-overlay.json')
  const workflowFile = path.join(userData, 'workbench-workflows.json')
  const taskFile = path.join(userData, 'workbench-tasks.json')
  const modeFile = path.join(userData, 'workbench-modes.json')
  const installed = readJson(installFile)?.entries || {}
  const userOwnedRetiredIds = new Set(Object.entries(installed)
    .filter(([id, entry]) => REMOVED_BUNDLED_EXPERT_IDS.includes(id) && entry?.source && entry.source !== 'curated')
    .map(([id]) => id))
  const retiredIds = Object.entries(installed)
    .filter(([id, entry]) => entry?.kind === 'expert' && entry?.source === 'curated' && shouldRemoveExpert(id, entry))
    .map(([id]) => id)
  const resetCatalogExperts = autoInstalledCatalogIds(userData, installed, modeFile, taskFile)
  const removeIds = [...new Set([...retiredIds, ...resetCatalogExperts])]
  const removedExperts = []
  for (const id of removeIds) {
    const result = await hub.uninstallCapability({ id })
    if (result?.ok) removedExperts.push(id)
  }
  const removedOverlayEntries = pruneOverlay(overlayFile, removeIds)
  const removedWorkflows = pruneWorkflows(workflowFile)
  const retiredTaskExpertIds = REMOVED_BUNDLED_EXPERT_IDS.filter(id => !userOwnedRetiredIds.has(id))
  const removedTasks = pruneTasks(taskFile, [...new Set([...removeIds, ...retiredTaskExpertIds])])

  const result = {
    ok: true, migrationId: MIGRATION_ID,
    removedExperts, resetCatalogExperts, removedOverlayEntries, removedWorkflows, removedTasks,
    imageProducerUpgrade, retainedExpertUpgrade,
    completedAt: new Date().toISOString(),
  }
  writeJsonAtomic(marker, result)
  return result
}

module.exports = {
  MIGRATION_ID, IMAGE_PRODUCER_CAPABILITY_IDS, RETAINED_EXPERT_IDS, PRODUCTION_EXPERT_IDS,
  REMOVED_BUNDLED_EXPERT_IDS, RETIRED_EXPERT_IDS, PRESERVED_RETIRED_TASK_EXPERT_IDS,
  RETIRED_SYSTEM_WORKFLOW_IDS, TEST_ID_RE,
  shouldRemoveExpert, isEmptyShell, shouldRemoveWorkflow, shouldRemoveTask,
  taskExpertIds, boundExpertIds, autoInstalledCatalogIds, migrateProductionCatalog,
  syncImageProducerCapabilities, syncRetainedExpertCapabilities,
  mergeRouteDependencies,
}
