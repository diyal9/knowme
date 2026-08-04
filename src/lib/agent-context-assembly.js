'use strict'

/**
 * agent-context-assembly — Expert persona、Skill 自动匹配与 slash L1 注入。
 * 纯函数，便于单元测试；IO 经 skillRuntime / expertRuntime 注入。
 */

const { LEGACY_PREFIX } = require('./skill-runtime')

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
 *     listSlashPickerItems: Function,
 *     findSkillRecord: Function,
 *   },
 *   legacySkillContext?: string,
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
    const res = expertRuntime.getSessionPersona(session.id, session.expertId)
    if (res?.ok) {
      persona = res.persona
      bindings = {
        skills: Array.isArray(res.bindings?.skills) ? res.bindings.skills : null,
        connectors: Array.isArray(res.bindings?.connectors) ? res.bindings.connectors : null,
      }
    }
  }

  const filterOpts = {}
  if (bindings.skills?.length) filterOpts.allowedIds = bindings.skills

  const expertBlock = buildExpertPersonaBlock(persona || {})
  let skillL0Block = ''
  let skillL1Block = ''
  const resolvedSlashIds = []

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
        if (bindings.skills?.length && !bindings.skills.includes(record.id)) continue
        const loaded = skillRuntime.loadSkillL1(record.id, filterOpts)
        if (loaded?.ok) {
          l1Entries.push(loaded)
          resolvedSlashIds.push(record.id)
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
  return {
    expertBlock,
    skillL0Block,
    skillL1Block,
    dynamicCapabilityContext: dynamicParts.join('\n\n'),
    bindings,
    resolvedSlashIds,
    personaSource: persona ? (session.snapshotPath ? 'snapshot' : 'live') : 'none',
  }
}

function getSessionCapabilityBindings(session, expertRuntime) {
  if (!session) return { allowedSkillIds: null, allowedConnectorIds: null }
  if (expertRuntime && typeof expertRuntime.getSessionPersona === 'function') {
    const res = expertRuntime.getSessionPersona(session.id, session.expertId)
    if (res?.ok && res.bindings) {
      return {
        allowedSkillIds: res.bindings.skills?.length ? res.bindings.skills : null,
        allowedConnectorIds: res.bindings.connectors?.length ? res.bindings.connectors : null,
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
}
