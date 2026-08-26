'use strict'

function requiredSecretKeys(connector) {
  return (connector?.secretSlots || []).filter((slot) => slot.required !== false).map((slot) => slot.key)
}

function configurationState(connector, configuredKeys = []) {
  if (!connector) return { ready: false, state: 'missing', message: '连接器未安装' }
  if (connector.enabled !== true) return { ready: false, state: 'disabled', message: '连接器未启用' }
  const mcp = connector.mcp || {}
  const transport = mcp.transport || (mcp.url ? 'streamable-http' : 'stdio')
  if (transport === 'stdio' && !String(mcp.command || '').trim()) {
    return { ready: false, state: 'needs_configuration', message: '请配置 MCP 启动命令' }
  }
  if (transport !== 'stdio' && !String(mcp.url || '').trim()) {
    return { ready: false, state: 'needs_configuration', message: '请配置 MCP 服务 URL' }
  }
  const present = new Set(configuredKeys || [])
  const missingSecrets = requiredSecretKeys(connector).filter((key) => !present.has(key))
  if (missingSecrets.length) {
    return { ready: false, state: 'needs_configuration', message: `请补齐密钥：${missingSecrets.join('、')}`, missingSecrets }
  }
  return { ready: true, state: 'configured', message: '连接器已配置' }
}

function buildRuntimeOptions(connector, secretValues = {}) {
  const env = {}
  const headers = {}
  let accessToken = ''
  for (const slot of connector?.secretSlots || []) {
    const value = secretValues[slot.key]
    if (!value) continue
    if (slot.target === 'bearer') accessToken = String(value)
    else if (slot.target === 'header') headers[slot.name || slot.key] = `${slot.prefix || ''}${value}`
    else env[slot.name || slot.key] = `${slot.prefix || ''}${value}`
  }
  return { env, headers, accessToken }
}

function globMatches(pattern, name) {
  const escaped = String(pattern || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`).test(String(name || ''))
}

function resolveToolPolicy(connector, rawToolName) {
  const policies = connector?.toolPolicies || []
  const selected = policies.find((policy) => globMatches(policy.match, rawToolName))
  return selected || {
    match: '*',
    risk: 'network',
    sideEffects: true,
    requiresApproval: true,
    timeoutMs: 30000,
    description: '未声明工具采用保守外部写入策略',
  }
}

function toolContractFor(connector, rawToolName) {
  const policy = resolveToolPolicy(connector, rawToolName)
  return {
    source: 'mcp',
    capability: `connector:${connector?.id || 'mcp'}`,
    risk: policy.risk,
    sideEffects: policy.sideEffects !== false,
    requiresApproval: policy.requiresApproval === true,
    scope: 'external',
    timeoutMs: policy.timeoutMs || 30000,
    idempotencySupported: policy.sideEffects === false,
    rollbackSupported: false,
    connectorId: String(connector?.id || ''),
    rawToolName: String(rawToolName || ''),
    policyMatch: policy.match,
  }
}

module.exports = {
  requiredSecretKeys,
  configurationState,
  buildRuntimeOptions,
  globMatches,
  resolveToolPolicy,
  toolContractFor,
}
