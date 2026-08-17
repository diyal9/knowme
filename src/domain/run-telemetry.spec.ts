import { describe, expect, it } from 'vitest'
import {
  nextRunPhase,
  parseDaemonArtifacts,
  parseDaemonLogs,
  parseLaunchSlug,
  runNextAction,
  runProgressLabel,
  runStatusSummary,
} from './run-telemetry'

describe('run telemetry', () => {
  it('parses launch slug, logs, artifacts and phase', () => {
    expect(parseLaunchSlug({ intent: { slug: 's1' } }, 'fallback')).toBe('s1')
    const logs = parseDaemonLogs({
      lines: ['a', 'b'],
      progress: '20%',
      status: 'running',
      gate: { node: 'g1', title: '审阅' },
    })
    expect(logs.gate?.node).toBe('g1')
    expect(nextRunPhase('running', logs.status, logs.gate)).toBe('hitl')
    expect(nextRunPhase('running', 'completed', null)).toBe('done')
    expect(nextRunPhase('done', '', null)).toBe('done')
    expect(parseDaemonArtifacts({ items: [{ id: '1', name: 'out.md' }] })).toEqual([{ id: '1', name: 'out.md' }])
  })

  it('formats run room labels for UI', () => {
    expect(runProgressLabel('running', '40%')).toBe('40%')
    expect(runProgressLabel('hitl', '')).toBe('等待确认')
    expect(runStatusSummary({ phase: 'hitl', log: [], gateTitle: '审阅产出' })).toContain('审阅产出')
    expect(runNextAction({ phase: 'done', gateTitle: null })).toContain('再跑')
  })
})
