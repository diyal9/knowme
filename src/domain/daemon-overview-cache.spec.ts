import { describe, expect, it } from 'vitest'
import { DAEMON_OVERVIEW_CACHE_TTL_MS, daemonOverviewCacheIsFresh } from './daemon-overview-cache'

describe('daemon overview cache', () => {
  it('keeps a recent snapshot fresh across quick surface switches', () => {
    expect(daemonOverviewCacheIsFresh({ loadedAt: 10_000 }, 10_000 + DAEMON_OVERVIEW_CACHE_TTL_MS - 1)).toBe(true)
  })

  it('refreshes stale and invalid snapshots', () => {
    expect(daemonOverviewCacheIsFresh({ loadedAt: 10_000 }, 10_000 + DAEMON_OVERVIEW_CACHE_TTL_MS)).toBe(false)
    expect(daemonOverviewCacheIsFresh(null)).toBe(false)
  })
})
