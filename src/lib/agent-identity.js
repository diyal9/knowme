'use strict'

/**
 * Agent 身份呈现的共享口径：工作台卡片与助理会话首屏必须用同一套图标语义与徽标，
 * 这样「点开始使用 → 进对话」是同一个对象的延续，而不是跳到一个陌生页面。
 * 专家数据里的 avatar 字符串不得直出 emoji；图标走语义名，图片走有限预设。
 */

const IDENTITY_ICON_RULES = [
  [/(ui|视觉|设计|美术|art|design|icon|界面)/, 'component'],
  [/(bi|analytic|数据|分析|指标|埋点|报表)/, 'database'],
  [/(config|配置|参数|数值|表格)/, 'settingsLine'],
  [/(test|qa|测试|验收)/, 'flask'],
  [/(知识|wiki|knowledge|检索|search|资料)/, 'bookOpen'],
  [/(运维|ops|deploy|server|部署|监控)/, 'server'],
  [/(code|coder|dev|engineer|研发|开发|工程|前端|后端|编程)/, 'terminal'],
  [/(office|办公|写作|文档|纪要|润色|邮件|doc)/, 'note'],
  [/(product|producer|\bpm\b|产品|制作人|规划)/, 'clipboardCheck'],
]

const DEFAULT_IDENTITY_ICON = 'users'
const AVATAR_ASSET_ROOT = 'assets/avatars'
const FALLBACK_PRESET_ID = 'other/partner'

/** 有限预设：游戏 9 + 办公 3 + 其它 1；与 src/assets/avatars/catalog.json 对齐。更具体的 match 必须排在泛化项前面。 */
const PRESET_AVATARS = [
  {
    id: 'game/producer',
    domain: 'game',
    role: 'producer',
    keys: ['game/producer', 'producer', 'production'],
    match: /(制作人|producer|production|项目经理|\bpm\b|里程碑)/i,
  },
  {
    id: 'game/planner',
    domain: 'game',
    role: 'planner',
    keys: ['game/planner', 'planner', 'product-planner'],
    match: /(产品策划|玩法策划|planner|feature[-_]?brief)/i,
  },
  {
    id: 'game/client',
    domain: 'game',
    role: 'client',
    keys: ['game/client', 'client', 'client-engineer'],
    match: /(客户端|client[-_]?engineer|unity|cocos|ue\b)/i,
  },
  {
    id: 'game/server',
    domain: 'game',
    role: 'server',
    keys: ['game/server', 'server', 'server-engineer'],
    match: /(服务端|server[-_]?engineer|网关|backend[-_]?game)/i,
  },
  {
    id: 'game/ui',
    domain: 'game',
    role: 'ui',
    keys: ['game/ui', 'ui', 'ux'],
    match: /(\bui\b|界面设计|交互设计|\bux\b)/i,
  },
  {
    id: 'game/vfx',
    domain: 'game',
    role: 'vfx',
    keys: ['game/vfx', 'vfx', 'fx'],
    match: /(特效|vfx|粒子|\bfx\b)/i,
  },
  {
    id: 'game/designer',
    domain: 'game',
    role: 'designer',
    keys: ['game/designer', 'designer'],
    match: /(数值策划|关卡|game[-_]?design|requirement[-_]?doc|策划)/i,
  },
  {
    id: 'game/engineer',
    domain: 'game',
    role: 'engineer',
    keys: ['game/engineer', 'engineer', 'dev'],
    match: /(研发交付|game[-_]?dev|daemon|研发|开发工程师)/i,
  },
  {
    id: 'game/qa',
    domain: 'game',
    role: 'qa',
    keys: ['game/qa', 'qa', 'tester'],
    match: /(测试|qa|验收|quality)/i,
  },
  {
    id: 'office/writer',
    domain: 'office',
    role: 'writer',
    keys: ['office/writer', 'writer', 'office', 'copywriter'],
    match: /(写作|润色|文案|office[-_]?partner|document|大纲|定稿)/i,
  },
  {
    id: 'office/collaborator',
    domain: 'office',
    role: 'collaborator',
    keys: ['office/collaborator', 'collaborator'],
    match: /(会议|纪要|助理|协作|calendar|飞书今日|today[-_]?priority)/i,
  },
  {
    id: 'office/knowledge',
    domain: 'office',
    role: 'knowledge',
    keys: ['office/knowledge', 'knowledge'],
    match: /(知识库|知识管家|wiki|steward|检索资料)/i,
  },
  {
    id: 'other/partner',
    domain: 'other',
    role: 'partner',
    keys: ['other/partner', 'partner', 'default'],
    match: /(超级合伙人|通用搭档|partner)/i,
  },
]

const LEGACY_AVATAR_ALIAS = {
  office: 'office/writer',
  game: 'game/producer',
}

