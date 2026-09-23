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

/** Cooperative counterpart for interactive retrieval on large local graphs. */
async function scopeBrainQueryDataAsync(data, policy, request = {}, options = {}) {
  const scopes = Array.isArray(policy.brainScopes) ? policy.brainScopes : []
  const projectAllowed = item => request.projectId === undefined
    || (!item.projectId && item.scope !== 'project')
    || Boolean(request.projectId && item.projectId === request.projectId)
  const signal = request.signal
  const every = Math.max(32, Number(options.yieldEvery) || 128)
  const yieldToEventLoop = () => new Promise(resolve => {
    if (typeof setImmediate === 'function') setImmediate(resolve)
    else setTimeout(resolve, 0)
  })
  const check = () => {
    if (signal?.aborted) {
      const error = new Error('知识检索已取消')
      error.code = 'aborted'
      throw error
    }
  }
  const collect = async (list, predicate, map) => {
    const result = []
    for (let index = 0; index < list.length; index += 1) {
      check()
      const item = list[index]
      if (predicate(item)) result.push(map ? map(item) : item)
      if ((index + 1) % every === 0) await yieldToEventLoop()
    }
    return result
  }
  const nodes = await collect(data.nodes, node => scopes.includes(node.scope || 'global') && projectAllowed(node)
    && (policy.allowPersonalMemory || (!['self', 'preference', 'person', 'goal'].includes(node.kind) && !(node.tags || []).includes('memory'))))
  const ids = new Set(nodes.map(node => node.id))
  const evidence = await collect(data.evidence, projectAllowed)
  const evidenceIds = new Set(evidence.map(item => item.id))
  const claims = await collect(data.claims,
    claim => projectAllowed(claim) && ids.has(claim.subjectId) && (!claim.objectNodeId || ids.has(claim.objectNodeId)),
    claim => ({ ...claim, evidenceRefs: (claim.evidenceRefs || []).filter(id => evidenceIds.has(id)) }))
  return {
    ...data,
    nodes,
    evidence,
    claims: claims.filter(claim => claim.evidenceRefs.length > 0),
  }
}

module.exports = { scopeBrainQueryData, scopeBrainQueryDataAsync }
