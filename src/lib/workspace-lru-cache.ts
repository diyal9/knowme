'use strict'

/**
 * 会话内 LRU：条数 + 合计字节上限。刷新/关窗由调用方 clear。
 */

function estimateBytes(value: unknown) {
  if (value == null) return 0
  if (typeof value === 'string') return value.length
  try {
    return JSON.stringify(value).length
  } catch {
    return 0
  }
}

function createLruCache(opts: { maxEntries?: number; maxBytes?: number } = {}) {
  const maxEntries = Number.isFinite(opts.maxEntries) ? Math.max(1, opts.maxEntries) : 32
  // 下限 1 字节：测试用 8 字节上限必须能拒绝更大条目，不能抬成 1024。
  const maxBytes = Number.isFinite(opts.maxBytes) ? Math.max(1, opts.maxBytes) : 8 * 1024 * 1024
  /** @type {Map<string, { value: unknown, bytes: number }>} */
  const map = new Map()
  let bytes = 0

  function evictIfNeeded() {
    while (map.size > maxEntries || bytes > maxBytes) {
      const first = map.keys().next().value
      if (first == null) break
      const row = map.get(first)
      map.delete(first)
      bytes -= row?.bytes || 0
    }
  }

  return {
    get(key) {
      const id = String(key || '')
      if (!id || !map.has(id)) return undefined
      const row = map.get(id)
      map.delete(id)
      map.set(id, row)
      return row.value
    },
    set(key, value) {
      const id = String(key || '')
      if (!id) return false
      const size = estimateBytes(value)
      if (size > maxBytes) return false
      if (map.has(id)) {
        bytes -= map.get(id).bytes
        map.delete(id)
      }
      map.set(id, { value, bytes: size })
      bytes += size
      evictIfNeeded()
      return true
    },
    clear() {
      map.clear()
      bytes = 0
    },
    size() { return map.size },
    bytes() { return bytes },
  }
}

module.exports = { createLruCache, estimateBytes }
