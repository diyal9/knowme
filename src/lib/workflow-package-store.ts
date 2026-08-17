'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  normalizeWorkflowPackage,
  validateWorkflowPackage,
  forkWorkflowPackage,
} = require('./workflow-package')

const STORE_VERSION = 1

function nowIso() {
  return new Date().toISOString()
}

function resolvePath(userData) {
  return path.join(String(userData || ''), 'workbench-workflows.json')
}

function readJson(file, fsImpl) {
  try {
    return JSON.parse(fsImpl.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(file, data, fsImpl) {
  const dir = path.dirname(file)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
  fsImpl.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  try {
    fsImpl.renameSync(tmp, file)
  } catch (error) {
    try { fsImpl.rmSync(tmp, { force: true }) } catch { /* best effort */ }
    throw error
  }
}

function createStore(options = {}) {
  const fsImpl = options.fs || fs
  const file = options.file || resolvePath(options.userData || '')

  function load() {
    const raw = readJson(file, fsImpl)
    const packages = {}
    if (raw?.version === STORE_VERSION && raw.packages && typeof raw.packages === 'object') {
      for (const [key, value] of Object.entries(raw.packages)) {
        const normalized = normalizeWorkflowPackage({ ...value, id: value.id || key })
        if (normalized.ok) packages[normalized.package.id] = normalized.package
      }
    }
    return { version: STORE_VERSION, packages, updatedAt: raw?.updatedAt || nowIso() }
  }

  function save(state) {
    const payload = {
      version: STORE_VERSION,
      packages: state.packages || {},
      updatedAt: nowIso(),
    }
    writeJsonAtomic(file, payload, fsImpl)
    return payload
  }

  function list(filter = {}) {
    const state = load()
    let packages = Object.values(state.packages)
    if (filter.source) packages = packages.filter(item => item.source === filter.source)
    if (filter.status) packages = packages.filter(item => item.status === filter.status)
    if (filter.goal) {
      const query = String(filter.goal).trim().toLowerCase()
      packages = packages.filter(item => `${item.name} ${item.description} ${item.goalTypes.join(' ')}`
        .toLowerCase().includes(query))
    }
    packages.sort((a, b) => `${a.source}:${a.name}`.localeCompare(`${b.source}:${b.name}`))
    return { ok: true, packages, file }
  }

  function get(id) {
    const packageId = String(id || '').trim()
    const item = load().packages[packageId]
    return item ? { ok: true, package: item } : { ok: false, code: 'not_found', error: '流程不存在' }
  }

  function savePackage(raw, options = {}) {
    const state = load()
    const current = state.packages[String(raw?.id || '').trim()]
    if (current && current.source === 'official' && options.allowOfficial !== true) {
      return { ok: false, code: 'official_readonly', error: '官方流程不可直接修改，请先复制为个人流程' }
    }
    const validation = validateWorkflowPackage(raw, options)
    if (!validation.ok) return validation
    state.packages[validation.package.id] = validation.package
    save(state)
    return { ok: true, package: validation.package }
  }

  function fork(id, options = {}) {
    const current = get(id)
    if (!current.ok) return current
    const result = forkWorkflowPackage(current.package, options)
    if (!result.ok) return result
    const state = load()
    state.packages[result.package.id] = result.package
    save(state)
    return { ok: true, package: result.package }
  }

  function archive(id) {
    const current = get(id)
    if (!current.ok) return current
    if (current.package.source === 'official') {
      return { ok: false, code: 'official_readonly', error: '官方流程不可归档' }
    }
    const next = normalizeWorkflowPackage({
      ...current.package,
      status: 'archived',
      updatedAt: nowIso(),
    })
    if (!next.ok) return next
    const state = load()
    state.packages[id] = next.package
    save(state)
    return { ok: true, package: next.package }
  }

  function matchesExpertId(value, expertId) {
    return String(value || '').trim() === expertId
  }

  function clearExpertFromGraph(graph, expertId) {
    if (!graph || typeof graph !== 'object') return { graph, cleared: 0 }
    let cleared = 0
    const next = { ...graph }
    if (Array.isArray(graph.members)) {
      next.members = graph.members.map(member => {
        if (!matchesExpertId(member?.agentPackageId || member?.expertId || member?.agent, expertId)) {
          return member
        }
        cleared += 1
        return {
          ...member,
          agentPackageId: '',
          expertId: '',
          agent: '',
          packageHash: '',
          profileHash: '',
          profileId: '',
          profile: null,
        }
      })
    }
    if (Array.isArray(graph.nodes)) {
      next.nodes = graph.nodes.map(node => {
        if (!matchesExpertId(node?.agentPackageId || node?.expertId || node?.agent, expertId)) {
          return node
        }
        cleared += 1
        return {
          ...node,
          agentPackageId: '',
          expertId: '',
          agent: '',
          packageHash: '',
          profileHash: '',
          profileId: '',
          profile: null,
        }
      })
    }
    return { graph: next, cleared }
  }

  /**
   * 专家删除后清理个人/forked 包中的引用；保留节点与包，官方包不动。
   */
  function clearExpertRefs(expertId) {
    const id = String(expertId || '').trim()
    if (!id) return { ok: false, code: 'invalid_args', error: '缺少专家 id', clearedPackages: 0, clearedRefs: 0 }
    const state = load()
    let clearedPackages = 0
    let clearedRefs = 0
    const touched = []
    for (const [packageId, pkg] of Object.entries(state.packages || {})) {
      if (!pkg || pkg.source === 'official') continue
      let packageCleared = 0
      const nextAgentRefs = Array.isArray(pkg.agentRefs)
        ? pkg.agentRefs.filter(ref => {
          if (matchesExpertId(ref?.id || ref, id)) {
            packageCleared += 1
            return false
          }
          return true
        })
        : pkg.agentRefs
      const graphResult = clearExpertFromGraph(pkg.graph, id)
      packageCleared += graphResult.cleared
      if (!packageCleared) continue
      const normalized = normalizeWorkflowPackage({
        ...pkg,
        agentRefs: nextAgentRefs,
        graph: graphResult.graph,
        updatedAt: nowIso(),
      })
      if (!normalized.ok) continue
      state.packages[packageId] = normalized.package
      clearedPackages += 1
      clearedRefs += packageCleared
      touched.push(packageId)
    }
    if (clearedPackages) save(state)
    return { ok: true, clearedPackages, clearedRefs, packageIds: touched }
  }

  return {
    file,
    load,
    list,
    get,
    save: savePackage,
    fork,
    archive,
    clearExpertRefs,
  }
}

module.exports = {
  STORE_VERSION,
  resolvePath,
  writeJsonAtomic,
  createStore,
}
