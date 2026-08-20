import { describe, expect, it } from 'vitest'
import { projectPipelineTaskAttention } from './pipeline-task-attention'

describe('projectPipelineTaskAttention', () => {
  it('turns pending clarification into a concise next action', () => {
    const attention = projectPipelineTaskAttention({
      phase: 'running',
      clarifyNode: 'n3-proto',
      daemonStatus: 'waiting',
      graphNodes: [{ id: 'n3-proto', label: '原型设计' }],
      log: ['[22:22:18] ALERT: Workflow 暂停待人工 · **原因**: NEED_INPUT 超时未收到澄清'],
    })

    expect(attention).toMatchObject({
      kind: 'clarification',
      statusLabel: '等待补充',
      canClarify: true,
    })
    expect(attention?.body).toBe('步骤「原型设计」等待补充信息超时，当前已暂停。')
    expect(attention?.body).not.toContain('ALERT')
    expect(attention?.nextAction).not.toContain('run --workflow')
  })

  it('offers recovery when a paused log has no active clarification node', () => {
    expect(projectPipelineTaskAttention({
      phase: 'running',
      log: ['NEED_INPUT 超时未收到澄清，Workflow 暂停待人工'],
    })).toMatchObject({
      kind: 'paused',
      statusLabel: '需要处理',
      canRestart: true,
    })
  })

  it('does not interrupt a normally running task', () => {
    expect(projectPipelineTaskAttention({
      phase: 'running',
      daemonStatus: 'running',
      log: ['正在执行步骤 2'],
    })).toBeNull()
  })
})
