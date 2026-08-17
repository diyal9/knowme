/**
 * capability-hub/experts — 专家 save/delete/publish/backfill 与 install store 同步。
 * 不负责：IPC 注册、能力列表（见 lifecycle / ipc）。
 */
'use strict'

const path = require('path')
const { deriveExpertDisplayName, hasChineseText } = require('../expert-display-name')
const { fail, ok } = require('./map')

const BUNDLED_EXPERT_SOURCES = new Set(['curated', 'pack', 'official'])
const USER_EXPERT_SOURCES = new Set(['local', 'custom', 'zip', 'https', 'local-repo'])

/**
 * 专家域操作：落盘、install store、overlay 与工作台清理。
 */
function createCapabilityExperts(deps) {
  const {
    store,
    catalogApi,
    expertRuntime,
    onExpertUninstalled,
  } = deps

  function syncExpertNaming(expertId, patch = {}) {
    const id = String(expertId || '').trim()
    if (!id) return
    const installed = (store.loadInstallStore().entries || {})[id]
    if (installed) store.upsertEntry({ ...installed, ...patch })
    const overlay = catalogApi.loadCatalogOverlay()
    const base = overlay.entries?.[id] || catalogApi.getCatalogEntry(id)?.entry
    if (base) catalogApi.upsertOverlayEntry({ ...base, ...patch })
  }

  /**
   * 将 saveExpert 结果登记进 install store + catalog overlay，
   * 避免「EXPERT.md 已写成功但能力 Hub 列表里看不见」。
   */
  function publishSavedExpert(result, payload = {}) {
    if (!result?.ok) return result
    const id = String(result.id || payload.id || payload.expertId || '').trim()
    if (!id) return result

    const existing = (store.loadInstallStore().entries || {})[id] || null
    const catalogBase = catalogApi.getCatalogEntry(id)?.entry || null
    const loaded = expertRuntime().loadExpert(id)
    const name = String(payload.name || existing?.name || (loaded.ok ? loaded.name : '') || id).trim()
    const originName = String(
      payload.originName || existing?.originName || (loaded.ok ? loaded.originName : '') || '',
    ).trim()
    const description = String(
      payload.description || existing?.description || (loaded.ok ? loaded.description : '') || '',
    ).trim()
    const priorSource = String(existing?.source || catalogBase?.source || '').trim()
    const requestSource = String(payload.source || '').trim()
    const source = BUNDLED_EXPERT_SOURCES.has(priorSource)
      ? priorSource
      : (USER_EXPERT_SOURCES.has(requestSource)
        ? requestSource
        : (USER_EXPERT_SOURCES.has(priorSource) ? priorSource : 'custom'))
    const contentHash = String(
      result.contentHash || existing?.contentHash || (loaded.ok ? loaded.manifest?.contentHash : '') || '',
    ).trim()
    const version = String(
      existing?.version || catalogBase?.version || (loaded.ok ? loaded.manifest?.version : '') || '1.0.0',
    ).trim() || '1.0.0'
    const now = new Date().toISOString()
    const capabilityManifest = result.capabilityManifest
      || (loaded.ok ? loaded.capabilityManifest : null)
      || existing?.manifest
      || catalogBase?.manifest
      || null
    const nameSource = String(
      payload.nameSource || existing?.nameSource || catalogBase?.nameSource || 'user',
    ).trim() || 'user'

    store.upsertEntry({
      ...(existing || {}),
      id,
      kind: 'expert',
      name,
      originName,
      nameSource,
      description,
      version,
      source,
      status: existing?.status || 'enabled',
      enabled: existing ? existing.enabled !== false : true,
      trust: existing?.trust || catalogBase?.trust || 'user',
      contentHash,
      installedAt: existing?.installedAt || now,
      updatedAt: now,
      manifest: capabilityManifest,
      dependencies: capabilityManifest?.dependencies || existing?.dependencies || [],
      permissions: capabilityManifest?.permissions || existing?.permissions || {},
      inputs: capabilityManifest?.inputs || existing?.inputs || [],
      outputs: capabilityManifest?.outputs || existing?.outputs || [],
      risk: capabilityManifest?.risk || existing?.risk || { level: 'low', reasons: [] },
      provenance: {
        ...(existing?.provenance || catalogBase?.provenance || {}),
        ...(capabilityManifest?.provenance || {}),
        source,
        ref: path.join('experts', id, 'EXPERT.md').replace(/\\/g, '/'),
      },
    })

    const priorCategories = Array.isArray(catalogBase?.categories) ? catalogBase.categories : []
    catalogApi.upsertOverlayEntry({
      ...(catalogBase || {}),
      id,
      kind: 'expert',
      name,
      originName,
      nameSource,
      description,
      version,
      source,
      trust: existing?.trust || catalogBase?.trust || 'user',
      categories: priorCategories,
      tags: Array.isArray(catalogBase?.tags) && catalogBase.tags.length
        ? catalogBase.tags
        : [source],
      featured: catalogBase?.featured === true,
      contentHash,
      manifest: capabilityManifest,
      dependencies: capabilityManifest?.dependencies || catalogBase?.dependencies || [],
      permissions: capabilityManifest?.permissions || catalogBase?.permissions || {},
      inputs: capabilityManifest?.inputs || catalogBase?.inputs || [],
      outputs: capabilityManifest?.outputs || catalogBase?.outputs || [],
      risk: capabilityManifest?.risk || catalogBase?.risk || { level: 'low', reasons: [] },
      provenance: {
        ...(catalogBase?.provenance || {}),
        ...(capabilityManifest?.provenance || {}),
        source,
        ref: path.join('experts', id, 'EXPERT.md').replace(/\\/g, '/'),
      },
    })
    return result
  }

  function saveExpertForHub(payload = {}) {
    if (payload.origin === 'daemon' || payload.source === 'daemon') {
      return fail('readonly_daemon_agent', '管线服务专家由管线服务维护，不能保存为本地 Agent')
    }
    const runtime = expertRuntime()
    const id = String(payload.id || payload.expertId || '').trim()
    const existing = runtime.loadExpert(id)
    const originName = String(payload.originName || (existing.ok ? existing.originName : '') || '').trim()
    const result = runtime.saveExpert(id, { ...payload, originName })
    if (!result.ok) return result
    const name = String(payload.name || '').trim()
    const userRenamed = existing.ok && name && name !== existing.name
    publishSavedExpert(result, {
      ...payload,
      originName,
      ...(userRenamed ? { nameSource: 'user' } : {}),
    })
    return ok(result)
  }

  /**
   * 删除自建专家：目录包 + install store + overlay + 工作台绑定。
   * 精选 / pack / official 一律拒绝。
   */
  function deleteExpertForHub(payload = {}) {
    const id = String(payload.id || payload.expertId || '').trim()
    if (!id) return fail('invalid_args', '缺少专家 id')
    if (payload.origin === 'daemon' || payload.source === 'daemon') {
      return fail('readonly_daemon_agent', '管线服务专家由管线服务维护，不能删除')
    }

    const installed = (store.loadInstallStore().entries || {})[id] || null
    const catalog = catalogApi.getCatalogEntry(id)?.entry || null
    const source = String(
      payload.source
      || installed?.source
      || catalog?.source
      || 'custom',
    ).trim()

    if (BUNDLED_EXPERT_SOURCES.has(source)) {
      return fail('readonly_bundled_expert', '精选或官方专家不可删除，请复制为自建后再管理')
    }

    const runtime = expertRuntime()
    const loaded = runtime.loadExpert(id)
    const hasPackage = loaded.ok
    const hasStoreEntry = !!installed

    if (!hasPackage && !hasStoreEntry) {
      return fail('not_found', `专家不存在: ${id}`)
    }

    let uninstallResult = null
    if (hasStoreEntry) {
      uninstallResult = store.uninstall(id)
      if (!uninstallResult.ok) return uninstallResult
    } else if (hasPackage) {
      const removed = runtime.deleteExpert(id)
      if (!removed.ok) return removed
    }

    if (hasPackage && runtime.loadExpert(id).ok) {
      const removed = runtime.deleteExpert(id)
      if (!removed.ok && removed.code !== 'not_found') return removed
    }

    if (source !== 'curated') {
      try { catalogApi.removeOverlayEntry(id) } catch { /* best effort */ }
    }

    let workbenchCleanup = null
    if (onExpertUninstalled) {
      try {
        workbenchCleanup = onExpertUninstalled(id)
      } catch (error) {
        workbenchCleanup = { ok: false, error: error?.message || String(error) }
      }
    }

    return ok({
      id,
      removed: true,
      uninstalled: !!uninstallResult?.ok,
      workbenchCleanup,
    })
  }

  /** 存量导入专家的一次性中文名回填；名字已含中文或已被用户改名时跳过 */
  function backfillExpertDisplayNames() {
    const runtime = expertRuntime()
    const renamed = []
    for (const entry of Object.values(store.loadInstallStore().entries || {})) {
      if (entry.kind !== 'expert' || entry.nameSource === 'user') continue
      const loaded = runtime.loadExpert(entry.id)
      if (!loaded.ok) continue
      const effectiveName = entry.name || catalogApi.getCatalogEntry(entry.id)?.entry?.name || loaded.name
      if (hasChineseText(effectiveName)) continue
      const derived = deriveExpertDisplayName({
        name: loaded.name,
        description: loaded.description,
        frontmatter: loaded.frontmatter,
        persona: loaded.frontmatter?.persona,
      })
      if (!derived.name || derived.name === loaded.name) continue
      const originName = loaded.originName || loaded.name
      const saved = runtime.saveExpert(entry.id, {
        name: derived.name,
        originName,
        description: loaded.description,
        avatar: loaded.avatar,
        skills: loaded.skills,
        connectors: loaded.connectors,
        soul: loaded.soul,
        sop: loaded.sop,
        agenticType: loaded.agenticType,
        agenticConfig: loaded.agenticConfig,
        systemPrompt: loaded.systemPrompt,
      })
      if (!saved.ok) continue
      syncExpertNaming(entry.id, {
        name: derived.name,
        originName,
        nameSource: 'derived',
        contentHash: saved.contentHash,
      })
      renamed.push({ id: entry.id, name: derived.name, originName })
    }
    return { ok: true, renamed }
  }

  return {
    publishSavedExpert,
    saveExpertForHub,
    deleteExpertForHub,
    backfillExpertDisplayNames,
  }
}

module.exports = {
  createCapabilityExperts,
  BUNDLED_EXPERT_SOURCES,
  USER_EXPERT_SOURCES,
}
