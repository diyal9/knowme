'use strict'

/**
 * agent-context-assembly — Expert 分层提示词、Skill 自动匹配与 slash L1 注入。
 * 纯函数，便于单元测试；IO 经 skillRuntime / expertRuntime 注入。
 */

const { LEGACY_PREFIX } = require('./skill-runtime')
const groundingRuntime = require('./agent-grounding-runtime')
const { assembleExpertLayeredBlocks, resolveSoulSop } = require('./expert-agentic-profile')
const { resolveAgentCapabilityScope } = require('./agent-capability-scope')

const L0_BUDGET = 2400
const L1_BUDGET = 8000

function normalizeSlashRef(ref) {
  return String(ref || '').trim().replace(/^\/+/, '')
}

function isLegacySlashRef(ref) {
  const id = normalizeSlashRef(ref)
  return id.startsWith(LEGACY_PREFIX) || !id.includes('/')
}

function buildExpertPersonaBlock(persona = {}) {
  const layered = assembleExpertLayeredBlocks({ persona })
  if (layered.expertBlock) return layered.expertBlock
  const name = String(persona.name || '').trim()
  const prompt = String(persona.systemPrompt || '').trim()
  if (!prompt) return ''
  const header = name ? `【专家 persona · ${name}】` : '【专家 persona】'
  return `${header}\n${prompt}`
}

function buildSkillL0Block(matches = []) {
  if (!matches.length) return ''
  const lines = [
    '【自动匹配技能 · L0 摘要】',
    '以下 Skill 是方法说明，不是可直接调用的函数。不要将 Skill 名称或 ID 改写成工具名。',
    '需要完整方法时，仅在本轮工具列表提供 load_skill 的情况下，使用对应 skill_id 读取；实际调用只能使用本轮 tools 中的函数与参数。',
  ]
  matches.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name || item.id}${item.slash ? ` (/${item.slash})` : ''}`)
    if (item.id) lines.push(`   skill_id=${item.id}`)
    if (item.description) lines.push(`   ${item.description}`)
  })
  return lines.join('\n').slice(0, L0_BUDGET)
}

function buildSkillL1Block(entries = []) {
  if (!entries.length) return ''
  const parts = []
  for (const entry of entries) {
    if (!entry.body) continue
    const header = `# 技能 ${entry.name || entry.id}${entry.truncated ? ' [truncated]' : ''}`
    parts.push(`${header}\n${entry.body}`)
  }
  const text = parts.join('\n\n---\n\n')
  if (text.length <= L1_BUDGET) return text
  throw Object.assign(new Error(`完整技能正文超出上下文预算（${text.length}/${L1_BUDGET} 字符），请减少本轮选择的技能。`), {
    code: 'skill_l1_budget_exceeded', requiredChars: text.length, maxChars: L1_BUDGET,
  })
}

function resolveProjectionSourceTrust(personaProjection = {}) {
  const source = String(
    personaProjection?.capabilityManifest?.provenance?.source
    || personaProjection?.capabilityManifest?.source
    || '',
  ).trim().toLowerCase()
  return ['bundled', 'curated', 'official'].includes(source) ? 'bundled' : 'user'
}

function buildCapabilityContextBlocks({ layered, skillL0Block, skillL1Block, personaName, sourceTrust } = {}) {
  const layers = layered?.layers || {}
  const expertSource = { type: 'expert-runtime', id: String(personaName || 'active') }
  const blocks = [
    layers.agenticScaffold ? {
      id: 'persona.agentic-scaffold',
      kind: 'persona',
      priority: 88,
      maxTokens: 720,
      content: layers.agenticScaffold,
      sourceTrust,
      source: expertSource,
    } : null,
    layers.soul ? {
      id: 'persona.soul',
      kind: 'persona',
      priority: 87,
      maxTokens: 1200,
      content: layers.soul,
      sourceTrust,
      source: expertSource,
    } : null,
    layers.sop ? {
      id: 'persona.sop',
      kind: 'persona',
      priority: 86,
      maxTokens: 2800,
      content: layers.sop,
      sourceTrust,
      source: expertSource,
    } : null,
    layers.attributes ? {
      id: 'persona.attributes',
      kind: 'persona',
      priority: 84,
      maxTokens: 900,
      content: layers.attributes,
      sourceTrust,
      source: expertSource,
    } : null,
    layers.session ? {
      id: 'task.expert-session',
      kind: 'task_fact',
      priority: 82,
      maxTokens: 800,
      content: layers.session,
      sourceTrust: 'user',
      source: { type: 'agent-session', id: 'active' },
    } : null,
    skillL0Block ? {
      id: 'skill.auto-summary',
      kind: 'skill',
      optional: true,
      priority: 62,
      maxTokens: 1600,
      content: skillL0Block,
      sourceTrust: 'user',
      source: { type: 'skill-runtime', id: 'auto-match' },
    } : null,
    skillL1Block ? {
      id: 'skill.explicit-content',
      kind: 'skill',
      explicit: true,
      priority: 74,
      maxTokens: 8000,
      content: skillL1Block,
      sourceTrust: 'user',
      source: { type: 'skill-runtime', id: 'explicit' },
    } : null,
  ].filter(Boolean)
  return blocks
}

