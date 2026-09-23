'use strict'
const { expertRouteLabel } = require('../shared/expert-display')

/**
 * expert-runtime — EXPERT.md + manifest 解析、bindings 校验、Session 快照与试聊 DTO。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { contentHash } = require('./skill-runtime')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  validateAndNormalizeManifest,
} = require('./capability-manifest-v2')
const {
  normalizeAgenticType,
  isValidAgenticType,
  normalizeAgenticConfig,
  resolveSoulSop,
  synthesizeSystemPrompt,
} = require('./expert-agentic-profile')
const { normalizeExpertPromptSchema, lintExpertPrompt } = require('./expert-prompt-governance')

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

function stripQuotes(value) {
  const v = String(value || '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

function parseInlineList(value) {
  const raw = String(value || '').trim()
  if (!raw) return []
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean)
  }
  return [stripQuotes(raw)].filter(Boolean)
}

function parseAgenticConfigValue(val) {
  const raw = String(val || '').trim()
  if (!raw) return {}
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * 解析 EXPERT.md frontmatter：name, description, avatar, skills[], connectors[], optionalConnectors[],
 * systemPrompt, soul, sop, agenticType, agenticConfig
 */
function parseExpertFrontmatter(content) {
  const text = String(content || '')
  const match = text.match(FRONTMATTER_RE)
  if (!match) {
    return { ok: false, frontmatter: {}, body: text, error: 'missing frontmatter' }
  }

  const raw = match[1]
  const body = match[2]
  const frontmatter = {}

  let listKey = ''
  let blockKey = ''
  let blockLines = []
  const flushBlock = () => {
    if (!blockKey) return
    frontmatter[blockKey] = blockLines.join('\n').trim()
    blockKey = ''
    blockLines = []
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (blockKey && (/^\s+/.test(line) || !trimmed)) {
      blockLines.push(line.replace(/^\s{2}/, ''))
      continue
    }
    flushBlock()
    if (listKey && /^\s*-\s+/.test(line)) {
      frontmatter[listKey].push(stripQuotes(trimmed.replace(/^-\s+/, '')))
      continue
    }
    listKey = ''
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (['skills', 'connectors', 'optionalConnectors', 'knowledgeRefs', 'useCases', 'boundaries', 'inputContract', 'outputContract'].includes(key)) {
      frontmatter[key] = parseInlineList(val)
      if (!val) listKey = key
    } else if (key === 'orchestrationEnabled') {
      frontmatter.orchestrationEnabled = val === true || val === 'true'
    } else if ((key === 'systemPrompt' || key === 'soul' || key === 'sop') && /^[|>]/.test(val)) {
      blockKey = key
    } else if (key === 'systemPrompt' || key === 'soul' || key === 'sop') {
      frontmatter[key] = stripQuotes(val)
    } else if (key === 'agenticType') {
      frontmatter.agenticType = stripQuotes(val)
    } else if (key === 'agenticConfig') {
      frontmatter.agenticConfig = parseAgenticConfigValue(val)
    } else {
      frontmatter[key] = stripQuotes(val)
    }
  }
  flushBlock()

  const legacyPrompt = String(frontmatter.systemPrompt || body.trim()).trim()
  const resolved = resolveSoulSop({
    soul: frontmatter.soul,
    sop: frontmatter.sop,
    systemPrompt: legacyPrompt,
    agenticType: frontmatter.agenticType,
    agenticConfig: frontmatter.agenticConfig,
  })

  return {
    ok: true,
    frontmatter,
    body,
    name: String(frontmatter.name || '').trim(),
    version: String(frontmatter.version || '1.0.0').trim() || '1.0.0',
    originName: String(frontmatter.originName || '').trim(),
    description: String(frontmatter.description || '').trim(),
    avatar: String(frontmatter.avatar || '').trim(),
    skills: Array.isArray(frontmatter.skills) ? frontmatter.skills.map(String) : [],
    connectors: Array.isArray(frontmatter.connectors) ? frontmatter.connectors.map(String) : [],
    optionalConnectors: Array.isArray(frontmatter.optionalConnectors) ? frontmatter.optionalConnectors.map(String) : [],
    knowledgeRefs: Array.isArray(frontmatter.knowledgeRefs) ? frontmatter.knowledgeRefs.map(String) : [],
    useCases: Array.isArray(frontmatter.useCases) ? frontmatter.useCases.map(String) : [],
    boundaries: Array.isArray(frontmatter.boundaries) ? frontmatter.boundaries.map(String) : [],
    inputContract: Array.isArray(frontmatter.inputContract) ? frontmatter.inputContract.map(String) : [],
    outputContract: Array.isArray(frontmatter.outputContract) ? frontmatter.outputContract.map(String) : [],
    soul: resolved.soul,
    sop: resolved.sop,
    agenticType: resolved.agenticType,
    agenticConfig: resolved.agenticConfig,
    systemPrompt: resolved.systemPrompt || legacyPrompt,
    error: null,
  }
}

