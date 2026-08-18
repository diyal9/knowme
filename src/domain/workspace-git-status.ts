/**
 * 代码工作区树：把 daemon changes 映射成 path → git 色。
 * 斜杠归一化；目录用后缀匹配，祖先也可着色。
 */

export type GitChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed'

const STATUS_MAP: Record<string, GitChangeStatus> = {
  added: 'added',
  add: 'added',
  a: 'added',
  modified: 'modified',
  modify: 'modified',
  m: 'modified',
  changed: 'modified',
  deleted: 'deleted',
  delete: 'deleted',
  d: 'deleted',
  removed: 'deleted',
  renamed: 'renamed',
  rename: 'renamed',
  r: 'renamed',
}

export function normalizeWorkspacePath(path: string): string {
  return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

export function mapChangeStatus(raw: string): GitChangeStatus {
  const key = String(raw || '').trim().toLowerCase()
  return STATUS_MAP[key] || 'modified'
}

export function buildGitStatusMap(files: { path?: string; status?: string }[]): Map<string, GitChangeStatus> {
  const map = new Map<string, GitChangeStatus>()
  for (const file of files || []) {
    const path = normalizeWorkspacePath(file.path || '')
    if (!path) continue
    map.set(path, mapChangeStatus(file.status || ''))
  }
  return map
}

/** 文件命中自身；目录命中任意后代。 */
export function gitStatusForPath(map: Map<string, GitChangeStatus>, path: string, isDir = false): GitChangeStatus | '' {
  const norm = normalizeWorkspacePath(path)
  if (!norm || !map.size) return ''
  if (map.has(norm)) return map.get(norm) || ''
  if (!isDir) {
    for (const [key, status] of map) {
      if (key.endsWith(`/${norm}`) || key.endsWith(norm)) return status
    }
    return ''
  }
  const prefix = `${norm}/`
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) return map.get(key) || 'modified'
  }
  return ''
}
