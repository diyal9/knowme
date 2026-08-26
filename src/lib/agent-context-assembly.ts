'use strict'

/**
 * agent-context-assembly — Expert 分层提示词、Skill 自动匹配与 slash L1 注入。
 * 纯函数，便于单元测试；IO 经 skillRuntime / expertRuntime 注入。
 */

const { LEGACY_PREFIX } = require('./skill-runtime')
const groundingRuntime = require('./agent-grounding-runtime')
const { assembleExpertLayeredBlocks, resolveSoulSop } = require('./expert-agentic-profile')

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
  const lines = ['【自动匹配技能 · L0 摘要】']
  matches.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name || item.id}${item.slash ? ` (/${item.slash})` : ''}`)
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
  return `${text.slice(0, L1_BUDGET - 40)}\n\n[技能正文已截断]`
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
  let bindings = { skills: null, connectors: null }
  if (expertRuntime && typeof expertRuntime.getSessionPersona === 'function') {
    const personaExpertId = String(session.personaExpertId || session.expertId || '').trim()
    const personaProjection = expertRuntime.getSessionPersona(session.id, personaExpertId)
    if (personaProjection?.ok) {
      persona = personaProjection.persona
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

  const filterOpts = {}
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
    skillL0Block = buildSkillL0Block(autoMatches)

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
        if (record.source === 'legacy-okf') {
          legacyRefs.push(record.slash || ref)
          continue
        }
        if (Array.isArray(bindings.skills) && !bindings.skills.includes(record.id)) continue
        const loaded = skillRuntime.loadSkillL1(record.id, filterOpts)
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
      if (legacyRefs.length && opts.legacySkillContext) {
        skillL1Block = [skillL1Block, opts.legacySkillContext].filter(Boolean).join('\n\n---\n\n')
      }
    } else if (opts.legacySkillContext) {
      skillL1Block = opts.legacySkillContext
    }
  } else if (opts.legacySkillContext && slashRefs.length) {
    skillL1Block = opts.legacySkillContext
  }

  const dynamicParts = [expertBlock, skillL0Block, skillL1Block].filter(Boolean)
  const groundingContract = groundingContracts.length
    ? groundingRuntime.mergeGroundingContracts(groundingContracts)
    : null
  const resolvedProfile = resolveSoulSop(persona || {})
  return {
    expertBlock,
    skillL0Block,
    skillL1Block,
    dynamicCapabilityContext: dynamicParts.join('\n\n'),
    groundingContract,
    bindings,
    resolvedSlashIds,
    personaName: String(persona?.name || '').trim(),
    personaSource: persona ? (session.snapshotPath ? 'snapshot' : 'live') : 'none',
    layers: layered.layers,
    agenticType: resolvedProfile.agenticType,
    soul: resolvedProfile.soul,
    sop: resolvedProfile.sop,
  }
}

function getSessionCapabilityBindings(session, expertRuntime) {
  if (!session) return { allowedSkillIds: null, allowedConnectorIds: null }
  if (expertRuntime && typeof expertRuntime.getSessionPersona === 'function') {
    const res = expertRuntime.getSessionPersona(session.id, session.expertId)
    if (res?.ok && res.bindings) {
      return {
        allowedSkillIds: Array.isArray(res.bindings.skills) ? res.bindings.skills : [],
        allowedConnectorIds: Array.isArray(res.bindings.connectors) ? res.bindings.connectors : [],
      }
    }
  }
  return { allowedSkillIds: null, allowedConnectorIds: null }
}

module.exports = {
  L0_BUDGET,
  L1_BUDGET,
  normalizeSlashRef,
  isLegacySlashRef,
  buildExpertPersonaBlock,
  buildSkillL0Block,
  buildSkillL1Block,
  assembleCapabilityContext,
  getSessionCapabilityBindings,
  assembleExpertLayeredBlocks,
  resolveSoulSop,
}
