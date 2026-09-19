'use strict'

/** Persist the root run identity before any deferred tool revalidates scope. */
function persistSessionRunIdentity(session, runId, deps = {}) {
  const id = String(runId || '').trim().slice(0, 160)
  if (!session || typeof session !== 'object' || !String(session.id || '').trim() || !id) {
    return { ok: false, code: 'run_identity_required', error: '会话或运行 ID 无效' }
  }
  if (typeof deps.loadAgentSessions !== 'function' || typeof deps.saveAgentSessions !== 'function') {
    return { ok: false, code: 'run_identity_store_unavailable', error: '会话存储不可用' }
  }

  const previousRun = session.run
  const previousUpdatedAt = session.updatedAt
  const updatedAt = new Date().toISOString()
  session.run = { ...(session.run && typeof session.run === 'object' ? session.run : {}), id }
  session.updatedAt = updatedAt
  try {
    const stored = deps.loadAgentSessions()
    const sessions = Array.isArray(stored) ? stored : []
    let found = false
    const next = sessions.map(item => {
      if (item?.id !== session.id) return item
      found = true
      return {
        ...item,
        run: { ...(item.run && typeof item.run === 'object' ? item.run : {}), id },
        updatedAt,
      }
    })
    if (!found) next.push({ ...session })
    deps.saveAgentSessions(next)
    return { ok: true, runId: id, persisted: true }
  } catch (error) {
    session.run = previousRun
    session.updatedAt = previousUpdatedAt
    return {
      ok: false,
      code: 'run_identity_persist_failed',
      error: `无法保存本轮运行身份：${error?.message || '未知错误'}`,
    }
  }
}

module.exports = { persistSessionRunIdentity }
