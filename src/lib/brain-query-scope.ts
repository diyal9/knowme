/** Restrict the whole query subgraph, including explanation paths, before ranking. */
'use strict'

function scopeBrainQueryData(data, policy, request = {}) {
  const scopes = Array.isArray(policy.brainScopes) ? policy.brainScopes : []
  const projectAllowed = item => request.projectId === undefined
    || (!item.projectId && item.scope !== 'project')
    || Boolean(request.projectId && item.projectId === request.projectId)
  const nodes = data.nodes.filter(node => scopes.includes(node.scope || 'global') && projectAllowed(node)
    && (policy.allowPersonalMemory || (!['self', 'preference', 'person', 'goal'].includes(node.kind) && !(node.tags || []).includes('memory'))))
  const ids = new Set(nodes.map(node => node.id))
  const evidence = data.evidence.filter(projectAllowed)
  const evidenceIds = new Set(evidence.map(item => item.id))
  const claims = data.claims.filter(claim => projectAllowed(claim)
    && ids.has(claim.subjectId) && (!claim.objectNodeId || ids.has(claim.objectNodeId)))
    .map(claim => ({ ...claim, evidenceRefs: (claim.evidenceRefs || []).filter(id => evidenceIds.has(id)) }))
    .filter(claim => claim.evidenceRefs.length > 0)
  return { ...data, nodes, evidence, claims }
}

module.exports = { scopeBrainQueryData }
