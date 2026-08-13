'use strict'

/**
 * expert-agentic-profile — Soul / SOP / AgenticType 与分层提示词脚手架。
 * 面向整个 KnowMe 专家 Agent 体系（可编辑资产 + Runtime 装配）。
 */

const AGENTIC_TYPES = Object.freeze([
  'reflection',
  'tool_use',
  'react',
  'planning',
  'multi_agent',
])

const AGENTIC_TYPE_LABELS = Object.freeze({
  reflection: '反射（Reflection）',
  tool_use: '工具使用（Tool use）',
  react: 'ReAct（推理+行动）',
  planning: '规划（Planning）',
  multi_agent: '多智能体（Multi-agent）',
})

const AGENTIC_TYPE_HINTS = Object.freeze({
  reflection: '先产出，再按验收清单自检并修订，直到达标。',
  tool_use: '优先用工具与外部信息，避免空转空想。',
  react: '在思考、行动（工具）、观察结果之间循环推进。',
  planning: '复杂目标先给出可执行路线图，再按阶段执行。',
  multi_agent: '明确委派边界；完整团队编排请使用工作流，而非本专家独自扮演全队。',
})

function normalizeAgenticType(value, fallback = 'react') {
  const raw = String(value || '').trim().toLowerCase().replace(/-/g, '_')
  const aliases = {
    reflect: 'reflection',
    tool: 'tool_use',
    tools: 'tool_use',
    tooluse: 'tool_use',
    reason_act: 'react',
    plan: 'planning',
    multiagent: 'multi_agent',
    multi: 'multi_agent',
  }
  const mapped = aliases[raw] || raw
  if (AGENTIC_TYPES.includes(mapped)) return mapped
  return fallback
}

function isValidAgenticType(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  return AGENTIC_TYPES.includes(normalizeAgenticType(raw, ''))
}

