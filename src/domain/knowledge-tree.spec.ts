import { describe, expect, it } from 'vitest'
import { buildKnowledgeTree, expandKnowledgeDirsForHits, filterKnowledgeEntries, knowledgeRootDirectoryLabel, seedCollapsedKnowledgeDirs } from './knowledge-tree'
import { normalizeKnowledgePage, primaryKnowledgeTab } from './knowledge-surface'
import { renderKnowledgeMarkdown } from './knowledge-markdown'

describe('knowledge-tree', () => {
  it('groups wiki/okf paths under 资料 and 已整理知识', () => {
    const tree = buildKnowledgeTree([
      { kind: 'wiki', path: 'raw/note.md', title: '笔记' },
      { kind: 'okf', path: 'concepts/guide.md', title: '指南' },
    ])
    expect(tree.children.map((n) => n.path)).toEqual(['raw', 'concepts'])
    expect(knowledgeRootDirectoryLabel('raw')).toBe('资料')
    expect(tree.children[0].children[0].entry?.title).toBe('笔记')
  })

  it('filters by kind and query', () => {
    const entries = [
      { kind: 'wiki' as const, path: 'raw/a.md', title: '部署' },
      { kind: 'okf' as const, path: 'concepts/b.md', title: '入职' },
    ]
    expect(filterKnowledgeEntries(entries, '部署', 'all')).toHaveLength(1)
    expect(filterKnowledgeEntries(entries, '', 'okf')[0].path).toBe('concepts/b.md')
  })

  it('seeds nested directories as collapsed', () => {
    const collapsed = seedCollapsedKnowledgeDirs([
      { kind: 'wiki', path: 'raw/10/101/a.md', title: 'a' },
    ])
    expect(collapsed.raw).toBeUndefined()
    expect(collapsed['raw/10']).toBe(true)
    expect(collapsed['raw/10/101']).toBe(true)
  })

  it('expands ancestor dirs for search hits', () => {
    const collapsed = seedCollapsedKnowledgeDirs([
      { kind: 'wiki', path: 'raw/10/101/a.md', title: 'a' },
    ])
    const opened = expandKnowledgeDirsForHits(collapsed, [{ kind: 'wiki', path: 'raw/10/101/a.md', title: 'a' }])
    expect(opened['raw/10']).toBeUndefined()
    expect(opened['raw/10/101']).toBeUndefined()
  })
})

describe('knowledge-surface', () => {
  it('aliases browse to 我的知识', () => {
    expect(normalizeKnowledgePage('browse')).toBe('status')
    expect(primaryKnowledgeTab('health')).toBe('status')
    expect(primaryKnowledgeTab('review')).toBe('review')
  })
})

describe('knowledge-markdown', () => {
  it('renders headings and escapes html', () => {
    const html = renderKnowledgeMarkdown('# 结论\n\n<script>x</script>\n- 一项')
    expect(html).toContain('<h1>结论</h1>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<li>一项</li>')
  })

  it('renders ordered lists and bold like assistant bubbles', () => {
    const html = renderKnowledgeMarkdown('1. **Data Server Host**\n2. **Dynamic Skill Hit**')
    expect(html).toContain('<ol>')
    expect(html).toContain('<strong>Data Server Host</strong>')
    expect(html).toContain('<strong>Dynamic Skill Hit</strong>')
    expect(html).not.toContain('**Data')
  })
})
