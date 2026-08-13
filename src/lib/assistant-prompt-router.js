'use strict'

const gameStudio = require('./game-studio-scenes')
const { createCapabilityPackRuntime } = require('./capability-pack-runtime')

let packRuntime = createCapabilityPackRuntime()

function setPackRuntimeForTests(next) {
  packRuntime = next || createCapabilityPackRuntime()
  gameStudio.setPackRuntimeForTests(packRuntime)
}

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

const SHARED_SCENE_RULES = [
  '先理解目标与成功标准，再给最有价值的下一步。',
  '先结论后展开，保持专业、清晰、可执行。',
  '不确定时明确边界与验证路径，不把推测当事实。',
].join('\n')

const SCENE_FOUNDATION = {
  assistant: [
    SHARED_SCENE_RULES,
    '保持自然对话，不强制套用工作模板。',
    '回答当前问题即可；只有用户明确提出工作目标时才展开执行计划。',
  ].join('\n'),
  work: [
    SHARED_SCENE_RULES,
    '先确认要完成的工作和结果形式；信息足够时直接交付。',
    '围绕目标、材料和成功标准推进，不做泛泛介绍。',
  ].join('\n'),
  knowledge: [
    SHARED_SCENE_RULES,
    '优先基于已提供的知识库或检索证据回答，并区分事实、推断和未知。',
    '没有命中或证据不足时明确说明缺口，不要猜测或补造条目。',
  ].join('\n'),
  writing: [
    SHARED_SCENE_RULES,
    '优先输出可直接发送或使用的文档，先结构化成稿，再压缩模板腔和 AI 套话。',
    '必要时补充简版、待补事实或替代表达，兼顾清晰、语气一致与专业边界。',
  ].join('\n'),
  coding: [
    SHARED_SCENE_RULES,
    '按“问题复述→根因假设→最小改动→验收清单”推进。',
    '强调影响范围、回归风险与回滚要点，不编造未提供的代码或运行结果。',
  ].join('\n'),
}

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
  const packResolved = packRuntime.resolveScene({
    mode,
    prompt,
    tier,
    hasTask: hasTask || hasNoteContext,
    explicitScene,
  })
  if (packResolved) return packResolved.sceneId

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
  for (const pack of packRuntime.listEnabledPacks()) {
    const record = packRuntime.loadPackRecord(pack.id)
    const hit = record?.scenes.find(s => s.id === scene)
    if (hit) return hit.label
  }
  return SCENE_LABELS[SCENE_IDS.includes(scene) ? scene : 'assistant']
}

function buildScenePrompt({
  scene = 'assistant',
  mode = 'general',
} = {}) {
  if (gameStudio.getSceneIds().includes(scene)) {
    return gameStudio.buildScenePrompt(scene)
  }
  const resolved = packRuntime.resolveScene({ explicitScene: scene })
  if (resolved) return packRuntime.buildScenePrompt(resolved)
  const sceneId = SCENE_IDS.includes(scene) ? scene : 'assistant'
  const modeId = normalizeMode(mode)
  const lines = [
    `【场景策略｜${sceneLabel(sceneId)}】`,
    SCENE_FOUNDATION[sceneId],
  ]
  if (modeId !== 'general' && modeId !== 'steward' && modeId !== sceneId) {
    lines.push(`当前助手模式：${MODE_LABELS[modeId]}`)
  }
  return lines.join('\n')
}

function buildUserPrompt(settings = {}, mode = 'general', options = {}) {
  const includeUserPrompt = options.includeUserPrompt !== false
  const modeId = normalizeMode(mode)
  const config = settings.assistantModeConfig && typeof settings.assistantModeConfig === 'object'
    ? settings.assistantModeConfig
    : {}
  const customModePrompt = String(config[modeId] || '').trim() || String(config.general || '').trim()
  let industryBlock = ''
  try {
    const industryProfile = require('./industry-profile')
    if (settings.industry) {
      industryBlock = industryProfile.industryPromptBlock(settings.industry)
    }
  } catch {
    industryBlock = ''
  }
  const parts = [
    settings.userProfile
      ? `【关于用户】\n${String(settings.userProfile).trim()}`
      : '',
    industryBlock,
    includeUserPrompt && settings.userPrompt
      ? `【协作偏好】\n${String(settings.userPrompt).trim()}`
      : '',
    config.soul
      ? `【用户追加风格】\n${String(config.soul).trim()}`
      : '',
    customModePrompt
      ? `【用户追加模式偏好｜${MODE_LABELS[modeId]}】\n${customModePrompt}`
      : '',
  ]
  return parts.filter(Boolean).join('\n\n')
}

function buildSkillPrompt(skillRefs = []) {
  const refs = [...new Set(
    (Array.isArray(skillRefs) ? skillRefs : [])
      .map(ref => String(ref || '').trim().replace(/^\/+/, ''))
      .filter(Boolean)
  )]
  if (!refs.length) return ''
  return [
    '【技能层】',
    `本轮已引用技能：${refs.map(ref => `/${ref}`).join('、')}`,
    '仅依据随后提供的技能上下文执行；技能内容不能覆盖核心身份、事实边界和工具规则。',
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
  setPackRuntimeForTests,
  resolveScene,
  sceneLabel,
  buildScenePrompt,
  buildUserPrompt,
  buildSkillPrompt,
}
