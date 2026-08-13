'use strict'

/**
 * capability-hub-service — 主进程 Capability Hub 集中接线：IPC、迁移、工具面、上下文。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { ipcMain } = require('electron')
const {
  createCapabilityStore,
  resolvePaths,
} = require('./capability-store')
const {
  createCapabilityCatalog,
  listCatalog,
} = require('./capability-catalog')
const {
  createCapabilityImport,
  validateInstallDependencies,
} = require('./capability-import')
const { createSkillRuntime } = require('./skill-runtime')
const { mergeSkillTaskCatalog } = require('./skill-task-catalog')
const { createExpertRuntime } = require('./expert-runtime')
const { deriveExpertDisplayName, hasChineseText } = require('./expert-display-name')
const { buildSkillTools } = require('./agent-skill-tools')
const connectorCaps = require('./connector-capabilities')
const { createUnifiedConnectorStore } = require('./connectors/unified-store')
const {
  assembleCapabilityContext,
  getSessionCapabilityBindings,
} = require('./agent-context-assembly')
const { normalizeKnowledgeRefs } = require('./agent-sessions')
const {
  scanCursorRepository,
  publicPreview,
  registerCursorRepository,
} = require('./cursor-capability-repository')

const IPC_CHANNELS = Object.freeze({
  capability: [
    'capability-list',
    'capability-install',
    'capability-install-precheck',
    'capability-uninstall',
    'capability-enable',
    'capability-disable',
    'capability-update',
    'capability-import',
    'capability-import-precheck',
    'capability-pick-local-folder',
    'capability-pick-zip-file',
    'capability-pick-cursor-repository',
    'capability-scan-cursor-repository',
    'capability-import-cursor-repository',
    'capability-favorite-list',
    'capability-favorite-toggle',
  ],
  skill: [
    'skill-list',
    'skill-load',
    'skill-read-resource',
    'skill-run-script',
    'skill-migrate-legacy',
    'skill-task-list',
  ],
  expert: [
    'expert-list',
    'expert-get',
    'expert-save',
    'expert-delete',
    'expert-try-chat',
    'expert-snapshot',
  ],
  connector: [
    'connector-health',
    'connector-tools-preview',
    'connector-save-allowlist',
  ],
})

function fail(code, message) {
  return { ok: false, code, error: message }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function projectSessionKnowledge(session, catalog = {}) {
  const providers = Array.isArray(catalog.providers) ? catalog.providers : []
  const activeProviderId = String(catalog.activeProviderId || 'local-default')
  const byId = new Map(providers.map(p => [p.id, p]))
  const refs = Array.isArray(session?.knowledgeRefs) ? session.knowledgeRefs : []
  const explicit = refs.length > 0
  const available = providers.map(p => ({
    id: p.id,
    displayName: p.displayName,
    kind: p.kind,
  }))

  if (!explicit) {
    const defaultProvider = byId.get(activeProviderId) || providers[0] || null
    return {
      mode: 'default',
      activeProviderId,
      selected: defaultProvider ? [{
        id: defaultProvider.id,
        displayName: defaultProvider.displayName,
        kind: defaultProvider.kind,
        status: 'default',
      }] : [],
      available,
      degraded: false,
      message: '',
    }
  }

  const selected = refs.map(ref => {
    const provider = byId.get(ref.id)
    return {
      id: ref.id,
      displayName: provider?.displayName || ref.id,
      kind: provider?.kind || 'unknown',
      status: provider ? 'ready' : 'limited',
    }
  })
  const readyCount = selected.filter(item => item.status === 'ready').length
  return {
    mode: 'selected',
    activeProviderId,
    selected,
    available,
    degraded: readyCount === 0,
    message: readyCount === 0
      ? '所选知识库均不可用，本轮不会检索其他知识库。'
      : (selected.some(item => item.status === 'limited')
        ? '部分所选知识库不可用，检索将仅使用仍可用的来源。'
        : ''),
  }
}

function resolveSessionRetrievalProviders(session, deps = {}) {
  const resolveProviderById = typeof deps.resolveProviderById === 'function'
    ? deps.resolveProviderById
    : () => null
  const getActiveProvider = typeof deps.getActiveProvider === 'function'
    ? deps.getActiveProvider
    : () => null
  const refs = Array.isArray(session?.knowledgeRefs) ? session.knowledgeRefs : []

  if (!refs.length) {
    const active = getActiveProvider()
    return active
      ? { mode: 'default', providers: [active], degraded: false, message: '' }
      : {
        mode: 'default',
        providers: [],
        degraded: true,
        message: '默认知识库不可用',
      }
  }

  const providers = []
  const missingIds = []
  for (const ref of refs) {
    const provider = resolveProviderById(ref.id)
    if (provider) providers.push(provider)
    else missingIds.push(ref.id)
  }

  if (!providers.length) {
    return {
      mode: 'selected',
      providers: [],
      degraded: true,
      message: '所选知识库均不可用，本轮不会检索其他知识库。',
      missingIds,
    }
  }

  return {
    mode: 'selected',
    providers,
    degraded: false,
    message: missingIds.length ? '部分所选知识库不可用，检索将仅使用仍可用的来源。' : '',
    missingIds,
  }
}

function validateSessionContextPatch(patch = {}) {
  if (!patch || typeof patch !== 'object') {
    return { ok: false, error: '无效的更新内容' }
  }
  const allowed = new Set(['knowledgeRefs', 'skills', 'connectors', 'bindings'])
  const keys = Object.keys(patch)
  if (!keys.length) return { ok: false, error: '缺少可更新字段' }
  for (const key of keys) {
    if (!allowed.has(key)) {
      return { ok: false, error: '仅允许更新 knowledgeRefs / skills / connectors' }
    }
  }
  if (patch.knowledgeRefs !== undefined && !Array.isArray(patch.knowledgeRefs)) {
    return { ok: false, error: 'knowledgeRefs 必须为数组' }
  }
  if (patch.skills !== undefined && !Array.isArray(patch.skills)) {
    return { ok: false, error: 'skills 必须为数组' }
  }
  if (patch.connectors !== undefined && !Array.isArray(patch.connectors)) {
    return { ok: false, error: 'connectors 必须为数组' }
  }
  if (patch.bindings !== undefined) {
    if (!patch.bindings || typeof patch.bindings !== 'object') {
      return { ok: false, error: 'bindings 必须为对象' }
    }
    if (patch.bindings.skills !== undefined && !Array.isArray(patch.bindings.skills)) {
      return { ok: false, error: 'bindings.skills 必须为数组' }
    }
    if (patch.bindings.connectors !== undefined && !Array.isArray(patch.bindings.connectors)) {
      return { ok: false, error: 'bindings.connectors 必须为数组' }
    }
  }
  return { ok: true }
}

/** 能力包 skill 主分类：按工作域推断，避免一律标成「能力包」导致技能 chip 空筛 */
function inferPackSkillDomainCategory(source = {}, manifest = {}) {
  const id = String(source.id || '').trim().toLowerCase()
  const name = String(source.name || '').trim().toLowerCase()
  const packId = String(source.ownerPackId || source.provenance?.ownerPackId || '').trim().toLowerCase()
  const hay = `${id} ${name}`
  const fromManifest = Array.isArray(manifest.categories) && manifest.categories.length
    ? String(manifest.categories[0] || '').trim()
    : (Array.isArray(source.categories) && source.categories.length
      ? String(source.categories[0] || '').trim()
      : '')
  if (fromManifest && !['能力包', '飞书', '效率', '连接器', 'pack'].includes(fromManifest)) {
    if (fromManifest === '开发') return '研发'
    return fromManifest
  }
  if (/^game[-_]|游戏/.test(id) || /游戏/.test(name)) return '游戏'
  if (/^feishu[-_]|飞书|lark/.test(id) || /飞书|feishu|lark/.test(hay)) return '办公'
  if (/^office[-_]|^writing[-_]|写作|润色|文稿|文档/.test(id) || /写作|润色/.test(name)) return '写作'
  if (/code|review|研发|开发|engineering|engineer/.test(hay)) return '研发'
  if (packId.includes('game')) return '游戏'
  if (packId.includes('office')) return '办公'
  return '能力包'
}

