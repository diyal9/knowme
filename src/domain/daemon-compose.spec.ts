import { describe, expect, it } from 'vitest'
import {
  DAEMON_MIN_INTENT_CHARS,
  daemonComposeCanAttempt,
  daemonFilterTitle,
  daemonPathCategoryLabel,
  daemonPathTags,
  daemonRunCards,
  daemonTaskTimeLabel,
  groupDaemonPaths,
  selectableDaemonPaths,
} from './daemon-compose'

describe('daemon-compose', () => {
  it('keeps the baseline intent floor', () => {
    expect(DAEMON_MIN_INTENT_CHARS).toBe(20)
    expect(daemonFilterTitle('needs_you')).toBe('需要你处理')
  })

  it('requires an unlocked online path before submit', () => {
    expect(daemonComposeCanAttempt(true, { id: 'p1' }, false)).toBe(true)
    expect(daemonComposeCanAttempt(false, { id: 'p1' }, false)).toBe(false)
    expect(daemonComposeCanAttempt(true, { id: 'p1', locked: true }, false)).toBe(false)
  })

  it('lists curated paths in catalog order', () => {
    const paths = selectableDaemonPaths([
      { id: 'b', name: 'B', catalog: { visibility: 'more', order: 2 } },
      { id: 'a', name: 'A', catalog: { visibility: 'primary', order: 1 } },
    ])
    expect(paths.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('groups paths by catalog category and exposes at most three concise tags', () => {
    const paths = selectableDaemonPaths([
      { id: 'plan', name: '实施计划', tags: ['文档', '需求'], catalog: { category: 'planning', order: 1 } },
      { id: 'qa', name: '测试修复', tags: ['测试', '修复', '循环', '额外'], catalog: { category: 'testing', order: 2 } },
      { id: 'backend', name: '后端编码', catalog: { category: 'development', visibility: 'advanced', order: 3 } },
    ])
    expect(groupDaemonPaths(paths).map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['规划与方案', ['plan']],
      ['测试与质量', ['qa']],
      ['功能开发', ['backend']],
    ])
    expect(daemonPathTags(paths[0])).toEqual(['文档', '需求', '常用'])
    expect(daemonPathTags(paths[1])).toHaveLength(3)
    expect(daemonPathTags(paths[2])).toEqual(['进阶'])
  })

  it('never exposes an English catalog category as a group title', () => {
    expect(daemonPathCategoryLabel('featimpl')).toBe('功能开发')
    expect(daemonPathCategoryLabel('deployment')).toBe('部署与交付')
    expect(daemonPathCategoryLabel('migration')).toBe('迁移与改造')
    expect(daemonPathCategoryLabel('unknown-pipeline-kind')).toBe('其他路径')
    expect(daemonPathCategoryLabel('产品研究')).toBe('产品研究')
  })

  it('projects a readable task topic, Feishu source and time without leaking the raw URL into the title', () => {
    const updatedAt = '2026-08-20T08:00:00.000Z'
    const [card] = daemonRunCards([{
      slug: 'run-1',
      intent: '需求文档：https://forever9.feishu.cn/wiki/DB8YwCuKtiRUkhkL6lyc',
      state: 'finished',
      workflow: 'plan',
      documentTitle: '【FF项目】0元礼包',
      updatedAt,
    }], [{ id: 'plan', name: '文档到实施计划' }], 'all', '')

    expect(card.cardTitle).toBe('需求文档任务')
    expect(card.cardTitle).not.toContain('https://')
    expect(card.sourceLabel).toBe('飞书文档')
    expect(card.sourceTitle).toBe('【FF项目】0元礼包')
    expect(card.sourceUrl).toBe('https://forever9.feishu.cn/wiki/DB8YwCuKtiRUkhkL6lyc')
    expect(card.statusLabel).toBe('已完成')
    expect(card.pathName).toBe('文档到实施计划')
    expect(daemonTaskTimeLabel(updatedAt, Date.parse('2026-08-20T09:30:00.000Z'))).toBe('1 小时前')
  })

  it('does not present a generic Feishu product name as the document title', () => {
    const [card] = daemonRunCards([{
      slug: 'run-generic-title',
      intent: '需求文档：https://forever9.feishu.cn/wiki/generic',
      documentTitle: '飞书云文档',
    }], [], 'all', '')

    expect(card.sourceLabel).toBe('飞书文档')
    expect(card.sourceTitle).toBe('')
  })
})
