'use strict'

const gameStudio = require('./game-studio-scenes')
const { getPromptBlock, getPromptStrings } = require('./context-engine/prompts/registry')

// Capability packs are process state owned by main/boot. Keeping this null
// until boot injects the userData-backed runtime prevents imports, previews,
// and tests from accidentally reading a pack-store relative to process.cwd().
let packRuntime = null

function setPackRuntime(next) {
  packRuntime = next || null
  gameStudio.setPackRuntime(packRuntime)
}

const setPackRuntimeForTests = setPackRuntime

const MODE_IDS = ['general', 'steward', 'writing', 'coding']
const SCENE_IDS = ['assistant', 'work', 'knowledge', 'writing', 'coding']

const MODE_LABELS = {
  general: '通用办公',
  steward: '知识管家',
  writing: '写作专家',
  coding: '研发助手',
}

const SCENE_LABELS = {
  assistant: '日常助手',
  work: '工作伙伴',
  knowledge: '知识管家',
  writing: '写作专家',
  coding: '研发助手',
}

/** 兼容导出；正文由 locale prompt registry 提供。 */
const SCENE_FOUNDATION = Object.freeze(Object.fromEntries(
  SCENE_IDS.map(id => [id, getPromptBlock(`scene.${id}`, 'zh-CN').content]),
))

function normalizeMode(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return MODE_IDS.includes(value) ? value : 'general'
}

function normalizeTier(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return ['chat', 'assist', 'retrieval'].includes(value) ? value : 'chat'
}

function resolveScene({
  mode = 'general',
  tier = 'chat',
  role = '',
  hasNoteContext = false,
  hasTask = false,
  industry = '',
  prompt = '',
  explicitScene = '',
} = {}) {
  // Installed packs are available capabilities, not ambient conversation
  // identities. A pack scene may only be selected explicitly or through a
  // scoped domain adapter below; never keyword-route across every enabled
  // pack in the process.
  if (String(explicitScene || '').trim()) {
    const packResolved = packRuntime?.resolveScene({ explicitScene })
    if (packResolved) return packResolved.sceneId
  }

  const gameScene = gameStudio.resolveGameScene({
    industry,
    mode,
    prompt,
    tier,
    hasTask: hasTask || hasNoteContext,
    explicitScene,
  })
  if (gameScene) return gameScene

  const modeId = normalizeMode(mode)
  const tierId = normalizeTier(tier)
  const roleId = String(role || '').trim().toLowerCase()

  if (modeId === 'steward' || roleId === 'steward' || tierId === 'retrieval') {
    return 'knowledge'
  }
  if (modeId === 'coding' || roleId === 'coding') return 'coding'
  if (modeId === 'writing' || roleId === 'writing') return 'writing'
  if (tierId === 'assist' || hasNoteContext || hasTask) return 'work'
  return 'assistant'
}

function sceneLabel(scene) {
  if (gameStudio.getSceneIds().includes(scene)) return gameStudio.sceneLabel(scene)
  for (const pack of packRuntime?.listEnabledPacks?.() || []) {
    const record = packRuntime.loadPackRecord(pack.id)
    const hit = record?.scenes.find(s => s.id === scene)
    if (hit) return hit.label
  }
  return SCENE_LABELS[SCENE_IDS.includes(scene) ? scene : 'assistant']
}

function buildScenePrompt({
  scene = 'assistant',
  mode = 'general',
  locale = 'zh-CN',
  hasHistory = false,
} = {}) {
  if (gameStudio.getSceneIds().includes(scene)) {
    return gameStudio.buildScenePrompt(scene)
  }
  const resolved = packRuntime?.resolveScene({ explicitScene: scene })
  if (resolved) return packRuntime.buildScenePrompt(resolved)
  const sceneId = SCENE_IDS.includes(scene) ? scene : 'assistant'
  const modeId = normalizeMode(mode)
  const strings = getPromptStrings(locale)
  const sceneBlock = getPromptBlock(`scene.${sceneId}`, locale)
  const lines = [
    sceneBlock?.content || getPromptBlock('scene.assistant', 'zh-CN').content,
  ]
  if (sceneId === 'assistant' && hasHistory) {
    lines.push(strings.historyContinuity)
  }
  if (modeId !== 'general' && modeId !== 'steward' && modeId !== sceneId) {
    lines.push(`${strings.modePrefix}：${strings.modeLabels?.[modeId] || MODE_LABELS[modeId]}`)
  }
  return lines.join('\n')
}

