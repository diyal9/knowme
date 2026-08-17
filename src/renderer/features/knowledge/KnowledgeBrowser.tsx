import { useMemo } from 'react'
import {
  buildKnowledgeTree,
  expandKnowledgeDirsForHits,
  filterKnowledgeEntries,
  knowledgeEntryBadge,
  knowledgeRootDirectoryLabel,
  knowledgeTreeFileCount,
  type KnowledgeTreeNode,
} from '../../../domain/knowledge-tree'
import { useAppStore } from '../../app/store'
import type { KnowledgeEntry } from '../../../shared/api'

function TreeNode({
  node,
  depth,
  selectedPath,
  collapsed,
  onToggle,
  onOpen,
}: {
  node: KnowledgeTreeNode
  depth: number
  selectedPath: string | null
  collapsed: Record<string, true>
  onToggle: (path: string) => void
  onOpen: (entry: KnowledgeEntry) => void
}) {
  if (node.type === 'file' && node.entry) {
    const item = node.entry
    const active = item.path === selectedPath
    return (
      <button
        type="button"
        className={`knowledge-tree-row knowledge-tree-file${active ? ' active' : ''}`}
        style={{ ['--kos-depth' as string]: depth }}
        title={item.path}
        onClick={() => onOpen(item)}
      >
        <span className="knowledge-tree-gutter" aria-hidden="true" />
        <span className="knowledge-tree-ico knowledge-tree-ico-file" aria-hidden="true" />
        <span className="knowledge-tree-label">{item.title || node.name}</span>
        <span className="knowledge-tree-badge">{knowledgeEntryBadge(item)}</span>
      </button>
    )
  }
  const open = !collapsed[node.path]
  const label = depth === 0 ? knowledgeRootDirectoryLabel(node.path) : node.name
  return (
    <div className={`knowledge-tree-dir${open ? ' open' : ''}`}>
      <button
        type="button"
        className="knowledge-tree-row knowledge-tree-folder"
        style={{ ['--kos-depth' as string]: depth }}
        aria-expanded={open}
        onClick={() => onToggle(node.path)}
      >
        <span className="knowledge-tree-twist" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="knowledge-tree-ico knowledge-tree-ico-folder" aria-hidden="true" />
        <span className="knowledge-tree-label">{label}</span>
        <span className="knowledge-tree-count">{knowledgeTreeFileCount(node)}</span>
      </button>
      {open ? (
        <div className="knowledge-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function KnowledgeBrowser({ entries }: { entries: KnowledgeEntry[] }) {
  const query = useAppStore((s) => s.knowledgeQuery)
  const filter = useAppStore((s) => s.knowledgeFilter)
  const setQuery = useAppStore((s) => s.setKnowledgeQuery)
  const setFilter = useAppStore((s) => s.setKnowledgeFilter)
  const collapsed = useAppStore((s) => s.knowledgeCollapsedDirs)
  const toggle = useAppStore((s) => s.toggleKnowledgeDir)
  const selectedPath = useAppStore((s) => s.knowledgeSelectedPath)
  const openEntry = useAppStore((s) => s.openKnowledgeEntry)

  const filtered = useMemo(() => filterKnowledgeEntries(entries, query, filter), [entries, filter, query])
  const tree = useMemo(() => buildKnowledgeTree(filtered), [filtered])
  const visibleCollapsed = useMemo(() => {
    const hits = query.trim() ? filtered : []
    const selected = selectedPath ? entries.filter((item) => item.path === selectedPath) : []
    return expandKnowledgeDirsForHits(collapsed, [...hits, ...selected])
  }, [collapsed, entries, filtered, query, selectedPath])
  const wikiCount = entries.filter((item) => item.kind === 'wiki').length
  const okfCount = entries.filter((item) => item.kind === 'okf').length

  return (
    <section className="knowledge-browser">
      <div className="knowledge-browser-head">
        <input
          className="knowledge-search"
          value={query}
          placeholder="搜索标题或路径…"
          aria-label="搜索知识"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="knowledge-filters">
          <button type="button" className={`knowledge-filter${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>全部 {entries.length}</button>
          <button type="button" className={`knowledge-filter${filter === 'wiki' ? ' active' : ''}`} onClick={() => setFilter('wiki')}>资料 {wikiCount}</button>
          <button type="button" className={`knowledge-filter${filter === 'okf' ? ' active' : ''}`} onClick={() => setFilter('okf')}>已整理 {okfCount}</button>
        </div>
      </div>
      <div className="knowledge-entry-list">
        {filtered.length ? (
          <div className="knowledge-tree" id="kosTree">
            {tree.children.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                collapsed={visibleCollapsed}
                onToggle={toggle}
                onOpen={(entry) => void openEntry(entry)}
              />
            ))}
          </div>
        ) : (
          <div className="knowledge-empty">
            {entries.length ? '没有匹配的条目' : '这里还没有知识资料'}
          </div>
        )}
      </div>
    </section>
  )
}
