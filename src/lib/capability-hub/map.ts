/**
 * capability-hub/map — Hub 列表映射、会话知识投影与最小能力包生成。
 * 不负责：install store、IPC、运行时编排（见 sibling 模块与 service 组合根）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { resolvePaths } = require('../capability-store')

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
function normalizeSkillDomainCategory(value = '', source = {}) {
  const category = String(value || '').trim()
  if (category === '写作') return '内容写作'
  if (category === '办公') return '日常办公'
  if (category === '研发' || category === '开发') return '软件研发'
  if (category === '知识') return '知识研究'
  if (category === '视觉') return '视觉创意'
  if (category === '游戏') {
    const text = `${String(source.id || '')} ${String(source.name || '')}`.toLowerCase()
    return /需求|策划|production|requirement/.test(text) ? '产品与研究' : '软件研发'
  }
  return category
}

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
    return normalizeSkillDomainCategory(fromManifest, source)
  }
  if (/^game[-_]|游戏/.test(id) || /游戏/.test(name)) return normalizeSkillDomainCategory('游戏', source)
  if (/^feishu[-_]|飞书|lark/.test(id) || /飞书|feishu|lark/.test(hay)) return '日常办公'
  if (/^office[-_]|^writing[-_]|写作|润色|文稿|文档/.test(id) || /写作|润色/.test(name)) return '内容写作'
  if (/code|review|研发|开发|engineering|engineer/.test(hay)) return '软件研发'
  if (packId.includes('game')) return normalizeSkillDomainCategory('游戏', source)
  if (packId.includes('office')) return '日常办公'
  return '知识研究'
}

function mapPackSkillToHub(source = {}, manifest = {}) {
  const ownerPackId = source.ownerPackId || source.provenance?.ownerPackId || ''
  const experienceWarnings = Array.isArray(manifest.experienceWarnings)
    ? manifest.experienceWarnings
    : (Array.isArray(source.experienceWarnings) ? source.experienceWarnings : [])
  const domain = inferPackSkillDomainCategory(source, manifest)
  const experienceTasks = manifest.metadata?.knowme?.experience?.tasks
  const icon = Array.isArray(experienceTasks) ? String(experienceTasks[0]?.icon || '').trim() : ''
  return {
    id: source.id,
    kind: 'skill',
    name: source.name || source.id,
    description: source.description || '',
    ...(icon ? { icon } : {}),
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
  if (entry.kind === 'skill') category = normalizeSkillDomainCategory(category, entry)
  else if (category === '开发') category = '研发'
  const categories = (entry.categories || []).map((cat) => entry.kind === 'skill' ? normalizeSkillDomainCategory(cat, entry) : (cat === '开发' ? '研发' : cat))
  const status = entry.installed
    ? (entry.enabled ? 'enabled' : 'disabled')
    : (entry.installStatus || 'available')
  const experienceTasks = entry.manifest?.metadata?.knowme?.experience?.tasks
  const icon = entry.icon || (Array.isArray(experienceTasks) ? experienceTasks[0]?.icon : '')
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    originName: entry.originName || '',
    description: entry.description,
    ...(icon ? { icon: String(icon) } : {}),
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
    } = require('../expert-agentic-profile')
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

module.exports = {
  fail,
  ok,
  projectSessionKnowledge,
  resolveSessionRetrievalProviders,
  validateSessionContextPatch,
  inferPackSkillDomainCategory,
  mapPackSkillToHub,
  mergePackSkillWarnings,
  mapCatalogItemToHub,
  createMinimalPackage,
  stageMinimalPackage,
}
