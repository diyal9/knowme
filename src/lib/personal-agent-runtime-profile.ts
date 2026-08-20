'use strict'

/**
 * Personal-topic sessions read their effective profile from Agent Profile storage.
 * API credentials and model settings still come from settings-secure.
 */
function resolvePersonalAgentSettings(settings = {}, session = {}, getAgentProfileStore) {
  const base = settings && typeof settings === 'object' ? settings : {}
  // Older personal-topic sessions may not have been stamped with profileId yet.
  // They still belong to the singleton KnowMe partner and must receive its
  // current Soul/configuration instead of silently falling back to legacy settings.
  const isPersonalSession = session?.agentId === 'personal' || session?.sessionKind === 'personal-topic'
  const profileId = String(session?.profileId || (isPersonalSession ? 'my-knowme' : '')).trim()
  if (!profileId || typeof getAgentProfileStore !== 'function') return base
  try {
    const result = getAgentProfileStore().get(profileId)
    if (!result?.ok || !result.profile) return base
    const profile = result.profile
    const preferences = profile.taskPreferences || {}
    return {
      ...base,
      // User identity remains owned by Settings. Legacy profile fields are only
      // used as an occupation fallback until the migrated settings are saved.
      industry: String(base.industry || preferences.industry || 'general').trim(),
      occupationId: String(base.occupationId || preferences.occupationId || '').trim(),
      agentDisplayName: String(profile.identity?.displayName || profile.name || '').trim(),
      agentSoul: String(profile.roleOverlay || '').trim(),
      agentCollaboration: String(profile.promptOverlay || '').trim(),
      agentDomainCapabilities: String(preferences.domainCapabilities || '').trim(),
      agentSelfDriveLevel: String(preferences.selfDriveLevel || 'balanced').trim(),
      agentSelfDriveRules: String(preferences.selfDriveRules || '').trim(),
    }
  } catch {
    return base
  }
}

module.exports = { resolvePersonalAgentSettings }

export { resolvePersonalAgentSettings }
