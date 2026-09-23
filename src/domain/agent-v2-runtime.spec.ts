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

  it('separates adjacent Feishu links before sending any conversation surface to the runtime', () => {
    const href = 'https://example.feishu.cn/wiki/BdKrdR019oCv5bxpnFlc4TTnpkh'
    const payload = buildAgentGeneratePayload({
      prompt: `${href}这个飞书文档`,
      displayPrompt: `${href}这个飞书文档`,
      sessionId: 's1',
      agentId: 'general',
      runId: createAgentRunId(),
      history: [],
      turn,
    })
    expect(payload.prompt).toBe(`${href} 这个飞书文档`)
    expect(payload.displayPrompt).toBe(`${href}这个飞书文档`)
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

  it('normalizes string seq/version and rejects a mismatched V2 run without fallback', () => {
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
    expect(next.text).toBe('')
    expect(next.v2AnswerCommitted).not.toBe(true)
    expect((next as any).messageState?.diagnostics?.at(-1)?.code).toBe('run_mismatch')
  })

  it('ignores duplicate answer.committed events after the first commit', () => {
    const message = {
      id: 'a1',
      role: 'assistant' as const,
      text: '',
      streaming: true,
      thinking: true,
      runId: 'run_1',
      protocolVersion: 2,
    }
    const first = applyRuntimeStreamEvent(message, {
      version: 2,
      seq: 1,
      runId: 'run_1',
      type: 'answer.committed',
      payload: { text: '唯一答案', hash: 'h1' },
    })
    const duplicate = applyRuntimeStreamEvent(first, {
      version: 2,
      seq: 1,
      runId: 'run_1',
      type: 'answer.committed',
      payload: { text: '重复答案', hash: 'h2' },
    })
    expect(first.text).toBe('唯一答案')
    expect(duplicate.text).toBe('唯一答案')
    expect((duplicate as any).answerHash).toBe('h1')
    expect((duplicate as any).v2AnswerCommitted).toBe(true)
  })

  it('keeps late, gap, frozen and unsupported decisions inside the V2 state machine', () => {
    const seed = {
      id: 'a1', role: 'assistant' as const, text: '', streaming: true, thinking: true,
      runId: 'run_2', protocolVersion: 2,
    }
    const gapped = applyRuntimeStreamEvent(seed, {
      version: 2, seq: 3, runId: 'run_2', type: 'stage', payload: { id: 'stage', title: '准备' },
    })
    expect((gapped as any).messageState?.counters?.gap).toBe(1)
    const late = applyRuntimeStreamEvent(gapped, {
      version: 2, seq: 1, runId: 'run_2', type: 'answer.committed', payload: { text: '迟到答案', hash: 'late' },
    })
    expect(late.text).toBe('')
    expect((late as any).messageState?.counters?.late).toBe(1)

    const completed = applyRuntimeStreamEvent(gapped, {
      version: 2, seq: 4, runId: 'run_2', type: 'run.completed', payload: { summary: '完成' },
    })
    const frozen = applyRuntimeStreamEvent(completed, {
      version: 2, seq: 5, runId: 'run_2', type: 'answer.committed', payload: { text: '终态后答案', hash: 'frozen' },
    })
    expect(frozen.text).not.toContain('终态后答案')
    expect((frozen as any).messageState?.diagnostics?.at(-1)?.code).toBe('ignored_after_terminal')

    const unsupported = applyRuntimeStreamEvent(seed, {
      version: 1, seq: 1, runId: 'run_2', type: 'answer.committed', payload: { text: '旧协议正文', hash: 'v1' },
    })
    expect(unsupported.text).not.toContain('旧协议正文')
    expect((unsupported as any).messageState?.status).toBe('failed')
    expect((unsupported as any).messageState?.diagnostics?.at(-1)?.code).toBe('unsupported_version')
  })

  it('does not replay a persisted canonical answer after reducer state is rebuilt', () => {
    const restored = {
      id: 'a1', role: 'assistant' as const, text: '已持久化答案', streaming: true, thinking: true,
      runId: 'run_restore', protocolVersion: 2, answerHash: 'canonical-hash', v2AnswerCommitted: true,
    }
    const next = applyRuntimeStreamEvent(restored, {
      version: 2, seq: 9, runId: 'run_restore', type: 'answer.committed',
      payload: { text: '重放答案', hash: 'replay-hash' },
    })
    expect(next.text).toBe('已持久化答案')
    expect((next as any).answerHash).toBe('canonical-hash')
    expect(next.streaming).toBe(false)
  })

  it('fails closed when a V2 reducer state is malformed', () => {
    const malformed = {
      id: 'a1', role: 'assistant' as const, text: '已有正文', streaming: true, thinking: true,
      runId: 'run_bad_state', protocolVersion: 2,
      messageState: { runId: 'run_bad_state', timeline: null },
    }
    const next = applyRuntimeStreamEvent(malformed, {
      version: 2, seq: 1, runId: 'run_bad_state', type: 'answer.committed',
      payload: { text: '不应回退的正文', hash: 'bad-state' },
    })
    expect(next.text).toBe('已有正文')
    expect((next as any).v2AnswerCommitted).not.toBe(true)
  })

  it('restores a persisted canonical answer and keeps legacy-only events compatible', () => {
    const restored = {
      id: 'assistant-refresh', role: 'assistant' as const, text: '刷新后仍是唯一答案',
      protocolVersion: 2, answerHash: 'refresh-hash', v2AnswerCommitted: true,
      streaming: true, thinking: true,
    }
    const replayed = applyRuntimeStreamEvent(restored, {
      version: 2, seq: 4, runId: 'run_refresh', type: 'answer.committed',
      payload: { text: '不应再次插入', hash: 'replay' },
    })
    expect(replayed.text).toBe('刷新后仍是唯一答案')
    expect(replayed.streaming).toBe(false)

    const legacy = applyRuntimeStreamEvent({
      id: 'assistant-legacy', role: 'assistant' as const, text: '', streaming: true,
    }, { type: 'stage', title: '旧协议阶段事件' })
    expect(legacy.activity).toBe('旧协议阶段事件')
  })
})
