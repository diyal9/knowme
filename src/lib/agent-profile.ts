'use strict'

const crypto = require('crypto')

const PROFILE_VERSION = 2
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const MAX_LIST = 32

function nowIso() {
  return new Date().toISOString()
}

function text(value, max = 240) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function id(value, label = 'Profile 标识') {
  const parsed = text(value, 80)
  return parsed && ID_RE.test(parsed)
    ? { ok: true, id: parsed }
    : { ok: false, error: `无效的${label}` }
}

function unique(values, max = MAX_LIST) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const item = typeof value === 'string'
      ? { id: value }
      : (value && typeof value === 'object' ? value : null)
    const itemId = text(item?.id || item?.skillId || item?.connectorId, 80)
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({
      id: itemId,
      version: text(item.version || 'latest', 40) || 'latest',
      contentHash: text(item.contentHash || item.hash, 160),
      required: item.required !== false,
    })
    if (out.length >= max) break
  }
  return out
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]))
}

function stablePayload(value) {
  if (Array.isArray(value)) return value.map(stablePayload)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stablePayload(value[key])
    return out
  }, {})
}

function stableHash(value) {
  return `sha256:${crypto.createHash('sha256')
    .update(JSON.stringify(stablePayload(value)))
    .digest('hex')}`
}

function normalizeAgentProfile(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const parsed = id(source.id || `${source.agentId || 'agent'}-profile`, 'Profile 标识')
  if (!parsed.ok) return parsed
  const agentId = id(source.agentId || source.expertId, 'Agent 标识')
  if (!agentId.ok) return agentId
  const profile = {
    profileVersion: PROFILE_VERSION,
    id: parsed.id,
    agentId: agentId.id,
    name: text(source.name || source.role || agentId.id),
    description: text(source.description),
    version: text(source.version || '1.0.0', 40) || '1.0.0',
    roleOverlay: text(source.roleOverlay || source.systemPromptOverlay, 1200),
    promptOverlay: text(source.promptOverlay || source.instructions || source.systemPrompt, 8000),
    skillRefs: unique(source.skillRefs || source.skills),
    knowledgeRefs: unique(source.knowledgeRefs || source.knowledgeSources),
    connectorRefs: unique(source.connectorRefs || source.connectors),
    permissions: clone(source.permissions || {}),
    memoryPolicy: clone(source.memoryPolicy || { scope: 'session' }),
    knowledgePolicy: clone(source.knowledgePolicy || { mode: 'selected', includeWorkMemory: false }),
    modelPolicy: clone(source.modelPolicy || {}),
    outputContract: clone(source.outputContract || {}),
    budget: clone(source.budget || {}),
    risk: clone(source.risk || { level: 'low', reasons: [] }),
    provenance: clone(source.provenance || {}),
    createdAt: text(source.createdAt, 40) || nowIso(),
    updatedAt: text(source.updatedAt, 40) || nowIso(),
  }
  profile.profileHash = stableHash(profile)
  return { ok: true, profile }
}

function validateAgentProfile(raw, options = {}) {
  const normalized = normalizeAgentProfile(raw)
  if (!normalized.ok) return normalized
  const profile = normalized.profile
  const issues = []
  const enabledSkillIds = new Set((options.enabledSkillIds || []).map(value => text(value, 80)))
  const availableConnectorIds = new Set((options.availableConnectorIds || []).map(value => text(value, 80)))
  const availableKnowledgeIds = new Set((options.availableKnowledgeIds || []).map(value => text(value, 80)))
  for (const ref of profile.skillRefs) {
    if (Array.isArray(options.enabledSkillIds) && !enabledSkillIds.has(ref.id)) {
      issues.push({ code: 'skill_unavailable', message: `Skill 未启用: ${ref.id}`, path: 'skillRefs' })
    }
    if (typeof options.resolveSkill === 'function') {
      const resolved = options.resolveSkill(ref.id, ref)
      if (!resolved || resolved.ok === false) {
        issues.push({ code: 'skill_missing', message: `Skill 不存在: ${ref.id}`, path: 'skillRefs' })
      }
    }
  }
  for (const ref of profile.connectorRefs) {
    if (Array.isArray(options.availableConnectorIds) && !availableConnectorIds.has(ref.id)) {
      issues.push({ code: 'connector_unavailable', message: `连接器不可用: ${ref.id}`, path: 'connectorRefs' })
    }
  }
  for (const ref of profile.knowledgeRefs) {
    if (Array.isArray(options.availableKnowledgeIds) && !availableKnowledgeIds.has(ref.id)) {
      issues.push({ code: 'knowledge_unavailable', message: `知识来源不可用: ${ref.id}`, path: 'knowledgeRefs' })
    }
  }
  const riskLevel = String(profile.risk?.level || 'low').toLowerCase()
  if (['high', 'critical'].includes(riskLevel) && options.confirmedRisk !== true) {
    issues.push({ code: 'risk_confirmation_required', message: '高风险 Agent 需要明确风险确认', path: 'risk' })
  }
  if (typeof options.authorize === 'function') {
    const authorized = options.authorize(profile)
    if (!authorized || authorized.ok === false) {
      issues.push({ code: 'profile_unauthorized', message: authorized?.error || 'Agent Profile 未获授权', path: 'permissions' })
    }
  }
  return { ok: issues.length === 0, profile, issues }
}

function createProfileSnapshot(profile) {
  const normalized = normalizeAgentProfile(profile)
  if (!normalized.ok) return normalized
  const value = normalized.profile
  return {
    ok: true,
    snapshot: {
      profileId: value.id,
      profileVersion: value.version,
      profileHash: value.profileHash,
      agentId: value.agentId,
      roleOverlay: value.roleOverlay,
      promptOverlay: value.promptOverlay,
      skillRefs: clone(value.skillRefs),
      knowledgeRefs: clone(value.knowledgeRefs),
      knowledgePolicy: clone(value.knowledgePolicy),
      connectorRefs: clone(value.connectorRefs),
      permissions: clone(value.permissions),
      memoryPolicy: clone(value.memoryPolicy),
      modelPolicy: clone(value.modelPolicy),
      outputContract: clone(value.outputContract),
      budget: clone(value.budget),
      risk: clone(value.risk),
    },
  }
}

module.exports = {
  PROFILE_VERSION,
  normalizeAgentProfile,
  validateAgentProfile,
  createProfileSnapshot,
}
