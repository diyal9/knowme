'use strict'

/**
 * Game studio scene routing — thin adapter over capability-pack-runtime.
 * Legacy exports preserved for IPC and tests; domain data lives in src/packs/game-studio/.
 */

const PACK_ID = 'game-studio'
let runtime = null

function setPackRuntime(next) {
  runtime = next || null
}

const setPackRuntimeForTests = setPackRuntime

function ensurePack() {
  /* pack state comes from the main-process runtime; no implicit install */
}

function packRecord() {
  ensurePack()
  if (!runtime?.isPackEnabled(PACK_ID)) return null
  return runtime.loadPackRecord(PACK_ID)
}

function sceneIndex(record) {
  const map = {}
  for (const scene of record?.scenes || []) map[scene.id] = scene
  return map
}

function getSceneIds() {
  const record = packRecord()
  return record ? record.scenes.map(s => s.id) : []
}

function getScenesMap() {
  return sceneIndex(packRecord())
}

function getLegacyModeMap() {
  const record = packRecord()
  return record?.legacyModeMap || {}
}

function normalizeIndustry(raw) {
  return String(raw || '').trim().toLowerCase() === 'game' ? 'game' : ''
}

function normalizeLegacyMode(raw) {
  const id = String(raw || '').trim().toLowerCase()
  const map = getLegacyModeMap()
  return map[id] ? id : 'general'
}

function classifySceneFromText(text = '') {
  const record = packRecord()
  if (!record) return null
  const src = String(text || '')
  if (!src.trim()) return null
  for (const scene of record.scenes) {
    if (!scene.keywords) continue
    const re = scene.keywords instanceof RegExp
      ? scene.keywords
      : new RegExp(scene.keywords, 'i')
    if (re.test(src)) return scene.id
  }
  return null
}

function resolveGameScene({
  industry = '',
  mode = 'general',
  prompt = '',
  tier = 'chat',
  hasTask = false,
  explicitScene = '',
} = {}) {
  ensurePack()
  if (!runtime?.isPackEnabled(PACK_ID)) return null
  const explicit = String(explicitScene || '').trim()
  if (explicit) {
    return runtime.resolveScene({ packId: PACK_ID, explicitScene: explicit })?.sceneId || null
  }
  if (normalizeIndustry(industry) !== 'game') return null
  // Industry makes the pack eligible; it does not choose a scene. Selection
  // still requires a concrete user intent. Legacy mode mappings remain only
  // for migration/UI compatibility and never become ambient chat prompts.
  return classifySceneFromText(prompt)
}

function getScene(sceneId) {
  const map = getScenesMap()
  return map[sceneId] || map['game-production'] || Object.values(map)[0] || {
    id: sceneId,
    label: sceneId,
    description: '',
  }
}

function sceneLabel(sceneId) {
  return getScene(sceneId).label
}

function sceneSkillRefs(sceneId) {
  const scene = getScene(sceneId)
  return scene.skillId ? [scene.skillId] : []
}

function buildScenePrompt(sceneId) {
  ensurePack()
  const resolved = runtime?.resolveScene({ packId: PACK_ID, explicitScene: sceneId })
  if (resolved) return runtime.buildScenePrompt(resolved)
  const record = packRecord()
  const promptBody = record?.scenePrompts?.[sceneId] || ''
  const scene = getScene(sceneId)
  return [`【游戏工作室场景｜${scene.label}】`, promptBody].filter(Boolean).join('\n')
}

function listScenesForUi() {
  ensurePack()
  return (runtime?.listScenesForUi(PACK_ID) || []).map(s => ({
    id: s.id,
    label: s.label,
    description: s.description,
    skillId: s.skillId,
    legacyModes: s.legacyModes,
  }))
}

function legacyModeDisplayName(mode) {
  ensurePack()
  return runtime?.legacyModeDisplayName(mode, PACK_ID) || '通用办公'
}

ensurePack()

module.exports = {
  PACK_ID,
  get SCENE_IDS() { return getSceneIds() },
  get SCENES() { return getScenesMap() },
  get LEGACY_MODE_TO_SCENE() { return getLegacyModeMap() },
  setPackRuntime,
  setPackRuntimeForTests,
  getSceneIds,
  getScenesMap,
  getLegacyModeMap,
  normalizeIndustry,
  classifySceneFromText,
  resolveGameScene,
  getScene,
  sceneLabel,
  sceneSkillRefs,
  buildScenePrompt,
  listScenesForUi,
  legacyModeDisplayName,
}
