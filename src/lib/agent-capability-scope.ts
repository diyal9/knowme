'use strict'

const { loadTaskCapabilityGrants } = require('./agent-task-capability-grants')
const { knowledgeCapabilityContains, intersectKnowledgeCapabilityIds } = require('./agent-knowledge-capability-ids')

const KINDS = ['skills', 'connectors', 'knowledge']
const KEYS = { skills: 'allowedSkillIds', connectors: 'allowedConnectorIds', knowledge: 'allowedKnowledgeIds' }

function scopeIds(value) {
  return Array.isArray(value) ? [...new Set(value.map(String).map(id => id.trim()).filter(Boolean))] : null
}

function intersectScopeIds(lists) {
  const declared = lists.filter(Array.isArray)
  return declared.length ? declared.reduce((a, b) => a.filter(id => b.includes(id))) : null
}

/** Bindings are soft defaults; every hard layer still intersects task grants. */
function resolveAgentCapabilityScope(options = {}) {
  const session = options.session || {}
  let snapshot = options.expertSnapshot || null
  if (!snapshot && session.expertId && options.expertRuntime?.getSessionPersona) {
    try { snapshot = options.expertRuntime.getSessionPersona(session.id, session.expertId) } catch { /* fail closed below */ }
  }
  const failedExpert = Boolean(session.expertId && !snapshot?.ok)
  const bindings = snapshot?.bindings || {}
  const refs = Array.isArray(session.knowledgeRefs) ? session.knowledgeRefs.map(ref => ref?.id || ref) : []
  const defaults = {
    skills: failedExpert ? [] : (scopeIds(bindings.skills) ?? (session.expertId ? [] : null)),
    connectors: failedExpert ? [] : (scopeIds(bindings.connectors) ?? (session.expertId ? [] : null)),
    knowledge: failedExpert ? [] : (scopeIds(bindings.knowledge) ?? (refs.length ? scopeIds(refs) : null)),
  }
  const layers = [session.run?.permissions, snapshot?.capabilityManifest?.permissions,
    options.permissions, session.capabilityPolicy, options.orgPolicy, options.parentScope].filter(Boolean)
  const noTools = session.executionPolicy === 'no-tools' || options.executionPolicy === 'no-tools'
  const hard = {}
  const denies = {}
  for (const kind of KINDS) {
    hard[kind] = (kind === 'knowledge' ? intersectKnowledgeCapabilityIds : intersectScopeIds)(layers.flatMap(layer => [
      scopeIds(layer[KEYS[kind]]), scopeIds(layer[kind]?.[KEYS[kind]]),
      scopeIds(layer.capabilities?.[kind]?.allowlist), scopeIds(layer[kind]?.allowlist),
    ]))
    denies[kind] = new Set(layers.flatMap(layer => [
      ...(scopeIds(layer.capabilities?.[kind]?.denylist) || []), ...(scopeIds(layer[kind]?.denylist) || []),
    ]))
  }
  const grants = loadTaskCapabilityGrants(options.userData, session)
    .filter(grant => grant.approvedBy === 'user' && !grant.revokedAt
      && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.now()))
  const decision = (kind, rawId) => {
    const id = String(rawId || '').trim()
    if (!KINDS.includes(kind) || !id) return { allowed: false, requestable: false, reason: 'invalid_capability' }
    if (noTools || failedExpert) return { allowed: false, requestable: false, reason: noTools ? 'no-tools' : 'expert_unavailable' }
    const contains = (a, b) => kind === 'knowledge' ? knowledgeCapabilityContains(a, b) : a === b
    if ([...denies[kind]].some(denied => contains(denied, id))
      || (hard[kind] !== null && !hard[kind].some(allowed => contains(allowed, id)))) {
      return { allowed: false, requestable: false, reason: 'hard_scope_denied' }
    }
    if (defaults[kind] === null || defaults[kind].some(bound => contains(bound, id))) return { allowed: true, requestable: false, reason: 'default_binding' }
    if (grants.some(grant => grant.capabilityKind === kind && contains(grant.capabilityId, id))) {
      return { allowed: true, requestable: false, reason: 'task_grant' }
    }
    return { allowed: false, requestable: Boolean(session.id), reason: 'unbound' }
  }
  const result = { decision, defaults, grants, noTools, deniedKnowledgeIds: [...denies.knowledge],
    deniedSkillIds: [...denies.skills], deniedConnectorIds: [...denies.connectors] }
  for (const kind of KINDS) {
    let candidates = defaults[kind] === null ? hard[kind] : [...new Set([
      ...defaults[kind], ...grants.filter(grant => grant.capabilityKind === kind).map(grant => grant.capabilityId),
    ])]
    if (kind === 'knowledge') candidates = intersectKnowledgeCapabilityIds([candidates, hard[kind]])
    result[KEYS[kind]] = noTools || failedExpert ? [] : candidates?.filter(id => decision(kind, id).allowed) ?? null
  }
  return result
}

module.exports = { resolveAgentCapabilityScope, scopeIds, intersectScopeIds }
