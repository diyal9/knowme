'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  normalizeAgentProfile,
  validateAgentProfile,
} = require('./agent-profile')

const STORE_VERSION = 1

function nowIso() {
  return new Date().toISOString()
}

function resolvePath(userData) {
  return path.join(String(userData || ''), 'agent-profiles.json')
}

function readJson(file, fsImpl) {
  try {
    return JSON.parse(fsImpl.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(file, data, fsImpl) {
  const dir = path.dirname(file)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
  fsImpl.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  try {
    fsImpl.renameSync(tmp, file)
  } catch (error) {
    try { fsImpl.rmSync(tmp, { force: true }) } catch { /* best effort */ }
    throw error
  }
}

function createStore(options = {}) {
  const fsImpl = options.fs || fs
  const file = options.file || resolvePath(options.userData || '')

  function load() {
    const raw = readJson(file, fsImpl)
    const profiles = {}
    if (raw?.version === STORE_VERSION && raw.profiles && typeof raw.profiles === 'object') {
      for (const [key, value] of Object.entries(raw.profiles)) {
        const normalized = normalizeAgentProfile({ ...value, id: value.id || key })
        if (normalized.ok) profiles[normalized.profile.id] = normalized.profile
      }
    }
    return { version: STORE_VERSION, profiles, updatedAt: raw?.updatedAt || nowIso() }
  }

  function save(state) {
    const payload = {
      version: STORE_VERSION,
      profiles: state.profiles || {},
      updatedAt: nowIso(),
    }
    writeJsonAtomic(file, payload, fsImpl)
    return payload
  }

  function list(agentId = '') {
    const profiles = Object.values(load().profiles)
    const filtered = agentId ? profiles.filter(item => item.agentId === String(agentId).trim()) : profiles
    return { ok: true, profiles: filtered, file }
  }

  function get(id) {
    const profile = load().profiles[String(id || '').trim()]
    return profile
      ? { ok: true, profile }
      : { ok: false, code: 'not_found', error: 'Agent Profile 不存在' }
  }

  function saveProfile(raw, options = {}) {
    const validation = validateAgentProfile(raw, options)
    if (!validation.ok) return validation
    const state = load()
    state.profiles[validation.profile.id] = validation.profile
    save(state)
    return { ok: true, profile: validation.profile }
  }

  function remove(id) {
    const state = load()
    const key = String(id || '').trim()
    if (!state.profiles[key]) return { ok: false, code: 'not_found', error: 'Agent Profile 不存在' }
    delete state.profiles[key]
    save(state)
    return { ok: true }
  }

  return {
    file,
    load,
    list,
    get,
    save: saveProfile,
    remove,
  }
}

module.exports = {
  STORE_VERSION,
  resolvePath,
  writeJsonAtomic,
  createStore,
}
