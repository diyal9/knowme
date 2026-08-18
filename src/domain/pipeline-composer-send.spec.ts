import { describe, expect, it } from 'vitest'
import { pipelineComposerReceipt, planPipelineComposerSend } from './pipeline-composer-send'
import { parsePendingClarifyNode } from './run-projection'

describe('planPipelineComposerSend', () => {
  it('keeps expert rooms on the LLM path', () => {
    expect(planPipelineComposerSend({ expertRoom: true, text: '帮我写纪要' })).toEqual({ kind: 'llm' })
  })

  it('submits clarify answers to Daemon instead of LLM', () => {
    const plan = planPipelineComposerSend({
      run: { lane: 'pipeline', clarifyNode: 'n-q1', gateNode: 'g1', phase: 'hitl' },
      text: '补充材料已放仓库',
    })
    expect(plan).toEqual({ kind: 'clarify', node: 'n-q1', answer: '补充材料已放仓库' })
    expect(pipelineComposerReceipt(plan)).toBe('已提交澄清答复。')
  })

  it('sends HITL free text as gate revise', () => {
    const plan = planPipelineComposerSend({
      run: { lane: 'pipeline', clarifyNode: null, gateNode: 'gate-1', phase: 'hitl' },
      text: '请改标题',
    })
    expect(plan).toEqual({ kind: 'gate-revise', node: 'gate-1', comment: '请改标题' })
  })

  it('acks running pipeline messages locally', () => {
    const plan = planPipelineComposerSend({
      run: { lane: 'pipeline', clarifyNode: null, gateNode: null, phase: 'running' },
      text: '?',
    })
    expect(plan.kind).toBe('ack')
    if (plan.kind === 'ack') expect(plan.text).toContain('已记下')
  })

  it('keeps workflow task rooms on the LLM path', () => {
    expect(planPipelineComposerSend({
      run: { lane: 'workflow', phase: 'running' },
      text: '你好',
    })).toEqual({ kind: 'llm' })
  })

  it('ignores empty composer', () => {
    expect(planPipelineComposerSend({ run: { phase: 'running' }, text: '  ' })).toEqual({ kind: 'empty' })
  })
})

describe('parsePendingClarifyNode', () => {
  it('reads the first pending clarification node', () => {
    expect(parsePendingClarifyNode({
      pending_clarifications: [{ node: 'n-q1', questions: ['缺材料'] }],
    })).toBe('n-q1')
    expect(parsePendingClarifyNode({ task: { pendingClarifications: [{ node_id: 'n2' }] } })).toBe('n2')
    expect(parsePendingClarifyNode({ ok: true })).toBeNull()
  })
})
