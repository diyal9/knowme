'use strict'

/** Topic similarity is relevance, not proof that a memory belongs to this task. */
function selectScopedWorkMemories(items, policy = {}, session = {}) {
  const selected = []
  const omitted = []
  const seen = new Set()
  for (const item of items || []) {
    if (item.type !== 'work_memory') continue
    const projectId = item.projectId || item.source?.projectId
    const sessionId = item.sessionId || item.source?.sessionId
    const inTask = sessionId && sessionId === session.id && policy.brainScopes?.length > 0
    const inProject = projectId && projectId === session.projectId && policy.brainScopes?.includes('project')
    const allowed = policy.allowPersonalMemory === true || inTask || inProject
    const key = String(item.text || '').replace(/\s+/g, ' ').trim()
    const reason = !allowed ? 'scope_unproven' : seen.has(key) ? 'duplicate' : !key ? 'empty' : null
    if (reason) { omitted.push({ id: item.id, reason }); continue }
    seen.add(key)
    selected.push(item)
  }
  return { items: selected, omitted }
}

module.exports = { selectScopedWorkMemories }