/**
 * @param {{
 *   session?: object,
 *   prompt?: string,
 *   slashRefs?: string[],
 *   tier?: string,
 *   expertRuntime?: { getSessionPersona: Function },
 *   skillRuntime?: {
 *     autoMatchSkills: Function,
 *     loadSkillL1: Function,
 *     loadSkillGroundingContract?: Function,
 *     listSlashPickerItems: Function,
 *     findSkillRecord: Function,
 *   },
 *   legacySkillContext?: string,
 *   taskId?: string,
 * }} opts
 */
function assembleCapabilityContext(opts = {}) {
  const session = opts.session || {}
  const tier = String(opts.tier || 'chat').trim()
  const prompt = String(opts.prompt || '').trim()
  const slashRefs = [...new Set((opts.slashRefs || []).map(normalizeSlashRef).filter(Boolean))]
  const expertRuntime = opts.expertRuntime
  const skillRuntime = opts.skillRuntime

  let persona = null
  let personaProjection = null
  let bindings = { skills: null, connectors: null }
  let planningBindings = { skills: [], connectors: [] }
  let readiness = { state: 'unknown', items: [], issues: [] }
  if (expertRuntime && typeof expertRuntime.getSessionPersona === 'function') {
    const personaExpertId = String(session.personaExpertId || session.expertId || '').trim()
    personaProjection = expertRuntime.getSessionPersona(session.id, personaExpertId)
    if (personaProjection?.ok) {
      persona = personaProjection.persona
      planningBindings = {
        skills: Array.isArray(personaProjection.bindings?.skills) ? personaProjection.bindings.skills : [],
        connectors: Array.isArray(personaProjection.bindings?.connectors) ? personaProjection.bindings.connectors : [],
      }
      readiness = personaProjection.readiness || readiness
    }
    // personaExpertId only shapes identity. Capability bindings still require
    // an execution expertId, so discussion-only sessions cannot regain tools.
    if (session.expertId) {
      const bindingProjection = personaExpertId === session.expertId
        ? personaProjection
        : expertRuntime.getSessionPersona(session.id, session.expertId)
      if (bindingProjection?.ok) {
        bindings = {
          skills: Array.isArray(bindingProjection.bindings?.skills) ? bindingProjection.bindings.skills : null,
          connectors: Array.isArray(bindingProjection.bindings?.connectors) ? bindingProjection.bindings.connectors : null,
        }
      }
    }
  }

  const capabilityScope = resolveAgentCapabilityScope({
    session, expertRuntime, userData: opts.userData, permissions: opts.permissions,
    executionPolicy: opts.executionPolicy,
  })
  bindings = { skills: capabilityScope.allowedSkillIds, connectors: capabilityScope.allowedConnectorIds }
  const allowLegacyContext = bindings.skills === null && !capabilityScope.noTools && !capabilityScope.deniedSkillIds.length
  const filterOpts = { invocation: 'model' }
  if (Array.isArray(bindings.skills)) filterOpts.allowedIds = bindings.skills

  const layered = assembleExpertLayeredBlocks({
    persona: persona || {},
    session: {
      goal: session.goal || session.taskGoal || session.intent,
      knowledgeRefs: session.knowledgeRefs,
    },
  })
  const expertBlock = layered.dynamicExpertContext || buildExpertPersonaBlock(persona || {})
  let skillL0Block = ''
  let skillL1Block = ''
  const resolvedSlashIds = []
  const groundingContracts = []

  const heavy = tier !== 'chat'
  if (heavy && skillRuntime) {
    const autoMatches = typeof skillRuntime.autoMatchSkills === 'function'
      ? skillRuntime.autoMatchSkills(prompt, { ...filterOpts, topK: 3 })
      : []
    skillL0Block = buildSkillL0Block(autoMatches.filter(item => capabilityScope.decision('skills', item.id).allowed))

    if (slashRefs.length && typeof skillRuntime.findSkillRecord === 'function') {
      const l1Entries = []
      const legacyRefs = []
      for (const ref of slashRefs) {
        const record = skillRuntime.findSkillRecord(ref)
          || (skillRuntime.listSlashPickerItems
            ? skillRuntime.listSlashPickerItems({ includeLegacy: true })
              .find((item) => item.slash === ref || item.id === ref)
            : null)
        if (!record) {
          legacyRefs.push(ref)
          continue
        }
        if (Array.isArray(bindings.skills) && !bindings.skills.includes(record.id)) continue
        if (!capabilityScope.decision('skills', record.id).allowed) continue
        const loaded = skillRuntime.loadSkillL1(record.id, { ...filterOpts, invocation: 'explicit-user' })
        if (!loaded?.ok && record.source === 'legacy-okf') legacyRefs.push(record.slash || ref)
        if (loaded?.truncated || loaded?.code === 'skill_l1_budget_exceeded') {
          throw Object.assign(new Error(loaded.message || '完整技能正文超出预算，请减少本轮选择的技能。'), { code: 'skill_l1_budget_exceeded' })
        }
        if (loaded?.ok) {
          l1Entries.push(loaded)
          resolvedSlashIds.push(record.id)
          if (typeof skillRuntime.loadSkillGroundingContract === 'function') {
            const grounding = skillRuntime.loadSkillGroundingContract(record.id, {
              ...filterOpts,
              taskId: String(opts.taskId || '').trim(),
            })
            if (grounding?.ok && grounding.contract) {
              const c = grounding.contract
              const hasRules = (c.requiredTools?.length || 0) > 0
                || (c.requiredEvidence?.length || 0) > 0
                || (c.completionConditions?.length || 0) > 0
              if (hasRules) groundingContracts.push(c)
            }
          }
        }
      }
      skillL1Block = buildSkillL1Block(l1Entries)
      if (legacyRefs.length && opts.legacySkillContext && allowLegacyContext) {
        skillL1Block = [skillL1Block, opts.legacySkillContext].filter(Boolean).join('\n\n---\n\n')
      }
    } else if (opts.legacySkillContext && allowLegacyContext) {
      skillL1Block = opts.legacySkillContext
    }
  } else if (opts.legacySkillContext && slashRefs.length && allowLegacyContext) {
    skillL1Block = opts.legacySkillContext
  }

  const dynamicParts = [expertBlock, skillL0Block, skillL1Block].filter(Boolean)
  const groundingContract = groundingContracts.length
    ? groundingRuntime.mergeGroundingContracts(groundingContracts)
    : null
  const resolvedProfile = resolveSoulSop(persona || {})
  const sourceTrust = resolveProjectionSourceTrust(personaProjection || {})
  const contextBlocks = buildCapabilityContextBlocks({
    layered,
    skillL0Block,
    skillL1Block,
    personaName: persona?.name,
    sourceTrust,
  })
  const readinessById = new Map((readiness.items || []).map(item => [String(item?.id || ''), item]))
  const planningCapabilities = {
    skills: planningBindings.skills.map((id) => {
      const record = skillRuntime && typeof skillRuntime.findSkillRecord === 'function'
        ? skillRuntime.findSkillRecord(id)
        : null
      const state = readinessById.get(String(id))
      return {
        id: String(id),
        name: String(record?.name || id),
        description: String(record?.description || ''),
        status: String(state?.status || 'ready'),
        reason: String(state?.reason || ''),
      }
    }),
    connectors: planningBindings.connectors.map((id) => {
      const state = readinessById.get(String(id))
      return {
        id: String(id),
        name: String(id),
        status: String(state?.status || 'ready'),
        reason: String(state?.reason || ''),
      }
    }),
    knowledgeRefs: (Array.isArray(session.knowledgeRefs) ? session.knowledgeRefs : [])
      .map(ref => String(ref?.name || ref?.id || ref || '').trim())
      .filter(Boolean),
    inputContract: (Array.isArray(persona?.inputContract) ? persona.inputContract : []).map(String).filter(Boolean),
    outputContract: (Array.isArray(persona?.outputContract) ? persona.outputContract : []).map(String).filter(Boolean),
    readiness: String(readiness.state || 'unknown'),
    sop: resolvedProfile.sop,
  }
  return {
    expertBlock,
    skillL0Block,
    skillL1Block,
    dynamicCapabilityContext: dynamicParts.join('\n\n'),
    contextBlocks,
    groundingContract,
    bindings,
    capabilityScope,
    planningCapabilities,
    resolvedSlashIds,
    personaName: String(persona?.name || '').trim(),
    personaSource: persona ? (session.snapshotPath ? 'snapshot' : 'live') : 'none',
    personaTrust: sourceTrust,
    layers: layered.layers,
    agenticType: resolvedProfile.agenticType,
    soul: resolvedProfile.soul,
    sop: resolvedProfile.sop,
  }
}

function getSessionCapabilityBindings(session, expertRuntime, options = {}) {
  return resolveAgentCapabilityScope({ ...options, session, expertRuntime })
}

module.exports = {
  L0_BUDGET,
  L1_BUDGET,
  normalizeSlashRef,
  isLegacySlashRef,
  buildExpertPersonaBlock,
  buildSkillL0Block,
  buildSkillL1Block,
  resolveProjectionSourceTrust,
  buildCapabilityContextBlocks,
  assembleCapabilityContext,
  getSessionCapabilityBindings,
  assembleExpertLayeredBlocks,
  resolveSoulSop,
}
