'use strict'

const STORE_VERSION = 2
const DEFAULT_EPHEMERAL_TTL_MS = 6 * 60 * 60 * 1000
const DEFAULT_MAX_ORPHANED_EPHEMERAL = 64

function timestamp(value) {
  const parsed = new Date(value || 0).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function taskIdsFromStore(raw) {
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.tasks) ? raw.tasks : [])
  return new Set(rows.map(item => String(item?.id || '').trim()).filter(Boolean))
}

function readReferencedTaskIds(fs, taskFile) {
  if (!taskFile) return new Set()
  try {
    return taskIdsFromStore(JSON.parse(fs.readFileSync(taskFile, 'utf8')))
  } catch {
    return new Set()
  }
}

/**
 * Keep durable conversations, task-backed workbench sessions, and a small
 * recent recovery window. Qualification/sub-run debris is intentionally
 * bounded so it cannot grow the user transcript store without limit.
 */
function pruneEphemeralSessions(sessions = [], options = {}) {
  const now = Number(options.now) || Date.now()
  const ttlMs = Math.max(0, Number(options.ttlMs) || DEFAULT_EPHEMERAL_TTL_MS)
  const maxOrphans = Math.max(0, Number(options.maxOrphans ?? DEFAULT_MAX_ORPHANED_EPHEMERAL))
  const referencedTaskIds = options.referencedTaskIds instanceof Set
    ? options.referencedTaskIds
    : new Set(Array.isArray(options.referencedTaskIds) ? options.referencedTaskIds.map(String) : [])
  const referencedSessionIds = options.referencedSessionIds instanceof Set
    ? options.referencedSessionIds
    : new Set(Array.isArray(options.referencedSessionIds) ? options.referencedSessionIds.map(String) : [])
  const durable = []
  const taskBacked = []
  const recovery = []

  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (session?.ephemeral !== true) {
      durable.push(session)
      continue
    }
    if (referencedSessionIds.has(String(session?.id || ''))) {
      taskBacked.push(session)
      continue
    }
    const taskId = String(session?.taskRef?.id || '').trim()
    if (taskId && referencedTaskIds.has(taskId)) {
      taskBacked.push(session)
      continue
    }
    const age = Math.max(0, now - timestamp(session?.updatedAt || session?.createdAt))
    if (age <= ttlMs) recovery.push(session)
  }

  recovery.sort((a, b) => timestamp(b?.updatedAt || b?.createdAt) - timestamp(a?.updatedAt || a?.createdAt))
  const keptIds = new Set([...durable, ...taskBacked, ...recovery.slice(0, maxOrphans)].map(item => String(item?.id || '')))
  const kept = (Array.isArray(sessions) ? sessions : []).filter(item => keptIds.has(String(item?.id || '')))
  return { sessions: kept, removedCount: Math.max(0, (sessions?.length || 0) - kept.length) }
}

function safeFileName(id) {
  return encodeURIComponent(String(id || '')).replace(/%/g, '_') || 'session'
}

