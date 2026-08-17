'use strict'

/**
 * 工作模式持久化（%APPDATA%\KnowMe\workbench-modes.json）
 *
 * 内置模板由代码提供；用户数据仅保存当前模式与各模式 Expert 绑定。
 * 读取时物化 DTO，Expert 名称/状态由可注入 catalog 投影；Daemon 状态由 daemon 投影。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const STORE_VERSION = 1
const MAX_BINDINGS_PER_MODE = 32
const MAX_MODES = 12
const BUILTIN_MODE_IDS = Object.freeze(['office', 'engineering', 'visual'])
const DEFAULT_MODE_ID = 'office'
const TEXT_MAX = 120
const DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i

const { nowIso, truncate, resolvePaths, normalizeId, normalizeExpertId, normalizeModeId, defaultPersistedState, readJson, renameWithRetrySync, writeJsonAtomic, normalizeBinding, normalizeBindingsForMode, normalizePersistedState, isBuiltinRoleId, cloneTemplateList, defaultCatalogProjector, defaultDaemonProjector, applyDaemonProjection, projectBinding, buildModeDto, collectExpertIds, BUILTIN_MODES } = require('./workbench-mode-store-io')

function createStore(options = {}) {
  const userData = options.userData || ''
  const file = options.file || resolvePaths(userData).file
  const fsImpl = options.fs || fs
  const catalogProjector = typeof options.catalogProjector === 'function'
    ? options.catalogProjector
    : defaultCatalogProjector
  const daemonProjector = typeof options.daemonProjector === 'function'
    ? options.daemonProjector
    : defaultDaemonProjector

  let degraded = false
  let degradedReason = ''
  let loadedFromDisk = false

  function loadPersisted() {
    if (!fsImpl.existsSync(file)) {
      degraded = false
      degradedReason = ''
      loadedFromDisk = false
      return defaultPersistedState()
    }
    const raw = readJson(file, fsImpl)
    const normalized = normalizePersistedState(raw)
    degraded = normalized.degraded
    degradedReason = normalized.reason || ''
    loadedFromDisk = true
    return normalized.state
  }

  function save(state) {
    const payload = {
      version: STORE_VERSION,
      activeModeId: state.activeModeId,
      bindings: state.bindings,
      updatedAt: nowIso(),
    }
    writeJsonAtomic(file, payload, fsImpl)
    degraded = false
    degradedReason = ''
    loadedFromDisk = true
    return payload
  }

  function buildDto(persisted) {
    const expertIds = collectExpertIds(persisted)
    const catalog = catalogProjector(expertIds, persisted)
    const modes = BUILTIN_MODE_IDS.map((modeId) => buildModeDto(modeId, persisted, catalog, daemonProjector))
    if (modes.length > MAX_MODES) {
      modes.length = MAX_MODES
    }
    return {
      ok: true,
      activeModeId: persisted.activeModeId,
      modes,
      degraded,
      degradedReason,
      loadedFromDisk,
    }
  }

  function list() {
    const persisted = loadPersisted()
    return buildDto(persisted)
  }

  function select(modeId) {
    const parsed = normalizeModeId(modeId)
    if (!parsed.ok) return { ok: false, error: parsed.error }

    const persisted = loadPersisted()
    if (persisted.activeModeId === parsed.id) {
      return { ok: true, alreadySelected: true, ...buildDto(persisted) }
    }

    persisted.activeModeId = parsed.id
    save(persisted)
    return { ok: true, alreadySelected: false, ...buildDto(persisted) }
  }

  function bindExpert(expertId, opts = {}) {
    const expertParsed = normalizeExpertId(expertId)
    if (!expertParsed.ok) return { ok: false, error: expertParsed.error }

    const modeParsed = normalizeModeId(opts.modeId || loadPersisted().activeModeId)
    if (!modeParsed.ok) return { ok: false, error: modeParsed.error }

    if (isBuiltinRoleId(modeParsed.id, expertParsed.id)) {
      return { ok: false, error: '内置角色不能作为用户绑定添加' }
    }

    const persisted = loadPersisted()
    const bindings = persisted.bindings[modeParsed.id] || []
    const existing = bindings.find((item) => item.expertId === expertParsed.id)
    if (existing) {
      return {
        ok: true,
        alreadyBound: true,
        modeId: modeParsed.id,
        ...buildDto(persisted),
      }
    }

    if (bindings.length >= MAX_BINDINGS_PER_MODE) {
      return { ok: false, error: `每个工作模式最多绑定 ${MAX_BINDINGS_PER_MODE} 个 Expert` }
    }

    const nextBindings = normalizeBindingsForMode([
      ...bindings,
      { expertId: expertParsed.id, addedAt: nowIso() },
    ])
    persisted.bindings[modeParsed.id] = nextBindings
    save(persisted)
    return {
      ok: true,
      alreadyBound: false,
      modeId: modeParsed.id,
      ...buildDto(persisted),
    }
  }

  function unbindExpert(expertId, opts = {}) {
    const expertParsed = normalizeExpertId(expertId)
    if (!expertParsed.ok) return { ok: false, error: expertParsed.error }

    const modeParsed = normalizeModeId(opts.modeId || loadPersisted().activeModeId)
    if (!modeParsed.ok) return { ok: false, error: modeParsed.error }

    if (isBuiltinRoleId(modeParsed.id, expertParsed.id)) {
      return { ok: false, error: '内置角色不能移除' }
    }

    const persisted = loadPersisted()
    const bindings = persisted.bindings[modeParsed.id] || []
    const nextBindings = bindings.filter((item) => item.expertId !== expertParsed.id)
    if (nextBindings.length === bindings.length) {
      return { ok: false, error: '当前模式中不存在该 Expert 绑定' }
    }

    persisted.bindings[modeParsed.id] = nextBindings
    save(persisted)
    return {
      ok: true,
      modeId: modeParsed.id,
      ...buildDto(persisted),
    }
  }

  /**
   * 卸载 Expert 后清理所有工作模式中的用户绑定（内置角色不动）。
   * 无绑定也返回 ok，便于卸载路径幂等调用。
   */
  function unbindExpertEverywhere(expertId) {
    const expertParsed = normalizeExpertId(expertId)
    if (!expertParsed.ok) return { ok: false, error: expertParsed.error }

    const persisted = loadPersisted()
    const removedFrom = []
    let changed = false
    for (const modeId of BUILTIN_MODE_IDS) {
      if (isBuiltinRoleId(modeId, expertParsed.id)) continue
      const bindings = persisted.bindings[modeId] || []
      const nextBindings = bindings.filter((item) => item.expertId !== expertParsed.id)
      if (nextBindings.length !== bindings.length) {
        persisted.bindings[modeId] = nextBindings
        removedFrom.push(modeId)
        changed = true
      }
    }
    if (changed) save(persisted)
    return {
      ok: true,
      expertId: expertParsed.id,
      removedFrom,
      unbound: removedFrom.length > 0,
      ...buildDto(persisted),
    }
  }

  function load() {
    return loadPersisted()
  }

  return {
    file,
    list,
    select,
    bindExpert,
    unbindExpert,
    unbindExpertEverywhere,
    load,
    save,
    buildDto,
  }
}

module.exports = {
  STORE_VERSION,
  MAX_BINDINGS_PER_MODE,
  MAX_MODES,
  BUILTIN_MODE_IDS,
  DEFAULT_MODE_ID,
  BUILTIN_MODES,
  resolvePaths,
  normalizeExpertId,
  normalizeModeId,
  normalizePersistedState,
  defaultPersistedState,
  renameWithRetrySync,
  writeJsonAtomic,
  createStore,
}