function asPositiveInt(value, fallback, { min = 1, max = 8 } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeAgenticConfig(type, config = {}) {
  const agenticType = normalizeAgenticType(type)
  const src = config && typeof config === 'object' ? config : {}
  const out = { agenticType }
  if (agenticType === 'reflection') {
    out.maxReflectionRounds = asPositiveInt(src.maxReflectionRounds, 2, { min: 1, max: 5 })
    out.acceptanceChecklist = String(src.acceptanceChecklist || '').trim().slice(0, 1200)
  } else if (agenticType === 'tool_use') {
    out.toolPolicy = String(src.toolPolicy || 'prefer_tools').trim() || 'prefer_tools'
    out.requiredConnectorHint = String(src.requiredConnectorHint || '').trim().slice(0, 200)
  } else if (agenticType === 'react') {
    out.enableReflection = src.enableReflection !== false
    out.enableTools = src.enableTools !== false
  } else if (agenticType === 'planning') {
    out.planFirst = src.planFirst !== false
    out.requirePlanConfirmation = src.requirePlanConfirmation === true
  } else if (agenticType === 'multi_agent') {
    out.delegationHints = String(src.delegationHints || '').trim().slice(0, 1200)
    out.teammateRefs = Array.isArray(src.teammateRefs)
      ? [...new Set(src.teammateRefs.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 8)
      : []
  }
  return out
}

/** 兼容旧专家：仅有 systemPrompt → SOP；缺省 Type=react。 */
function resolveSoulSop(source = {}) {
  const soul = String(source.soul || source.persona?.soul || '').trim()
  let sop = String(source.sop || source.persona?.sop || '').trim()
  const legacy = String(source.systemPrompt || source.persona?.systemPrompt || '').trim()
  if (!sop && legacy) sop = legacy
  const agenticType = normalizeAgenticType(
    source.agenticType || source.persona?.agenticType || source.agentic?.type,
  )
  const agenticConfig = normalizeAgenticConfig(
    agenticType,
    source.agenticConfig || source.persona?.agenticConfig || source.agentic || {},
  )
  const systemPrompt = String(
    source.systemPrompt
    || synthesizeSystemPrompt({ soul, sop })
    || legacy,
  ).trim()
  return {
    soul,
    sop,
    agenticType,
    agenticConfig,
    systemPrompt,
    legacyMapped: !String(source.sop || '').trim() && !!legacy,
  }
}

function synthesizeSystemPrompt({ soul = '', sop = '' } = {}) {
  const parts = []
  if (String(soul || '').trim()) parts.push(`【Soul】\n${String(soul).trim()}`)
  if (String(sop || '').trim()) parts.push(`【SOP】\n${String(sop).trim()}`)
  return parts.join('\n\n').trim()
}

/** L0：KnowMe 对话结构默认（专家关不掉的协议层） */
function buildKnowMeDialogueStructureBlock() {
  return [
    '【KnowMe 对话结构 · L0】',
    '- 你是 KnowMe 工作伙伴中的专家 Agent；回答面向可执行协作，而非空泛聊天。',
    '- 遵守输出协议：结构化、可核验；不确定时明确说明缺口，不得臆造事实、角色或未提供的材料。',
    '- 引用与工具结果须可追溯；信息不足时先澄清或列出假设，再推进。',
    '- 专家 Soul/SOP 可塑造风格与职责，但不得关闭本层安全、诚实与协议约束。',
  ].join('\n')
}

function buildAgenticScaffoldBlock(agenticType, agenticConfig = {}) {
  const type = normalizeAgenticType(agenticType)
  const cfg = normalizeAgenticConfig(type, agenticConfig)
  const lines = [`【Agentic 脚手架 · ${AGENTIC_TYPE_LABELS[type] || type}】`, AGENTIC_TYPE_HINTS[type]]
  if (type === 'reflection') {
    lines.push(`- 最多自检 ${cfg.maxReflectionRounds} 轮；交付前对照验收要点修订。`)
    if (cfg.acceptanceChecklist) lines.push(`- 验收清单：\n${cfg.acceptanceChecklist}`)
  } else if (type === 'tool_use') {
    lines.push('- 有检索/外部信息需求时优先调用已绑定工具与连接器，再综合结论。')
    if (cfg.requiredConnectorHint) lines.push(`- 优先通道提示：${cfg.requiredConnectorHint}`)
  } else if (type === 'react') {
    lines.push(`- 允许工具：${cfg.enableTools ? '是' : '否'}；允许反思修订：${cfg.enableReflection ? '是' : '否'}。`)
    lines.push('- 按 Thought → Act → Observe 循环推进，每步说明依据。')
  } else if (type === 'planning') {
    lines.push(`- 复杂任务${cfg.planFirst ? '必须先' : '宜先'}给出分阶段路线图（目标、步骤、依赖、风险）。`)
    if (cfg.requirePlanConfirmation) {
      lines.push('- 计划需用户确认后再深入执行；未确认前只完善计划与澄清。')
    }
  } else if (type === 'multi_agent') {
    lines.push('- 你是协作中的一位专家：只做本职，需其他角色时说明委派对象与交接物。')
    lines.push('- 完整多智能体编排请引导用户使用工作流 / Studio，勿假装已拉起未声明团队。')
    if (cfg.delegationHints) lines.push(`- 委派条件：\n${cfg.delegationHints}`)
    if (cfg.teammateRefs?.length) lines.push(`- 可参考协作对象：${cfg.teammateRefs.join('、')}`)
  }
  return lines.filter(Boolean).join('\n')
}

function buildSoulBlock(soul, name = '') {
  const text = String(soul || '').trim()
  if (!text) return ''
  const title = name ? `【专家 Soul · ${name}】` : '【专家 Soul】'
  return `${title}\n${text}`
}

function buildSopBlock(sop, name = '') {
  const text = String(sop || '').trim()
  if (!text) return ''
  const title = name ? `【专家 SOP · ${name}】` : '【专家 SOP】'
  return `${title}\n${text}`
}

function buildAttributesBlock(persona = {}) {
  const lines = []
  const role = String(persona.role || '').trim()
  const description = String(persona.description || '').trim()
  const caps = Array.isArray(persona.capabilities)
    ? persona.capabilities.map((c) => String(c?.label || c?.name || c || '').trim()).filter(Boolean)
    : []
  const collab = String(persona.collaborationStyle || persona.collabStyle || '').trim()
  if (role) lines.push(`角色：${role}`)
  if (description) lines.push(`简介：${description}`)
  if (caps.length) lines.push(`能力：${caps.slice(0, 8).join('、')}`)
  if (collab) lines.push(`协作方式：${collab}`)
  const type = persona.agenticType ? normalizeAgenticType(persona.agenticType) : ''
  if (type) lines.push(`AgenticType：${AGENTIC_TYPE_LABELS[type] || type}`)
  if (!lines.length) return ''
  return `【专家属性与协作方式】\n${lines.join('\n')}`
}

function buildSessionContextBlock(session = {}) {
  const lines = []
  const goal = String(session.goal || session.taskGoal || session.intent || '').trim()
  const refs = Array.isArray(session.knowledgeRefs)
    ? session.knowledgeRefs.map((r) => String(r?.id || r || '').trim()).filter(Boolean)
    : []
  if (goal) lines.push(`任务目标：${goal}`)
  if (refs.length) lines.push(`知识范围：${refs.join('、')}`)
  if (!lines.length) return ''
  return `【本次 Session】\n${lines.join('\n')}`
}

/**
 * 组装专家相关分层块（不含技能 L6，由既有 skill 装配拼接）。
 */
function assembleExpertLayeredBlocks({ persona = {}, session = {} } = {}) {
  const resolved = resolveSoulSop(persona)
  const name = String(persona.name || '').trim()
  const l0 = buildKnowMeDialogueStructureBlock()
  const l1 = buildAgenticScaffoldBlock(resolved.agenticType, resolved.agenticConfig)
  const l2 = buildSoulBlock(resolved.soul, name)
  const l3 = buildSopBlock(resolved.sop, name)
  const l3Effective = l3 || (resolved.systemPrompt && !resolved.soul
    ? buildSopBlock(resolved.systemPrompt, name)
    : '')
  const l4 = buildAttributesBlock({
    ...persona,
    agenticType: resolved.agenticType,
    capabilities: persona.capabilities || persona.professionalCapabilities,
  })
  const l5 = buildSessionContextBlock(session)
  const layers = {
    knowmeStructure: l0,
    agenticScaffold: l1,
    soul: l2,
    sop: l3Effective,
    attributes: l4,
    session: l5,
  }
  const expertParts = [l2, l3Effective, l4].filter(Boolean)
  const expertBlock = expertParts.length
    ? expertParts.join('\n\n')
    : (resolved.systemPrompt
      ? `【专家 persona · ${name || '专家'}】\n${resolved.systemPrompt}`
      : '')
  const dynamicExpertContext = [l0, l1, expertBlock, l5].filter(Boolean).join('\n\n')
  return {
    layers,
    expertBlock,
    dynamicExpertContext,
    resolved,
  }
}

function agenticTypeOptions() {
  return AGENTIC_TYPES.map((id) => ({
    id,
    label: AGENTIC_TYPE_LABELS[id],
    hint: AGENTIC_TYPE_HINTS[id],
  }))
}

module.exports = {
  AGENTIC_TYPES,
  AGENTIC_TYPE_LABELS,
  AGENTIC_TYPE_HINTS,
  normalizeAgenticType,
  isValidAgenticType,
  normalizeAgenticConfig,
  resolveSoulSop,
  synthesizeSystemPrompt,
  buildKnowMeDialogueStructureBlock,
  buildAgenticScaffoldBlock,
  buildSoulBlock,
  buildSopBlock,
  buildAttributesBlock,
  buildSessionContextBlock,
  assembleExpertLayeredBlocks,
  agenticTypeOptions,
}