function mapPackSkillToHub(source = {}, manifest = {}) {
  const ownerPackId = source.ownerPackId || source.provenance?.ownerPackId || ''
  const experienceWarnings = Array.isArray(manifest.experienceWarnings)
    ? manifest.experienceWarnings
    : (Array.isArray(source.experienceWarnings) ? source.experienceWarnings : [])
  const domain = inferPackSkillDomainCategory(source, manifest)
  return {
    id: source.id,
    kind: 'skill',
    name: source.name || source.id,
    description: source.description || '',
    version: manifest.version || '1.0.0',
    source: 'pack',
    category: domain,
    categories: [domain, '能力包'].filter((v, i, arr) => arr.indexOf(v) === i),
    tags: ['pack', ...(ownerPackId ? [ownerPackId] : [])],
    featured: false,
    status: 'enabled',
    enabled: true,
    installed: true,
    contentHash: source.contentHash || manifest.provenance?.contentHash || '',
    installedAt: '',
    sourceAvailable: true,
    repositoryId: '',
    legacy: false,
    packOwned: true,
    ownerPackId,
    uninstallBlocked: true,
    uninstallHint: ownerPackId
      ? `该 Skill 由能力包「${ownerPackId}」提供，请通过禁用或卸载能力包管理。`
      : '该 Skill 由能力包提供，请通过能力包生命周期管理。',
    dependencies: manifest.dependencies || [],
    permissions: manifest.permissions || {},
    inputs: manifest.inputs || [],
    outputs: manifest.outputs || [],
    risk: manifest.risk || { level: 'low', reasons: [] },
    provenance: {
      ...(manifest.provenance || source.provenance || {}),
      source: 'pack',
      ownerPackId,
    },
    experienceWarnings,
    standardCompatible: true,
  }
}

