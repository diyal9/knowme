/**
 * capability-hub/lifecycle — 能力 list/install/import/favorites/cursor 与 enable/disable。
 * 不负责：专家 save/delete（见 experts）、会话上下文（见 session-context）。
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { listCatalog } = require('../capability-catalog')
const { validateInstallDependencies } = require('../capability-import')
const { resolvePaths } = require('../capability-store')
const connectorCaps = require('../connector-capabilities')
const {
  scanCursorRepository,
  publicPreview,
  registerCursorRepository,
} = require('../cursor-capability-repository')
const {
  fail,
  ok,
  mapCatalogItemToHub,
  mapPackSkillToHub,
  mergePackSkillWarnings,
  stageMinimalPackage,
} = require('./map')

/**
 * 能力生命周期：目录列表、安装/导入、收藏与 Cursor 仓库注册。
 */
function createCapabilityLifecycle(deps) {
  const {
    getUserData,
    getConnectorsApi,
    bundledRoot,
    getPackSkillSources,
    store,
    catalogApi,
    importApi,
    unifiedConnectors,
    expertRuntime,
    skillRuntime,
    findPackOwnedSkill,
    onExpertUninstalled,
  } = deps

  const repositoryPreviews = new Map()

  function rememberRepositoryPreview(preview) {
    const token = crypto.randomBytes(16).toString('hex')
    repositoryPreviews.set(token, { preview, createdAt: Date.now() })
    while (repositoryPreviews.size > 8) {
      const oldest = repositoryPreviews.keys().next().value
      repositoryPreviews.delete(oldest)
    }
    return token
  }

  function migrateConnectorsIfNeeded() {
    return unifiedConnectors.migrateLegacy()
  }

  async function connectorLifecycle(entry, enabled) {
    if (!entry || entry.kind !== 'connector') return ok()
    const connectors = unifiedConnectors.loadConnectors()
    const conn = connectors.find((c) => c.id === entry.id)
    if (!conn) return ok()
    if (conn.type === 'mcp' && conn.mcp) {
      if (enabled) await connectorCaps.onConnectorEnabled(entry.id, conn.mcp)
      else await connectorCaps.onConnectorDisabled(entry.id)
    }
    getConnectorsApi()?.upsertConnector?.({ id: entry.id, enabled: enabled === true })
    return ok()
  }

  async function listCapabilities(options = {}) {
    const result = listCatalog(getUserData(), { ...options, bundledRoot })
    const items = (result.entries || []).map(mapCatalogItemToHub)
    const seenIds = new Set(items.map((item) => item.id))

    if (getPackSkillSources) {
      const payload = getPackSkillSources()
      const packIssues = Array.isArray(payload?.issues) ? payload.issues : []
      for (const src of payload?.sources || []) {
        const manifest = src.capabilityManifest || {}
        const experienceWarnings = mergePackSkillWarnings(manifest)
        for (const issue of packIssues.filter((item) => item.skillId === src.id)) {
          experienceWarnings.push({
            code: issue.code,
            message: issue.message,
            path: issue.path || `pack:${src.ownerPackId || ''}`,
          })
        }
        manifest.experienceWarnings = experienceWarnings

        if (seenIds.has(src.id)) {
          const existing = items.find((item) => item.id === src.id)
          if (existing) {
            existing.packOwned = true
            existing.ownerPackId = src.ownerPackId || src.provenance?.ownerPackId || existing.ownerPackId
            if (existing.source !== 'curated') existing.source = 'pack'
            existing.uninstallBlocked = true
            existing.uninstallHint = existing.ownerPackId
              ? `该 Skill 由能力包「${existing.ownerPackId}」提供，请通过禁用或卸载能力包管理。`
              : existing.uninstallHint
            existing.dependencies = manifest.dependencies?.length
              ? manifest.dependencies
              : existing.dependencies
            existing.permissions = Object.keys(manifest.permissions || {}).length
              ? manifest.permissions
              : existing.permissions
            existing.risk = manifest.risk || existing.risk
            existing.provenance = {
              ...(existing.provenance || {}),
              ...(manifest.provenance || src.provenance || {}),
              source: 'pack',
              ownerPackId: existing.ownerPackId,
            }
            existing.experienceWarnings = experienceWarnings.length ? experienceWarnings : existing.experienceWarnings
          }
          continue
        }

        const hubItem = mapPackSkillToHub(src, manifest)
        if (options.kind && options.kind !== hubItem.kind) continue
        items.push(hubItem)
        seenIds.add(hubItem.id)
      }
    }

    try {
      const runtime = expertRuntime()
      for (const item of items) {
        if (item.kind !== 'expert') continue
        if (String(item.avatar || '').trim()) continue
        const loaded = runtime.loadExpert(item.id)
        if (loaded?.ok && loaded.avatar) item.avatar = loaded.avatar
      }
      if (!options.kind || options.kind === 'expert') {
        for (const expert of runtime.listExperts()) {
          if (seenIds.has(expert.id)) continue
          items.push(mapCatalogItemToHub({
            id: expert.id,
            kind: 'expert',
            name: expert.name || expert.id,
            originName: expert.originName || '',
            description: expert.description || '',
            avatar: expert.avatar || '',
            version: '1.0.0',
            source: 'custom',
            categories: [],
            tags: ['custom'],
            featured: false,
            installed: true,
            enabled: true,
            installStatus: 'enabled',
            contentHash: expert.contentHash || '',
            dependencies: expert.dependencies || [],
            permissions: expert.permissions || {},
            inputs: expert.inputs || [],
            outputs: expert.outputs || [],
            risk: expert.risk || { level: 'low', reasons: [] },
            provenance: expert.provenance || {},
            sourceAvailable: true,
          }))
          seenIds.add(expert.id)
        }
      }
    } catch {
      /* ignore enrichment failures */
    }

    items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    let favoriteKeys = new Set()
    try {
      favoriteKeys = new Set(store.listFavoriteKeys ? store.listFavoriteKeys() : [])
    } catch {
      favoriteKeys = new Set()
    }
    for (const item of items) {
      const key = `${item.kind}:${item.id}`
      item.favorite = favoriteKeys.has(key)
    }
    return ok({ items, version: result.version, favorites: [...favoriteKeys] })
  }

  function listCapabilityFavorites() {
    try {
      const keys = store.listFavoriteKeys ? store.listFavoriteKeys() : []
      return ok({ keys })
    } catch (error) {
      return fail('favorite_list_failed', error?.message || String(error))
    }
  }

  function toggleCapabilityFavorite(payload = {}) {
    const kind = String(payload.kind || 'skill').trim() || 'skill'
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_id', '缺少能力 id')
    try {
      const result = store.toggleFavorite(kind, id)
      if (!result?.ok) return fail('favorite_toggle_failed', result?.error || '收藏失败')
      return ok(result)
    } catch (error) {
      return fail('favorite_toggle_failed', error?.message || String(error))
    }
  }

  function validateCapabilityActivation(entry, payload = {}) {
    const entries = store.loadInstallStore().entries || {}
    const dependencies = entry.manifest?.dependencies || entry.dependencies || []
    const issues = []
    const warnings = []
    for (const dep of dependencies) {
      const target = entries[dep.id]
      const available = target
        && target.enabled !== false
        && !['removed', 'failed', 'available'].includes(target.status)
        && (!dep.kind || target.kind === dep.kind)
      if (available) continue
      const item = {
        code: dep.required === false ? 'missing_optional_dependency' : 'missing_dependency',
        dependency: dep,
        message: `缺少${dep.required === false ? '可选' : '必需'}依赖: ${dep.id}`,
      }
      if (dep.required === false) warnings.push(item)
      else issues.push(item)
    }
    if (issues.length && entry.kind === 'expert') {
      warnings.push(...issues.splice(0))
    }
    if (issues.length) {
      return {
        ok: false,
        code: 'dependency_conflict',
        error: issues[0].message,
        issues,
        warnings,
      }
    }
    const risk = entry.manifest?.risk || entry.risk || { level: 'low', reasons: [] }
    if (['high', 'critical'].includes(risk.level) && payload.riskConfirmed !== true) {
      return {
        ok: false,
        code: 'risk_confirmation_required',
        error: '高风险能力需明确确认后启用',
        needsRiskConfirmation: true,
        risk,
        warnings,
      }
    }
    return ok({ warnings })
  }

  function publishImportedEntry(result) {
    if (!result?.ok || !result.entry || result.entry.source === 'curated') return result
    const entry = result.entry
    let name = entry.name || entry.id
    let description = entry.description || ''
    if (entry.kind === 'skill') {
      const loaded = skillRuntime().findSkillRecord(entry.id)
      if (loaded) {
        name = loaded.name || name
        description = loaded.description || description
      }
    } else if (entry.kind === 'expert') {
      const loaded = expertRuntime().loadExpert(entry.id)
      if (loaded.ok) {
        name = loaded.name || name
        description = loaded.description || description
      }
    } else if (entry.kind === 'connector') {
      const manifestPath = path.join(resolvePaths(getUserData()).connectors, entry.id, 'manifest.json')
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        name = manifest.name || name
        description = manifest.description || description
        unifiedConnectors.projectLegacy()
      } catch { /* keep install metadata */ }
    }
    store.upsertEntry({ ...entry, name, description })
    catalogApi.upsertOverlayEntry({
      id: entry.id,
      kind: entry.kind,
      name,
      description,
      version: entry.version,
      source: entry.source,
      trust: entry.trust,
      categories: entry.kind === 'connector' ? ['自定义'] : [],
      tags: [entry.source],
      contentHash: entry.contentHash,
      manifest: entry.manifest,
      dependencies: entry.dependencies,
      permissions: entry.permissions,
      inputs: entry.inputs,
      outputs: entry.outputs,
      risk: entry.risk,
      provenance: entry.provenance,
    })
    return result
  }

  async function scanCursorRepositoryForHub(payload = {}) {
    const folderPath = String(payload.path || '').trim()
    const preview = scanCursorRepository(folderPath)
    if (!preview.ok) return preview
    const previewToken = rememberRepositoryPreview(preview)
    return publicPreview(preview, previewToken)
  }

  async function importCursorRepository(payload = {}) {
    const previewToken = String(payload.previewToken || '').trim()
    const cached = repositoryPreviews.get(previewToken)
    if (!cached || Date.now() - cached.createdAt > 10 * 60 * 1000) {
      repositoryPreviews.delete(previewToken)
      return fail('preview_expired', '仓库预览已过期，请重新扫描')
    }
    if (payload.trustConfirmed !== true) {
      return {
        ok: false,
        needsTrust: true,
        code: 'trust_required',
        error: '请确认信任该本地 Cursor 仓库后再注册',
        preview: publicPreview(cached.preview, previewToken),
      }
    }
    const refreshed = scanCursorRepository(cached.preview.root)
    if (!refreshed.ok) return refreshed
    if (refreshed.contentHash !== cached.preview.contentHash) {
      const nextToken = rememberRepositoryPreview(refreshed)
      repositoryPreviews.delete(previewToken)
      return {
        ok: false,
        code: 'preview_stale',
        error: '仓库内容在确认前发生变化，请检查新预览后重试',
        preview: publicPreview(refreshed, nextToken),
      }
    }
    const result = registerCursorRepository(refreshed, {
      userData: getUserData(),
      store,
      catalog: catalogApi,
      expertRuntime: expertRuntime(),
      connectorsApi: getConnectorsApi(),
    })
    repositoryPreviews.delete(previewToken)
    return result
  }

  async function installCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_args', '缺少 catalog id')
    const entryResult = catalogApi.getCatalogEntry(id)
    if (!entryResult.ok) return entryResult
    if (entryResult.entry.source === 'curated' || entryResult.entry.catalogLayer === 'bundled') {
      return importApi.installCurated(id, {
        bundledRoot,
        enabled: payload.enabled !== false,
        riskConfirmed: payload.riskConfirmed === true,
      })
    }
    return fail('not_curated', '仅 curated 条目支持 catalog 安装')
  }

  async function precheckInstallCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_args', '缺少 catalog id')
    const entryResult = catalogApi.getCatalogEntry(id)
    if (!entryResult.ok) return entryResult
    const entry = entryResult.entry || {}
    const manifest = entry.manifest || {}
    const dependencies = validateInstallDependencies(getUserData(), {
      id: entry.id,
      kind: entry.kind,
      dependencies: manifest.dependencies || entry.dependencies || [],
      risk: manifest.risk || entry.risk || { level: 'low', reasons: [] },
      permissions: manifest.permissions || entry.permissions || {},
      inputs: manifest.inputs || entry.inputs || [],
      outputs: manifest.outputs || entry.outputs || [],
      name: entry.name,
      version: entry.version,
    })
    return ok({
      preview: {
        source: entry.source || 'curated',
        id: entry.id,
        kind: entry.kind,
        name: entry.name || entry.id,
        version: entry.version || '1.0.0',
        trust: {
          required: false,
          status: entry.trust || 'bundled',
          message: '',
          origin: entry.repositoryId || '',
        },
        risk: entry.risk || manifest.risk || { level: 'low', reasons: [] },
        dependencies: {
          requiredIssues: dependencies.issues || [],
          optionalWarnings: dependencies.warnings || [],
        },
        permissions: manifest.permissions || entry.permissions || {},
        io: {
          inputs: manifest.inputs || entry.inputs || [],
          outputs: manifest.outputs || entry.outputs || [],
        },
        compatibility: {
          status: dependencies.ok ? 'compatible' : 'blocked',
          reason: dependencies.ok ? '' : (dependencies.issues?.[0]?.message || '依赖不可用'),
        },
        estimatedCost: {
          level: 'low',
          score: 0,
          estimate: '预计较低',
          packageSizeMb: 0,
          fileCount: 0,
        },
        rollbackHint: '安装后可在能力详情中停用或卸载。',
      },
    })
  }

  async function uninstallCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_args', '缺少 id')
    const packOwned = findPackOwnedSkill(id)
    if (packOwned) {
      const ownerPackId = packOwned.ownerPackId || packOwned.provenance?.ownerPackId || ''
      return fail(
        'pack_owned_skill',
        ownerPackId
          ? `该 Skill 由已启用的能力包「${ownerPackId}」提供，请先禁用或卸载该能力包。`
          : '该 Skill 由已启用的能力包提供，请先禁用或卸载对应能力包。',
        { ownerPackId, route: 'pack-disable' },
      )
    }
    const current = store.getEntry(id)
    if (!current.ok) return current
    if (current.entry.kind === 'connector') {
      await connectorCaps.onConnectorRemoved(id)
      const result = unifiedConnectors.removeConnector(id)
      if (result.ok && current.entry.source !== 'curated') catalogApi.removeOverlayEntry(id)
      return result
    }
    const result = store.uninstall(id)
    if (result.ok && current.entry.source !== 'curated') catalogApi.removeOverlayEntry(id)
    if (result.ok && current.entry.kind === 'expert' && onExpertUninstalled) {
      try {
        const cleanup = onExpertUninstalled(id)
        if (cleanup && cleanup.ok === false) {
          result.workbenchCleanup = cleanup
        } else if (cleanup) {
          result.workbenchCleanup = cleanup
        }
      } catch (error) {
        result.workbenchCleanup = {
          ok: false,
          error: error?.message || String(error),
        }
      }
    }
    return result
  }

  async function enableCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const current = store.getEntry(id)
    if (!current.ok) return current
    const activation = validateCapabilityActivation(current.entry, payload)
    if (!activation.ok) return activation
    if (current.entry.kind === 'connector') {
      const connectorResult = unifiedConnectors.setEnabled(id, true)
      if (connectorResult.ok) await connectorLifecycle(connectorResult.entry, true)
      return connectorResult
    }
    const result = store.enable(id)
    if (result.ok) await connectorLifecycle(result.entry, true)
    return result
  }

  async function disableCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const current = store.getEntry(id)
    if (!current.ok) return current
    if (current.entry.kind === 'connector') {
      const connectorResult = unifiedConnectors.setEnabled(id, false)
      if (connectorResult.ok) await connectorLifecycle(connectorResult.entry, false)
      return connectorResult
    }
    const result = store.disable(id)
    if (result.ok) await connectorLifecycle(result.entry, false)
    return result
  }

  async function updateCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const entryResult = catalogApi.getCatalogEntry(id)
    if (!entryResult.ok) return entryResult
    const sourceResult = catalogApi.getBundledInstallSource(entryResult.entry)
    if (!sourceResult.ok) return sourceResult
    return importApi.installCurated(id, {
      bundledRoot,
      enabled: true,
      riskConfirmed: payload.riskConfirmed === true,
    })
  }

  async function importCapability(payload = {}) {
    const source = String(payload.source || 'local').trim()
    const trustConfirmed = payload.trustConfirmed === true
    const riskConfirmed = payload.riskConfirmed === true

    if (source === 'https') {
      const url = String(payload.url || '').trim()
      const result = await importApi.importFromHttps(url, { trustConfirmed, riskConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: url }
      }
      return publishImportedEntry(result)
    }

    if (source === 'local') {
      const folderPath = String(payload.path || '').trim()
      if (!folderPath) return fail('invalid_args', '缺少本地目录 path')
      const result = importApi.importFromFolder(folderPath, { trustConfirmed, riskConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: folderPath }
      }
      return publishImportedEntry(result)
    }

    if (source === 'zip') {
      const zipPath = String(payload.path || '').trim()
      if (!zipPath) return fail('invalid_args', '缺少 ZIP path')
      const result = importApi.importFromZipFile(zipPath, { trustConfirmed, riskConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: zipPath }
      }
      return publishImportedEntry(result)
    }

    if (source === 'custom') {
      const kind = String(payload.kind || 'skill').trim()
      const staged = stageMinimalPackage(getUserData(), kind, payload)
      if (!staged.ok) return staged
      const result = importApi.importFromFolder(staged.stagingPath, {
        source: 'custom',
        id: payload.id,
        trustConfirmed: true,
        riskConfirmed,
      })
      return publishImportedEntry(result)
    }

    return fail('unsupported_source', `不支持的导入来源: ${source}`)
  }

  async function precheckImportCapability(payload = {}) {
    return importApi.precheckImport(payload || {})
  }

  return {
    migrateConnectorsIfNeeded,
    listCapabilities,
    listCapabilityFavorites,
    toggleCapabilityFavorite,
    publishImportedEntry,
    scanCursorRepositoryForHub,
    importCursorRepository,
    installCapability,
    precheckInstallCapability,
    uninstallCapability,
    enableCapability,
    disableCapability,
    updateCapability,
    importCapability,
    precheckImportCapability,
  }
}

module.exports = {
  createCapabilityLifecycle,
}
