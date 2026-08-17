import { describe, expect, it } from 'vitest'
import {
  buildSearchPathSet,
  fileCatalogFromTree,
  filterVisibleNodes,
  mergeSourceChildren,
  sourceDirKey,
} from './file-tree'

describe('file-tree view-model', () => {
  it('merges lazy-loaded children under parent path', () => {
    const base = [
      { type: 'dir' as const, name: 'docs', path: 'docs', depth: 0 },
    ]
    const merged = mergeSourceChildren(base, 'docs', [
      { type: 'file', name: 'readme.md', path: 'docs/readme.md', depth: 1 },
    ])
    expect(merged).toHaveLength(2)
    expect(merged[1]?.path).toBe('docs/readme.md')
  })

  it('filters nodes by search and keeps ancestor paths', () => {
    const nodes = [
      { type: 'dir' as const, name: 'docs', path: 'docs', depth: 0 },
      { type: 'file' as const, name: 'guide.md', path: 'docs/guide.md', depth: 1 },
    ]
    const paths = buildSearchPathSet(nodes, 'guide')
    expect(paths?.has('docs')).toBe(true)
    expect(paths?.has('docs/guide.md')).toBe(true)
  })

  it('hides nodes under collapsed directories', () => {
    const nodes = [
      { type: 'dir' as const, name: 'docs', path: 'docs', depth: 0 },
      { type: 'file' as const, name: 'guide.md', path: 'docs/guide.md', depth: 1 },
    ]
    const collapsed = new Set([sourceDirKey('s1', 'docs')])
    const visible = filterVisibleNodes(nodes, { sourceId: 's1', collapsed })
    expect(visible.map((n) => n.path)).toEqual(['docs'])
  })

  it('builds @ catalog from file nodes only', () => {
    const catalog = fileCatalogFromTree(
      [
        { type: 'dir', name: 'docs', path: 'docs', depth: 0 },
        { type: 'file', name: 'guide.md', path: 'docs/guide.md', depth: 1 },
      ],
      'Docs',
    )
    expect(catalog).toEqual([
      { id: 'docs/guide.md', title: 'guide.md', preview: 'docs/guide.md', project: 'Docs' },
    ])
  })
})
