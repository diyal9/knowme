/** Resolve knowledge selections against host policy without mutating provider objects. */
'use strict'

const { parseKnowledgeCollectionRef } = require('../../shared/knowledge-selection')

function selectionRef(value) {
  const id = String(value || '').trim()
  return parseKnowledgeCollectionRef(id) || { providerId: id, collectionId: null }
}

/** null means unrestricted; [] is an explicit empty scope, never a default fallback. */
function resolveKnowledgeProviderScope(session, deps = {}) {
  const resolve = typeof deps.resolveProviderById === 'function' ? deps.resolveProviderById : () => null
  const active = typeof deps.getActiveProvider === 'function' ? deps.getActiveProvider : () => null
  const allowed = Array.isArray(deps.allowedKnowledgeIds) ? deps.allowedKnowledgeIds.map(selectionRef) : null
  const denied = Array.isArray(deps.deniedKnowledgeIds) ? deps.deniedKnowledgeIds.map(selectionRef) : []
  const explicit = Array.isArray(session?.knowledgeRefs) && session.knowledgeRefs.length > 0
  const fallback = !explicit && allowed === null ? active() : null
  const ids = explicit ? session.knowledgeRefs.map(ref => String(ref.id || ''))
    : allowed !== null ? deps.allowedKnowledgeIds : fallback ? [fallback.id] : []
  const groups = new Map()
  const missingIds = []

  for (const id of [...new Set(ids)]) {
    const ref = selectionRef(id)
    const provider = fallback?.id === ref.providerId ? fallback : resolve(ref.providerId)
    const policy = allowed?.filter(item => item.providerId === ref.providerId)
    const denials = denied.filter(item => item.providerId === ref.providerId)
    const grantAll = allowed === null || policy.some(item => !item.collectionId)
    if (!provider || provider.enabled === false || denials.some(item => !item.collectionId) || (!grantAll && !policy.length)) {
      missingIds.push(id)
      continue
    }
    const configured = Array.isArray(provider.collectionIds) ? [...new Set(provider.collectionIds.map(String))] : []
    const permitted = configured.filter(value => (grantAll || policy.some(item => item.collectionId === value))
      && !denials.some(item => item.collectionId === value))
    if ((ref.collectionId && !permitted.includes(ref.collectionId)) || ((!grantAll || denials.length) && permitted.length === 0)) {
      missingIds.push(id)
      continue
    }
    const current = groups.get(provider.id) || { provider, all: false, collections: new Set() }
    if (!ref.collectionId && grantAll && !denials.length) current.all = true
    for (const value of ref.collectionId ? [ref.collectionId] : permitted) current.collections.add(value)
    groups.set(provider.id, current)
  }

  const providers = [...groups.values()].map(({ provider, all, collections }) => {
    // Always clone collections: subsequent unions must not expand the configured provider grant.
    if (all) return { ...provider, ...(Array.isArray(provider.collectionIds) ? { collectionIds: [...provider.collectionIds] } : {}) }
    const collectionIds = [...collections]
    return { ...provider, collectionIds, collection: collectionIds[0] || '' }
  })
  const mode = explicit || allowed !== null ? 'selected' : 'default'
  return {
    mode,
    providers,
    degraded: providers.length === 0,
    message: providers.length === 0
      ? mode === 'default' ? '默认知识库不可用' : '所选知识库均不可用或未获授权，本轮不会检索其他知识库。'
      : missingIds.length ? '部分所选知识库不可用或未获授权，检索将仅使用仍可用的来源。' : '',
    ...(mode === 'selected' ? { missingIds } : {}),
  }
}

module.exports = { resolveKnowledgeProviderScope }
