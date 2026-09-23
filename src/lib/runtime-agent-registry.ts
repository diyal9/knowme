/**
 * Runtime Agent Registry — professional Agent definition governance.
 *
 * Agent packages still run through the existing expert runtime. This module adds
 * the control plane: strict validation, preview/confirm tokens, lifecycle gates,
 * immutable revisions, and rollback. All mutable data lives under userData.
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  definitionFromLoadedExpert,
  definitionHash,
  normalizeLifecycle,
  validateProfessionalAgentDefinition,
} = require('./professional-agent-definition')
const { BUNDLED_EXPERT_SOURCES } = require('./capability-hub/experts')

const REGISTRY_VERSION = 1
const AGENT_DRAFT_VERSION = 1
const DEFAULT_PREVIEW_TTL_MS = 30 * 60 * 1000
const SAFE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const WRITE_ACTIONS = new Set(['create', 'update', 'retire', 'restore', 'rollback'])
const ORGANIZATION_EXPERT_SOURCES = new Set(['local-repo', 'organization', 'org'])

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function fail(code, error, details = {}) {
  return { ok: false, code, error, ...details }
}

function nowIso() {
  return new Date().toISOString()
}

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temp, file)
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  return [...keys].filter(key => definitionHash({ value: before?.[key] }) !== definitionHash({ value: after?.[key] })).sort()
}

function createRuntimeAgentRegistry(deps = {}) {
  const {
    store,
    catalogApi,
    expertRuntime,
    saveExpertForHub,
    onExpertUninstalled,
  } = deps
  const previewTtlMs = Number(deps.previewTtlMs) > 0
    ? Number(deps.previewTtlMs)
    : DEFAULT_PREVIEW_TTL_MS
  const isAgentAdmin = typeof deps.isAgentAdmin === 'function'
    ? deps.isAgentAdmin
    : () => deps.isAgentAdmin !== false
  const previews = new Map()

  function operatorRole() {
    try { return isAgentAdmin() ? 'admin' : 'user' } catch { return 'user' }
  }

  function ownershipForSource(source) {
    const normalized = String(source || 'custom').trim().toLowerCase() || 'custom'
    if (BUNDLED_EXPERT_SOURCES.has(normalized)) return 'system'
    if (ORGANIZATION_EXPERT_SOURCES.has(normalized)) return 'organization'
    return 'user'
  }

  function canManageCurrent(current) {
    return Boolean(current?.ok) && (operatorRole() === 'admin' || ownershipForSource(current.source) === 'user')
  }

  function assertCurrentAccess(current) {
    if (!current?.ok) return current
    return canManageCurrent(current)
      ? ok({ role: operatorRole(), ownership: ownershipForSource(current.source) })
      : fail('forbidden_agent_scope', '普通用户只能评估和调优自己创建的 Agent')
  }

  function registryRoot() {
    return path.join(store.resolvePaths().root, 'agent-registry')
  }

  function assertAgentId(agentId) {
    const id = String(agentId || '').trim()
    return SAFE_ID_RE.test(id) ? { ok: true, id } : fail('invalid_agent_id', 'Agent id 无效')
  }

  function revisionPaths(agentId) {
    const checked = assertAgentId(agentId)
    if (!checked.ok) return checked
    const root = path.join(registryRoot(), checked.id)
    return ok({
      id: checked.id,
      root,
      index: path.join(root, 'index.json'),
      revisions: path.join(root, 'revisions'),
    })
  }

  function draftPath(agentId) {
    const paths = revisionPaths(agentId)
    return paths.ok ? ok({ ...paths, draft: path.join(paths.root, 'draft.json') }) : paths
  }

  function normalizeDraftDefinition(raw = {}, id) {
    const list = value => [...new Set((Array.isArray(value) ? value : [])
      .map(item => String(item || '').trim())
      .filter(Boolean))]
    const definition = clonePlain(raw) || {}
    return {
      ...definition,
      id,
      name: String(raw.name || '').trim().slice(0, 120),
      description: String(raw.description || raw.persona || '').trim().slice(0, 1200),
      version: String(raw.version || '0.1.0').trim() || '0.1.0',
      avatar: String(raw.avatar || '').trim(),
      skills: list(raw.skills),
      connectors: list(raw.connectors),
      optionalConnectors: list(raw.optionalConnectors),
      knowledgeRefs: list(raw.knowledgeRefs),
      useCases: list(raw.useCases),
      boundaries: list(raw.boundaries),
      inputs: Array.isArray(raw.inputs) ? clonePlain(raw.inputs) : [],
      outputs: Array.isArray(raw.outputs) ? clonePlain(raw.outputs) : [],
    }
  }

  function getAgentDraft(payload = {}) {
    const agentId = typeof payload === 'string' ? payload : payload.agentId || payload.agent_id || payload.id
    const paths = draftPath(agentId)
    if (!paths.ok) return paths
    const current = getCurrent(paths.id)
    if (current.ok) {
      const access = assertCurrentAccess(current)
      if (!access.ok) return access
    }
    const draft = readJson(paths.draft)
    return draft ? ok({ agentId: paths.id, draft }) : fail('agent_draft_not_found', `Agent 草稿不存在: ${paths.id}`)
  }

  function saveAgentDraft(payload = {}) {
    const raw = payload.draft && typeof payload.draft === 'object' ? payload.draft : payload
    const checked = assertAgentId(raw.id || raw.agentId || raw.agent_id)
    if (!checked.ok) return checked
    const paths = draftPath(checked.id)
    if (!paths.ok) return paths
    const existing = readJson(paths.draft)
    const current = getCurrent(checked.id)
    if (current.ok) {
      const access = assertCurrentAccess(current)
      if (!access.ok) return access
    }
    const intent = String(payload.intent || raw.intent || 'create').trim().toLowerCase()
    if (!existing && current.ok && intent !== 'update') {
      return fail('agent_exists', `Agent 已存在，请从专家详情进入调优: ${checked.id}`)
    }
    const definition = normalizeDraftDefinition(raw.definition && typeof raw.definition === 'object'
      ? raw.definition
      : raw, checked.id)
    if (!definition.name) return fail('missing_name', '请填写专家名称')
    if (!definition.description) return fail('missing_description', '请填写一句话职责')
    const timestamp = nowIso()
    const draft = {
      draftVersion: AGENT_DRAFT_VERSION,
      agentId: checked.id,
      status: 'draft',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      definitionHash: definitionHash(definition),
      definition,
    }
    writeJsonAtomic(paths.draft, draft)
    return ok({ code: existing ? 'agent_draft_updated' : 'agent_draft_created', agentId: checked.id, draft })
  }

  function markDraftPublished(agentId, revision) {
    const paths = draftPath(agentId)
    if (!paths.ok) return paths
    const current = readJson(paths.draft)
    if (!current) return ok({ skipped: true })
    const timestamp = nowIso()
    const next = {
      ...current,
      status: 'published',
      publishedAt: timestamp,
      updatedAt: timestamp,
      publishedRevision: revision,
    }
    writeJsonAtomic(paths.draft, next)
    return ok({ draft: next })
  }

  function getCurrent(agentId) {
    const checked = assertAgentId(agentId)
    if (!checked.ok) return checked
    const catalogResult = catalogApi.getCatalogEntry(checked.id)
    const catalogEntry = catalogResult?.ok ? catalogResult.entry : null
    const loaded = expertRuntime().loadExpert(checked.id)
    if (!catalogEntry && !loaded.ok) return fail('agent_not_found', `Agent 不存在: ${checked.id}`)
    const definition = definitionFromLoadedExpert(loaded.ok ? loaded : {}, catalogEntry || {})
    const source = String(catalogEntry?.source || loaded?.source || 'custom').trim() || 'custom'
    return ok({
      id: checked.id,
      catalogEntry,
      loaded: loaded.ok ? loaded : null,
      definition,
      source,
      hash: definitionHash(definition),
    })
  }

  function getAgentDefinition(payload = {}) {
    const agentId = typeof payload === 'string' ? payload : payload.agentId || payload.agent_id || payload.id
    const current = getCurrent(agentId)
    if (!current.ok) return current
    const access = assertCurrentAccess(current)
    if (!access.ok) return access
    return ok({
      agentId: current.id,
      name: current.definition.name || current.id,
      source: current.source,
      ownership: ownershipForSource(current.source),
      operatorRole: operatorRole(),
      editable: true,
      definitionHash: current.hash,
      definition: clonePlain(current.definition),
    })
  }

  function listManageableAgents(payload = {}) {
    const query = String(payload.query || '').trim().toLowerCase()
    const listed = catalogApi.listCatalog({})
    const agents = (listed?.entries || [])
      .filter(item => item?.kind === 'expert')
      .map(item => getCurrent(item.id))
      .filter(current => current?.ok && canManageCurrent(current))
      .map(current => ({
        id: current.id,
        name: current.definition.name || current.id,
        description: current.definition.description || '',
        version: current.definition.version || '',
        source: current.source,
        ownership: ownershipForSource(current.source),
        definitionHash: current.hash,
        lifecycle: current.definition.lifecycle,
        editable: true,
      }))
      .filter(item => !query || `${item.id} ${item.name} ${item.description}`.toLowerCase().includes(query))
      .sort((a, b) => a.ownership.localeCompare(b.ownership) || a.name.localeCompare(b.name, 'zh-CN'))
    return ok({ operatorRole: operatorRole(), agents })
  }

  function availableCapabilityIds() {
    const listed = catalogApi.listCatalog({ enabledOnly: true })
    return new Set((listed?.entries || []).map(item => String(item.id || '').trim()).filter(Boolean))
  }

  function verifyAgentDefinition(payload = {}) {
    const definition = payload.definition && typeof payload.definition === 'object'
      ? payload.definition
      : payload
    const result = validateProfessionalAgentDefinition(definition, {
      availableIds: availableCapabilityIds(),
      source: 'custom',
      trust: 'user',
    })
    return {
      ...result,
      code: result.ok ? 'definition_ready' : 'definition_blocked',
    }
  }

  function loadRevision(agentId, revision) {
    const paths = revisionPaths(agentId)
    if (!paths.ok) return paths
    const number = Number(revision)
    if (!Number.isSafeInteger(number) || number <= 0) return fail('invalid_revision', 'revision 必须是正整数')
    const file = path.join(paths.revisions, `${String(number).padStart(6, '0')}.json`)
    const record = readJson(file)
    return record ? ok({ record }) : fail('revision_not_found', `revision 不存在: ${number}`)
  }

  function resolvePreviewCandidate(action, payload, current) {
    if (action === 'create' || action === 'update') {
      const raw = payload.definition && typeof payload.definition === 'object'
        ? payload.definition
        : payload.agent
      if (!raw) return fail('missing_definition', '缺少完整 Agent definition')
      const verified = verifyAgentDefinition({ definition: raw })
      if (!verified.ok) return fail('definition_blocked', '专业 Agent 定义未通过质量门禁', {
        issues: verified.issues,
        warnings: verified.warnings,
        quality: verified.quality,
      })
      return ok({ definition: verified.definition, manifest: verified.manifest, verification: verified })
    }
    if (action === 'retire' || action === 'restore') {
      if (!current?.ok) return current
      const lifecycle = action === 'retire'
        ? normalizeLifecycle({
            state: 'retired',
            newTasks: false,
            successors: payload.successors || current.definition.lifecycle?.successors,
          })
        : normalizeLifecycle({
            state: 'active',
            newTasks: true,
            successors: current.definition.lifecycle?.successors,
          })
      return ok({ definition: { ...current.definition, lifecycle }, manifest: current.loaded?.capabilityManifest || current.catalogEntry?.manifest || null })
    }
    if (action === 'rollback') {
      if (!current?.ok) return current
      const loadedRevision = loadRevision(current.id, payload.revision)
      if (!loadedRevision.ok) return loadedRevision
      const verified = verifyAgentDefinition({ definition: loadedRevision.record.definition })
      if (!verified.ok) return fail('revision_definition_blocked', '目标 revision 已不满足当前专业质量门禁', {
        issues: verified.issues,
        warnings: verified.warnings,
      })
      return ok({
        definition: verified.definition,
        manifest: verified.manifest,
        verification: verified,
        rollbackFromRevision: loadedRevision.record.revision,
      })
    }
    return fail('invalid_action', `不支持的 Agent 变更: ${action}`)
  }

  function previewAgentChange(payload = {}) {
    const action = String(payload.action || '').trim().toLowerCase()
    if (!WRITE_ACTIONS.has(action)) return fail('invalid_action', 'action 必须是 create/update/retire/restore/rollback')
    const requestedId = String(payload.agentId || payload.id || payload.definition?.id || payload.agent?.id || '').trim()
    const checked = assertAgentId(requestedId)
    if (!checked.ok) return checked
    const current = getCurrent(checked.id)
    if (action === 'create' && current.ok) return fail('agent_exists', `Agent 已存在: ${checked.id}`)
    if (action !== 'create' && !current.ok) return current
    if (current.ok) {
      const access = assertCurrentAccess(current)
      if (!access.ok) return access
    }

    const candidate = resolvePreviewCandidate(action, payload, current)
    if (!candidate.ok) return candidate
    if (candidate.definition.id !== checked.id) {
      return fail('agent_id_mismatch', 'definition.id 与目标 Agent id 不一致')
    }
    const baseHash = current.ok ? current.hash : 'absent'
    const candidateHash = definitionHash(candidate.definition)
    const token = crypto.randomUUID()
    const createdAt = Date.now()
    const preview = {
      token,
      action,
      agentId: checked.id,
      baseHash,
      candidateHash,
      definition: clonePlain(candidate.definition),
      manifest: clonePlain(candidate.manifest),
      rollbackFromRevision: candidate.rollbackFromRevision || null,
      createdAt,
      expiresAt: createdAt + previewTtlMs,
      reason: String(payload.reason || '').trim(),
      operatorRole: operatorRole(),
      source: current.ok ? current.source : 'custom',
      ownership: current.ok ? ownershipForSource(current.source) : 'user',
    }
    previews.set(token, preview)
    return ok({
      code: 'confirmation_required',
      confirmationRequired: true,
      changeToken: token,
      expiresAt: new Date(preview.expiresAt).toISOString(),
      action,
      agentId: checked.id,
      baseHash,
      candidateHash,
      changedFields: changedFields(current.ok ? current.definition : {}, candidate.definition),
      lifecycle: candidate.definition.lifecycle,
      quality: candidate.verification?.quality || { state: 'ready', score: 100 },
      warnings: candidate.verification?.warnings || [],
      operatorRole: preview.operatorRole,
      ownership: preview.ownership,
    })
  }

  function currentHash(agentId) {
    const current = getCurrent(agentId)
    return current.ok ? current.hash : 'absent'
  }

  function writeRevision(agentId, action, definition, metadata = {}) {
    const paths = revisionPaths(agentId)
    if (!paths.ok) return paths
    const index = readJson(paths.index, { version: REGISTRY_VERSION, agentId: paths.id, latest: 0, revisions: [] })
    const revision = Number(index.latest || 0) + 1
    const createdAt = nowIso()
    const record = {
      registryVersion: REGISTRY_VERSION,
      agentId: paths.id,
      revision,
      action,
      createdAt,
      definitionHash: definitionHash(definition),
      definition: clonePlain(definition),
      metadata: clonePlain(metadata || {}),
    }
    const file = path.join(paths.revisions, `${String(revision).padStart(6, '0')}.json`)
    writeJsonAtomic(file, record)
    index.version = REGISTRY_VERSION
    index.agentId = paths.id
    index.latest = revision
    index.updatedAt = createdAt
    index.revisions = [...(Array.isArray(index.revisions) ? index.revisions : []), {
      revision,
      action,
      createdAt,
      definitionHash: record.definitionHash,
      version: definition.version,
      lifecycle: definition.lifecycle,
    }]
    writeJsonAtomic(paths.index, index)
    return ok({ revision, record })
  }

  function publishDefinition(preview) {
    const qualification = {
      state: 'ready',
      issues: [],
      limitedSkills: [],
      assessedAtImport: false,
      verification: 'definition-only',
    }
    const result = saveExpertForHub({
      ...preview.definition,
      source: 'custom',
      capabilityManifest: preview.manifest,
      qualification,
      lifecycle: preview.definition.lifecycle,
    })
    return result?.ok ? result : fail(result?.code || 'agent_publish_failed', result?.error || 'Agent 发布失败')
  }

  function applyLifecycle(preview) {
    const current = getCurrent(preview.agentId)
    if (!current.ok) return current
    const lifecycle = preview.definition.lifecycle
    const base = current.catalogEntry || {}
    const overlay = catalogApi.upsertOverlayEntry({ ...base, lifecycle })
    if (!overlay?.ok) return fail('lifecycle_write_failed', overlay?.error || 'Agent 生命周期写入失败')
    const installed = store.getEntry(preview.agentId)
    if (installed?.ok) {
      const toggled = lifecycle.newTasks === false ? store.disable(preview.agentId) : store.enable(preview.agentId)
      if (!toggled?.ok) return fail('lifecycle_store_failed', toggled?.error || 'Agent 安装状态更新失败')
    }
    let cleanup = null
    if (lifecycle.newTasks === false && onExpertUninstalled) {
      try {
        cleanup = onExpertUninstalled(preview.agentId)
      } catch (error) {
        cleanup = { ok: false, error: error?.message || String(error) }
      }
    }
    return ok({ lifecycle, cleanup })
  }

  function commitAgentChange(payload = {}) {
    const token = String(payload.changeToken || payload.change_token || '').trim()
    const preview = previews.get(token)
    if (!preview) return fail('invalid_change_token', '变更令牌不存在或已使用，请重新预览')
    if (Date.now() > preview.expiresAt) {
      previews.delete(token)
      return fail('change_token_expired', '变更令牌已过期，请重新预览')
    }
    const actualHash = currentHash(preview.agentId)
    if (actualHash !== preview.baseHash) {
      previews.delete(token)
      return fail('stale_change', 'Agent 已在预览后发生变化，请重新预览', {
        expectedHash: preview.baseHash,
        actualHash,
      })
    }
    if (preview.action !== 'create') {
      const access = assertCurrentAccess(getCurrent(preview.agentId))
      if (!access.ok) {
        previews.delete(token)
        return access
      }
    }
    previews.delete(token)
    let applied
    try {
      applied = preview.action === 'retire' || preview.action === 'restore'
        ? applyLifecycle(preview)
        : publishDefinition(preview)
    } catch (error) {
      return fail('agent_change_failed', error?.message || 'Agent 变更失败')
    }
    if (!applied.ok) return applied
    let revision
    try {
      revision = writeRevision(preview.agentId, preview.action, preview.definition, {
        reason: preview.reason,
        rollbackFromRevision: preview.rollbackFromRevision,
        candidateHash: preview.candidateHash,
        operatorRole: preview.operatorRole,
        source: preview.source,
        ownership: preview.ownership,
      })
    } catch (error) {
      revision = fail('revision_write_failed', error?.message || 'revision 写入失败')
    }
    if (!revision.ok) return fail('revision_write_failed', revision.error || 'Agent 已发布，但 revision 写入失败', { applied: true })
    if (preview.action === 'create' || preview.action === 'update' || preview.action === 'rollback') {
      try { markDraftPublished(preview.agentId, revision.revision) } catch { /* publishing remains authoritative */ }
    }
    return ok({
      code: 'agent_change_committed',
      action: preview.action,
      agentId: preview.agentId,
      revision: revision.revision,
      definitionHash: revision.record.definitionHash,
      lifecycle: preview.definition.lifecycle,
      cleanup: applied.cleanup || null,
    })
  }

  function listAgentRevisions(payload = {}) {
    const agentId = typeof payload === 'string' ? payload : payload.agentId || payload.id
    const paths = revisionPaths(agentId)
    if (!paths.ok) return paths
    const current = getCurrent(paths.id)
    if (current.ok) {
      const access = assertCurrentAccess(current)
      if (!access.ok) return access
    }
    const index = readJson(paths.index, { version: REGISTRY_VERSION, agentId: paths.id, latest: 0, revisions: [] })
    return ok({
      agentId: paths.id,
      latest: Number(index.latest || 0),
      revisions: Array.isArray(index.revisions) ? index.revisions.slice().reverse() : [],
    })
  }

  function canStartExpert(agentId) {
    const checked = assertAgentId(agentId)
    if (!checked.ok) return checked
    const catalog = catalogApi.getCatalogEntry(checked.id)
    if (!catalog?.ok) {
      return expertRuntime().loadExpert(checked.id).ok
        ? ok({ agentId: checked.id, lifecycle: { state: 'active', newTasks: true }, legacy: true })
        : fail('agent_not_found', `Agent 不存在: ${checked.id}`)
    }
    const lifecycle = normalizeLifecycle(catalog.entry.lifecycle)
    if (lifecycle.state === 'retired' || lifecycle.newTasks === false) {
      return fail('agent_retired', `Agent 已下架，不能创建新任务: ${checked.id}`, { lifecycle })
    }
    return ok({ agentId: checked.id, lifecycle })
  }

  return {
    listManageableAgents,
    getAgentDefinition,
    getAgentDraft,
    saveAgentDraft,
    verifyAgentDefinition,
    previewAgentChange,
    commitAgentChange,
    listAgentRevisions,
    canStartExpert,
    loadRevision,
  }
}

module.exports = {
  REGISTRY_VERSION,
  AGENT_DRAFT_VERSION,
  DEFAULT_PREVIEW_TTL_MS,
  createRuntimeAgentRegistry,
}
