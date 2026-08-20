'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const MY_KNOWME_PROFILE_ID = 'my-knowme'
const PERSONAL_AGENT_ID = 'personal'
const GROWTH_STORE_VERSION = 1
const MAX_EVENTS = 200
const MAX_PROPOSALS = 100
const DEFAULT_AGENT_SOUL = [
  '你是用户长期使用的专业工作伙伴。',
  '保持诚实、可靠和克制；以推进真实工作为目标，不表演人格，不假装掌握未知事实。',
  '遇到重要判断时说明依据、假设与边界，尊重用户的最终决定。',
].join('\n')
const DEFAULT_DOMAIN_CAPABILITIES = [
  '任务拆解、计划与进度推进',
  '资料检索、归纳与会议总结',
  '办公写作、方案整理与表达优化',
  '风险识别、检查清单与决策辅助',
].join('\n')
const DEFAULT_COLLABORATION = [
  '先给结论和下一步，再补充必要依据。',
  '信息不足时明确缺口，只追问推进任务所需的问题。',
  '区分事实、推断和建议；不虚构用户、项目或组织信息。',
].join('\n')
const DEFAULT_SELF_DRIVE_RULES = [
  '可以主动整理上下文、拆解步骤、发现遗漏并提出下一步。',
  '涉及发送、发布、删除、付费、授权或对外承诺时，必须先获得确认。',
].join('\n')

function nowIso() {
  return new Date().toISOString()
}

function cleanText(value, max = 1000) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]))
}

function renameWithRetrySync(fsImpl, source, target) {
  const delays = [15, 40, 80, 160]
  let lastError
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      fsImpl.renameSync(source, target)
      return
    } catch (error) {
      lastError = error
      const retryable = ['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)
      if (!retryable || attempt >= delays.length) break
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt])
    }
  }
  throw lastError
}

function normalizeSelfDriveLevel(value) {
  const level = cleanText(value, 20)
  return ['guided', 'balanced', 'proactive'].includes(level) ? level : 'balanced'
}

function defaultProfile(settings = {}) {
  const userPrompt = cleanText(settings.userPrompt, 8000)
  const displayName = cleanText(settings.knowMeName || settings.assistantName, 80) || '智能伙伴'
  return {
    id: MY_KNOWME_PROFILE_ID,
    agentId: PERSONAL_AGENT_ID,
    profileKind: 'personal',
    name: displayName,
    description: '我的长期工作代理',
    identity: {
      displayName,
      avatar: cleanText(settings.knowMeAvatar, 240) || 'other/partner',
    },
    contexts: [],
    taskPreferences: {
      domainCapabilities: DEFAULT_DOMAIN_CAPABILITIES,
      selfDriveLevel: 'balanced',
      selfDriveRules: DEFAULT_SELF_DRIVE_RULES,
      ...(settings.assistantMode ? { legacyMode: cleanText(settings.assistantMode, 80) } : {}),
    },
    roleOverlay: cleanText(settings.assistantModeConfig?.soul, 1200) || DEFAULT_AGENT_SOUL,
    promptOverlay: userPrompt || DEFAULT_COLLABORATION,
    skillRefs: [],
    knowledgeRefs: [],
    connectorRefs: [],
    permissions: {},
    memoryPolicy: { scope: 'global', learningEnabled: true },
    knowledgePolicy: { mode: 'selected', includeWorkMemory: true },
    provenance: {
      source: 'knowme-personal-agent',
      projectedLegacySettings: Boolean(userPrompt),
      personalDetailsMigratedV1: true,
      occupationConfigMigratedV1: true,
      agentSoulSeparatedV1: true,
    },
  }
}

function emptyGrowthState() {
  return { version: GROWTH_STORE_VERSION, events: [], proposals: [], updatedAt: nowIso() }
}

