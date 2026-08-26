import { describe, expect, it } from 'vitest'
import {
  applyRuntimeStreamEvent,
  buildAgentGeneratePayload,
  createAgentRunId,
  extractSkillRefs,
  isV2StreamEvent,
  renderAgentMarkdown,
  unwrapCjsApi,
} from './agent-v2-runtime'

describe('agent-v2-runtime', () => {
  const turn = {
    userMessageId: 'user-1',
    assistantMessageId: 'assistant-1',
    userCreatedAt: '2026-08-26T00:00:00.000Z',
  }

  it('builds generate payload with runId, agentId, grounding and skill refs', () => {
    const runId = createAgentRunId()
    const payload = buildAgentGeneratePayload({
      prompt: '/summarize 帮我总结会议',
      sessionId: 's1',
      agentId: 'general',
      runId,
      history: [],
      turn,
    })
    expect(payload.runId).toBe(runId)
    expect(payload.turn).toEqual(turn)
    expect(payload.sessionId).toBe('s1')
    expect(payload.agentId).toBe('general')
    expect(payload.skillRefs).toEqual(['summarize'])
    expect(payload.contentGrounding).toBeTruthy()
    expect(payload.surface).toBe('assistant')
  })

  it('passes workbench lane role without mixing assistant session id', () => {
    const payload = buildAgentGeneratePayload({
      prompt: '对齐目标',
      sessionId: 'wb-expert-writer',
      agentId: 'writing',
      role: 'writing',
      expertId: 'writer',
      surface: 'workbench',
      taskRef: { id: 'writer', kind: 'expert-chat' },
      runId: createAgentRunId(),
      history: [],
      turn,
    })
    expect(payload.sessionId).toBe('wb-expert-writer')
    expect(payload.role).toBe('writing')
    expect(payload.expertId).toBe('writer')
    expect(payload.surface).toBe('workbench')
  })

  it('marks expert discussion as a tool-free collaboration request', () => {
    const payload = buildAgentGeneratePayload({
      prompt: '解释当前成果',
      sessionId: 'wb-expert-task-discussion-v2',
      agentId: 'general',
      role: 'general',
      surface: 'workbench',
      taskRef: { id: 'task-1', kind: 'expert-discussion' },
      conversationMode: 'expert-discussion',
      expertDiscussionContext: {
        taskId: 'task-1', goal: '解释成果', status: 'review', resultSummary: '', deliverables: [], recentEvents: [],
      },
      runId: createAgentRunId(),
      history: [],
      turn,
    })
    expect(payload.conversationMode).toBe('expert-discussion')
    expect(payload.agentId).toBe('general')
    expect(payload.expertDiscussionContext).toMatchObject({ taskId: 'task-1', goal: '解释成果' })
    expect(payload.taskRef).toEqual({ id: 'task-1', kind: 'expert-discussion' })
  })

  it('reduces v2 stage + answer.committed onto the message', () => {
    const message = {
      id: 'a1',
      role: 'assistant' as const,
      text: '',
      streaming: true,
      thinking: true,
      runId: 'run_1',
      protocolVersion: 2,
      startedAt: Date.now(),
      trace: [],
    }
    const afterStage = applyRuntimeStreamEvent(message, {
      version: 2,
      seq: 1,
      runId: 'run_1',
      type: 'stage',
      payload: { id: 'stage_prepare', title: '上下文准备完成', status: 'done' },
    })
    expect(isV2StreamEvent({ version: 2 })).toBe(true)
    expect(afterStage.trace?.some((item) => item.id === 'stage_prepare')).toBe(true)
    const afterAnswer = applyRuntimeStreamEvent(afterStage, {
      version: 2,
      seq: 2,
      runId: 'run_1',
      type: 'answer.committed',
      payload: { text: '## 结论\n- 已完成', hash: 'h1' },
    })
    expect(afterAnswer.text).toContain('结论')
    expect(renderAgentMarkdown(afterAnswer.text)).toContain('<h2')
  })

  it('renders assistant markdown lists and emphasis instead of raw asterisks', () => {
    const html = renderAgentMarkdown('1. **Data Server Host**\n2. **Dynamic Skill Hit**')
    expect(html).toContain('<ol>')
    expect(html).toContain('<strong>Data Server Host</strong>')
    expect(html).not.toMatch(/\*\*Data/)
  })

  it('extracts slash skills', () => {
    expect(extractSkillRefs('请 /search 一下', ['note'])).toEqual(['note', 'search'])
  })

  it('unwraps nested Vite CJS default namespaces', () => {
    const api = { buildGrounding: () => ({ active: false }) }
    expect(unwrapCjsApi<{ buildGrounding: () => unknown }>({ default: { default: api } }, 'buildGrounding').buildGrounding()).toEqual({ active: false })
  })

  it('commits answer when seq/version arrive as strings or reducer ignores the event', () => {
    const message = {
      id: 'a1',
      role: 'assistant' as const,
      text: '',
      streaming: true,
      thinking: true,
      runId: 'run_1',
      protocolVersion: 2,
    }
    const next = applyRuntimeStreamEvent(message, {
      version: '2',
      seq: '3',
      runId: 'run_other',
      type: 'answer.committed',
      payload: { text: '字符串序号也能落正文', hash: 'h2' },
    })
    expect(next.text).toBe('字符串序号也能落正文')
    expect(next.v2AnswerCommitted).toBe(true)
  })
})