function parseManifestJson(text) {
  try {
    const data = JSON.parse(String(text || '{}'))
    return {
      ok: true,
      version: String(data.version || '1.0.0').trim(),
      contentHash: String(data.contentHash || data.content_hash || '').trim(),
      raw: data,
    }
  } catch (err) {
    return { ok: false, error: String(err.message || 'invalid manifest json') }
  }
}

function buildManifest(expertParsed, expertMdContent) {
  return {
    version: String(expertParsed.version || '1.0.0').trim() || '1.0.0',
    contentHash: contentHash(expertMdContent),
    name: expertParsed.name,
    skills: expertParsed.skills,
    connectors: expertParsed.connectors,
    optionalConnectors: expertParsed.optionalConnectors,
    knowledgeRefs: expertParsed.knowledgeRefs || [],
    updatedAt: new Date().toISOString(),
  }
}

function atomicWriteJson(filePath, data, fsImpl = fs) {
  const dir = path.dirname(filePath)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fsImpl.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  fsImpl.renameSync(tmp, filePath)
}

function normalizeExpertId(id) {
  return String(id || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function allExpertConnectorIds(expert = {}) {
  return [...new Set([
    ...(Array.isArray(expert.connectors) ? expert.connectors : []),
    ...(Array.isArray(expert.optionalConnectors) ? expert.optionalConnectors : []),
  ].map(String).map((id) => id.trim()).filter(Boolean))]
}

function validateExpertPackage(parsed) {
  const issues = []
  if (!parsed.name) issues.push({ code: 'missing_name', message: '缺少 name' })
  const resolved = resolveSoulSop(parsed)
  if (!resolved.systemPrompt && !resolved.sop && !resolved.soul) {
    issues.push({ code: 'missing_system_prompt', message: '缺少 Soul/SOP 或 systemPrompt' })
  }
  if (parsed.agenticType != null && String(parsed.agenticType).trim()
    && !isValidAgenticType(parsed.agenticType)) {
    issues.push({ code: 'invalid_agentic_type', message: 'agenticType 必须是五种 Agentic 模式之一' })
  }
  const orch = parsed.orchestration || parsed.frontmatter?.orchestration
  if (orch && typeof orch === 'object') {
    if (orch.maxSubRuns != null && Number(orch.maxSubRuns) > 2) {
      issues.push({ code: 'orchestration_depth_exceeded', message: 'maxSubRuns 不能超过 2' })
    }
    if (orch.maxParallel != null && Number(orch.maxParallel) > 1) {
      issues.push({ code: 'parallel_cap_exceeded', message: 'maxParallel 不能超过 1' })
    }
  }
  const promptLint = lintExpertPrompt(parsed)
  issues.push(...promptLint.errors.map(item => ({ code: item.code, message: item.message, field: item.field })))
  return { ok: issues.length === 0, issues, warnings: promptLint.warnings, promptSchema: promptLint.schema }
}

function validateBindings(expert, { availableSkills = [], availableConnectors = [] } = {}) {
  const skillSet = new Set(availableSkills.map(String))
  const connectorSet = new Set(availableConnectors.map(String))
  const issues = []

  for (const skillId of expert.skills || []) {
    if (!skillSet.has(String(skillId))) {
      issues.push({
        code: 'unknown_skill',
        message: `绑定的 skill 不存在或未启用: ${skillId}`,
        skillId,
      })
    }
  }
  for (const connectorId of expert.connectors || []) {
    if (!connectorSet.has(String(connectorId))) {
      issues.push({
        code: 'unknown_connector',
        message: `绑定的 connector 不存在或未启用: ${connectorId}`,
        connectorId,
      })
    }
  }
  return { ok: issues.length === 0, issues }
}

function normalizeReadinessIds(value) {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))]
}

