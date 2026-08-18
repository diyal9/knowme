/**
 * 渲染进程会话 LRU（与主进程 workspace-lru-cache 行为一致）。
 */

function estimateBytes(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'string') return value.length
  try { return JSON.stringify(value).length } catch { return 0 }
}

export function createSessionLru(opts: { maxEntries?: number; maxBytes?: number } = {}) {
  const maxEntries = Math.max(1, opts.maxEntries || 32)
  // 测试与小缓存允许 <1KB；未传时默认 8MB。禁止把 8 抬成 1024 导致超大条目误写入。
  const rawBytes = opts.maxBytes
  const maxBytes = typeof rawBytes === 'number' && Number.isFinite(rawBytes) ? Math.max(1, rawBytes) : 8 * 1024 * 1024
  const map = new Map<string, { value: unknown; bytes: number }>()
  let bytes = 0
  function evict() {
    while (map.size > maxEntries || bytes > maxBytes) {
      const first = map.keys().next().value
      if (first == null) break
      const row = map.get(first)
      map.delete(first)
      bytes -= row?.bytes || 0
    }
  }
  return {
    get(key: string) {
      if (!key || !map.has(key)) return undefined
      const row = map.get(key)!
      map.delete(key)
      map.set(key, row)
      return row.value
    },
    set(key: string, value: unknown) {
      if (!key) return false
      const size = estimateBytes(value)
      if (size > maxBytes) return false
      if (map.has(key)) {
        bytes -= map.get(key)!.bytes
        map.delete(key)
      }
      map.set(key, { value, bytes: size })
      bytes += size
      evict()
      return true
    },
    clear() {
      map.clear()
      bytes = 0
    },
  }
}
