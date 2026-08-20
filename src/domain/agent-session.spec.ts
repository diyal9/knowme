import { describe, expect, it } from 'vitest'
import {
  chatMessagesFromSession,
  dedupeOpenSessionIds,
  extractImageUrls,
  filterAgentSurfaceSessions,
  isAssistantLaunchEmpty,
  isWorkbenchOwnedSession,
  parseSessionList,
  parseSessionRecord,
  resolveSessionTabLabel,
} from './agent-session'

describe('agent session helpers', () => {
  it('parses list + ui open tabs', () => {
    const parsed = parseSessionList({
      sessions: [
        { id: 'a', title: 'A', pinned: true },
        { id: 'b', displayTitle: 'B' },
      ],
      ui: { openSessionIds: ['b', 'a'], activeSessionId: 'b' },
    })
    expect(parsed.tabs.map((s) => s.id)).toEqual(['b', 'a'])
    expect(parsed.activeId).toBe('b')
    expect(parsed.tabs[1].pinned).toBe(true)
  })

  it('parses run.artifacts on session records', () => {
    const session = parseSessionRecord({
      id: 's1',
      title: '对话',
      run: {
        goal: '写文件',
        artifacts: [{
          id: 'art-1',
          type: 'editor_patch',
          title: '替换',
          body: 'hello',
          status: 'draft',
          meta: { sourceId: 'src', path: 'a.md', mode: 'replace' },
        }],
      },
    })
    expect(session?.run?.artifacts?.[0]).toMatchObject({
      id: 'art-1',
      type: 'editor_patch',
      targetPath: 'a.md',
      meta: { sourceId: 'src', path: 'a.md', mode: 'replace' },
    })
  })

  it('dedupes repeated openSessionIds', () => {
    const parsed = parseSessionList({
      sessions: [{ id: 's1', title: '三元礼包' }],
      ui: { openSessionIds: ['s1', 's1', 's1'], activeSessionId: 's1' },
    })
    expect(parsed.tabs).toHaveLength(1)
    expect(parsed.tabs[0].title).toBe('三元礼包')
  })

  it('filters workbench-owned sessions from agent tabs', () => {
    const parsed = parseSessionList({
      sessions: [
        { id: 'a1', title: '日常协作' },
        { id: 'w1', title: '工作台 - Daemon 调试', taskRef: { id: 't1', kind: 'workflow-chat' } },
      ],
      ui: { openSessionIds: ['a1', 'w1'], activeSessionId: 'w1' },
    })
    expect(parsed.tabs.map((item) => item.id)).toEqual(['a1'])
    expect(parsed.activeId).toBe('a1')
    expect(filterAgentSurfaceSessions([
      { id: 'a1', title: '日常协作' },
      { id: 'wb-expert-writer', title: '新助手' },
    ]).map((item) => item.id)).toEqual(['a1'])
    expect(isWorkbenchOwnedSession({ id: 'w1', title: '工作台 - Daemon 调试' })).toBe(true)
    expect(isWorkbenchOwnedSession({ id: 'wb-expert-writer', title: '新助手' })).toBe(true)
  })

  it('treats assistant launch as empty until a user turn exists', () => {
    expect(isAssistantLaunchEmpty([])).toBe(true)
    expect(isAssistantLaunchEmpty([
      { id: 'a1', role: 'assistant', text: '您好，我是 KnowMe…' },
    ])).toBe(true)
    expect(isAssistantLaunchEmpty([
      { id: 'u1', role: 'user', text: '你好' },
    ])).toBe(false)
  })

  it('resolves default personal tab label to 新主题', () => {
    expect(resolveSessionTabLabel({ id: 's1', title: '新助手', agentId: 'general' })).toBe('新主题')
    expect(resolveSessionTabLabel({ id: 's1', title: '新助手', displayTitle: '新助手' })).toBe('新主题')
    expect(resolveSessionTabLabel({ id: 's1', title: 'New Agent', agentId: 'general' })).toBe('新主题')
    expect(resolveSessionTabLabel({ id: 's2', title: '项目跟进' })).toBe('项目跟进')
    expect(resolveSessionTabLabel({
      id: 's3',
      title: '请为我做会议总结：总结最近三天与我相关的会议。',
    })).toBe('会议总结')
    expect(resolveSessionTabLabel({ id: 's4', title: '新主题', sessionKind: 'personal-topic' }, {
      firstUserText: '请整理本周项目风险并生成同步稿',
    })).toBe('请整理本周项目风险并生成同步稿')
    expect(resolveSessionTabLabel({ id: 's5', title: '新主题' }, { firstUserText: '你好' })).toBe('新主题')
  })

  it('dedupes open session ids in order', () => {
    expect(dedupeOpenSessionIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('reads nested session payload and messages', () => {
    expect(parseSessionRecord({ ok: true, session: { id: 's1', title: '协作' } })?.title).toBe('协作')
    expect(parseSessionRecord({
      id: 's2',
      title: '协作',
      updatedAt: '2026-08-18T02:00:00.000Z',
    })?.updatedAt).toBe('2026-08-18T02:00:00.000Z')
    expect(chatMessagesFromSession({
      session: { messages: [{ id: 'u1', role: 'user', text: 'hi' }] },
    }).map((m) => m.text)).toEqual(['hi'])
  })

  it('does not replay persisted tool payloads as assistant messages', () => {
    expect(chatMessagesFromSession({
      session: {
        messages: [
          { id: 'u1', role: 'user', text: '读取网页' },
          { id: 't1', role: 'tool', toolName: 'fetch_web_page', text: '{"ok":true,"data":{}}' },
          { id: 'a1', role: 'assistant', text: '已整理网页内容。' },
        ],
      },
    }).map((m) => m.text)).toEqual(['读取网页', '已整理网页内容。'])
  })

  it('extracts markdown and bare image urls', () => {
    expect(extractImageUrls('看 ![图](https://x.test/a.png) 和 https://x.test/b.jpg')).toEqual([
      'https://x.test/a.png',
      'https://x.test/b.jpg',
    ])
  })
})
