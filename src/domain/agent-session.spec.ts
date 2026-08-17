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

  it('resolves default general tab label to 通用', () => {
    expect(resolveSessionTabLabel({ id: 's1', title: '新助手', agentId: 'general' })).toBe('通用')
    expect(resolveSessionTabLabel({ id: 's1', title: '新助手', displayTitle: '新助手' })).toBe('通用')
    expect(resolveSessionTabLabel({ id: 's2', title: '项目跟进' })).toBe('项目跟进')
    expect(resolveSessionTabLabel({
      id: 's3',
      title: '请为我做会议总结：总结最近三天与我相关的会议。',
    })).toBe('会议总结')
  })

  it('dedupes open session ids in order', () => {
    expect(dedupeOpenSessionIds(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })

  it('reads nested session payload and messages', () => {
    expect(parseSessionRecord({ ok: true, session: { id: 's1', title: '协作' } })?.title).toBe('协作')
    expect(chatMessagesFromSession({
      session: { messages: [{ id: 'u1', role: 'user', text: 'hi' }] },
    }).map((m) => m.text)).toEqual(['hi'])
  })

  it('extracts markdown and bare image urls', () => {
    expect(extractImageUrls('看 ![图](https://x.test/a.png) 和 https://x.test/b.jpg')).toEqual([
      'https://x.test/a.png',
      'https://x.test/b.jpg',
    ])
  })
})
