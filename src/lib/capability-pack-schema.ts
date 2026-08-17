'use strict'

const PACK_SCHEMA_VERSION = 1
const PACK_ID_RE = /^[a-z][a-z0-9-]{0,62}$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i

function fail(code, message) {
  return { ok: false, code, error: message }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function validateScene(scene, index = 0) {
  if (!scene || typeof scene !== 'object') return fail('invalid_scene', `scenes[${index}] 无效`)
  const id = String(scene.id || '').trim()
  if (!id) return fail('invalid_scene', `scenes[${index}] 缺少 id`)
  if (!String(scene.label || '').trim()) return fail('invalid_scene', `scenes[${index}] 缺少 label`)
  return ok({ scene: { ...scene, id } })
}

function validatePackManifest(raw = {}) {
  if (!raw || typeof raw !== 'object') return fail('invalid_manifest', 'pack manifest 必须是对象')

  const schemaVersion = Number(raw.schemaVersion)
  if (schemaVersion !== PACK_SCHEMA_VERSION) {
    return fail('unsupported_schema', `不支持的 schemaVersion: ${raw.schemaVersion}`)
  }

  const id = String(raw.id || '').trim()
  if (!PACK_ID_RE.test(id)) return fail('invalid_id', 'pack id 须为小写 kebab-case')

  const version = String(raw.version || '').trim()
  if (!SEMVER_RE.test(version)) return fail('invalid_version', 'pack version 须为 semver')

  if (!String(raw.name || '').trim()) return fail('missing_name', '缺少 name')
  if (!String(raw.description || '').trim()) return fail('missing_description', '缺少 description')

  const expert = raw.expert != null ? String(raw.expert || '').trim() : ''
  const skills = Array.isArray(raw.skills) ? raw.skills.map(s => String(s || '').trim()).filter(Boolean) : []
  const connectors = Array.isArray(raw.connectors) ? raw.connectors.map(c => String(c || '').trim()).filter(Boolean) : []
  const workflows = Array.isArray(raw.workflows) ? raw.workflows.map(w => String(w || '').trim()).filter(Boolean) : []
  const dependencies = Array.isArray(raw.dependencies)
    ? raw.dependencies.map(d => String(d || '').trim()).filter(Boolean)
    : []

  const scenes = []
  if (Array.isArray(raw.scenes)) {
    for (let i = 0; i < raw.scenes.length; i += 1) {
      const result = validateScene(raw.scenes[i], i)
      if (!result.ok) return result
      scenes.push(result.scene)
    }
  }

  const permissions = raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {}
  const legacyModeMap = raw.legacyModeMap && typeof raw.legacyModeMap === 'object' ? raw.legacyModeMap : {}
  const knowledge = raw.knowledge && typeof raw.knowledge === 'object' ? raw.knowledge : null
  const acceptance = raw.acceptance && typeof raw.acceptance === 'object' ? raw.acceptance : null
  const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : {}
  const bundledCapabilities = raw.bundledCapabilities && typeof raw.bundledCapabilities === 'object'
    ? {
      ...(raw.bundledCapabilities.expert != null
        ? { expert: String(raw.bundledCapabilities.expert || '').trim() }
        : {}),
      ...(raw.bundledCapabilities.catalogRoot != null
        ? { catalogRoot: String(raw.bundledCapabilities.catalogRoot || '').trim() }
        : {}),
    }
    : null

  return ok({
    manifest: {
      schemaVersion: PACK_SCHEMA_VERSION,
      id,
      name: String(raw.name).trim(),
      description: String(raw.description).trim(),
      version,
      expert,
      skills,
      connectors,
      workflows,
      dependencies,
      scenes,
      permissions,
      legacyModeMap,
      knowledge,
      acceptance,
      ui,
      ...(bundledCapabilities ? { bundledCapabilities } : {}),
      requirementSchema: raw.requirementSchema ? String(raw.requirementSchema).trim() : '',
      defaultWorkflow: raw.defaultWorkflow ? String(raw.defaultWorkflow).trim() : '',
    },
  })
}

module.exports = {
  PACK_SCHEMA_VERSION,
  PACK_ID_RE,
  validatePackManifest,
  validateScene,
}
