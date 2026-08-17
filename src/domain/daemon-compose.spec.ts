import { describe, expect, it } from 'vitest'
import {
  DAEMON_MIN_INTENT_CHARS,
  daemonComposeCanAttempt,
  daemonFilterTitle,
  selectableDaemonPaths,
} from './daemon-compose'

describe('daemon-compose', () => {
  it('keeps the baseline intent floor', () => {
    expect(DAEMON_MIN_INTENT_CHARS).toBe(20)
    expect(daemonFilterTitle('needs_you')).toBe('需要你处理')
  })

  it('requires an unlocked online path before submit', () => {
    expect(daemonComposeCanAttempt(true, { id: 'p1' }, false)).toBe(true)
    expect(daemonComposeCanAttempt(false, { id: 'p1' }, false)).toBe(false)
    expect(daemonComposeCanAttempt(true, { id: 'p1', locked: true }, false)).toBe(false)
  })

  it('lists curated paths in catalog order', () => {
    const paths = selectableDaemonPaths([
      { id: 'b', name: 'B', catalog: { visibility: 'more', order: 2 } },
      { id: 'a', name: 'A', catalog: { visibility: 'primary', order: 1 } },
    ])
    expect(paths.map((item) => item.id)).toEqual(['a', 'b'])
  })
})