function readJson(fs, file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function ensureDir(fs, dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeJson(fs, file, value) {
  ensureDir(fs, require('path').dirname(file))
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

function backupLegacyStore(fs, legacyFile, rootDir, migration) {
  if (!legacyFile || !fs.existsSync(legacyFile)) return ''
  const backupDir = require('path').join(rootDir, 'migration-backups')
  ensureDir(fs, backupDir)
  const base = `agent-sessions.pre-v2.${Date.now()}.json`
  const backupFile = require('path').join(backupDir, base)
  fs.renameSync(legacyFile, backupFile)
  writeJson(fs, legacyFile, {
    version: STORE_VERSION,
    migratedTo: require('path').relative(require('path').dirname(legacyFile), rootDir),
    backup: require('path').relative(require('path').dirname(legacyFile), backupFile),
    ...migration,
  })
  return backupFile
}

function createAgentSessionStore(options = {}) {
  const fs = options.fs || require('fs')
  const path = options.path || require('path')
  const legacyFile = String(options.legacyFile || '')
  const rootDir = String(options.rootDir || path.join(path.dirname(legacyFile), 'agent-sessions'))
  const sessionsDir = path.join(rootDir, 'sessions')
  const indexFile = path.join(rootDir, 'index.json')
  const agentSessions = options.agentSessions
  if (!agentSessions?.migrateStore || !agentSessions?.compactSession || !agentSessions?.normalizeUi) {
    throw new Error('agent_session_store_dependencies_missing')
  }

  let cache = null
  const persistedText = new Map()
  // Runtime checkpoints must not make Electron's main process wait on disk.
  // Keep writes ordered so a slower older snapshot can never overwrite a
  // newer checkpoint that was queued immediately after it.
  let asyncWriteChain = Promise.resolve()
  let persistVersion = 0

  const retention = (sessions, ui = {}) => pruneEphemeralSessions(sessions, {
    referencedTaskIds: readReferencedTaskIds(fs, options.taskFile),
    referencedSessionIds: new Set([
      ...(Array.isArray(ui?.openSessionIds) ? ui.openSessionIds.map(String) : []),
      String(ui?.activeSessionId || ''),
    ].filter(Boolean)),
    ttlMs: options.ephemeralTtlMs,
    maxOrphans: options.maxOrphanedEphemeral,
    now: options.now?.() || Date.now(),
  })

  const writeIndex = (sessions, ui, extra = {}) => {
    writeJson(fs, indexFile, {
      version: STORE_VERSION,
      sessions: sessions.map(session => ({
        id: session.id,
        file: `${safeFileName(session.id)}.json`,
        title: session.title,
        sessionKind: session.sessionKind,
        ephemeral: session.ephemeral === true,
        updatedAt: session.updatedAt,
      })),
      ui,
      ...extra,
    })
  }

  const persist = (sessions, ui, extra = {}) => {
    ensureDir(fs, sessionsDir)
    const activeFiles = new Set()
    for (const session of sessions) {
      const fileName = `${safeFileName(session.id)}.json`
      const file = path.join(sessionsDir, fileName)
      const text = JSON.stringify(session, null, 2)
      activeFiles.add(fileName)
      if (persistedText.get(session.id) !== text) {
        fs.writeFileSync(file, text, 'utf8')
        persistedText.set(session.id, text)
      }
    }
    if (fs.existsSync(sessionsDir)) {
      for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.json') && !activeFiles.has(entry.name)) {
          fs.rmSync(path.join(sessionsDir, entry.name), { force: true })
        }
      }
    }
    writeIndex(sessions, ui, extra)
  }

  const persistAsync = async (sessions, ui, extra = {}) => {
    const fsPromises = fs.promises
    if (!fsPromises?.mkdir || !fsPromises?.writeFile) {
      // Small injected test filesystems may intentionally expose only the
      // synchronous surface. Keep the API functional for those adapters.
      persist(sessions, ui, extra)
      return
    }
    await fsPromises.mkdir(sessionsDir, { recursive: true })
    const activeFiles = new Set()
    for (const session of sessions) {
      const fileName = `${safeFileName(session.id)}.json`
      const file = path.join(sessionsDir, fileName)
      const text = JSON.stringify(session, null, 2)
      activeFiles.add(fileName)
      if (persistedText.get(session.id) !== text) {
        await fsPromises.writeFile(file, text, 'utf8')
        persistedText.set(session.id, text)
      }
      // A large transcript can contain thousands of messages. Yield between
      // shards so renderer IPC and cancellation remain serviceable while the
      // durable snapshot is being written.
      await new Promise(resolve => setImmediate(resolve))
    }
    try {
      const entries = await fsPromises.readdir(sessionsDir, { withFileTypes: true })
      await Promise.all(entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json') && !activeFiles.has(entry.name))
        .map(entry => fsPromises.rm(path.join(sessionsDir, entry.name), { force: true })))
    } catch { /* cleanup is best effort; the next checkpoint retries it */ }
    await fsPromises.mkdir(path.dirname(indexFile), { recursive: true })
    await fsPromises.writeFile(indexFile, JSON.stringify({
      version: STORE_VERSION,
      sessions: sessions.map(session => ({
        id: session.id,
        file: `${safeFileName(session.id)}.json`,
        title: session.title,
        sessionKind: session.sessionKind,
        ephemeral: session.ephemeral === true,
        updatedAt: session.updatedAt,
      })),
      ui,
      ...extra,
    }, null, 2), 'utf8')
  }

  const enqueuePersistAsync = (sessions, ui, extra = {}) => {
    const version = ++persistVersion
    const task = asyncWriteChain.then(async () => {
      await persistAsync(sessions, ui, extra)
      // A legacy synchronous caller may have saved while this async write was
      // in flight. Repair the disk snapshot from the newest in-memory cache
      // before releasing the queue, preventing an older checkpoint from
      // winning the race on restart.
      if (version !== persistVersion && cache) {
        await persistAsync(cache.sessions, cache.ui)
      }
    })
    asyncWriteChain = task.catch(() => {})
    return task
  }

  const normalizeForSave = (sessions, ui) => {
    const retained = retention(Array.isArray(sessions) ? sessions : [], ui)
    const normalized = retained.sessions.map((session, index) => agentSessions.compactSession(session, index + 1).session)
    return {
      sessions: normalized,
      ui: agentSessions.normalizeUi(ui, normalized),
      removedCount: retained.removedCount,
    }
  }

  const migrateLegacy = () => {
    const raw = readJson(fs, legacyFile, { sessions: [], ui: {} })
    const migrated = agentSessions.migrateStore(raw)
    const next = normalizeForSave(migrated.sessions, migrated.ui)
    persist(next.sessions, next.ui, { migratedAt: new Date().toISOString(), removedEphemeralCount: next.removedCount })
    if (Array.isArray(raw?.sessions)) {
      backupLegacyStore(fs, legacyFile, rootDir, {
        sessionCount: next.sessions.length,
        removedEphemeralCount: next.removedCount,
      })
    }
    return next
  }

  const loadFromIndex = index => {
    const sessions = []
    for (const entry of Array.isArray(index?.sessions) ? index.sessions : []) {
      const fileName = String(entry?.file || `${safeFileName(entry?.id)}.json`)
      const raw = readJson(fs, path.join(sessionsDir, fileName), null)
      if (!raw) continue
      const normalized = agentSessions.compactSession(raw, sessions.length + 1).session
      sessions.push(normalized)
      persistedText.set(normalized.id, JSON.stringify(normalized, null, 2))
    }
    const retained = retention(sessions, index?.ui)
    const ui = agentSessions.normalizeUi(index?.ui, retained.sessions)
    if (retained.removedCount) persist(retained.sessions, ui, { prunedAt: new Date().toISOString(), removedEphemeralCount: retained.removedCount })
    return { sessions: retained.sessions, ui }
  }

  return {
    load() {
      if (cache) return cache
      const index = readJson(fs, indexFile, null)
      cache = index?.version === STORE_VERSION ? loadFromIndex(index) : migrateLegacy()
      return cache
    },
    save(sessions, ui) {
      // The executor checkpoints after every tool result. In the common case
      // only one session object changed, while normalizeForSave would walk and
      // compact every open conversation again. Reuse the cached normalized
      // sessions and compact only the changed slot; fall back to the complete
      // path when ordering, retention, or multiple sessions changed.
      persistVersion += 1
      if (cache && Array.isArray(sessions) && sessions.length === cache.sessions.length) {
        const changed = []
        let sameOrder = true
        for (let index = 0; index < sessions.length; index += 1) {
          if (sessions[index]?.id !== cache.sessions[index]?.id) sameOrder = false
          if (sessions[index] !== cache.sessions[index]) changed.push(index)
        }
        const retained = sameOrder ? retention(sessions, ui) : null
        if (sameOrder && retained && retained.removedCount === 0 && retained.sessions.length === sessions.length
          && changed.length <= 1) {
          const nextSessions = cache.sessions.slice()
          if (changed.length === 1) {
            const index = changed[0]
            nextSessions[index] = agentSessions.compactSession(sessions[index], index + 1).session
          }
          const nextUi = agentSessions.normalizeUi(ui, nextSessions)
          persist(nextSessions, nextUi)
          cache = { sessions: nextSessions, ui: nextUi }
          return cache
        }
      }
      const next = normalizeForSave(sessions, ui)
      persist(next.sessions, next.ui, next.removedCount ? { prunedAt: new Date().toISOString(), removedEphemeralCount: next.removedCount } : {})
      cache = { sessions: next.sessions, ui: next.ui }
      return cache
    },
    async saveAsync(sessions, ui) {
      // Compute and publish the in-memory snapshot synchronously, then queue
      // only the filesystem work. Callers can await this method when they need
      // the checkpoint durable, without blocking the Electron main thread.
      let next
      let extra = {}
      if (cache && Array.isArray(sessions) && sessions.length === cache.sessions.length) {
        const changed = []
        let sameOrder = true
        for (let index = 0; index < sessions.length; index += 1) {
          if (sessions[index]?.id !== cache.sessions[index]?.id) sameOrder = false
          if (sessions[index] !== cache.sessions[index]) changed.push(index)
        }
        const retained = sameOrder ? retention(sessions, ui) : null
        if (sameOrder && retained && retained.removedCount === 0 && retained.sessions.length === sessions.length
          && changed.length <= 1) {
          const nextSessions = cache.sessions.slice()
          if (changed.length === 1) {
            const index = changed[0]
            nextSessions[index] = agentSessions.compactSession(sessions[index], index + 1).session
          }
          next = { sessions: nextSessions, ui: agentSessions.normalizeUi(ui, nextSessions) }
        }
      }
      if (!next) {
        const normalized = normalizeForSave(sessions, ui)
        next = { sessions: normalized.sessions, ui: normalized.ui }
        if (normalized.removedCount) {
          extra = { prunedAt: new Date().toISOString(), removedEphemeralCount: normalized.removedCount }
        }
      }
      cache = next
      await enqueuePersistAsync(next.sessions, next.ui, extra)
      return cache
    },
    async flush() {
      await asyncWriteChain
    },
    paths: { rootDir, sessionsDir, indexFile, legacyFile },
  }
}

module.exports = {
  STORE_VERSION,
  DEFAULT_EPHEMERAL_TTL_MS,
  DEFAULT_MAX_ORPHANED_EPHEMERAL,
  taskIdsFromStore,
  pruneEphemeralSessions,
  createAgentSessionStore,
}