function buildUserPrompt(settings = {}, mode = 'general', options = {}) {
  const includeUserPrompt = options.includeUserPrompt !== false
  const includeAgentPersona = options.includeAgentPersona !== false
  const includeWorkProfile = options.includeWorkProfile !== false
  const agentPersonaScope = ['none', 'style', 'full'].includes(options.agentPersonaScope)
    ? options.agentPersonaScope
    : (includeAgentPersona ? 'full' : 'none')
  const includeAgentStyle = agentPersonaScope === 'style' || agentPersonaScope === 'full'
  const includeAgentOperatingContext = agentPersonaScope === 'full'
  // A personal display name is UI/profile metadata. Inject it only when the
  // user actually asks about identity; otherwise it is easy for the model to
  // copy the name into every answer.
  const includeIdentityName = options.includeIdentityName === true
  const modeId = normalizeMode(mode)
  const strings = getPromptStrings(options.locale || settings.locale || 'zh-CN')
  const sections = strings.sections || {}
  const config = settings.assistantModeConfig && typeof settings.assistantModeConfig === 'object'
    ? settings.assistantModeConfig
    : {}
  const customModePrompt = String(config[modeId] || '').trim() || String(config.general || '').trim()
  let industryBlock = ''
  let occupationBlock = ''
  try {
    const industryProfile = require('./industry-profile')
    if (includeWorkProfile && settings.industry) {
      industryBlock = industryProfile.industryPromptBlock(settings.industry)
    }
  } catch {
    industryBlock = ''
  }
  try {
    const roleCatalog = require('../shared/personal-role-catalog')
    if (includeWorkProfile && settings.industry && settings.occupationId) {
      const role = roleCatalog.getOccupation(settings.industry, settings.occupationId)
      const industry = roleCatalog.getRoleIndustry(settings.industry)
      occupationBlock = `【${sections.userRole}】\n${industry.label} · ${role.label}`
    }
  } catch {
    occupationBlock = ''
  }
  const userProfile = settings.userProfile ? String(settings.userProfile).trim() : ''
  const selfDriveLabels = strings.selfDrive || getPromptStrings('zh-CN').selfDrive
  const selfDriveLevel = String(settings.agentSelfDriveLevel || 'balanced').trim()
  const selfDrivePolicy = selfDriveLabels[selfDriveLevel] || selfDriveLabels.balanced
  const parts = [
    includeWorkProfile && userProfile
      ? `【${sections.aboutUser}】\n${userProfile}`
      : '',
    industryBlock,
    occupationBlock,
    agentPersonaScope !== 'none' && includeIdentityName && settings.agentDisplayName
      ? `【${sections.identityMetadata}】\n${strings.identityMetadata(String(settings.agentDisplayName).trim())}`
      : '',
    includeAgentStyle && settings.agentSoul
      ? `【${sections.soul}】\n${String(settings.agentSoul).trim()}`
      : '',
    includeAgentOperatingContext && settings.agentDomainCapabilities
      ? `【${sections.domainCapabilities}】\n${String(settings.agentDomainCapabilities).trim()}`
      : '',
    includeAgentOperatingContext && settings.agentCollaboration
      ? `【${sections.collaboration}】\n${String(settings.agentCollaboration).trim()}`
      : '',
    includeAgentOperatingContext && (settings.agentSoul || settings.agentSelfDriveRules)
      ? `【${sections.selfDrive}】\n${selfDrivePolicy}${settings.agentSelfDriveRules ? `\n${String(settings.agentSelfDriveRules).trim()}` : ''}`
      : '',
    includeUserPrompt && settings.userPrompt
      ? `【${sections.historyPreferences}】\n${String(settings.userPrompt).trim()}`
      : '',
    includeAgentStyle && config.soul
      ? `【${sections.extraStyle}】\n${String(config.soul).trim()}`
      : '',
    includeAgentOperatingContext && customModePrompt
      ? `【${sections.extraMode}｜${strings.modeLabels?.[modeId] || MODE_LABELS[modeId]}】\n${customModePrompt}`
      : '',
  ]
  return parts.filter(Boolean).join('\n\n')
}

function buildSkillPrompt(skillRefs = [], options = {}) {
  const refs = [...new Set(
    (Array.isArray(skillRefs) ? skillRefs : [])
      .map(ref => String(ref || '').trim().replace(/^\/+/, ''))
      .filter(Boolean)
  )]
  if (!refs.length) return ''
  const locale = options.locale || 'zh-CN'
  const strings = getPromptStrings(locale)
  const separator = String(locale).toLowerCase().startsWith('en') ? ', ' : '、'
  return [
    `【${strings.skillLayer}】`,
    `${strings.referencedSkills}：${refs.map(ref => `/${ref}`).join(separator)}`,
    strings.skillBoundary,
  ].join('\n')
}

module.exports = {
  MODE_IDS,
  SCENE_IDS,
  MODE_LABELS,
  SCENE_LABELS,
  SCENE_FOUNDATION,
  normalizeMode,
  normalizeTier,
  setPackRuntime,
  setPackRuntimeForTests,
  resolveScene,
  sceneLabel,
  buildScenePrompt,
  buildUserPrompt,
  buildSkillPrompt,
}