function buildRouteReadiness(expert, skillSet = null, connectorSet = null) {
  const routes = expert?.capabilityManifest?.metadata?.knowme?.execution?.routes
  if (!Array.isArray(routes)) return []
  return routes.map((route, index) => {
    const id = String(route?.id || '').trim()
    if (!id) return null
    const requiredSkills = normalizeReadinessIds([...(Array.isArray(route?.requiredSkills) ? route.requiredSkills : []), route?.skillId])
    const requiredConnectorIds = normalizeReadinessIds([...(Array.isArray(route?.requiredConnectorIds) ? route.requiredConnectorIds : []), route?.connectorId])
    const issues = []
    if (skillSet) {
      for (const dependency of requiredSkills) {
        if (!skillSet.has(dependency)) issues.push({
          code: 'route_skill_unavailable',
          dependency: { id: dependency, kind: 'skill' },
          message: `技能未安装或已停用: ${dependency}`,
        })
      }
    }
    if (connectorSet) {
      for (const dependency of requiredConnectorIds) {
        if (!connectorSet.has(dependency)) issues.push({
          code: 'route_connector_unavailable',
          dependency: { id: dependency, kind: 'connector' },
          message: `连接器未安装或已停用: ${dependency}`,
        })
      }
    }
    return {
      id,
      label: expertRouteLabel(route, index),
      state: issues.length ? 'limited' : 'ready',
      requiredSkills,
      requiredConnectorIds,
      issues,
    }
  }).filter(Boolean)
}

function buildBindingReadiness(expert, options = {}) {
  const skillIds = Array.isArray(options.availableSkills) ? options.availableSkills.map(String) : null
  const connectorIds = Array.isArray(options.availableConnectors) ? options.availableConnectors.map(String) : null
  const skillSet = skillIds ? new Set(skillIds) : null
  const connectorSet = connectorIds ? new Set(connectorIds) : null
  const declaredDependencies = Array.isArray(expert.capabilityManifest?.dependencies)
    ? expert.capabilityManifest.dependencies
      .filter(item => item?.id && (item.kind === 'skill' || item.kind === 'connector'))
      .map(item => ({ id: String(item.id), kind: item.kind, required: item.required !== false }))
    : []
  const declaredIds = new Set(declaredDependencies.map(item => `${item.kind}:${item.id}`))
  const skillDependencies = declaredDependencies.some(item => item.kind === 'skill')
    ? declaredDependencies.filter(item => item.kind === 'skill')
    : (expert.skills || []).map(id => ({ id: String(id), kind: 'skill', required: true }))
  const connectorDependencies = declaredDependencies.some(item => item.kind === 'connector')
    ? declaredDependencies.filter(item => item.kind === 'connector')
    : [
      ...(expert.connectors || []).map(id => ({ id: String(id), kind: 'connector', required: true })),
      ...(expert.optionalConnectors || []).map(id => ({ id: String(id), kind: 'connector', required: false })),
    ]
  const dependencies = [...skillDependencies, ...connectorDependencies]
    .filter(item => !declaredIds.has(`${item.kind}:${item.id}`) || declaredDependencies.includes(item))
  const items = [
    ...dependencies.map(item => {
      const available = item.kind === 'skill'
        ? (!skillSet || skillSet.has(item.id))
        : (!connectorSet || connectorSet.has(item.id))
      return {
        id: item.id,
        kind: item.kind,
        required: item.required,
        status: available ? 'ready' : (item.required ? 'limited' : 'optional'),
        ...(!available ? {
          reason: item.required ? `${item.kind === 'skill' ? '技能' : '连接器'}未安装或已停用` : `可选${item.kind === 'skill' ? '技能' : '连接器'}未安装或已停用`,
        } : {}),
      }
    }),
  ]
  const limited = items.filter(item => item.required !== false && item.status !== 'ready')
  const routes = buildRouteReadiness(expert, skillSet, connectorSet)
  return {
    state: limited.length ? 'limited' : 'ready',
    items,
    issues: limited.map(item => ({
      code: item.kind === 'skill' ? 'unavailable_skill' : 'unavailable_connector',
      dependency: { id: item.id, kind: item.kind },
      message: `${item.reason}: ${item.id}`,
    })),
    ...(routes.length ? { routes } : {}),
  }
}

