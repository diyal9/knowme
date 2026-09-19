'use strict'

function persistSessionProjectBinding(session, projectId, deps = {}) {
  const normalizedProjectId = String(projectId || '').trim().slice(0, 100)
  if (!session || typeof session !== 'object' || !normalizedProjectId) {
    return { ok: false, code: 'project_required', error: '项目文件操作需要先选择项目' }
  }
  if (session.projectId) return { ok: true, projectId: session.projectId, persisted: false }

  const updatedAt = new Date().toISOString()
  session.projectId = normalizedProjectId
  session.updatedAt = updatedAt
  try {
    if (typeof deps.loadAgentSessions !== 'function' || typeof deps.saveAgentSessions !== 'function') {
      throw new Error('会话存储不可用')
    }
    const stored = deps.loadAgentSessions()
    const sessions = Array.isArray(stored) ? stored : []
    let found = false
    const next = sessions.map(item => {
      if (item?.id !== session.id) return item
      found = true
      return { ...item, projectId: normalizedProjectId, updatedAt }
    })
    if (!found) next.push({ ...session })
    deps.saveAgentSessions(next)
    return { ok: true, projectId: normalizedProjectId, persisted: true }
  } catch (error) {
    session.projectId = null
    return {
      ok: false,
      code: 'project_binding_failed',
      error: `无法保存会话的项目归属：${error?.message || '未知错误'}`,
    }
  }
}

function guardFileAdapterForProjectBinding(adapter, bindProject) {
  if (!adapter || typeof adapter !== 'object' || typeof bindProject !== 'function') return adapter
  const guarded = { ...adapter }
  const ensureBound = () => bindProject()
  const originalValidatePath = typeof adapter.validatePath === 'function'
    ? adapter.validatePath.bind(adapter)
    : null
  guarded.validatePath = (rel) => {
    const binding = ensureBound()
    if (!binding?.ok) return { ok: false, error: binding?.error || '无法绑定项目' }
    return originalValidatePath ? originalValidatePath(rel) : { ok: true }
  }
  for (const name of ['readFile', 'listDir', 'grep']) {
    if (typeof adapter[name] !== 'function') continue
    const operation = adapter[name].bind(adapter)
    guarded[name] = async (...args) => {
      const binding = ensureBound()
      if (!binding?.ok) {
        return { ok: false, code: binding?.code || 'project_binding_failed', error: binding?.error || '无法绑定项目' }
      }
      return operation(...args)
    }
  }
  return guarded
}

function guardToolBundleForProjectBinding(bundle, bindProject, names = null) {
  if (!bundle?.handlers || typeof bindProject !== 'function') return bundle
  const selected = names ? new Set(names) : null
  const handlers = { ...bundle.handlers }
  for (const [name, handler] of Object.entries(handlers)) {
    if (typeof handler !== 'function' || (selected && !selected.has(name))) continue
    handlers[name] = async (...args) => {
      const binding = bindProject()
      if (!binding?.ok) {
        return { ok: false, code: binding?.code || 'project_binding_failed', text: binding?.error || '无法绑定项目' }
      }
      return handler(...args)
    }
  }
  return { ...bundle, handlers }
}

module.exports = {
  persistSessionProjectBinding,
  guardFileAdapterForProjectBinding,
  guardToolBundleForProjectBinding,
}
