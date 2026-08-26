'use strict'

function connectorRequirements(subject = {}, context = {}) {
  const declared = [
    ...(Array.isArray(subject.connectorDependencies) ? subject.connectorDependencies : []),
    ...(Array.isArray(subject.dependencies) ? subject.dependencies.filter((dep) => dep?.kind === 'connector') : []),
    ...(Array.isArray(subject.manifest?.dependencies) ? subject.manifest.dependencies.filter((dep) => dep?.kind === 'connector') : []),
  ]
  const byId = new Map()
  for (const raw of declared) {
    const id = String(raw?.id || raw).trim()
    if (!id) continue
    const requiredWhen = String(raw?.requiredWhen || '').trim()
    const conditionMatches = !requiredWhen || context[requiredWhen] === true || context.layoutMode === requiredWhen
    const required = raw?.required !== false && conditionMatches
    const previous = byId.get(id)
    byId.set(id, {
      id,
      required: Boolean(previous?.required || required),
      reason: String(raw?.reason || previous?.reason || '').trim(),
      tools: [...new Set([...(previous?.tools || []), ...(Array.isArray(raw?.tools) ? raw.tools : [])])],
      route: String(raw?.route || previous?.route || 'capability-hub').trim(),
    })
  }
  return [...byId.values()]
}

async function assessConnectorRequirements(subject, context = {}, options = {}) {
  const requirements = connectorRequirements(subject, context)
  const results = []
  for (const requirement of requirements) {
    let status
    try {
      const response = await options.getConnectorStatus?.(requirement.id)
      if (!response?.ok || !response.connector) {
        status = { state: 'missing', ok: false, message: response?.message || response?.error || '连接器未安装' }
      } else {
        status = response.connector.status || {
          state: response.connector.enabled === false ? 'disabled' : 'configured',
          ok: response.connector.enabled !== false,
        }
      }
    } catch (error) {
      status = { state: 'offline', ok: false, message: error?.message || String(error) }
    }
    const ready = status.ok === true && ['online', 'ready', 'configured'].includes(String(status.state || 'configured'))
    results.push({
      ...requirement,
      ready,
      state: ready ? 'ready' : String(status.state || 'offline'),
      message: ready ? '连接器可用' : String(status.message || '连接器不可用'),
      remediation: ready ? '' : String(status.remediation || `请在能力中心配置并测试「${requirement.id}」`),
    })
  }
  const blockers = results.filter((item) => item.required && !item.ready)
  const warnings = results.filter((item) => !item.required && !item.ready)
  return {
    ok: blockers.length === 0,
    requirements: results,
    blockers,
    warnings,
    code: blockers.length ? 'connector_dependency_blocked' : 'ok',
    error: blockers.length ? blockers.map((item) => `${item.id}: ${item.message}`).join('；') : '',
  }
}

module.exports = { connectorRequirements, assessConnectorRequirements }
