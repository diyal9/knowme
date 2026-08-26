import { describe, expect, it } from 'vitest'
import { workflowRunProjection } from './store-workbench-helpers'

describe('workflowRunProjection', () => {
  it('projects completed node summaries into viewable workflow results', () => {
    const projection = workflowRunProjection(
      {
        graph: {
          nodes: [
            { id: 'expert', type: 'agent', name: '办公协作专家' },
            { id: 'end', type: 'terminal', name: '完成' },
          ],
        },
      },
      {
        root: { status: 'completed' },
        events: [{
          type: 'workbench.graph.terminal',
          result: {
            results: {
              expert: { summary: '已整理待办、负责人和截止时间。' },
              end: { summary: 'workflow completed' },
            },
          },
        }],
      },
    )

    expect(projection.phase).toBe('done')
    expect(projection.graphNodes[0].outputLabel).toBe('已整理待办、负责人和截止时间。')
  })

  it('recovers nodes and results from a persisted run tree without an in-memory package', () => {
    const projection = workflowRunProjection(null, {
      rootRunId: 'root-1',
      root: { runId: 'root-1', status: 'done', summary: '运行完成' },
      nodes: {
        'root-1': { runId: 'root-1', status: 'done' },
        'child-1': {
          runId: 'child-1',
          status: 'done',
          summary: '已生成飞书消息处理清单。',
          expertId: 'office-partner',
          meta: { workflowNodeId: 'office', expertId: 'office-partner' },
        },
      },
      events: [],
    })

    expect(projection.phase).toBe('done')
    expect(projection.graphNodes).toHaveLength(1)
    expect(projection.graphNodes[0]).toMatchObject({
      id: 'office',
      label: 'office-partner',
      status: 'done',
      outputLabel: '已生成飞书消息处理清单。',
    })
  })

  it('does not leave interrupted runs looking active after a process restart', () => {
    const projection = workflowRunProjection(
      { graph: { nodes: [{ id: 'psd_intake', type: 'agent', name: 'PSD 读取' }] } },
      { status: 'INTERRUPTED', nodes: {}, events: [] },
    )

    expect(projection.phase).toBe('done')
    expect(projection.status).toBe('INTERRUPTED')
    expect(projection.graphNodes[0].status).toBe('failed')
  })

  it('keeps a failed node reason available to the recovery interface', () => {
    const projection = workflowRunProjection(
      { graph: { nodes: [{ id: 'psd_read', type: 'action', name: '读取 PSD' }] } },
      {
        root: { status: 'failed' },
        events: [{
          type: 'workbench.graph.terminal',
          result: {
            results: {
              psd_read: { status: 'failed', code: 'psd_not_found', message: '没有找到指定的 PSD 文件' },
            },
          },
        }],
      },
    )

    expect(projection.graphNodes[0]).toMatchObject({
      status: 'failed',
      outputLabel: '没有找到指定的 PSD 文件',
    })
  })
})
