'use strict'

const MAX_ACTIVE_SKILLS = 16
const MAX_RESOURCE_PAGES = 8
const MAX_RESOURCE_CHARS = 131072
const REACTIVATION_TOOLS = new Set(['discover_tools', 'discover_capabilities', 'request_capability_access', 'list_skills', 'load_skill'])

// Checkpoints are requirements to re-load, never authorization or executable content.
function readSkillActivationRefs(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > MAX_ACTIVE_SKILLS) {
    throw Object.assign(new Error('技能激活 checkpoint 无效或超过上限，必须重新激活。'), { code: 'skill_reactivation_required' })
  }
  return raw.map(ref => {
    if (typeof ref?.skillId !== 'string' || !ref.skillId.trim() || ref.skillId.length > 256
      || typeof ref?.contentHash !== 'string' || ref.contentHash.length > 256) {
      throw Object.assign(new Error('技能激活 checkpoint 缺少 ID/hash，必须重新激活。'), { code: 'skill_reactivation_required' })
    }
    return { skillId: ref.skillId, contentHash: ref.contentHash }
  })
}

function skillActivationRef(activation) {
  return { skillId: String(activation.skillId), contentHash: String(activation.contentHash || '') }
}

async function revalidateSkillActivations(activations, { validate, execute, signal }) {
  for (const activation of activations) {
    const args = JSON.stringify({ skill_id: activation.skillId })
    if (!validate('load_skill', args)?.ok) return { ok: false, skillId: activation.skillId, code: 'skill_activation_revoked' }
    let result
    try { result = await execute({ name: 'load_skill', arguments: args, signal }) } catch {
      return { ok: false, skillId: activation.skillId, code: 'skill_activation_revoked' }
    }
    const fresh = result?.activation
    if (result?.ok !== true || result.truncated === true || fresh?.status !== 'active'
      || fresh.complete !== true || fresh.skillId !== activation.skillId) {
      return { ok: false, skillId: activation.skillId, code: 'skill_activation_revoked' }
    }
    if (!activation.contentHash || fresh.contentHash !== activation.contentHash) {
      return { ok: false, skillId: activation.skillId, code: 'skill_activation_changed' }
    }
  }
  return { ok: true }
}

module.exports = { MAX_ACTIVE_SKILLS, MAX_RESOURCE_PAGES, MAX_RESOURCE_CHARS, REACTIVATION_TOOLS,
  readSkillActivationRefs, skillActivationRef, revalidateSkillActivations }