function identitySemantic(agent = {}) {
  const persona = agent.persona && typeof agent.persona === 'object' ? agent.persona : {}
  const skills = Array.isArray(agent.skills) ? agent.skills.join(' ') : ''
  const tags = Array.isArray(agent.tags) ? agent.tags.join(' ') : ''
  const category = Array.isArray(agent.categories)
    ? agent.categories.join(' ')
    : String(agent.category || '')
  return [
    agent.id,
    agent.name,
    agent.title,
    persona.role,
    agent.role,
    agent.description,
    agent.summary,
    agent.avatar,
    skills,
    tags,
    category,
  ]
    .map(part => String(part == null ? '' : part))
    .join(' ')
    .toLowerCase()
}

function presetById(id) {
  const key = String(id || '').trim().toLowerCase()
  if (!key) return null
  return PRESET_AVATARS.find(item => item.id === key || item.keys.includes(key)) || null
}

function presetSrc(preset) {
  if (!preset) return ''
  return `${AVATAR_ASSET_ROOT}/${preset.domain}/${preset.role}.png`
}

/** 按语义取图标名；取不到时回落到中性的 users，绝不返回 emoji。 */
function identityIcon(agent = {}) {
  const semantic = identitySemantic(agent)
  if (!semantic.trim()) return DEFAULT_IDENTITY_ICON
  for (const [pattern, icon] of IDENTITY_ICON_RULES) {
    if (pattern.test(semantic)) return icon
  }
  return DEFAULT_IDENTITY_ICON
}

/**
 * 解析预设头像 id（如 game/client）。优先级：显式 avatar 键 → 语义 match → other/partner。
 * 永远不返回 emoji。
 */
function identityAvatarKey(agent = {}) {
  const raw = String(agent.avatar == null ? '' : agent.avatar).trim()
  const aliased = LEGACY_AVATAR_ALIAS[raw.toLowerCase()] || raw
  const byKey = presetById(aliased)
  if (byKey) return byKey.id

  const semantic = identitySemantic(agent)
  if (semantic.trim()) {
    for (const preset of PRESET_AVATARS) {
      if (preset.id === FALLBACK_PRESET_ID) continue
      if (preset.match.test(semantic)) return preset.id
    }
  }

  return FALLBACK_PRESET_ID
}

const PRESET_LABELS = {
  'game/producer': '游戏制作',
  'game/planner': '产品策划',
  'game/designer': '游戏策划',
  'game/client': '客户端',
  'game/server': '服务端',
  'game/engineer': '游戏研发',
  'game/ui': 'UI 设计',
  'game/vfx': '特效',
  'game/qa': '游戏测试',
  'office/writer': '办公写作',
  'office/collaborator': '办公协作',
  'office/knowledge': '知识管家',
  'other/partner': '通用搭档',
}

/** 解析预设头像相对路径；与 identityAvatarKey 同源。 */
function identityAvatarSrc(agent = {}) {
  return presetSrc(presetById(identityAvatarKey(agent)))
}

/** 创建/调优 UI 用的预设列表（含展示名）。 */
function listPresetAvatars() {
  return PRESET_AVATARS.map(item => ({
    id: item.id,
    domain: item.domain,
    role: item.role,
    src: presetSrc(item),
    label: PRESET_LABELS[item.id] || item.role,
  }))
}

function identitySourceLabel(agent = {}) {
  const origin = String(agent.origin || agent.source || 'local').toLowerCase()
  if (origin === 'daemon' || origin === 'official') return '团队专家'
  if (origin === 'repository' || origin === 'team') return '仓库专家'
  return '我的专家'
}

const DEFAULT_IDENTITY_DUTY = '尚未填写职责说明'

function identityDuty(agent = {}) {
  const duty = String(agent.description || agent.summary || '').trim()
  return duty || DEFAULT_IDENTITY_DUTY
}

/** 绑定能力规模：让用户在启动前知道这个 Agent 手上有什么。 */
function identityCapabilityChips(agent = {}) {
  const skills = Array.isArray(agent.skills) ? agent.skills.length : 0
  const connectors = Array.isArray(agent.connectors) ? agent.connectors.length : 0
  const chips = []
  if (skills > 0) chips.push(`${skills} 个技能`)
  if (connectors > 0) chips.push(`${connectors} 个连接器`)
  if (!chips.length) chips.push('专家方法')
  return chips
}

const IDENTITY_API = {
  IDENTITY_ICON_RULES,
  DEFAULT_IDENTITY_ICON,
  DEFAULT_IDENTITY_DUTY,
  PRESET_AVATARS,
  PRESET_LABELS,
  FALLBACK_PRESET_ID,
  AVATAR_ASSET_ROOT,
  identityIcon,
  identityAvatarKey,
  identityAvatarSrc,
  listPresetAvatars,
  identitySourceLabel,
  identityDuty,
  identityCapabilityChips,
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = IDENTITY_API
}

if (typeof window !== 'undefined') {
  window.AgentIdentity = IDENTITY_API
}
