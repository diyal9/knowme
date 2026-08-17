'use strict'

/**
 * Shared TTL + LRU eviction for in-memory runtime stores (processRegistry, artifactStore, runStates).
 */

function createEvictingMap(opts = {}) {
  const maxEntries = Number.isFinite(opts.maxEntries) ? opts.maxEntries : 500
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 24 * 60 * 60 * 1000
  const map = new Map()

  function touch(key, entry) {
    if (map.has(key)) map.delete(key)
    map.set(key, { ...entry, _accessedAt: Date.now() })
  }

  function purge(now = Date.now()) {
    for (const [key, entry] of map) {
      const created = entry.createdAt || entry.startedAt || entry._accessedAt || 0
      const terminal = entry.status && !['running', 'starting', 'pending'].includes(entry.status)
      const terminalAt = entry.endedAt || created
      const age = terminal ? now - terminalAt : now - created
      if (age > ttlMs) map.delete(key)
    }
    while (map.size > maxEntries) {
      const first = map.keys().next().value
      if (first === undefined) break
      map.delete(first)
    }
  }

  function set(key, entry) {
    touch(key, { ...entry, createdAt: entry.createdAt || Date.now() })
    purge()
  }

  function get(key) {
    purge()
    const entry = map.get(key)
    if (!entry) return null
    const created = entry.createdAt || entry.startedAt || 0
    const terminal = entry.status && !['running', 'starting', 'pending'].includes(entry.status)
    const terminalAt = entry.endedAt || created
    const age = Date.now() - (terminal ? terminalAt : created)
    if (age > ttlMs) {
      map.delete(key)
      return { expired: true, entry }
    }
    touch(key, entry)
    return entry
  }

  function getFriendly(key, labels = {}) {
    const hit = get(key)
    if (!hit) {
      return {
        ok: false,
        code: 'not_found',
        text: labels.notFound || '记录不存在或已清理',
        message: labels.notFound || 'Run 已结束或已清理',
      }
    }
    if (hit.expired) {
      return {
        ok: false,
        code: 'expired',
        text: labels.expired || '记录已过期，请重新发起',
        message: labels.expired || '任务已过期',
      }
    }
    return { ok: true, entry: hit }
  }

  return { map, set, get, getFriendly, purge, maxEntries, ttlMs }
}

/** Map 兼容薄封装：value 为事件数组，供 workbenchAgentRunEvents 等有界存储。 */
function createEvictingEventMap(opts = {}) {
  const store = createEvictingMap(opts)
  return {
    get(key) {
      // 走 store.get 以触发 TTL purge；勿直读 map 绕过淘汰。
      const hit = store.get(String(key))
      if (!hit || hit.expired) return undefined
      return hit.events
    },
    set(key, events) {
      const id = String(key)
      const prev = store.map.get(id)
      store.set(id, {
        events: Array.isArray(events) ? events : [],
        createdAt: prev?.createdAt || Date.now(),
      })
    },
  }
}

module.exports = {
  createEvictingMap,
  createEvictingEventMap,
}
