'use strict'

const fs = require('fs')
const path = require('path')
const launchModel = require('./workbench-launch-model')

const VERSION = 1
const GOAL_MAX = 240
const CONTEXT_MAX = 12000
const AGENTS_MAX = 12
const REFS_MAX = 32
const SECRET_KEY = /(?:token|secret|password|passwd|authorization|api[_-]?key|access[_-]?key|private[_-]?key|cookie)/i

function nowIso() {
  return new Date().toISOString()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function safeContext(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return undefined
  if (typeof value === 'string') return value.slice(0, 1000)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.slice(0, 30).map(item => safeContext(item, depth + 1)).filter(item => item !== undefined)
  }
  if (typeof value !== 'object') return undefined
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue
    const safe = safeContext(item, depth + 1)
    if (safe !== undefined) result[String(key).slice(0, 80)] = safe
  }
  return result
}

function normalizeDraft(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const context = safeContext(source.context)
  const contextText = context === undefined ? '' : JSON.stringify(context)
  const legacyIntent = launchModel.launchIntentFromLegacy(source)
  const launchIntent = source.launchIntent
    ? launchModel.normalizeLaunchIntent({ ...legacyIntent, ...source.launchIntent })
    : legacyIntent
  const derived = launchModel.deriveLegacyDraftFields(launchIntent)

  return {
    version: VERSION,
    goal: String(source.goal || derived.goal || '').trim().slice(0, GOAL_MAX),
    workflowId: String(source.workflowId || derived.workflowId || '').trim().slice(0, 160),
    modeId: String(source.modeId || launchIntent.domain || '').trim().slice(0, 80),
    agentIds: Array.isArray(source.agentIds)
      ? source.agentIds.map(id => String(id || '').trim()).filter(Boolean).slice(0, AGENTS_MAX)
      : [],
    context: contextText.length <= CONTEXT_MAX ? context : undefined,
    slug: String(source.slug || derived.slug || '').trim().slice(0, 80),
    phase: String(source.phase || derived.phase || 'preparing').trim().slice(0, 40) || 'preparing',
    executionSource: String(source.executionSource || derived.executionSource || '').trim().slice(0, 40),
    goalId: String(source.goalId || derived.goalId || '').trim().slice(0, 120),
    workflowVersion: String(source.workflowVersion || derived.workflowVersion || '').trim().slice(0, 40),
    compositionId: String(source.compositionId || derived.compositionId || '').trim().slice(0, 120),
    rootRunId: String(source.rootRunId || derived.rootRunId || '').trim().slice(0, 120),
    composition: safeContext(source.composition || derived.composition),
    profileIds: Array.isArray(source.profileIds)
      ? source.profileIds.map(id => String(id || '').trim()).filter(Boolean).slice(0, REFS_MAX)
      : derived.profileIds,
    skillRefs: Array.isArray(source.skillRefs)
      ? source.skillRefs.map(ref => safeContext(ref)).filter(Boolean).slice(0, REFS_MAX)
      : [],
    artifactRefs: Array.isArray(source.artifactRefs)
      ? source.artifactRefs.map(ref => safeContext(ref)).filter(Boolean).slice(0, REFS_MAX)
      : derived.artifactRefs,
    launchIntent,
    updatedAt: String(source.updatedAt || '').trim() || nowIso(),
  }
}

function writeJson(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function createStore(file) {
  function load() {
    const raw = readJson(file)
    return raw && raw.version === VERSION && raw.draft
      ? normalizeDraft(raw.draft)
      : null
  }

  function get() {
    return { ok: true, draft: load() }
  }

  function save(patch = {}) {
    const previous = load() || {}
    const draft = normalizeDraft({ ...previous, ...(patch || {}), updatedAt: nowIso() })
    if (!draft.goal && !draft.workflowId && !draft.slug && !draft.launchIntent?.goal) {
      return { ok: false, error: '任务草稿不能为空' }
    }
    writeJson(file, { version: VERSION, draft, updatedAt: nowIso() })
    return { ok: true, draft }
  }

  function saveLaunchIntent(patch = {}, options = {}) {
    const previous = load() || {}
    const merged = launchModel.patchLaunchIntent(previous.launchIntent, patch)
    const guard = launchModel.guardDuplicateLaunch(previous.launchIntent, merged, options)
    if (!guard.ok) {
      return {
        ok: false,
        duplicate: true,
        error: guard.error,
        runId: guard.runId,
        draft: previous,
      }
    }
    const derived = launchModel.deriveLegacyDraftFields(guard.intent)
    return save({ ...derived, launchIntent: guard.intent })
  }

  function clear() {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {
      return { ok: false, error: '无法清除任务草稿' }
    }
    return { ok: true, draft: null }
  }

  return { get, save, saveLaunchIntent, clear }
}

module.exports = {
  VERSION,
  GOAL_MAX,
  CONTEXT_MAX,
  normalizeDraft,
  createStore,
}
