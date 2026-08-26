import { describe, expect, it } from 'vitest'
import {
  isWorkbenchLaneSessionId,
  resolveKernelRole,
  workbenchExpertSessionId,
  workbenchRunSessionId,
  workbenchTaskRefForSessionId,
} from './dialogue-lanes'
import { finalizeGenerateReply, historyTurns, seedStreamingAssistant } from './agent-generate-contract'

describe('dialogue-lanes', () => {
  it('builds stable workbench session ids', () => {
    expect(workbenchExpertSessionId('writer/v1')).toBe('wb-expert-writer_v1')
    expect(workbenchRunSessionId('wf 1')).toBe('wb-run-wf_1')
    expect(isWorkbenchLaneSessionId('wb-expert-a')).toBe(true)
    expect(isWorkbenchLaneSessionId('s1')).toBe(false)
    expect(workbenchTaskRefForSessionId('wb-expert-a')).toEqual({ id: 'a', kind: 'expert-chat' })
    expect(workbenchTaskRefForSessionId('wb-run-x')).toEqual({ id: 'x', kind: 'workflow-chat' })
  })

  it('maps expert metadata to kernel role without using assistant tab', () => {
    expect(resolveKernelRole({ agentId: 'coding' })).toBe('coding')
    expect(resolveKernelRole({ category: '写作', name: '文案专家' })).toBe('writing')
    expect(resolveKernelRole({ name: '知识管家', category: '专家' })).toBe('steward')
    expect(resolveKernelRole({ name: '制作人' })).toBe('general')
  })
})

describe('agent-generate-contract', () => {
  it('seeds a v2 streaming assistant bubble', () => {
    const seeded = seedStreamingAssistant('wa-1', 'run_1')
    expect(seeded.streaming).toBe(true)
    expect(seeded.protocolVersion).toBe(2)
    expect(historyTurns([{ id: 'u', role: 'user', text: 'hi' }, seeded])).toEqual([
      { id: 'u', role: 'user', text: 'hi' },
    ])
  })

  it('finalizes committed text over invoke fallback', () => {
    const existing = { id: 'a', role: 'assistant' as const, text: '正文', v2AnswerCommitted: true }
    expect(finalizeGenerateReply(existing, {
      cancelled: false,
      resultError: '',
      resultText: 'invoke',
    }).text).toBe('正文')
  })
})