function mergePackSkillWarnings(manifest = {}) {
  const warnings = []
  const tasks = manifest.metadata?.knowme?.experience?.tasks
  if (Array.isArray(tasks) && !tasks.length && manifest.metadata?.knowme?.experience?.rawTasks) {
    warnings.push({
      code: 'invalid_experience',
      message: 'KnowMe 任务扩展校验失败，Skill 仍可作为标准 Skill 使用',
      path: 'metadata.knowme.experience',
    })
  }
  return warnings
}

function mapCatalogItemToHub(entry) {
  let category = Array.isArray(entry.categories) && entry.categories.length
    ? entry.categories[0]
    : '全部'
  if (category === '开发') category = '研发'
  const categories = (entry.categories || []).map((cat) => (cat === '开发' ? '研发' : cat))
  const status = entry.installed
    ? (entry.enabled ? 'enabled' : 'disabled')
    : (entry.installStatus || 'available')
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    originName: entry.originName || '',
    description: entry.description,
    avatar: entry.avatar || entry.manifest?.avatar || '',
    version: entry.version,
    source: entry.source,
    category,
    categories,
    tags: entry.tags || [],
    featured: entry.featured === true,
    status,
    enabled: entry.enabled === true,
    installed: entry.installed === true,
    contentHash: entry.installedHash || entry.contentHash || '',
    installedAt: entry.installedAt || '',
    sourceAvailable: entry.sourceAvailable !== false,
    repositoryId: entry.repositoryId || '',
    legacy: entry.source === 'legacy-okf',
    dependencies: entry.dependencies || entry.manifest?.dependencies || [],
    permissions: entry.permissions || entry.manifest?.permissions || {},
    inputs: entry.inputs || entry.manifest?.inputs || [],
    outputs: entry.outputs || entry.manifest?.outputs || [],
    risk: entry.risk || entry.manifest?.risk || { level: 'low', reasons: [] },
    provenance: entry.provenance || entry.manifest?.provenance || {},
  }
}