/**
 * @param {{
 *   capabilitiesRoot: string,
 *   snapshotRoot?: string,
 *   fsImpl?: typeof fs,
 *   getSkillHashes?: (ids: string[]) => Record<string, string>,
 *   getConnectorHashes?: (ids: string[]) => Record<string, string>,
 * }} deps
 */
function createExpertRuntime(deps = {}) {
  const capabilitiesRoot = String(deps.capabilitiesRoot || '').trim()
  const snapshotRootOverride = String(deps.snapshotRoot || '').trim()
  const fsImpl = deps.fsImpl || fs
  const getSkillHashes =
    typeof deps.getSkillHashes === 'function' ? deps.getSkillHashes : () => ({})
  const getConnectorHashes =
    typeof deps.getConnectorHashes === 'function' ? deps.getConnectorHashes : () => ({})
  const getAvailableSkillIds =
    typeof deps.getAvailableSkillIds === 'function' ? deps.getAvailableSkillIds : null
  const getAvailableConnectorIds =
    typeof deps.getAvailableConnectorIds === 'function' ? deps.getAvailableConnectorIds : null

  function expertsRoot() {
    return path.join(capabilitiesRoot, 'experts')
  }

  function snapshotsRoot() {
    return snapshotRootOverride || path.join(capabilitiesRoot, 'snapshots')
  }

  function expertDir(expertId) {
    return path.join(expertsRoot(), normalizeExpertId(expertId))
  }

  function loadExpert(expertId) {
    const id = normalizeExpertId(expertId)
    const dir = expertDir(id)
    const expertMd = path.join(dir, 'EXPERT.md')
    const manifestPath = path.join(dir, 'manifest.json')
    const sidecarPath = path.join(dir, SIDECAR_FILE)
    if (!fsImpl.existsSync(expertMd)) {
      return { ok: false, code: 'not_found', message: `专家不存在: ${id}` }
    }
    const mdContent = fsImpl.readFileSync(expertMd, 'utf8')
    const parsed = parseExpertFrontmatter(mdContent)
    const validation = validateExpertPackage(parsed)
    if (!validation.ok) {
      return { ok: false, code: 'invalid_expert', message: validation.issues[0].message, issues: validation.issues }
    }

    let manifest = buildManifest(parsed, mdContent)
    if (fsImpl.existsSync(manifestPath)) {
      const onDisk = parseManifestJson(fsImpl.readFileSync(manifestPath, 'utf8'))
      if (onDisk.ok) {
        manifest = { ...manifest, ...onDisk.raw, contentHash: onDisk.contentHash || manifest.contentHash }
      }
    }
    let capabilityManifest = null
    if (fsImpl.existsSync(sidecarPath)) {
      try {
        const normalized = validateAndNormalizeManifest(JSON.parse(fsImpl.readFileSync(sidecarPath, 'utf8')), {
          id,
          kind: 'expert',
        })
        if (normalized.ok) capabilityManifest = normalized.manifest
      } catch { /* use legacy adapter */ }
    }
    if (!capabilityManifest) {
      const adapted = adaptLegacyCapability('expert', parsed, {
        id,
        name: parsed.name,
        description: parsed.description,
        version: manifest.version,
        source: 'runtime',
        ref: path.join('experts', id, 'EXPERT.md').replace(/\\/g, '/'),
        contentHash: manifest.contentHash,
      })
      if (adapted.ok) capabilityManifest = adapted.manifest
    }

    return {
      ok: true,
      id,
      dir,
      ...parsed,
      manifest,
      capabilityManifest,
      expertMdPath: expertMd,
      manifestPath,
      sidecarPath,
    }
  }

  function listExperts() {
    const root = expertsRoot()
    if (!fsImpl.existsSync(root)) return []
    const out = []
    for (const name of fsImpl.readdirSync(root)) {
      const loaded = loadExpert(name)
      if (!loaded.ok) continue
      out.push({
        id: loaded.id,
        name: loaded.name,
        originName: loaded.originName,
        description: loaded.description,
        avatar: loaded.avatar,
        version: loaded.capabilityManifest?.version || loaded.manifest.version || loaded.version,
        skills: loaded.skills,
        connectors: loaded.connectors,
        optionalConnectors: loaded.optionalConnectors,
        knowledgeRefs: loaded.capabilityManifest?.metadata?.knowledgeRefs || loaded.knowledgeRefs || [],
        useCases: loaded.capabilityManifest?.metadata?.knowme?.useCases || loaded.useCases || [],
        boundaries: loaded.capabilityManifest?.metadata?.knowme?.boundaries || loaded.boundaries || [],
        soul: loaded.soul,
        sop: loaded.sop,
        agenticType: loaded.agenticType,
        agenticConfig: loaded.agenticConfig,
        contentHash: loaded.manifest.contentHash,
        dependencies: loaded.capabilityManifest?.dependencies || [],
        permissions: loaded.capabilityManifest?.permissions || {},
        inputs: loaded.capabilityManifest?.inputs || [],
        outputs: loaded.capabilityManifest?.outputs || [],
        risk: loaded.capabilityManifest?.risk || { level: 'low', reasons: [] },
        provenance: loaded.capabilityManifest?.provenance || {},
      })
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  function assertExpertDirSafe(dir) {
    const root = path.resolve(expertsRoot())
    const resolved = path.resolve(dir)
    const prefix = root.endsWith(path.sep) ? root : root + path.sep
    if (resolved !== root && !resolved.startsWith(prefix)) {
      return { ok: false, code: 'path_escape', message: '专家路径越界，已拒绝删除' }
    }
    return { ok: true, path: resolved }
  }

  function deleteExpert(expertId) {
    const id = normalizeExpertId(expertId)
    if (!id) return { ok: false, code: 'invalid_args', message: '缺少 expert id' }
    const dir = expertDir(id)
    if (!fsImpl.existsSync(dir)) {
      return { ok: false, code: 'not_found', message: `专家不存在: ${id}` }
    }
    const guard = assertExpertDirSafe(dir)
    if (!guard.ok) return guard
    try {
      fsImpl.rmSync(guard.path, { recursive: true, force: true })
    } catch (error) {
      return {
        ok: false,
        code: 'delete_failed',
        message: error?.message || `删除专家失败: ${id}`,
      }
    }
    return { ok: true, id, removed: true }
  }

  function saveExpert(expertId, payload = {}) {
    const id = normalizeExpertId(expertId || payload.id)
    if (!id) return { ok: false, code: 'invalid_args', message: '缺少 expert id' }

    const resolved = resolveSoulSop(payload)
    if (payload.agenticType != null && String(payload.agenticType).trim()
      && !isValidAgenticType(payload.agenticType)) {
      return {
        ok: false,
        code: 'invalid_agentic_type',
        message: 'agenticType 必须是五种 Agentic 模式之一',
      }
    }
    const parsed = {
      name: String(payload.name || '').trim(),
      version: String(payload.version || payload.capabilityManifest?.version || '1.0.0').trim() || '1.0.0',
      originName: String(payload.originName || '').trim(),
      description: String(payload.description || '').trim(),
      avatar: String(payload.avatar || '').trim(),
      skills: Array.isArray(payload.skills) ? payload.skills.map(String) : [],
      connectors: Array.isArray(payload.connectors) ? payload.connectors.map(String) : [],
      optionalConnectors: Array.isArray(payload.optionalConnectors) ? payload.optionalConnectors.map(String) : [],
      knowledgeRefs: Array.isArray(payload.knowledgeRefs) ? payload.knowledgeRefs.map(String) : [],
      useCases: Array.isArray(payload.useCases) ? payload.useCases.map(String) : [],
      boundaries: Array.isArray(payload.boundaries) ? payload.boundaries.map(String) : [],
      inputContract: (Array.isArray(payload.inputs) ? payload.inputs : payload.inputContract || [])
        .map(item => String(item?.name || item || '').trim()).filter(Boolean),
      outputContract: (Array.isArray(payload.outputs) ? payload.outputs : payload.outputContract || [])
        .map(item => String(item?.name || item || '').trim()).filter(Boolean),
      soul: resolved.soul,
      sop: resolved.sop,
      agenticType: resolved.agenticType,
      agenticConfig: resolved.agenticConfig,
      systemPrompt: resolved.systemPrompt
        || synthesizeSystemPrompt({ soul: resolved.soul, sop: resolved.sop }),
    }
    const validation = validateExpertPackage(parsed)
    if (!validation.ok) {
      return { ok: false, code: 'invalid_expert', message: validation.issues[0].message, issues: validation.issues }
    }

    const lines = [
      '---',
      `name: ${JSON.stringify(parsed.name)}`,
      `version: ${JSON.stringify(parsed.version)}`,
      ...(parsed.originName ? [`originName: ${JSON.stringify(parsed.originName)}`] : []),
      `description: ${JSON.stringify(parsed.description)}`,
      `avatar: ${JSON.stringify(parsed.avatar)}`,
      `skills: [${parsed.skills.map((s) => JSON.stringify(s)).join(', ')}]`,
      `connectors: [${parsed.connectors.map((c) => JSON.stringify(c)).join(', ')}]`,
      ...(parsed.optionalConnectors.length ? [`optionalConnectors: [${parsed.optionalConnectors.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      ...(parsed.knowledgeRefs.length ? [`knowledgeRefs: [${parsed.knowledgeRefs.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      ...(parsed.useCases.length ? [`useCases: [${parsed.useCases.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      ...(parsed.boundaries.length ? [`boundaries: [${parsed.boundaries.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      ...(parsed.inputContract.length ? [`inputContract: [${parsed.inputContract.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      ...(parsed.outputContract.length ? [`outputContract: [${parsed.outputContract.map((c) => JSON.stringify(c)).join(', ')}]`] : []),
      `agenticType: ${JSON.stringify(parsed.agenticType)}`,
      `agenticConfig: ${JSON.stringify(parsed.agenticConfig)}`,
      `soul: ${JSON.stringify(parsed.soul)}`,
      `sop: ${JSON.stringify(parsed.sop)}`,
      `systemPrompt: ${JSON.stringify(parsed.systemPrompt)}`,
      '---',
      '',
    ]
    const mdContent = lines.join('\n')
    const manifest = buildManifest(parsed, mdContent)
    const provenance = {
      source: 'custom',
      trust: 'user',
      ref: path.join('experts', id, 'EXPERT.md').replace(/\\/g, '/'),
      contentHash: manifest.contentHash,
    }
    const adapted = payload.capabilityManifest && typeof payload.capabilityManifest === 'object'
      ? validateAndNormalizeManifest({
          ...payload.capabilityManifest,
          id,
          kind: 'expert',
          name: parsed.name,
          description: parsed.description,
          version: parsed.version,
          provenance: { ...(payload.capabilityManifest.provenance || {}), ...provenance },
        }, { id, kind: 'expert' })
      : adaptLegacyCapability('expert', parsed, {
          id,
          name: parsed.name,
          description: parsed.description,
          version: manifest.version,
          ...provenance,
        })
    if (!adapted.ok) {
      return { ok: false, code: 'invalid_capability_manifest', message: adapted.issues?.[0]?.message || '能力合同无效', issues: adapted.issues || [] }
    }
    const dir = expertDir(id)
    fsImpl.mkdirSync(dir, { recursive: true })
    fsImpl.writeFileSync(path.join(dir, 'EXPERT.md'), mdContent, 'utf8')
    atomicWriteJson(path.join(dir, 'manifest.json'), manifest, fsImpl)
    atomicWriteJson(path.join(dir, SIDECAR_FILE), adapted.manifest, fsImpl)
    return {
      ok: true,
      id,
      manifest,
      capabilityManifest: adapted.manifest,
      contentHash: manifest.contentHash,
      soul: parsed.soul,
      sop: parsed.sop,
      agenticType: parsed.agenticType,
      agenticConfig: parsed.agenticConfig,
    }
  }

  function snapshotPath(sessionId) {
    return path.join(snapshotsRoot(), String(sessionId || '').trim(), 'manifest.json')
  }

  function buildSnapshotManifest(expert, skillHashes, connectorHashes, readiness) {
    const resolved = resolveSoulSop(expert)
    return {
      sessionId: expert.sessionId,
      expertId: expert.expertId,
      frozenAt: new Date().toISOString(),
      persona: {
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        role: expert.role || '',
        soul: resolved.soul,
        sop: resolved.sop,
        agenticType: resolved.agenticType,
        agenticConfig: resolved.agenticConfig,
        systemPrompt: resolved.systemPrompt,
        capabilities: Array.isArray(expert.capabilities) ? expert.capabilities : [],
        collaborationStyle: String(expert.collaborationStyle || '').trim(),
      },
      bindings: {
        skills: expert.skills,
        connectors: allExpertConnectorIds(expert),
      },
      capabilityManifest: expert.capabilityManifest && typeof expert.capabilityManifest === 'object'
        ? expert.capabilityManifest
        : null,
      hashes: {
        expert: expert.manifest.contentHash,
        skills: skillHashes,
        connectors: connectorHashes,
      },
      readiness,
    }
  }

  function createSessionSnapshot(sessionId, expertId) {
    const sid = String(sessionId || '').trim()
    const eid = normalizeExpertId(expertId)
    if (!sid || !eid) {
      return { ok: false, code: 'invalid_args', message: 'sessionId 与 expertId 均不能为空' }
    }

    const expert = loadExpert(eid)
    if (!expert.ok) return expert
    const qualification = expert.capabilityManifest?.metadata?.knowme?.qualification
    if (qualification?.state === 'limited') {
      const issues = Array.isArray(qualification.issues) ? qualification.issues.map(String) : []
      const limitedSkills = Array.isArray(qualification.limitedSkills) ? qualification.limitedSkills.map(String) : []
      return {
        ok: false,
        code: 'expert_contract_limited',
        message: `专家“${expert.name || eid}”的能力合同未就绪，请先修复受限能力后再执行。`,
        issues,
        limitedSkills,
      }
    }
    const readiness = buildBindingReadiness(expert, {
      availableSkills: getAvailableSkillIds ? getAvailableSkillIds() : null,
      availableConnectors: getAvailableConnectorIds ? getAvailableConnectorIds() : null,
    })

    const skillHashes = getSkillHashes(expert.skills)
    const connectorHashes = getConnectorHashes(allExpertConnectorIds(expert))
    const snapshot = buildSnapshotManifest(
      {
        sessionId: sid,
        expertId: eid,
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        soul: expert.soul,
        sop: expert.sop,
        agenticType: expert.agenticType,
        agenticConfig: expert.agenticConfig,
        systemPrompt: expert.systemPrompt,
        skills: expert.skills,
        connectors: allExpertConnectorIds(expert),
        manifest: expert.manifest,
        capabilityManifest: expert.capabilityManifest,
      },
      skillHashes,
      connectorHashes,
      readiness,
    )

    const outPath = snapshotPath(sid)
    atomicWriteJson(outPath, snapshot, fsImpl)
    return {
      ok: true,
      sessionId: sid,
      expertId: eid,
      snapshot,
      path: outPath,
      degraded: readiness.state === 'limited',
      issues: readiness.issues,
    }
  }

  function readSessionSnapshot(sessionId) {
    const outPath = snapshotPath(sessionId)
    if (!fsImpl.existsSync(outPath)) return null
    try {
      return JSON.parse(fsImpl.readFileSync(outPath, 'utf8'))
    } catch {
      return null
    }
  }

  function getSessionPersona(sessionId, expertId) {
    const snapshot = readSessionSnapshot(sessionId)
    const hasPersona = snapshot?.persona
      && (snapshot.persona.systemPrompt || snapshot.persona.soul || snapshot.persona.sop)
    if (hasPersona) {
      const resolved = resolveSoulSop(snapshot.persona)
      return {
        ok: true,
        source: 'snapshot',
        expertId: snapshot.expertId,
        persona: {
          ...snapshot.persona,
          soul: resolved.soul,
          sop: resolved.sop,
          agenticType: resolved.agenticType,
          agenticConfig: resolved.agenticConfig,
          systemPrompt: resolved.systemPrompt,
        },
        bindings: snapshot.bindings,
        hashes: snapshot.hashes,
        capabilityManifest: snapshot.capabilityManifest || null,
        readiness: snapshot.readiness || { state: 'ready', items: [], issues: [] },
      }
    }
    if (!expertId) {
      return { ok: false, code: 'no_persona', message: 'Session 无快照且未指定 expertId' }
    }
    const expert = loadExpert(expertId)
    if (!expert.ok) return expert
    const resolved = resolveSoulSop(expert)
    return {
      ok: true,
      source: 'live',
      expertId: expert.id,
      persona: {
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        soul: resolved.soul,
        sop: resolved.sop,
        agenticType: resolved.agenticType,
        agenticConfig: resolved.agenticConfig,
        systemPrompt: resolved.systemPrompt,
      },
      bindings: {
        skills: expert.skills,
        connectors: allExpertConnectorIds(expert),
      },
      capabilityManifest: expert.capabilityManifest || null,
      readiness: buildBindingReadiness(expert, {
        availableSkills: getAvailableSkillIds ? getAvailableSkillIds() : null,
        availableConnectors: getAvailableConnectorIds ? getAvailableConnectorIds() : null,
      }),
      hashes: {
        expert: expert.manifest.contentHash,
      },
    }
  }

  function normalizeIdList(value) {
    return [...new Set((Array.isArray(value) ? value : [])
      .map((item) => String(item?.id || item || '').trim())
      .filter(Boolean))]
  }

  /** Session 级技能/连接器绑定覆盖：只改快照，不写回专家包 */
  function updateSessionBindings(sessionId, patch = {}) {
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, code: 'invalid_args', message: '缺少 sessionId' }
    const snapshot = readSessionSnapshot(sid)
    if (!snapshot) return { ok: false, code: 'not_found', message: 'Session 快照不存在' }

    const nextSkills = patch.skills !== undefined
      ? normalizeIdList(patch.skills)
      : normalizeIdList(snapshot.bindings?.skills)
    const nextConnectors = patch.connectors !== undefined
      ? normalizeIdList(patch.connectors)
      : normalizeIdList(snapshot.bindings?.connectors)

    const availableSkills = getAvailableSkillIds ? getAvailableSkillIds() : null
    const availableConnectors = getAvailableConnectorIds ? getAvailableConnectorIds() : null
    if (availableSkills) {
      const allow = new Set(availableSkills.map(String))
      const unknown = nextSkills.filter((id) => !allow.has(id))
      if (unknown.length) {
        return {
          ok: false,
          code: 'unknown_skill',
          message: `未注册技能: ${unknown.join('、')}`,
          unknown,
        }
      }
    }
    if (availableConnectors) {
      const allow = new Set(availableConnectors.map(String))
      const unknown = nextConnectors.filter((id) => !allow.has(id))
      if (unknown.length) {
        return {
          ok: false,
          code: 'unknown_connector',
          message: `未注册连接器: ${unknown.join('、')}`,
          unknown,
        }
      }
    }

    const readiness = buildBindingReadiness(
      { skills: nextSkills, connectors: nextConnectors },
      { availableSkills, availableConnectors },
    )
    const next = {
      ...snapshot,
      bindings: { skills: nextSkills, connectors: nextConnectors },
      readiness,
      bindingOverrideAt: new Date().toISOString(),
    }
    atomicWriteJson(snapshotPath(sid), next, fsImpl)
    return { ok: true, sessionId: sid, snapshot: next, bindings: next.bindings, readiness }
  }

  function buildTryChatSession(expertId, options = {}) {
    const eid = normalizeExpertId(expertId)
    const expert = loadExpert(eid)
    if (!expert.ok) return expert

    const sessionId = String(
      options.sessionId || `try-${eid}-${crypto.randomBytes(4).toString('hex')}`,
    ).trim()

    const snapshotResult = createSessionSnapshot(sessionId, eid)
    if (!snapshotResult.ok) return snapshotResult

    return {
      ok: true,
      session: {
        id: sessionId,
        expertId: eid,
        ephemeral: true,
        title: `试聊 · ${expert.name}`,
        persona: snapshotResult.snapshot.persona,
        bindings: snapshotResult.snapshot.bindings,
        snapshotPath: snapshotResult.path,
      },
    }
  }

  return {
    loadExpert,
    listExperts,
    saveExpert,
    deleteExpert,
    validateBindings,
    buildBindingReadiness,
    createSessionSnapshot,
    readSessionSnapshot,
    getSessionPersona,
    updateSessionBindings,
    buildTryChatSession,
  }
}

module.exports = {
  createExpertRuntime,
  parseExpertFrontmatter,
  parseManifestJson,
  validateExpertPackage,
  validateBindings,
  buildBindingReadiness,
  buildRouteReadiness,
  buildManifest,
  atomicWriteJson,
  contentHash,
  normalizeAgenticType,
  resolveSoulSop,
  normalizeExpertPromptSchema,
  lintExpertPrompt,
}
