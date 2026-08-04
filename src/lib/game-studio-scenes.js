'use strict'

/**
 * Game studio scene routing — Skill-driven task scenarios for mobile game studios.
 * Legacy agentId (general/steward/writing/coding) maps as compatibility layer only.
 */

const SCENE_IDS = ['game-design', 'game-dev', 'game-qa', 'game-production', 'game-knowledge']

const SCENES = {
  'game-design': {
    id: 'game-design',
    label: '策划需求',
    description: '撰写结构化游戏需求案，引用飞书资料并走审批写入',
    skillId: 'game-requirement-doc',
    expertId: 'game-studio-partner',
    connectors: ['feishu'],
    legacyModes: ['writing'],
    keywords: /(需求案|策划|玩法|数值|埋点|prd|gdd|game design|验收标准|活动配置)/i,
  },
  'game-dev': {
    id: 'game-dev',
    label: '研发实现',
    description: '从需求案启动 Daemon 工作流并形成可审阅交付',
    skillId: 'game-dev-delivery',
    expertId: 'game-studio-partner',
    connectors: ['feishu'],
    legacyModes: ['coding'],
    keywords: /(开发|实现|客户端|服务端|代码|接口|联调|daemon|工作流|workflow|交付)/i,
    defaultWorkflow: 'game-dev-delivery',
  },
  'game-qa': {
    id: 'game-qa',
    label: '测试验收',
    description: '对照需求验收标准执行 QA 与反模式审查',
    skillId: 'game-qa-acceptance',
    expertId: 'game-studio-partner',
    connectors: [],
    legacyModes: [],
    keywords: /(测试|qa|验收|回归|用例|反模式|缺陷|bug)/i,
  },
  'game-production': {
    id: 'game-production',
    label: '制作推进',
    description: '版本里程碑、风险清单与跨职能推进',
    skillId: 'game-production',
    expertId: 'game-studio-partner',
    connectors: ['feishu'],
    legacyModes: ['general'],
    keywords: /(版本|里程碑|排期|风险|制作人|项目推进|上线|发版)/i,
  },
  'game-knowledge': {
    id: 'game-knowledge',
    label: '项目知识',
    description: 'Wiki/OKF 整理与项目上下文维护',
    skillId: null,
    expertId: null,
    connectors: [],
    legacyModes: ['steward'],
    keywords: /(知识库|wiki|okf|整理|升格|健康检查)/i,
  },
}

const LEGACY_MODE_TO_SCENE = {
  general: 'game-production',
  steward: 'game-knowledge',
  writing: 'game-design',
  coding: 'game-dev',
}

const SCENE_PROMPTS = {
  'game-design': [
    '你是 KnowMe，手机游戏工作室的策划协作伙伴。',
    '优先输出结构化游戏需求案：背景、目标、玩法、规则、数值/资源、埋点、验收标准、风险。',
    '引用飞书或本地资料时标注来源；写入飞书须等用户审批，不得绕过。',
    '信息足够时直接成稿，仅在关键缺口时追问（最多 3 项）。',
  ].join('\n'),
  'game-dev': [
    '你是 KnowMe，手机游戏研发协作伙伴。',
    '从已批准的需求案出发，明确开发任务、影响范围、最小改动与验收清单。',
    '启动 Workbench Daemon 工作流前 MUST 确认 Daemon 健康；不可用时诚实阻断并给出恢复路径。',
    '强调回归风险、接口契约与可交付产物路径。',
  ].join('\n'),
  'game-qa': [
    '你是 KnowMe，手机游戏 QA 协作伙伴。',
    '对照需求验收标准列出测试矩阵、反模式与阻塞项。',
    '区分已验证、待验证与无法验证（外部依赖）三类结论。',
  ].join('\n'),
  'game-production': [
    '你是 KnowMe，手机游戏制作/项目推进伙伴。',
    '围绕版本目标整理里程碑、依赖、风险与下一步负责人。',
    '先结论后细节，避免空泛介绍。',
  ].join('\n'),
  'game-knowledge': [
    '你是 KnowMe，项目知识管家。',
    '优先基于已有 Wiki/OKF 证据回答；证据不足时明确缺口。',
  ].join('\n'),
}

function normalizeIndustry(raw) {
  return String(raw || '').trim().toLowerCase() === 'game' ? 'game' : ''
}

function normalizeLegacyMode(raw) {
  const id = String(raw || '').trim().toLowerCase()
  return LEGACY_MODE_TO_SCENE[id] ? id : 'general'
}

function classifySceneFromText(text = '') {
  const src = String(text || '')
  if (!src.trim()) return null
  for (const scene of Object.values(SCENES)) {
    if (scene.keywords && scene.keywords.test(src)) return scene.id
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
  if (normalizeIndustry(industry) !== 'game') return null

  const explicit = String(explicitScene || '').trim()
  if (explicit && SCENES[explicit]) return explicit

  const fromText = classifySceneFromText(prompt)
  if (fromText) return fromText

  const legacy = normalizeLegacyMode(mode)
  if (LEGACY_MODE_TO_SCENE[legacy]) return LEGACY_MODE_TO_SCENE[legacy]

  if (tier === 'assist' || hasTask) return 'game-dev'
  return 'game-production'
}

function getScene(sceneId) {
  return SCENES[SCENE_IDS.includes(sceneId) ? sceneId : 'game-production'] || SCENES['game-production']
}

function sceneLabel(sceneId) {
  return getScene(sceneId).label
}

function sceneSkillRefs(sceneId) {
  const scene = getScene(sceneId)
  const refs = []
  if (scene.skillId) refs.push(scene.skillId)
  return refs
}

function buildScenePrompt(sceneId) {
  const id = SCENE_IDS.includes(sceneId) ? sceneId : 'game-production'
  const scene = getScene(id)
  const lines = [
    `【游戏工作室场景｜${scene.label}】`,
    SCENE_PROMPTS[id] || SCENE_PROMPTS['game-production'],
  ]
  if (scene.skillId) {
    lines.push(`推荐技能：/${scene.skillId}`)
  }
  return lines.join('\n')
}

function listScenesForUi() {
  return SCENE_IDS.filter(id => id !== 'game-knowledge').map(id => {
    const s = SCENES[id]
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      skillId: s.skillId,
      legacyModes: s.legacyModes,
    }
  })
}

function legacyModeDisplayName(mode) {
  const sceneId = LEGACY_MODE_TO_SCENE[normalizeLegacyMode(mode)]
  return sceneId ? sceneLabel(sceneId) : '通用办公'
}

module.exports = {
  SCENE_IDS,
  SCENES,
  LEGACY_MODE_TO_SCENE,
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
