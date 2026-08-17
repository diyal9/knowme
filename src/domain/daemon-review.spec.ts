import { describe, expect, it } from 'vitest'
import { extractGateInfo, normalizeLogLines, projectProcessTranscript } from './daemon-review'

describe('daemon-review domain', () => {
  it('normalizes log lines and drops empty sentinel', () => {
    expect(normalizeLogLines('(no log yet)')).toEqual([])
    expect(normalizeLogLines('line1\nline2')).toEqual(['line1', 'line2'])
  })

  it('projects process transcript', () => {
    const view = projectProcessTranscript({ progressText: 'step 1', logsText: 'log a' })
    expect(view.progress.text).toBe('step 1')
    expect(view.logs.lines).toEqual(['log a'])
  })

  it('extracts gate node from daemon payload', () => {
    expect(extractGateInfo({ node: 'gate-1', title: '审阅产出' })).toEqual({
      node: 'gate-1',
      title: '审阅产出',
    })
  })
})