function createMinimalPackage(kind, payload = {}) {
  const id = String(payload.id || '').trim()
  const name = String(payload.name || id).trim()
  const description = String(payload.description || name).trim()
  if (!id || !name) return fail('invalid_args', '缺少 id 或 name')

  if (kind === 'skill') {
    return {
      ok: true,
      files: {
        'SKILL.md': [
          '---',
          `name: ${JSON.stringify(name)}`,
          `description: ${JSON.stringify(description)}`,
          `slash: ${JSON.stringify(payload.slash || id)}`,
          '---',
          '',
          `# ${name}`,
          '',
          description,
          '',
        ].join('\n'),
      },
    }
  }

  if (kind === 'expert') {
    const {
      resolveSoulSop,
      synthesizeSystemPrompt,
      normalizeAgenticType,
      normalizeAgenticConfig,
    } = require('./expert-agentic-profile')
    const resolved = resolveSoulSop({
      soul: payload.soul,
      sop: payload.sop,
      systemPrompt: payload.systemPrompt || description,
      agenticType: payload.agenticType,
      agenticConfig: payload.agenticConfig,
    })
    const systemPrompt = resolved.systemPrompt
      || synthesizeSystemPrompt({ soul: resolved.soul, sop: resolved.sop })
      || description
    const avatar = String(payload.avatar || '').trim()
    const agenticType = normalizeAgenticType(payload.agenticType || resolved.agenticType)
    const agenticConfig = normalizeAgenticConfig(agenticType, payload.agenticConfig || resolved.agenticConfig)
    return {
      ok: true,
      files: {
        'EXPERT.md': [
          '---',
          `name: ${JSON.stringify(name)}`,
          `description: ${JSON.stringify(description)}`,
          `avatar: ${JSON.stringify(avatar)}`,
          `skills: [${(payload.skills || []).map((s) => JSON.stringify(String(s))).join(', ')}]`,
          `connectors: [${(payload.connectors || []).map((c) => JSON.stringify(String(c))).join(', ')}]`,
          `agenticType: ${JSON.stringify(agenticType)}`,
          `agenticConfig: ${JSON.stringify(agenticConfig)}`,
          `soul: ${JSON.stringify(resolved.soul)}`,
          `sop: ${JSON.stringify(resolved.sop || systemPrompt)}`,
          `systemPrompt: ${JSON.stringify(systemPrompt)}`,
          '---',
          '',
        ].join('\n'),
      },
    }
  }

  const manifest = {
    id,
    kind: 'connector',
    name,
    description,
    version: '1.0.0',
    type: String(payload.type || 'mcp'),
    mcp: payload.mcp && typeof payload.mcp === 'object' ? payload.mcp : {
      command: '',
      args: [],
      cwd: '',
      envKeys: [],
    },
    allowlist: Array.isArray(payload.allowlist) ? payload.allowlist : [],
  }
  return {
    ok: true,
    files: {
      'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    },
  }
}

function stageMinimalPackage(userData, kind, payload) {
  const built = createMinimalPackage(kind, payload)
  if (!built.ok) return built
  const paths = resolvePaths(userData)
  const stageRoot = path.join(paths.staging, `custom-${kind}-${Date.now()}`)
  fs.mkdirSync(stageRoot, { recursive: true })
  for (const [name, content] of Object.entries(built.files)) {
    fs.writeFileSync(path.join(stageRoot, name), content, 'utf8')
  }
  return { ok: true, stagingPath: stageRoot }
}

function createCapabilityHubService(deps = {}) {
  const getUserData = typeof deps.getUserData === 'function' ? deps.getUserData : () => ''
  const getKnowledgeDir = typeof deps.getKnowledgeDir === 'function'
    ? deps.getKnowledgeDir
    : () => path.join(getUserData(), 'knowledge')
  const getConnectorsApi = typeof deps.getConnectorsApi === 'function'
    ? deps.getConnectorsApi
    : () => null
  const bundledRoot = deps.bundledRoot || path.join(__dirname, '..', 'catalog')
  const getPackSkillSources = typeof deps.getPackSkillSources === 'function'
    ? deps.getPackSkillSources
    : null
  const getPackEmptyStateGroups = typeof deps.getPackEmptyStateGroups === 'function'
    ? deps.getPackEmptyStateGroups
    : () => []
  const getPackScenesForUi = typeof deps.getPackScenesForUi === 'function'
    ? deps.getPackScenesForUi
    : () => []
  const getKnowledgeCatalog = typeof deps.getKnowledgeCatalog === 'function'
    ? deps.getKnowledgeCatalog
    : () => ({ providers: [], activeProviderId: 'local-default' })
  const resolveProviderById = typeof deps.resolveProviderById === 'function'
    ? deps.resolveProviderById
    : () => null
  const getActiveProvider = typeof deps.getActiveProvider === 'function'
    ? deps.getActiveProvider
    : () => null
  const onExpertUninstalled = typeof deps.onExpertUninstalled === 'function'
    ? deps.onExpertUninstalled
    : null

  const store = createCapabilityStore({ getUserData })
  const unifiedConnectors = createUnifiedConnectorStore({
    getUserData,
    capabilityStore: store,
    mode: deps.connectorStoreMode,
  })
  const catalogApi = createCapabilityCatalog({ getUserData, bundledRoot })
  const importApi = createCapabilityImport({ getUserData })
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

  function capabilitiesRoot() {
    return resolvePaths(getUserData()).root
  }

  function buildInstallStoreMap() {
    const loaded = store.loadInstallStore()
    const map = { skills: {}, experts: {}, connectors: {} }
    for (const entry of Object.values(loaded.entries || {})) {
      if (entry.kind === 'skill') map.skills[entry.id] = entry
      if (entry.kind === 'expert') map.experts[entry.id] = entry
      if (entry.kind === 'connector') map.connectors[entry.id] = entry
    }
    return map
  }

  async function runSkillScriptInSandbox(ctx = {}) {
    const agentSandbox = require('./agent-sandbox')
    const permissions = agentSandbox.normalizeSandboxPermissions(ctx.permissions || {}, {})
    const scriptsRoot = String(ctx.scriptsRoot || ctx.skillRoot || '').trim()
    if (!scriptsRoot) return fail('invalid_path', '技能 scripts 目录无效')

    const scriptAbs = String(ctx.scriptAbs || '').trim()
    const rel = path.relative(scriptsRoot, scriptAbs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return fail('invalid_path', '脚本必须在技能 scripts/ 目录内')
    }

    const ext = path.extname(scriptAbs).toLowerCase()
    const sandboxTools = agentSandbox.buildSandboxTools({
      workdir: scriptsRoot,
      permissions,
    })

    if (ext === '.py') {
      const code = fs.readFileSync(scriptAbs, 'utf8')
      return sandboxTools.handlers.run_python({ code })
    }
    if (ext === '.js' || ext === '.mjs') {
      const command = process.platform === 'win32'
        ? `node "${scriptAbs.replace(/"/g, '\\"')}"`
        : `node ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    if (ext === '.sh' || ext === '.bash') {
      const command = process.platform === 'win32'
        ? `bash "${scriptAbs.replace(/"/g, '\\"')}"`
        : `bash ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    return fail('unsupported_script', `不支持的脚本类型: ${ext || '(无扩展名)'}`)
  }

  function skillRuntime() {
    return createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      getPackSkillSources: getPackSkillSources || undefined,
      runScript: (ctx) => runSkillScriptInSandbox(ctx),
    })
  }

  function findPackOwnedSkill(skillId) {
    if (!getPackSkillSources) return null
    const payload = getPackSkillSources()
    const sources = Array.isArray(payload) ? payload : (payload?.sources || [])
    return sources.find((item) => item.id === String(skillId || '').trim()) || null
  }

  function listSkillTasks(options = {}) {
    const dynamic = skillRuntime().listSkillTasks(options)
    return mergeSkillTaskCatalog({
      skillTasksResult: dynamic,
      emptyStateGroups: getPackEmptyStateGroups(),
      packScenes: getPackScenesForUi(),
    })
  }

  function expertRuntime() {
    const rt = createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
    })
    return createExpertRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      getSkillHashes: (ids) => {
        const out = {}
        for (const id of ids) {
          const rec = rt.findSkillRecord(id)
          if (rec) out[id] = rec.contentHash || ''
        }
        return out
      },
      getConnectorHashes: (ids) => Object.fromEntries(ids.map((id) => [id, `connector:${id}`])),
      getAvailableSkillIds: () => rt.scanAllSkills()
        .filter(item => rt.isSkillEnabled(item.id))
        .map(item => item.id),
      getAvailableConnectorIds: () => unifiedConnectors.loadConnectors()
        .filter(item => item.enabled !== false)
        .map(item => item.id),
    })
  }

  function syncExpertNaming(expertId, patch = {}) {
    const id = String(expertId || '').trim()
    if (!id) return
    const installed = (store.loadInstallStore().entries || {})[id]
    if (installed) store.upsertEntry({ ...installed, ...patch })
    const overlay = catalogApi.loadCatalogOverlay()
    const base = overlay.entries?.[id] || catalogApi.getCatalogEntry(id)?.entry
    if (base) catalogApi.upsertOverlayEntry({ ...base, ...patch })
  }

  const BUNDLED_EXPERT_SOURCES = new Set(['curated', 'pack', 'official'])
  const USER_EXPERT_SOURCES = new Set(['local', 'custom', 'zip', 'https', 'local-repo'])

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
    if (!USER_EXPERT_SOURCES.has(source) && source) {
      // 未知 source 仍可能是落盘 custom 副本；仅 bundled 明确阻断
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

    // uninstall 会尝试删 installDir；若 store 记录与包路径不一致则补删
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
      // 目录里的有效名字（如内置精选的中文名）优先，避免把已中文化的展示名改回推导值
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

    // 专家头像：目录项可能没有 avatar，回填已安装专家的 EXPERT.md 字段，供 Hub 卡片匹配预设图
    // 顺带合并仅落盘未登记的自建专家，避免历史「保存成功但列表空白」。
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
    // 专家卸载后必须摘掉工作台绑定，否则任务快捷卡片会残留幽灵「智能专家」
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

  function buildSkillToolsForSession(session, sandboxPermissions) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    return buildSkillTools({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      allowedSkillIds: bindings.allowedSkillIds,
      runScript: (ctx) => runSkillScriptInSandbox({
        ...ctx,
        permissions: sandboxPermissions || session?.run?.permissions || {},
      }),
    })
  }

  function filterConnectorsForSession(session, connectors) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    if (!Array.isArray(bindings.allowedConnectorIds)) return connectors
    const allow = new Set(bindings.allowedConnectorIds)
    return connectors.filter((c) => allow.has(c.id))
  }

  function assembleContextForSession(session, prompt, slashRefs, tier, legacySkillContext, options = {}) {
    return assembleCapabilityContext({
      session,
      prompt,
      slashRefs,
      tier,
      expertRuntime: expertRuntime(),
      skillRuntime: skillRuntime(),
      legacySkillContext,
      taskId: String(options.taskId || '').trim(),
    })
  }

  function sessionDto(session) {
    let expertName = ''
    let expert = null
    if (session.expertId) {
      const runtime = expertRuntime()
      const projection = runtime.getSessionPersona(session.id, session.expertId)
      if (projection.ok) {
        expertName = projection.persona?.name || session.expertId
        expert = {
          id: projection.expertId || session.expertId,
          name: expertName,
          description: projection.persona?.description || '',
          avatar: projection.persona?.avatar || '',
          soul: projection.persona?.soul || '',
          sop: projection.persona?.sop || '',
          agenticType: projection.persona?.agenticType || 'react',
          agenticConfig: projection.persona?.agenticConfig || {},
          bindings: projection.bindings || { skills: [], connectors: [] },
          readiness: projection.readiness || { state: 'ready', items: [], issues: [] },
          source: projection.source,
        }
      }
    }
    const catalog = getKnowledgeCatalog()
    const knowledge = projectSessionKnowledge(session, catalog)
    const taskRef = session?.taskRef?.id ? { id: String(session.taskRef.id) } : null
    return {
      ...session,
      expertName,
      expert,
      taskRef,
      knowledge,
    }
  }

  function updateSessionKnowledgeContext(session, patch = {}) {
    const validation = validateSessionContextPatch(patch)
    if (!validation.ok) return validation

    const next = {
      ...session,
      updatedAt: new Date().toISOString(),
    }
    if (patch.knowledgeRefs !== undefined) {
      next.knowledgeRefs = normalizeKnowledgeRefs(patch.knowledgeRefs)
    }

    const skillIds = patch.skills !== undefined
      ? patch.skills
      : (patch.bindings?.skills !== undefined ? patch.bindings.skills : undefined)
    const connectorIds = patch.connectors !== undefined
      ? patch.connectors
      : (patch.bindings?.connectors !== undefined ? patch.bindings.connectors : undefined)

    if (skillIds !== undefined || connectorIds !== undefined) {
      const runtime = expertRuntime()
      if (typeof runtime.updateSessionBindings !== 'function') {
        return { ok: false, error: 'Session 绑定覆盖暂不可用' }
      }
      const bindingPatch = {}
      if (skillIds !== undefined) bindingPatch.skills = skillIds
      if (connectorIds !== undefined) bindingPatch.connectors = connectorIds
      const bound = runtime.updateSessionBindings(session.id, bindingPatch)
      if (!bound.ok) return { ok: false, error: bound.message || '绑定更新失败', code: bound.code }
      next.expert = {
        ...(next.expert || {}),
        bindings: bound.bindings,
        readiness: bound.readiness,
      }
    }

    return { ok: true, session: next }
  }

  function resolveSessionRetrievalScope(session) {
    return resolveSessionRetrievalProviders(session, {
      resolveProviderById,
      getActiveProvider,
    })
  }

  function registerIpcHandlers(handlers = {}) {
    const showOpenDialog = handlers.showOpenDialog

    ipcMain.handle('capability-list', (_e, opts) => listCapabilities(opts || {}))
    ipcMain.handle('capability-favorite-list', () => listCapabilityFavorites())
    ipcMain.handle('capability-favorite-toggle', (_e, payload) => toggleCapabilityFavorite(payload || {}))
    ipcMain.handle('capability-install', (_e, payload) => installCapability(payload || {}))
    ipcMain.handle('capability-install-precheck', (_e, payload) => precheckInstallCapability(payload || {}))
    ipcMain.handle('capability-uninstall', (_e, payload) => uninstallCapability(payload || {}))
    ipcMain.handle('capability-enable', (_e, payload) => enableCapability(payload || {}))
    ipcMain.handle('capability-disable', (_e, payload) => disableCapability(payload || {}))
    ipcMain.handle('capability-update', (_e, payload) => updateCapability(payload || {}))
    ipcMain.handle('capability-import', (_e, payload) => importCapability(payload || {}))
    ipcMain.handle('capability-import-precheck', (_e, payload) => precheckImportCapability(payload || {}))
    ipcMain.handle('capability-scan-cursor-repository', (_e, payload) =>
      scanCursorRepositoryForHub(payload || {}))
    ipcMain.handle('capability-import-cursor-repository', (_e, payload) =>
      importCursorRepository(payload || {}))

    ipcMain.handle('capability-pick-local-folder', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择能力包文件夹',
        properties: ['openDirectory'],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('capability-pick-zip-file', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择 ZIP 能力包',
        properties: ['openFile'],
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('capability-pick-cursor-repository', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择 Cursor 智能体仓库',
        properties: ['openDirectory'],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('skill-list', () => {
      const items = skillRuntime().listSlashPickerItems()
      const skills = items.map((item) => ({
        id: item.id,
        title: item.name,
        slash: item.slash,
        description: item.description || '',
        source: item.source,
        legacy: item.legacy === true,
      }))
      return ok({ skills, items })
    })

    ipcMain.handle('skill-load', (_e, payload = {}) => {
      const skillId = String(payload.skillId || payload.id || '').trim()
      const sessionId = String(payload.sessionId || '').trim()
      let filterOpts = {}
      if (sessionId && deps.loadAgentStore) {
        const { sessions } = deps.loadAgentStore()
        const session = sessions.find((s) => s.id === sessionId)
        if (session) {
          const bindings = getSessionCapabilityBindings(session, expertRuntime())
          if (bindings.allowedSkillIds) filterOpts = { allowedIds: bindings.allowedSkillIds }
        }
      }
      const result = skillRuntime().loadSkillL1(skillId, filterOpts)
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-read-resource', (_e, payload = {}) => {
      const result = skillRuntime().readSkillResource(
        payload.skillId || payload.id,
        payload.path || payload.resource,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-run-script', async (_e, payload = {}) => {
      const sessionId = String(payload.sessionId || '').trim()
      let permissions = payload.permissions || {}
      if (sessionId && deps.loadAgentStore) {
        const { sessions } = deps.loadAgentStore()
        const session = sessions.find((s) => s.id === sessionId)
        if (session?.run?.permissions) permissions = session.run.permissions
      }
      const result = await skillRuntime().runSkillScript(
        payload.skillId || payload.id,
        payload.script || payload.scriptPath,
        payload.args || {},
        permissions,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-migrate-legacy', (_e, payload = {}) => {
      const result = skillRuntime().exportLegacyToSkillMd(
        payload.legacySkillId || payload.id,
        payload.targetId,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-task-list', () => ok(listSkillTasks()))

    ipcMain.handle('expert-list', () => ok({ experts: expertRuntime().listExperts() }))

    ipcMain.handle('expert-get', (_e, expertId) => {
      const result = expertRuntime().loadExpert(expertId)
      return result.ok ? ok({ expert: result }) : result
    })

    ipcMain.handle('expert-save', (_e, payload = {}) => saveExpertForHub(payload || {}))

    ipcMain.handle('expert-delete', (_e, payload = {}) => deleteExpertForHub(payload || {}))

    ipcMain.handle('expert-snapshot', (_e, payload = {}) => {
      const result = expertRuntime().createSessionSnapshot(
        String(payload.sessionId || '').trim(),
        String(payload.expertId || '').trim(),
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('expert-try-chat', (_e, payload = {}) => {
      const result = expertRuntime().buildTryChatSession(String(payload.expertId || '').trim(), payload)
      return result.ok ? ok({ session: result.session, ephemeral: true }) : result
    })

    ipcMain.handle('connector-health', async (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const connectors = unifiedConnectors.loadConnectors()
      const conn = connectors.find((c) => c.id === connectorId)
      if (!conn) return fail('not_found', '连接器不存在')
      if (conn.type !== 'mcp') {
        return ok({ state: conn.enabled ? 'enabled' : 'disabled', toolsCount: 0 })
      }
      const probe = await connectorCaps.probeMcpHealth(conn.mcp || {})
      return probe.ok ? ok(probe) : probe
    })

    ipcMain.handle('connector-tools-preview', async (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const connectors = unifiedConnectors.loadConnectors()
      const conn = connectors.find((c) => c.id === connectorId)
      if (!conn) return fail('not_found', '连接器不存在')
      const preview = await connectorCaps.previewMcpTools(conn)
      return preview.ok ? ok(preview) : preview
    })

    ipcMain.handle('connector-save-allowlist', (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const allowlist = Array.isArray(payload.allowlist) ? payload.allowlist : []
      const result = unifiedConnectors.setAllowlist(connectorId, allowlist)
      if (!result.ok) return result
      getConnectorsApi()?.upsertConnector?.({ id: connectorId, allowlist })
      return ok({ connectorId, allowlist })
    })
  }

  return {
    IPC_CHANNELS,
    migrateConnectorsIfNeeded,
    backfillExpertDisplayNames,
    listCapabilities,
    listCapabilityFavorites,
    toggleCapabilityFavorite,
    saveExpert: saveExpertForHub,
    deleteExpert: deleteExpertForHub,
    installCapability,
    precheckInstallCapability,
    uninstallCapability,
    enableCapability,
    disableCapability,
    updateCapability,
    importCapability,
    precheckImportCapability,
    scanCursorRepositoryForHub,
    importCursorRepository,
    skillRuntime,
    listSkillTasks,
    expertRuntime,
    buildSkillToolsForSession,
    filterConnectorsForSession,
    assembleContextForSession,
    sessionDto,
    updateSessionKnowledgeContext,
    resolveSessionRetrievalScope,
    projectSessionKnowledge,
    validateSessionContextPatch,
    registerIpcHandlers,
    capabilitiesRoot,
    unifiedConnectors,
  }
}

module.exports = {
  IPC_CHANNELS,
  createCapabilityHubService,
  mapCatalogItemToHub,
  mapPackSkillToHub,
  inferPackSkillDomainCategory,
  createMinimalPackage,
  projectSessionKnowledge,
  resolveSessionRetrievalProviders,
  validateSessionContextPatch,
}
