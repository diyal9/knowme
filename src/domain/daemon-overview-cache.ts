export const DAEMON_OVERVIEW_CACHE_TTL_MS = 20_000

export function daemonOverviewCacheIsFresh(
  cache: { loadedAt: number } | null | undefined,
  now = Date.now(),
  ttlMs = DAEMON_OVERVIEW_CACHE_TTL_MS,
): boolean {
  if (!cache || !Number.isFinite(cache.loadedAt) || cache.loadedAt <= 0) return false
  return Math.max(0, now - cache.loadedAt) < ttlMs
}
