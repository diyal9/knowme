'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const launchModel = require('./workbench-launch-model')

const STORE_VERSION = 1
const MAX_TEXT = 240
const MAX_REFS = 40

function nowIso() {
  return new Date().toISOString()
}

function text(value, max = MAX_TEXT) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function ref(value) {
  if (typeof value === 'string') return text(value, 160)
  if (!value || typeof value !== 'object') return ''
  return {
    id: text(value.id || value.path, 160),
    kind: text(value.kind, 40),
    version: text(value.version, 40),
    hash: text(value.hash || value.contentHash, 160),
  }
}

function normalizeContext(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const legacyIntent = launchModel.launchIntentFromLegacy(source)
  const launchIntent = source.launchIntent
    ? launchModel.normalizeLaunchIntent({ ...legacyIntent, ...source.launchIntent })
    : legacyIntent
  const derived = launchModel.deriveLegacyContextFields(launchIntent)

  return {
    version: STORE_VERSION,
    goalId: text(source.goalId || derived.goalId, 120),
    goal: text(source.goal || derived.goal),
    workflowId: text(source.workflowId || derived.workflowId, 120),
    workflowVersion: text(source.workflowVersion || derived.workflowVersion, 40),
    compositionId: text(source.compositionId || derived.compositionId, 120),
    compositionHash: text(source.compositionHash || derived.compositionHash, 160),
    rootRunId: text(source.rootRunId || derived.rootRunId, 160),
    executionSource: text(source.executionSource || derived.executionSource, 40),
    artifactRefs: (Array.isArray(source.artifactRefs) ? source.artifactRefs : derived.artifactRefs)
      .map(ref).filter(item => item && (typeof item === 'string' || item.id)).slice(0, MAX_REFS),
    launchIntent,
    updatedAt: text(source.updatedAt, 40) || nowIso(),
  }
}

function createStore(file, options = {}) {
  const fsImpl = options.fs || fs

  function read() {
    try {
      const raw = JSON.parse(fsImpl.readFileSync(file, 'utf8'))
      return raw?.version === STORE_VERSION ? normalizeContext(raw.context) : normalizeContext()
    } catch {
      return normalizeContext()
    }
  }

  function write(context) {
    const normalized = normalizeContext({ ...context, updatedAt: nowIso() })
    fsImpl.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
    fsImpl.writeFileSync(tmp, JSON.stringify({
      version: STORE_VERSION,
      context: normalized,
      updatedAt: nowIso(),
    }, null, 2), 'utf8')
    try {
      fsImpl.renameSync(tmp, file)
    } catch (error) {
      try { fsImpl.rmSync(tmp, { force: true }) } catch { /* best effort */ }
      throw error
    }
    return { ok: true, context: normalized }
  }

  return {
    get: () => ({ ok: true, context: read() }),
    save: patch => write({ ...read(), ...(patch || {}) }),
    saveLaunchIntent: (patch, options = {}) => {
      const current = read()
      const merged = launchModel.patchLaunchIntent(current.launchIntent, patch)
      const guard = launchModel.guardDuplicateLaunch(current.launchIntent, merged, options)
      if (!guard.ok) {
        return {
          ok: false,
          duplicate: true,
          error: guard.error,
          runId: guard.runId,
          context: current,
        }
      }
      const derived = launchModel.deriveLegacyContextFields(guard.intent)
      return write({ ...current, ...derived, launchIntent: guard.intent })
    },
    clear: () => {
      try { if (fsImpl.existsSync(file)) fsImpl.unlinkSync(file) } catch {
        return { ok: false, error: '无法清除工作上下文' }
      }
      return { ok: true, context: normalizeContext() }
    },
  }
}

module.exports = {
  STORE_VERSION,
  normalizeContext,
  createStore,
}
