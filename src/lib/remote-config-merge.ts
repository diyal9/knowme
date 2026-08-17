'use strict'

function mergeOrgPublicConfig(settings, publicConfig) {
  const base = settings && typeof settings === 'object' ? { ...settings } : {}
  const cfg = publicConfig && typeof publicConfig === 'object' ? publicConfig : {}
  const profile = cfg.model_profile && typeof cfg.model_profile === 'object' ? cfg.model_profile : null
  if (profile) {
    if (profile.provider) base.llmProvider = String(profile.provider)
    if (profile.endpoint) base.apiEndpoint = String(profile.endpoint)
    if (profile.model) base.model = String(profile.model)
  }
  const policy = cfg.connector_policy && typeof cfg.connector_policy === 'object'
    ? cfg.connector_policy
    : null
  if (policy && policy.feishu_allowlist != null) {
    base.orgFeishuAllowlist = String(policy.feishu_allowlist)
  }
  if (cfg.feature_flags && typeof cfg.feature_flags === 'object') {
    base.orgFeatureFlags = { ...cfg.feature_flags }
  }
  return base
}

function isOrgManaged(remoteConfig) {
  return !!(remoteConfig && remoteConfig.enabled === true && remoteConfig.lastOk === true)
}

function normalizeRemoteConfig(raw) {
  const rc = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: rc.enabled === true,
    endpoint: String(rc.endpoint || 'http://127.0.0.1:8020'),
    lastOk: rc.lastOk === true,
    lastError: rc.lastError ? String(rc.lastError) : '',
    updatedAt: rc.updatedAt ? String(rc.updatedAt) : '',
    fetchedAt: rc.fetchedAt ? String(rc.fetchedAt) : '',
  }
}

module.exports = {
  mergeOrgPublicConfig,
  isOrgManaged,
  normalizeRemoteConfig,
}
