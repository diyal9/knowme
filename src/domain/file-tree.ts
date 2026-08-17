export interface FileTreeNode {
  type: 'dir' | 'file'
  name: string
  path: string
  depth?: number
}

export interface ContentSource {
  id: string
  type: string
  displayName?: string
  rootPath?: string
  branch?: string
}

export interface FileTreeResult {
  ok?: boolean
  error?: string
  nodes?: FileTreeNode[]
  truncated?: boolean
  lazy?: boolean
}

export function sourceDirKey(sourceId: string, relPath: string): string {
  return `${sourceId}:${relPath || ''}`
}

export function sourceAncestorPaths(relPath: string): string[] {
  const parts = String(relPath || '').split('/').filter(Boolean)
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

export function isUnderSourcePath(parentPath: string, childPath: string): boolean {
  if (!parentPath) return !!childPath
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`)
}

export function mergeSourceChildren(
  nodes: FileTreeNode[],
  parentPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  const parent = String(parentPath || '')
  if (!parent) return Array.isArray(children) ? children.slice() : []
  const next = nodes.filter((n) => n.path === parent || !isUnderSourcePath(parent, n.path))
  const idx = next.findIndex((n) => n.path === parent)
  const insertAt = idx >= 0 ? idx + 1 : next.length
  next.splice(insertAt, 0, ...(children || []))
  return next
}

export function buildSearchPathSet(nodes: FileTreeNode[], query: string): Set<string> | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const paths = new Set<string>()
  for (const node of nodes) {
    if (!node.path.toLowerCase().includes(q) && !node.name.toLowerCase().includes(q)) continue
    paths.add(node.path)
    for (const ancestor of sourceAncestorPaths(node.path)) paths.add(ancestor)
  }
  return paths
}

export function filterVisibleNodes(
  nodes: FileTreeNode[],
  opts: {
    query?: string
    collapsed: Set<string>
    sourceId: string
  },
): FileTreeNode[] {
  const searchPaths = buildSearchPathSet(nodes, opts.query || '')
  return nodes.filter((node) => {
    if (searchPaths) return searchPaths.has(node.path)
    return !sourceAncestorPaths(node.path).some((path) =>
      opts.collapsed.has(sourceDirKey(opts.sourceId, path)),
    )
  })
}

export function filterSourcesByQuery(sources: ContentSource[], query: string): ContentSource[] {
  const q = query.trim().toLowerCase()
  if (!q) return sources
  return sources.filter((s) => {
    const hay = [s.displayName, s.rootPath, s.type, s.branch].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
}

export function sourceKindLabel(source: ContentSource): string {
  if (source.type === 'gitlab') return 'GitLab'
  if (source.type === 'github') return 'GitHub'
  if (source.type === 'web') return '网页'
  return '本地'
}

/** Obsidian-style tree glyph: folder vs generic file (baseline ui-icons). */
export function fileTreeNodeIcon(node: Pick<FileTreeNode, 'type'>): 'folder' | 'file' {
  return node.type === 'dir' ? 'folder' : 'file'
}

export interface FileCatalogItem {
  id: string
  title: string
  preview: string
  project: string
}

export function fileCatalogFromTree(nodes: FileTreeNode[], project = ''): FileCatalogItem[] {
  return (nodes || [])
    .filter((node) => node.type === 'file')
    .map((node) => ({
      id: node.path,
      title: node.name,
      preview: node.path,
      project,
    }))
}
