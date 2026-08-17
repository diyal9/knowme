import { describe, expect, it } from 'vitest'
import { buildDaemonProcessTranscript, buildDaemonProgressCard } from '../../../domain/agent-daemon-process'

describe('agent-daemon-process', () => {
  it('builds progress + logs transcript', () => {
    const transcript = buildDaemonProcessTranscript('正在执行', ['line-1', 'line-2'], 'step ok')
    expect(transcript?.progress?.text).toBe('step ok')
    expect(transcript?.logs?.lines).toEqual(['line-1', 'line-2'])
  })

  it('builds compact progress card while generating', () => {
    const card = buildDaemonProgressCard('正在生成…', 12)
    expect(card?.kind).toBe('chat-progress')
    expect(card?.ratio).toBeGreaterThan(0)
  })
})