function createPersonalAgentService(options = {}) {
  const fsImpl = options.fs || fs
  const pathImpl = options.path || path
  const profileStore = options.profileStore
  const productMemory = options.productMemory
  const memoryDir = cleanText(options.memoryDir, 1000)
  const auditFile = options.auditFile || pathImpl.join(cleanText(options.userData, 1000), 'personal-agent-growth.json')
  const loadSettings = typeof options.loadSettings === 'function' ? options.loadSettings : () => ({})

  if (!profileStore) throw new Error('personal-agent requires profileStore')

  function readGrowth() {
    try {
      const raw = JSON.parse(fsImpl.readFileSync(auditFile, 'utf8'))
      return {
        version: GROWTH_STORE_VERSION,
        events: Array.isArray(raw.events) ? raw.events.slice(-MAX_EVENTS) : [],
        proposals: Array.isArray(raw.proposals) ? raw.proposals.slice(-MAX_PROPOSALS) : [],
        updatedAt: cleanText(raw.updatedAt, 40) || nowIso(),
      }
    } catch {
      return emptyGrowthState()
    }
  }

  function writeGrowth(state) {
    const next = {
      version: GROWTH_STORE_VERSION,
      events: (state.events || []).slice(-MAX_EVENTS),
      proposals: (state.proposals || []).slice(-MAX_PROPOSALS),
      updatedAt: nowIso(),
    }
    fsImpl.mkdirSync(pathImpl.dirname(auditFile), { recursive: true })
    const tmp = `${auditFile}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
    fsImpl.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
    renameWithRetrySync(fsImpl, tmp, auditFile)
    return next
  }

  function appendEvent(type, detail = {}) {
    const state = readGrowth()
    const event = {
      id: `growth_${crypto.randomUUID()}`,
      type: cleanText(type, 80),
      status: cleanText(detail.status, 40) || 'applied',
      summary: cleanText(detail.summary, 500),
      source: cleanText(detail.source, 120) || 'user',
      proposalId: cleanText(detail.proposalId, 120),
      memoryRef: cleanText(detail.memoryRef, 160),
      reversible: detail.reversible === true,
      createdAt: nowIso(),
    }
    state.events.push(event)
    writeGrowth(state)
    return event
  }

  function ensureProfile() {
    const existing = profileStore.get(MY_KNOWME_PROFILE_ID)
    if (existing.ok) {
      const provenance = existing.profile.provenance || {}
      if (provenance.agentSoulSeparatedV1 === true) return existing
      const settings = loadSettings()
      const existingPrompt = cleanText(existing.profile.promptOverlay || settings.userPrompt, 8000)
      const preferences = existing.profile.taskPreferences || {}
      return profileStore.save({
        ...existing.profile,
        roleOverlay: cleanText(settings.assistantModeConfig?.soul, 1200) || DEFAULT_AGENT_SOUL,
        promptOverlay: existingPrompt || DEFAULT_COLLABORATION,
        taskPreferences: {
          ...preferences,
          domainCapabilities: cleanText(preferences.domainCapabilities, 2400) || DEFAULT_DOMAIN_CAPABILITIES,
          selfDriveLevel: normalizeSelfDriveLevel(preferences.selfDriveLevel),
          selfDriveRules: cleanText(preferences.selfDriveRules, 2400) || DEFAULT_SELF_DRIVE_RULES,
        },
        provenance: {
          ...provenance,
          personalDetailsMigratedV1: true,
          occupationConfigMigratedV1: true,
          agentSoulSeparatedV1: true,
        },
      }, { confirmedRisk: true })
    }
    return profileStore.save(defaultProfile(loadSettings()), { confirmedRisk: true })
  }

  function get() {
    const result = ensureProfile()
    if (!result.ok) return result
    const growth = readGrowth()
    return {
      ok: true,
      profile: result.profile,
      pendingProposalCount: growth.proposals.filter(item => item.status === 'pending').length,
      recentGrowth: growth.events.slice(-5).reverse(),
    }
  }

  function createProposal(input = {}) {
    const state = readGrowth()
    const proposal = {
      id: `proposal_${crypto.randomUUID()}`,
      kind: cleanText(input.kind, 40) || 'behavior',
      summary: cleanText(input.summary || input.text, 500),
      patch: clone(input.patch || {}),
      status: 'pending',
      source: cleanText(input.source, 120) || 'teaching',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    state.proposals.push(proposal)
    writeGrowth(state)
    appendEvent('proposal_created', {
      status: 'pending',
      summary: proposal.summary,
      source: proposal.source,
      proposalId: proposal.id,
    })
    return { ok: true, applied: false, requiresConfirmation: true, proposal }
  }

  function hasGovernedChange(patch = {}) {
    if (!patch || typeof patch !== 'object') return false
    if (['skillRefs', 'knowledgeRefs', 'connectorRefs', 'permissions', 'memoryPolicy', 'knowledgePolicy']
      .some(key => Object.prototype.hasOwnProperty.call(patch, key))) return true
    return Array.isArray(patch.contexts) && patch.contexts.some(context =>
      context && typeof context === 'object' &&
      ['skillRefs', 'knowledgeRefs', 'connectorRefs', 'permissions']
        .some(key => Object.prototype.hasOwnProperty.call(context, key)))
  }

  function safeDirectPatch(patch = {}) {
    const next = {}
    if (patch.identity && typeof patch.identity === 'object') next.identity = clone(patch.identity)
    if (Array.isArray(patch.contexts)) next.contexts = clone(patch.contexts)
    if (patch.taskPreferences && typeof patch.taskPreferences === 'object') next.taskPreferences = clone(patch.taskPreferences)
    if (patch.roleOverlay != null) next.roleOverlay = cleanText(patch.roleOverlay, 1200)
    if (patch.promptOverlay != null) next.promptOverlay = cleanText(patch.promptOverlay, 8000)
    return next
  }

  function save(input = {}) {
    const patch = input.profile || input.patch || input
    if (hasGovernedChange(patch)) {
      return createProposal({
        kind: 'profile-governance',
summary: input.summary || '调整智能伙伴的能力、知识或权限',
        patch,
        source: 'personal-agent-save',
      })
    }
    const current = ensureProfile()
    if (!current.ok) return current
    const direct = safeDirectPatch(patch)
    const preferences = {
      ...(current.profile.taskPreferences || {}),
      ...(direct.taskPreferences || {}),
    }
    preferences.domainCapabilities = cleanText(preferences.domainCapabilities, 2400) || DEFAULT_DOMAIN_CAPABILITIES
    preferences.selfDriveLevel = normalizeSelfDriveLevel(preferences.selfDriveLevel)
    preferences.selfDriveRules = cleanText(preferences.selfDriveRules, 2400) || DEFAULT_SELF_DRIVE_RULES
    const next = {
      ...current.profile,
      ...direct,
      taskPreferences: preferences,
      roleOverlay: cleanText(direct.roleOverlay ?? current.profile.roleOverlay, 1200) || DEFAULT_AGENT_SOUL,
      promptOverlay: cleanText(direct.promptOverlay ?? current.profile.promptOverlay, 8000) || DEFAULT_COLLABORATION,
      id: MY_KNOWME_PROFILE_ID,
      agentId: PERSONAL_AGENT_ID,
      profileKind: 'personal',
      name: cleanText(direct.identity?.displayName || current.profile.name, 80),
      updatedAt: nowIso(),
    }
    const saved = profileStore.save(next, { confirmedRisk: true })
    if (saved.ok) appendEvent('profile_updated', { summary: input.summary || '更新个人代理设置' })
    return saved
  }

  function teachingKind(text, patch) {
    if (hasGovernedChange(patch)) return 'profile-governance'
    if (/权限|授权|代表我|发送|发布|覆盖|删除/.test(text)) return 'permission'
    if (/\bskill\b|技能|安装|装备|连接器/i.test(text)) return 'capability'
    if (/知识库|知识源|长期知识/.test(text)) return 'knowledge'
    if (/推断|猜测|自动判断|主动/.test(text)) return 'behavior'
    return 'memory'
  }

  function teach(input = {}) {
    if (input.undoEventId) return undo(input.undoEventId)
    const summary = cleanText(input.summary || input.text, 500)
if (!summary) return { ok: false, code: 'empty_teaching', error: '请输入要教给智能伙伴的内容' }
    const kind = teachingKind(summary, input.patch)
    const explicitlyRemember = input.kind === 'remember' || /^(请)?记住|以后请|我的偏好是/.test(summary)
    if (kind !== 'memory' || !explicitlyRemember) {
      return createProposal({ kind, summary, patch: input.patch, source: 'personal-agent-teach' })
    }
    const remembered = typeof productMemory?.upsertGlobalMemory === 'function'
      ? productMemory.upsertGlobalMemory(memoryDir, {
          type: 'preference',
          text: summary,
          scope: 'global',
          source: { type: 'personal-agent', label: '由智能伙伴记录' },
        })
      : productMemory?.rememberExplicitPreference(memoryDir, summary, { source: 'personal-agent-teach' })
    if (remembered?.ok === false) return remembered
    const memoryRef = cleanText(remembered?.item?.id || remembered?.pattern?.id || remembered?.id, 160)
    const event = appendEvent('memory_applied', {
      summary,
      memoryRef,
      reversible: true,
    })
    return { ok: true, applied: true, requiresConfirmation: false, memoryRef, undoEventId: event.id, event }
  }

  function undo(eventId) {
    const state = readGrowth()
    const event = state.events.find(item => item.id === cleanText(eventId, 160))
    if (!event || event.reversible !== true || event.status === 'reverted') {
      return { ok: false, code: 'undo_unavailable', error: '这条记忆或变更记录不可撤销，或已经撤销' }
    }
    if (event.memoryRef && typeof productMemory?.retractExplicitPreference === 'function') {
      const retracted = event.memoryRef.startsWith('mem_') && typeof productMemory?.removeGlobalMemory === 'function'
        ? productMemory.removeGlobalMemory(memoryDir, event.memoryRef)
        : productMemory.retractExplicitPreference(memoryDir, event.memoryRef)
      if (!retracted.ok) return retracted
    }
    event.status = 'reverted'
    event.revertedAt = nowIso()
    writeGrowth(state)
    const undoEvent = appendEvent('memory_reverted', { summary: `撤销：${event.summary}`, memoryRef: event.memoryRef })
    return { ok: true, reverted: event, event: undoEvent }
  }

  function applyProposal(input = {}, validationOptions = {}) {
    if (input.undoEventId) return undo(input.undoEventId)
    const state = readGrowth()
    const proposal = state.proposals.find(item => item.id === cleanText(input.proposalId || input.id, 160))
    if (!proposal) return { ok: false, code: 'not_found', error: '变更提案不存在' }
    if (proposal.status !== 'pending') return { ok: false, code: 'already_reviewed', error: '变更提案已经处理' }
    const action = input.action === 'reject' ? 'reject' : 'apply'
    if (action === 'reject') {
      proposal.status = 'rejected'
      proposal.updatedAt = nowIso()
      writeGrowth(state)
      appendEvent('proposal_rejected', { summary: proposal.summary, proposalId: proposal.id })
      return { ok: true, proposal }
    }
    const current = ensureProfile()
    if (!current.ok) return current
    const saved = profileStore.save({
      ...current.profile,
      ...clone(proposal.patch),
      id: MY_KNOWME_PROFILE_ID,
      agentId: PERSONAL_AGENT_ID,
      profileKind: 'personal',
      updatedAt: nowIso(),
    }, { ...validationOptions, confirmedRisk: input.confirmedRisk === true })
    if (!saved.ok) return saved
    proposal.status = 'applied'
    proposal.updatedAt = nowIso()
    writeGrowth(state)
    appendEvent('proposal_applied', { summary: proposal.summary, proposalId: proposal.id })
    return { ok: true, proposal, profile: saved.profile }
  }

  function growthList(input = {}) {
    const state = readGrowth()
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 50))
    return {
      ok: true,
      events: state.events.slice(-limit).reverse(),
      proposals: state.proposals.slice(-limit).reverse(),
    }
  }

  return { get, save, teach, applyProposal, growthList, ensureProfile, auditFile }
}

module.exports = {
  MY_KNOWME_PROFILE_ID,
  PERSONAL_AGENT_ID,
  GROWTH_STORE_VERSION,
  DEFAULT_AGENT_SOUL,
  DEFAULT_DOMAIN_CAPABILITIES,
  DEFAULT_COLLABORATION,
  DEFAULT_SELF_DRIVE_RULES,
  defaultProfile,
  createPersonalAgentService,
}
