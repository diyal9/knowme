/** Fail closed on scope changes during an in-flight run; no credentials enter the fingerprint. */
'use strict'

function knowledgeScopeFingerprint(scope = {}, policy = {}) {
  const strings = values => [...new Set(Array.isArray(values) ? values.map(String) : [])].sort()
  return JSON.stringify({
    degraded: scope.degraded === true,
    projectId: scope.projectId,
    providers: (scope.providers || []).map(p => ({ id: p.id, kind: p.kind, enabled: p.enabled !== false,
      configuration: require('./knowledge-provider-fingerprint').knowledgeProviderFingerprint(p),
      version: p.version || p.updatedAt || '', collectionIds: strings(p.collectionIds), collection: p.collection || p.collectionId || '' }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    brainScopes: strings(policy.brainScopes),
    allowPersonalMemory: policy.allowPersonalMemory === true,
    allowRemoteQuery: policy.allowRemoteQuery === true,
    policies: (policy.providers || []).map(p => ({ id: p.providerId, collectionIds: strings(p.collectionIds) }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  })
}

/** Recheck before IO and before exposing results, including a grant revoked during the request. */
function guardKnowledgeTools(tools, { retrievalScope, knowledgePolicy, getCurrentScope, projectId } = {}) {
  if (typeof getCurrentScope !== 'function') return tools
  const initial = knowledgeScopeFingerprint({ ...retrievalScope, projectId }, knowledgePolicy)
  const current = () => {
    try {
      const latest = getCurrentScope()
      return latest && knowledgeScopeFingerprint({ ...latest.retrievalScope, projectId: latest.projectId }, latest.knowledgePolicy) === initial
    } catch { return false }
  }
  const denied = () => ({ ok: false, code: 'knowledge_scope_changed', hits: [],
    error: '知识范围或授权已变化，请按当前范围重新准备任务。', degraded: true })
  return Object.fromEntries(Object.entries(tools).map(([name, handler]) => [name, async (...args) => {
    if (!current()) return denied()
    const result = await handler(...args)
    return current() ? result : denied()
  }]))
}

module.exports = { knowledgeScopeFingerprint, guardKnowledgeTools }
