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
})
