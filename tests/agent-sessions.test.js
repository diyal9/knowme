const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  createSession,
  compactSession,
  contextMessages,
  MAX_CONTEXT_CHARS,
  DEFAULT_TITLE,
  migrateStore,
  normalizeUi,
  buildSummaryText,
  buildResumeProjection,
  buildTranscriptText,
  sortOpenSessionIds,
  forkSession,
  sessionDisplayTitle,
  normalizeSession,
} = require('../src/lib/agent-sessions')

describe('agent sessions', () => {
  it('creates isolated sessions for different Agents', () => {
    const general = createSession('general', 1)
    const coding = createSession('coding', 1)
    assert.notEqual(general.id, coding.id)
    assert.equal(general.agentId, 'general')
    assert.equal(coding.agentId, 'coding')
    assert.equal(general.title, DEFAULT_TITLE)
  })

  it('exposes short agent labels without redundant Agent suffix', () => {
    const { AGENTS } = require('../src/lib/agent-sessions')
    assert.deepEqual(AGENTS.map(a => a.name), ['通用', '知识管家', '写作', '编程'])
  })

  it('uses mode name as empty session tab label', () => {
    const steward = createSession('steward', 1)
    const general = createSession('general', 1)
    const coding = createSession('coding', 1)
    assert.equal(sessionDisplayTitle(steward), '知识管家')
    assert.equal(sessionDisplayTitle(general), '通用')
    assert.equal(sessionDisplayTitle(coding), '编程')
    steward.run.goal = '检索远程知识库'
    assert.equal(sessionDisplayTitle(steward), '检索远程知识库')
  })

  it('compacts old messages while retaining recent context', () => {
    const session = createSession('general', 1)
    session.summary = ''
    session.messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      text: 'x'.repeat(1400) + i,
    }))
    const result = compactSession(session)
    assert.equal(result.compacted, true)
    assert.ok(result.session.summary.length > 0)
    assert.ok(result.session.messages.length <= 12)
    assert.ok(result.session.summary.length + result.session.messages.reduce((n, m) => n + m.text.length, 0) <= MAX_CONTEXT_CHARS)
    assert.ok(contextMessages(result.session).some(m => m.text.includes('会话历史摘要')))
  })

  it('preserves structured goal and tool facts during compaction', () => {
    const session = createSession('general', 1)
    session.messages = [
      ...Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        text: `${i}：${'前置上下文 '.repeat(80)}`,
      })),
      { role: 'user', text: '目标：完成项目交付' },
      { role: 'assistant', text: '已确认关键事实' },
      {
        role: 'tool',
        text: '知识库命中结果',
        toolName: 'search_knowledge',
        status: 'done',
      },
      ...Array.from({ length: 60 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        text: `${i}：${'后续上下文 '.repeat(350)}`,
      })),
    ]
    const result = compactSession(session)
    assert.equal(result.compacted, true)
    assert.match(result.session.summary, /当前目标/)
    assert.match(result.session.summary, /已执行工具与结果/)
  })

  it('migrates store without ui into open tabs', () => {
    const a = createSession('general', 1)
    const b = createSession('writing', 1)
    a.updatedAt = '2026-07-18T02:00:00.000Z'
    b.updatedAt = '2026-07-18T03:00:00.000Z'
    const store = migrateStore({ sessions: [a, b] })
    assert.ok(store.ui.openSessionIds.length >= 1)
    assert.ok(store.ui.openSessionIds.includes(b.id))
    assert.equal(store.ui.activeSessionId, store.ui.openSessionIds[0])
  })

  it('normalizes ui to drop missing session ids', () => {
    const s = createSession('general', 1)
    const ui = normalizeUi({ openSessionIds: [s.id, 'gone'], activeSessionId: 'gone' }, [s])
    assert.deepEqual(ui.openSessionIds, [s.id])
    assert.equal(ui.activeSessionId, s.id)
  })

  it('builds summary text and forks into a new session', () => {
    const source = createSession('general', 1)
    source.messages = [
      { role: 'user', text: '帮我写一篇笔记' },
      { role: 'assistant', text: '好的，这是大纲…' },
    ]
    const text = buildSummaryText(source)
    assert.ok(text.includes('帮我写一篇笔记'))
    const forked = forkSession(source)
    assert.notEqual(forked.id, source.id)
    assert.ok(forked.summary.includes('帮我写一篇笔记'))
    assert.equal(forked.messages.length, 0)
    assert.equal(sessionDisplayTitle(source), '帮我写一篇笔记')
  })

  it('builds a bounded resumable projection without transcript messages', () => {
    const session = createSession('general', 1, { goal: '继续整理项目资料' })
    session.summary = '当前进展：已完成资料收集\n下一步：整理结论'
    session.messages = [{ role: 'user', text: '不应通过 projection 泄露完整消息' }]
    const projection = buildResumeProjection(session)
    assert.equal(projection.id, session.id)
    assert.equal(projection.title, '继续整理项目资料')
    assert.match(projection.summary, /当前进展/)
    assert.equal(Object.hasOwn(projection, 'messages'), false)
    assert.ok(projection.summary.length <= 600)
  })

  it('builds full transcript and sorts pinned open tabs first', () => {
    const a = createSession('general', 1)
    const b = createSession('writing', 1)
    a.messages = [
      { role: 'user', text: '你好' },
      { role: 'assistant', text: '你好！有什么可以帮忙的？' },
    ]
    b.pinned = true
    const transcript = buildTranscriptText(a)
    assert.ok(transcript.includes('User:'))
    assert.ok(transcript.includes('你好'))
    assert.ok(transcript.includes('Assistant:'))
    assert.deepEqual(sortOpenSessionIds([a.id, b.id], [a, b]), [b.id, a.id])
    const ui = normalizeUi({ openSessionIds: [a.id, b.id], activeSessionId: a.id }, [a, b])
    assert.deepEqual(ui.openSessionIds, [b.id, a.id])
    assert.equal(createSession('general', 1).pinned, false)
  })

  it('persists safe trace and tool messages without restoring pending state', () => {
    const session = normalizeSession({
      id: 's_trace',
      agentId: 'general',
      messages: [
        { role: 'user', text: '查知识库' },
        {
          role: 'assistant',
          text: '找到结果',
          streaming: true,
          activity: '仍在执行',
          trace: [{ id: 't1', kind: 'tool', title: '搜索知识库', status: 'pending', summary: '2 条' }],
        },
        {
          role: 'tool',
          text: '结果摘要',
          toolCallId: 'call_1',
          toolName: 'search_knowledge',
          status: 'done',
          durationMs: 25,
        },
      ],
    })
    assert.equal(session.messages.length, 3)
    assert.equal(session.messages[1].trace[0].status, 'done')
    assert.equal(session.messages[1].streaming, undefined)
    assert.equal(session.messages[2].role, 'tool')
    assert.equal(session.messages[2].toolName, 'search_knowledge')
    assert.equal(contextMessages(session).some(m => m.role === 'tool'), false)
    assert.ok(buildTranscriptText(session).includes('Tool (search_knowledge)'))
  })
})
