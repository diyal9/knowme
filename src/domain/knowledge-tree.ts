import type { KnowledgeEntry } from '../shared/api'

export type KnowledgeKindFilter = 'all' | 'wiki' | 'okf'

export type KnowledgeTreeNode = {
  name: string
  path: string
  type: 'dir' | 'file'
  children: KnowledgeTreeNode[]
  entry?: KnowledgeEntry
}

export function knowledgeBasename(path: string): string {
  const parts = String(path || '').replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

export function knowledgeRootDirectoryLabel(path: string): string {
  if (path === 'raw') return '资料'
  if (path === 'concepts') return '已整理知识'
  if (path === 'inbox') return '待整理资料'
  return knowledgeBasename(path)
}

export function knowledgeEntryBadge(entry: KnowledgeEntry): string {
  if (entry.kind === 'okf') return '已整理'
  if (entry.editable || String(entry.path || '').startsWith('raw/')) return '可编辑'
  return '资料'
}

export function collectKnowledgeEntries(wiki: KnowledgeEntry[] = [], okf: KnowledgeEntry[] = []): KnowledgeEntry[] {
  return [
    ...wiki.map((item) => ({ ...item, kind: 'wiki' as const })),
    ...okf.map((item) => ({ ...item, kind: 'okf' as const })),
  ]
}

export function filterKnowledgeEntries(
  entries: KnowledgeEntry[],
  query: string,
  filter: KnowledgeKindFilter,
): KnowledgeEntry[] {
  const q = query.trim().toLowerCase()
  return entries.filter((item) => {
    if (filter !== 'all' && item.kind !== filter) return false
    if (!q) return true
    return `${item.title || ''} ${item.path}`.toLowerCase().includes(q)
  })
}

function ensureDir(map: Map<string, KnowledgeTreeNode>, path: string, name: string): KnowledgeTreeNode {
  let node = map.get(path)
  if (!node) {
    node = { name, path, type: 'dir', children: [] }
    map.set(path, node)
  }
  return node
}

export function buildKnowledgeTree(entries: KnowledgeEntry[]): KnowledgeTreeNode {
  const root: KnowledgeTreeNode = { name: '', path: '', type: 'dir', children: [] }
  const dirs = new Map<string, KnowledgeTreeNode>([['', root]])

  for (const entry of entries) {
    const parts = String(entry.path || '').replace(/\\/g, '/').split('/').filter(Boolean)
    if (!parts.length) continue
    let parent = root
    let acc = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      let dir = dirs.get(acc)
      if (!dir) {
        dir = ensureDir(dirs, acc, parts[i])
        parent.children.push(dir)
      }
      parent = dir
    }
    parent.children.push({
      name: parts[parts.length - 1],
      path: entry.path,
      type: 'file',
      children: [],
      entry,
    })
  }

  for (const seed of ['raw', 'concepts']) {
    if (!dirs.has(seed)) {
      const dir = ensureDir(dirs, seed, seed)
      root.children.push(dir)
    }
  }

  const sortNodes = (nodes: KnowledgeTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return String(a.name).localeCompare(String(b.name), 'zh-CN')
    })
    nodes.forEach((node) => {
      if (node.type === 'dir') sortNodes(node.children)
    })
  }
  const priority = (path: string) => (path === 'raw' ? 0 : path === 'concepts' ? 1 : 2)
  sortNodes(root.children)
  root.children.sort((a, b) => priority(a.path) - priority(b.path) || a.name.localeCompare(b.name, 'zh-CN'))
  return root
}

export function knowledgeTreeFileCount(node: KnowledgeTreeNode): number {
  if (node.type === 'file') return 1
  return node.children.reduce((sum, child) => sum + knowledgeTreeFileCount(child), 0)
}

/** Collapse nested folders (paths containing `/`); keep raw / concepts open. */
export function seedCollapsedKnowledgeDirs(entries: KnowledgeEntry[]): Record<string, true> {
  const collapsed: Record<string, true> = {}
  for (const item of entries) {
    const parts = String(item.path || '').replace(/\\/g, '/').split('/').filter(Boolean)
    let acc = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      if (acc.includes('/')) collapsed[acc] = true
    }
  }
  return collapsed
}

/** While searching (or showing a selected file), keep ancestor folders expanded. */
export function expandKnowledgeDirsForHits(
  collapsed: Record<string, true>,
  entries: KnowledgeEntry[],
): Record<string, true> {
  const next = { ...collapsed }
  for (const item of entries) {
    const parts = String(item.path || '').replace(/\\/g, '/').split('/').filter(Boolean)
    let acc = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      delete next[acc]
    }
  }
  return next
}
