'use strict'

const fs = require('fs')
const path = require('path')
const { copyDirectorySafe, assertPathInsideRoot } = require('./capability-store')
const { PACK_ID_RE, validatePackManifest } = require('./capability-pack-schema')
const { createPackStore, resolvePackFile } = require('./capability-pack-store')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  checkCapabilityDependencies,
  validateAndNormalizeManifest,
} = require('./capability-manifest-v2')
const { contentHash, parseSkillFrontmatter } = require('./skill-runtime')

function fail(code, message, extra = {}) {
  return { ok: false, code, error: message, ...extra }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function validatePackId(packId) {
  const id = String(packId || '').trim()
  return PACK_ID_RE.test(id)
    ? ok({ packId: id })
    : fail('invalid_pack_id', 'pack id 须为小写 kebab-case')
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function resolveTrustedCatalogRoot(catalogRoot) {
  const resolved = path.resolve(String(catalogRoot || ''))
  try {
    if (typeof fs.realpathSync.native === 'function') {
      return fs.realpathSync.native(resolved)
    }
    return fs.realpathSync(resolved)
  } catch {
    return resolved
  }
}

function createCapabilityPackRuntime(options = {}) {
  const store = createPackStore(options)
  const cache = new Map()
  const trustedCatalogRoot = resolveTrustedCatalogRoot(
    options.trustedCatalogRoot || path.join(__dirname, '..', 'catalog'),
  )
  const getAvailableCapabilityManifests = typeof options.getAvailableCapabilityManifests === 'function'
    ? options.getAvailableCapabilityManifests
    : null
  const getOccupiedSkillIds = typeof options.getOccupiedSkillIds === 'function'
    ? options.getOccupiedSkillIds
    : null
  const ensureExpertInstalled = typeof options.ensureExpertInstalled === 'function'
    ? options.ensureExpertInstalled
    : null

  function isPackInstalledSource(entry) {
    return entry?.source === 'installed'
  }

  function resolvePackCatalogRoot(packRoot, manifest, entry) {
    const catalogRel = String(manifest?.bundledCapabilities?.catalogRoot || '').trim()
    if (!catalogRel) return { ok: false, code: 'no_catalog', catalogRoot: null }

    const resolved = path.resolve(packRoot, catalogRel)
    if (isPackInstalledSource(entry)) {
      const guard = assertPathInsideRoot(packRoot, resolved)
      if (!guard.ok) {
        return { ok: false, code: 'catalog_outside_pack', catalogRoot: null }
      }
      return { ok: true, catalogRoot: guard.path }
    }

    const trustedGuard = assertPathInsideRoot(trustedCatalogRoot, resolved)
    if (trustedGuard.ok) {
      return { ok: true, catalogRoot: trustedGuard.path }
    }
    const packGuard = assertPathInsideRoot(packRoot, resolved)
    if (packGuard.ok) {
      return { ok: true, catalogRoot: packGuard.path }
    }
    return { ok: false, code: 'catalog_outside_boundary', catalogRoot: null }
  }

  function resolvePackSkillDirectory(packRoot, manifest, entry, skillId) {
    const catalog = resolvePackCatalogRoot(packRoot, manifest, entry)
    if (!catalog.ok || !catalog.catalogRoot) {
      return { ok: false, code: catalog.code || 'no_catalog', message: '缺少有效 catalogRoot' }
    }
    const rel = path.join('skills', String(skillId || '').trim(), 'SKILL.md').replace(/\\/g, '/')
    const skillMd = path.resolve(catalog.catalogRoot, rel)
    const guard = assertPathInsideRoot(catalog.catalogRoot, skillMd)
    if (!guard.ok) {
      return { ok: false, code: 'skill_path_escape', message: `Skill 路径越界: ${skillId}` }
    }
    if (!fs.existsSync(skillMd)) {
      return { ok: false, code: 'missing_skill', message: `缺少 Skill: ${skillId}` }
    }
    const dir = path.dirname(skillMd)
    return { ok: true, dir, skillMd, catalogRoot: catalog.catalogRoot }
  }

  function loadPackSkillSource(packId, skillId, record) {
    const resolved = resolvePackSkillDirectory(record.packRoot, record.manifest, record.entry, skillId)
    if (!resolved.ok) return resolved

    let parsed
    try {
      const content = fs.readFileSync(resolved.skillMd, 'utf8')
      parsed = parseSkillFrontmatter(content)
      if (!parsed?.ok) {
        return { ok: false, code: 'invalid_skill', message: parsed?.error || `Skill 无效: ${skillId}` }
      }
      const hash = contentHash(content)
      let capabilityManifest = null
      const sidecarPath = path.join(resolved.dir, SIDECAR_FILE)
      if (fs.existsSync(sidecarPath)) {
        try {
          const normalized = validateAndNormalizeManifest(
            JSON.parse(fs.readFileSync(sidecarPath, 'utf8')),
            {
              id: skillId,
              kind: 'skill',
              name: parsed.name || skillId,
              description: parsed.description || '',
              provenance: {
                source: 'pack',
                ref: path.join('skills', skillId, 'SKILL.md').replace(/\\/g, '/'),
                trust: 'bundled',
                contentHash: hash,
              },
            },
          )
          if (normalized.ok) capabilityManifest = normalized.manifest
        } catch { /* fall through */ }
      }
      if (!capabilityManifest) {
        const adapted = adaptLegacyCapability('skill', parsed.frontmatter || {}, {
          id: skillId,
          name: parsed.name || skillId,
          description: parsed.description || '',
          source: 'pack',
          ref: path.join('skills', skillId, 'SKILL.md').replace(/\\/g, '/'),
          trust: 'bundled',
          contentHash: hash,
          hasScripts: fs.existsSync(path.join(resolved.dir, 'scripts')),
        })
        capabilityManifest = adapted.ok ? adapted.manifest : null
      }
      return {
        ok: true,
        source: {
          id: skillId,
          source: 'pack',
          dir: resolved.dir,
          ownerPackId: packId,
          name: parsed.name || skillId,
          description: parsed.description || '',
          disableModelInvocation: parsed.disableModelInvocation,
          slash: parsed.slash || skillId,
          contentHash: hash,
          capabilityManifest,
          provenance: {
            source: 'pack',
            ownerPackId: packId,
            ref: path.relative(record.packRoot, resolved.skillMd).replace(/\\/g, '/'),
            contentHash: hash,
          },
        },
      }
    } catch {
      return { ok: false, code: 'read_failed', message: `Skill 不可读: ${skillId}` }
    }
  }

  function validatePackSkillRefs(packId, record = null) {
    const packRecord = record || loadPackRecord(packId)
    if (!packRecord) return fail('pack_not_found', '能力包不存在')

    const skillIds = Array.isArray(packRecord.manifest.skills)
      ? packRecord.manifest.skills.map((id) => String(id || '').trim()).filter(Boolean)
      : []
    if (!skillIds.length) return ok({ legacy: true })

    const catalogRel = String(packRecord.manifest?.bundledCapabilities?.catalogRoot || '').trim()
    if (!catalogRel) {
      return ok({ legacy: true, warnings: [{ code: 'legacy_scene_only', message: '无 catalogRoot，跳过 bundled skill 校验' }] })
    }

    const missing = []
    const invalid = []
    const sources = []
    for (const skillId of skillIds) {
      const loaded = loadPackSkillSource(packId, skillId, packRecord)
      if (!loaded.ok) {
        if (loaded.code === 'missing_skill') missing.push(skillId)
        else invalid.push({ skillId, message: loaded.message || loaded.code })
        continue
      }
      sources.push(loaded.source)
    }

    if (missing.length) {
      return fail('missing_pack_skill', `缺少 bundled Skill: ${missing.join(', ')}`, { missing, invalid })
    }
    if (invalid.length) {
      return fail('invalid_pack_skill', invalid[0].message || 'bundled Skill 无效', { missing, invalid })
    }

    const occupied = typeof getOccupiedSkillIds === 'function' ? new Set(getOccupiedSkillIds()) : null
    const conflicts = []
    if (occupied) {
      for (const src of sources) {
        if (occupied.has(src.id)) conflicts.push(src.id)
      }
    }
    if (conflicts.length) {
      return fail('skill_id_conflict', `Skill ID 冲突: ${conflicts.join(', ')}`, { conflicts })
    }

    const seen = new Set()
    const duplicates = []
    for (const skillId of skillIds) {
      if (seen.has(skillId)) duplicates.push(skillId)
      seen.add(skillId)
    }
    if (duplicates.length) {
      return fail('duplicate_pack_skill', `Pack manifest 重复 Skill: ${[...new Set(duplicates)].join(', ')}`)
    }

    return ok({ sources })
  }

  function listSkillSources() {
    const out = []
    const issues = []
    const seenIds = new Set()

    for (const pack of listEnabledPacks()) {
      const record = loadPackRecord(pack.id)
      if (!record) continue
      const skillIds = Array.isArray(record.manifest.skills) ? record.manifest.skills : []
      if (!skillIds.length) continue

      const catalogRel = String(record.manifest?.bundledCapabilities?.catalogRoot || '').trim()
      if (!catalogRel) continue

      for (const skillId of skillIds) {
        const normalizedId = String(skillId || '').trim()
        if (!normalizedId) continue
        if (seenIds.has(normalizedId)) {
          issues.push({
            code: 'duplicate_skill_id',
            message: `重复 Skill ID: ${normalizedId}`,
            skillId: normalizedId,
            packId: pack.id,
          })
          continue
        }
        const loaded = loadPackSkillSource(pack.id, normalizedId, record)
        if (!loaded.ok) {
          issues.push({
            code: loaded.code || 'missing_skill',
            message: loaded.message || `Skill 不可用: ${normalizedId}`,
            skillId: normalizedId,
            packId: pack.id,
          })
          continue
        }
        seenIds.add(normalizedId)
        out.push(loaded.source)
      }
    }
    return { sources: out, issues }
  }

  function ensurePackSkillRefs(packId, record = null) {
    const validated = validatePackSkillRefs(packId, record)
    if (validated.ok) return validated
    return validated
  }

  function clearCache() {
    cache.clear()
  }

  function listBundledPackIds() {
    const root = store.bundledRoot
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(id => fs.existsSync(path.join(root, id, 'pack.json')))
  }

  function loadManifestFromRoot(packRoot) {
    const file = path.join(packRoot, 'pack.json')
    const raw = readJsonFile(file)
    if (!raw) return fail('missing_manifest', '缺少 pack.json')
    const validated = validatePackManifest(raw)
    if (!validated.ok) return validated
    const adapted = adaptLegacyCapability('pack', validated.manifest, {
      id: validated.manifest.id,
      source: 'pack-runtime',
      ref: path.join(validated.manifest.id, 'pack.json').replace(/\\/g, '/'),
    })
    if (!adapted.ok) return fail('invalid_capability_manifest', adapted.issues[0]?.message || '能力包统一声明无效')
    return ok({ manifest: validated.manifest, capabilityManifest: adapted.manifest, packRoot })
  }

  function loadScenesBundle(packRoot, manifest) {
    if (Array.isArray(manifest.scenes) && manifest.scenes.length) {
      return {
        scenes: manifest.scenes,
        scenePrompts: {},
        legacyModeMap: manifest.legacyModeMap || {},
      }
    }
    const scenesFile = manifest.scenesFile ? String(manifest.scenesFile).trim() : 'scenes.json'
    const file = resolvePackFile(packRoot, scenesFile)
    if (!file || !fs.existsSync(file)) {
      return { scenes: [], scenePrompts: {}, legacyModeMap: {} }
    }
    const raw = readJsonFile(file) || {}
    return {
      scenes: Array.isArray(raw.scenes) ? raw.scenes : [],
      scenePrompts: raw.scenePrompts && typeof raw.scenePrompts === 'object' ? raw.scenePrompts : {},
      legacyModeMap: raw.legacyModeMap && typeof raw.legacyModeMap === 'object' ? raw.legacyModeMap : {},
    }
  }

  function loadPackRecord(packId) {
    const validId = validatePackId(packId)
    if (!validId.ok) return null
    packId = validId.packId
    if (cache.has(packId)) return cache.get(packId)

    const entry = store.getEntry(packId)
    const bundledRoot = path.resolve(store.bundledRoot, packId)
    const bundledGuard = assertPathInsideRoot(store.bundledRoot, bundledRoot)
    if (!bundledGuard.ok) return null
    const hasBundled = fs.existsSync(path.join(bundledRoot, 'pack.json'))

    if (!entry && !hasBundled) return null

    const packRoot = store.resolvePackRoot(packId, entry)
    if (!packRoot) return null
    const loaded = loadManifestFromRoot(packRoot)
    if (!loaded.ok) return null
    if (loaded.manifest.id !== packId) return null

    const scenesBundle = loadScenesBundle(packRoot, loaded.manifest)
    const record = {
      id: packId,
      manifest: loaded.manifest,
      capabilityManifest: loaded.capabilityManifest,
      packRoot,
      entry: entry || {
        id: packId,
        version: loaded.manifest.version,
        status: 'available',
        source: 'bundled',
        enabled: false,
      },
      scenes: scenesBundle.scenes,
      scenePrompts: scenesBundle.scenePrompts,
      legacyModeMap: scenesBundle.legacyModeMap,
    }

    if (loaded.manifest.requirementSchema) {
      const schemaFile = resolvePackFile(packRoot, loaded.manifest.requirementSchema)
      record.requirementSchema = schemaFile && fs.existsSync(schemaFile)
        ? readJsonFile(schemaFile)
        : null
    }

    cache.set(packId, record)
    return record
  }

  function discoverPacks() {
    const ids = new Set(listBundledPackIds())
    const storeData = store.loadStore()
    for (const id of Object.keys(storeData.packs || {})) ids.add(id)

    const packs = []
    for (const id of ids) {
      const record = loadPackRecord(id)
      if (!record) continue
      const enabled = record.entry.enabled !== false
        && (record.entry.status === 'enabled' || record.entry.status === 'installed')
      packs.push({
        id: record.id,
        name: record.manifest.name,
        description: record.manifest.description,
        version: record.manifest.version,
        status: record.entry.status || (enabled ? 'enabled' : 'available'),
        enabled,
        installed: record.entry.status === 'enabled'
          || record.entry.status === 'installed'
          || record.entry.status === 'disabled',
        source: record.entry.source || 'bundled',
        expert: record.manifest.expert,
        skills: record.manifest.skills,
        connectors: record.manifest.connectors,
        dependencies: record.manifest.dependencies,
        permissions: record.manifest.permissions,
        capabilityDependencies: record.capabilityManifest.dependencies,
        inputs: record.capabilityManifest.inputs,
        outputs: record.capabilityManifest.outputs,
        risk: record.capabilityManifest.risk,
        provenance: record.capabilityManifest.provenance,
      })
    }
    return packs.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  function listEnabledPacks() {
    return discoverPacks().filter(p => p.enabled)
  }

  function isPackEnabled(packId) {
    const record = loadPackRecord(packId)
    if (!record) return false
    return record.entry.enabled !== false
      && ['enabled', 'installed'].includes(record.entry.status)
  }

  function sceneMapForPack(record) {
    const map = {}
    for (const scene of record.scenes) map[scene.id] = scene
    return map
  }

  function classifySceneFromText(scenes, text = '') {
    const src = String(text || '')
    if (!src.trim()) return null
    for (const scene of scenes) {
      if (!scene.keywords) continue
      const re = scene.keywords instanceof RegExp
        ? scene.keywords
        : new RegExp(scene.keywords, 'i')
      if (re.test(src)) return scene.id
    }
    return null
  }

  function resolveScene({
    packId = '',
    sceneId = '',
    prompt = '',
    mode = 'general',
    tier = 'chat',
    hasTask = false,
    explicitScene = '',
  } = {}) {
    const enabled = listEnabledPacks()
    if (!enabled.length) return null

    const targetPacks = packId
      ? enabled.filter(p => p.id === packId)
      : enabled

    const explicit = String(explicitScene || sceneId || '').trim()

    for (const pack of targetPacks) {
      const record = loadPackRecord(pack.id)
      if (!record) continue
      const map = sceneMapForPack(record)

      if (explicit && map[explicit]) {
        return { packId: pack.id, sceneId: explicit, scene: map[explicit], record }
      }

      const fromText = classifySceneFromText(record.scenes, prompt)
      if (fromText && map[fromText]) {
        return { packId: pack.id, sceneId: fromText, scene: map[fromText], record }
      }

      if (packId) {
        const legacyKey = String(mode || 'general').trim().toLowerCase()
        const legacyScene = record.legacyModeMap[legacyKey]
        if (legacyScene && map[legacyScene]) {
          return { packId: pack.id, sceneId: legacyScene, scene: map[legacyScene], record }
        }
      }
    }

    if (packId && (tier === 'assist' || hasTask)) {
      for (const pack of targetPacks) {
        const record = loadPackRecord(pack.id)
        const devScene = record?.scenes.find(s => s.defaultWorkflow || /dev|delivery|实现/.test(s.label || ''))
        if (devScene) {
          return { packId: pack.id, sceneId: devScene.id, scene: devScene, record }
        }
      }
    }

    return null
  }

  function resolveLegacyGameScene(args) {
    return resolveScene({ ...args, packId: 'game-studio' })
  }

  function buildScenePrompt(resolved) {
    if (!resolved?.record || !resolved.scene) return ''
    const { record, sceneId, scene } = resolved
    const promptBody = record.scenePrompts[sceneId] || ''
    const lines = [
      `【${record.manifest.name}｜${scene.label}】`,
      promptBody,
    ]
    if (scene.skillId) lines.push(`推荐技能：/${scene.skillId}`)
    return lines.filter(Boolean).join('\n')
  }

  function listScenesForUi(packId = '') {
    const packs = packId
      ? listEnabledPacks().filter(p => p.id === packId)
      : listEnabledPacks()

    const items = []
    for (const pack of packs) {
      const record = loadPackRecord(pack.id)
      if (!record) continue
      for (const scene of record.scenes) {
        if (scene.showInEmptyState === false) continue
        items.push({
          packId: pack.id,
          packName: pack.name,
          id: scene.id,
          label: scene.label,
          description: scene.description,
          skillId: scene.skillId,
          expertId: scene.expertId,
          legacyModes: scene.legacyModes || [],
          emptyPrompt: scene.emptyPrompt || '',
        })
      }
    }
    return items
  }

  function listEmptyStateGroups() {
    const groups = []
    for (const pack of listEnabledPacks()) {
      const record = loadPackRecord(pack.id)
      if (!record) continue
      const scenes = record.scenes.filter(s => s.showInEmptyState !== false)
      if (!scenes.length) continue
      const ui = record.manifest.ui || {}
      groups.push({
        packId: pack.id,
        kicker: ui.emptyStateKicker != null ? String(ui.emptyStateKicker) : pack.name,
        hero: ui.emptyStateHero != null ? String(ui.emptyStateHero) : pack.name,
        sub: ui.emptyStateSub != null ? String(ui.emptyStateSub) : pack.description,
        scenes: scenes.map(s => ({
          id: s.id,
          title: s.label,
          subtitle: s.description,
          prompt: s.emptyPrompt || '',
        })),
      })
    }
    return groups
  }

  function getRequirementSchema(packId = 'game-studio') {
    const record = loadPackRecord(packId)
    return record?.requirementSchema || null
  }

  function getPackWorkflow(packId, sceneId) {
    const record = loadPackRecord(packId)
    if (!record) return record?.manifest?.defaultWorkflow || ''
    const scene = sceneMapForPack(record)[sceneId]
    return scene?.defaultWorkflow || record.manifest.defaultWorkflow || ''
  }

  function checkDependencies(packId, additionalAvailable = []) {
    const validId = validatePackId(packId)
    if (!validId.ok) return validId
    packId = validId.packId
    const record = loadPackRecord(packId)
    if (!record) return fail('pack_not_found', '能力包不存在')
    if (getAvailableCapabilityManifests) {
      const availableById = new Map()
      for (const manifest of [
        ...(getAvailableCapabilityManifests() || []),
        ...(Array.isArray(additionalAvailable) ? additionalAvailable : []),
      ]) {
        if (!manifest?.id || manifest.id === record.capabilityManifest.id) continue
        availableById.set(manifest.id, manifest)
      }
      const available = [...availableById.values()]
      const checked = checkCapabilityDependencies(record.capabilityManifest, available)
      if (!checked.ok) {
        const missing = checked.issues
          .filter(item => item.code === 'missing_dependency')
          .map(item => item.dependency?.id)
          .filter(Boolean)
        return fail('dependency_conflict', missing.length
          ? `缺少依赖: ${missing.join(', ')}`
          : (checked.issues[0]?.message || '能力包依赖不可用'))
      }
      return ok({ warnings: checked.warnings })
    }
    const missing = []
    for (const dep of record.manifest.dependencies || []) {
      if (!isPackEnabled(dep)) missing.push(dep)
    }
    if (missing.length) return fail('dependency_conflict', `缺少依赖: ${missing.join(', ')}`)
    return ok()
  }

  /**
   * Pack 声明的 expert 必须可 loadExpert（落盘到 capabilities/experts/）。
   * 仅 catalog「available」不够——场景/工作流调度会 not_found。
   */
  function ensurePackExpertInstalled(packId, record = null) {
    const packRecord = record || loadPackRecord(packId)
    const expertId = String(packRecord?.manifest?.expert || '').trim()
    if (!expertId) return ok({ skipped: true, reason: 'no_expert' })
    if (!ensureExpertInstalled) {
      return ok({ skipped: true, reason: 'no_hook', expertId })
    }
    try {
      const result = ensureExpertInstalled(expertId)
      if (result && result.ok === false) {
        return fail(
          result.code || 'expert_install_failed',
          result.error || result.message || `专家安装失败: ${expertId}`,
          { expertId },
        )
      }
      return ok({ expertId, status: result?.status || 'ensured', result })
    } catch (error) {
      return fail('expert_install_failed', error?.message || String(error), { expertId })
    }
  }

  function installPack(packId, source = 'bundled', installOptions = {}) {
    const validId = validatePackId(packId)
    if (!validId.ok) return validId
    packId = validId.packId
    const bundledRoot = path.resolve(store.bundledRoot, packId)
    const bundledGuard = assertPathInsideRoot(store.bundledRoot, bundledRoot)
    if (!bundledGuard.ok) return fail('invalid_pack_path', '能力包路径越界')
    const loaded = loadManifestFromRoot(bundledRoot)
    if (!loaded.ok) return loaded
    if (loaded.manifest.id !== packId) return fail('pack_id_mismatch', 'pack id 与 manifest 不一致')

    const skillCheck = ensurePackSkillRefs(packId, {
      packRoot: bundledRoot,
      manifest: loaded.manifest,
      entry: { source },
    })
    if (!skillCheck.ok) return skillCheck
    const depCheck = checkDependencies(
      packId,
      (skillCheck.sources || []).map(item => item.capabilityManifest).filter(Boolean),
    )
    if (!depCheck.ok) return depCheck
    if (loaded.capabilityManifest.risk.level === 'high' && installOptions.riskConfirmed !== true) {
      return fail('risk_confirmation_required', '高风险能力包需要明确确认')
    }

    const contentHash = store.hashDirectory(bundledRoot)
    store.upsertEntry({
      id: packId,
      version: loaded.manifest.version,
      status: 'enabled',
      source,
      enabled: true,
      installedAt: new Date().toISOString(),
      contentHash,
    })
    clearCache()
    const expertEnsure = ensurePackExpertInstalled(packId)
    if (!expertEnsure.ok && installOptions.requireExpert !== false) {
      return fail(
        expertEnsure.code || 'expert_install_failed',
        expertEnsure.error || '能力包绑定专家安装失败',
        { packId, expertId: expertEnsure.expertId },
      )
    }
    return ok({ packId, version: loaded.manifest.version, expert: expertEnsure })
  }

  function enablePack(packId, enableOptions = {}) {
    const validId = validatePackId(packId)
    if (!validId.ok) return validId
    packId = validId.packId
    const record = loadPackRecord(packId)
    if (!record) return fail('pack_not_found', '能力包不存在')
    const skillCheck = ensurePackSkillRefs(packId, record)
    if (!skillCheck.ok) return skillCheck
    const depCheck = checkDependencies(
      packId,
      (skillCheck.sources || []).map(item => item.capabilityManifest).filter(Boolean),
    )
    if (!depCheck.ok) return depCheck
    if (record.capabilityManifest.risk.level === 'high' && enableOptions.riskConfirmed !== true) {
      return fail('risk_confirmation_required', '高风险能力包需要明确确认')
    }
    store.upsertEntry({
      ...record.entry,
      id: packId,
      status: 'enabled',
      enabled: true,
    })
    clearCache()
    const expertEnsure = ensurePackExpertInstalled(packId, record)
    if (!expertEnsure.ok && enableOptions.requireExpert !== false) {
      return fail(
        expertEnsure.code || 'expert_install_failed',
        expertEnsure.error || '能力包绑定专家安装失败',
        { packId, expertId: expertEnsure.expertId },
      )
    }
    return ok({ packId, expert: expertEnsure })
  }

  function disablePack(packId) {
    const validId = validatePackId(packId)
    if (!validId.ok) return validId
    packId = validId.packId
    const record = loadPackRecord(packId)
    if (!record) return fail('pack_not_found', '能力包不存在')
    store.upsertEntry({
      ...record.entry,
      id: packId,
      status: 'disabled',
      enabled: false,
    })
    clearCache()
    return ok({ packId })
  }

  function uninstallPack(packId) {
    const validId = validatePackId(packId)
    if (!validId.ok) return validId
    packId = validId.packId
    const installed = store.installedDir(packId)
    if (!installed) return fail('invalid_pack_path', '能力包安装路径无效')
    const installedGuard = assertPathInsideRoot(store.paths.installed, installed)
    if (!installedGuard.ok) return fail('invalid_pack_path', '能力包安装路径越界')
    if (fs.existsSync(installed)) {
      fs.rmSync(installed, { recursive: true, force: true })
    }
    store.removeEntry(packId)
    clearCache()
    return ok({ packId })
  }

  function installFromDirectory(srcDir, packIdOverride = '') {
    const loaded = loadManifestFromRoot(srcDir)
    if (!loaded.ok) return loaded
    const requestedId = packIdOverride || loaded.manifest.id
    const validId = validatePackId(requestedId)
    if (!validId.ok) return validId
    const packId = validId.packId
    if (packId !== loaded.manifest.id) {
      return fail('pack_id_mismatch', 'pack id override 必须与 manifest.id 一致')
    }
    const skillCheck = ensurePackSkillRefs(packId, {
      packRoot: srcDir,
      manifest: loaded.manifest,
      entry: { source: 'installed' },
    })
    if (!skillCheck.ok) return skillCheck
    if (getAvailableCapabilityManifests) {
      const availableById = new Map()
      for (const manifest of [
        ...(getAvailableCapabilityManifests() || []),
        ...((skillCheck.sources || []).map(item => item.capabilityManifest).filter(Boolean)),
      ]) {
        if (!manifest?.id || manifest.id === loaded.capabilityManifest.id) continue
        availableById.set(manifest.id, manifest)
      }
      const available = [...availableById.values()]
      const checked = checkCapabilityDependencies(loaded.capabilityManifest, available)
      if (!checked.ok) {
        const missing = checked.issues
          .filter(item => item.code === 'missing_dependency')
          .map(item => item.dependency?.id)
          .filter(Boolean)
        return fail('dependency_conflict', missing.length
          ? `缺少依赖: ${missing.join(', ')}`
          : (checked.issues[0]?.message || '能力包依赖不可用'))
      }
    }
    const dest = store.installedDir(packId)
    if (!dest) return fail('invalid_pack_path', '能力包安装路径无效')
    fs.mkdirSync(store.paths.installed, { recursive: true })
    const staging = fs.mkdtempSync(path.join(store.paths.installed, `.${packId}-stage-`))
    const backup = path.join(
      store.paths.installed,
      `.${packId}-backup-${process.pid}-${Date.now()}`,
    )
    const previousEntry = store.getEntry(packId)
    let copied
    try {
      copied = copyDirectorySafe(srcDir, staging, store.paths.installed)
    } catch (error) {
      fs.rmSync(staging, { recursive: true, force: true })
      return fail('pack_copy_failed', String(error?.message || error || '能力包复制失败'))
    }
    if (!copied.ok) {
      fs.rmSync(staging, { recursive: true, force: true })
      return fail('pack_copy_failed', copied.error || '能力包复制失败')
    }
    const copiedManifest = loadManifestFromRoot(staging)
    if (!copiedManifest.ok || copiedManifest.manifest.id !== packId) {
      fs.rmSync(staging, { recursive: true, force: true })
      return fail('pack_copy_invalid', copiedManifest.error || '复制后的能力包无效')
    }

    let movedOld = false
    let movedNew = false
    try {
      if (fs.existsSync(dest)) {
        fs.renameSync(dest, backup)
        movedOld = true
      }
      fs.renameSync(staging, dest)
      movedNew = true
      const stored = store.upsertEntry({
        id: packId,
        version: loaded.manifest.version,
        status: 'enabled',
        source: 'installed',
        enabled: true,
        installedAt: new Date().toISOString(),
        contentHash: store.hashDirectory(dest),
      })
      if (!stored) throw new Error('能力包登记失败')
    } catch (error) {
      try {
        if (movedNew && fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
        if (movedOld && fs.existsSync(backup)) fs.renameSync(backup, dest)
        if (previousEntry) store.upsertEntry(previousEntry)
        else store.removeEntry(packId)
      } catch { /* best-effort rollback */ }
      if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true })
      return fail('pack_install_transaction_failed', String(error?.message || error || '能力包安装事务失败'))
    }
    try {
      if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true })
    } catch { /* installed version is already committed */ }
    clearCache()
    return ok({ packId, version: loaded.manifest.version })
  }

  function ensureDefaultPacks() {
    const defaultPackIds = ['office-partner']
    const results = []
    for (const packId of defaultPackIds) {
      if (isPackEnabled(packId)) {
        const expert = ensurePackExpertInstalled(packId)
        results.push({
          packId,
          status: 'enabled',
          expert,
          // 已启用 Pack 也必须补齐专家；失败记入结果但不阻断另一包
          ok: expert.ok !== false || expert.skipped === true,
        })
        continue
      }
      const entry = store.getEntry(packId)
      if (entry && entry.enabled === false) {
        results.push({ packId, status: 'user_disabled' })
        continue
      }
      const installed = installPack(packId, 'bundled')
      results.push({
        packId,
        status: installed.ok ? 'installed' : 'failed',
        error: installed.ok ? undefined : installed.error,
        code: installed.ok ? undefined : installed.code,
        expert: installed.expert,
      })
    }
    return ok({ results })
  }

  function migrateLegacyGameIndustry(industry) {
    if (String(industry || '').trim().toLowerCase() !== 'game') return ok()
    if (isPackEnabled('game-studio')) return ok()
    return installPack('game-studio', 'bundled')
  }

  function legacyModeDisplayName(mode, packId = 'game-studio') {
    const record = loadPackRecord(packId)
    if (!record || !isPackEnabled(packId)) return null
    const legacyKey = String(mode || 'general').trim().toLowerCase()
    const sceneId = record.legacyModeMap[legacyKey]
    if (!sceneId) return null
    const scene = sceneMapForPack(record)[sceneId]
    return scene?.label || null
  }

  function readPackFile(packId, relativePath) {
    const record = loadPackRecord(packId)
    if (!record) return fail('pack_not_found', '能力包不存在')
    const file = resolvePackFile(record.packRoot, relativePath)
    if (!file || !fs.existsSync(file)) return fail('file_not_found', '文件不存在或路径非法')
    return ok({ path: file, content: fs.readFileSync(file, 'utf8') })
  }

  return {
    store,
    clearCache,
    discoverPacks,
    listEnabledPacks,
    isPackEnabled,
    loadPackRecord,
    resolveScene,
    resolveLegacyGameScene,
    buildScenePrompt,
    listScenesForUi,
    listEmptyStateGroups,
    getRequirementSchema,
    getPackWorkflow,
    installPack,
    enablePack,
    disablePack,
    uninstallPack,
    installFromDirectory,
    ensureDefaultPacks,
    ensurePackExpertInstalled,
    migrateLegacyGameIndustry,
    legacyModeDisplayName,
    readPackFile,
    validatePackManifest,
    validatePackSkillRefs,
    listSkillSources,
    resolvePackCatalogRoot,
  }
}

module.exports = {
  createCapabilityPackRuntime,
}
