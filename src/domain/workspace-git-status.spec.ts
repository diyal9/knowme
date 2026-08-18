import { describe, expect, it } from 'vitest'
import { buildGitStatusMap, gitStatusForPath, normalizeWorkspacePath } from './workspace-git-status'

describe('workspace-git-status', () => {
  it('maps added/modified/deleted with slash normalize', () => {
    const map = buildGitStatusMap([
      { path: 'src\\a.ts', status: 'A' },
      { path: 'docs/readme.md', status: 'modified' },
      { path: 'gone.txt', status: 'deleted' },
    ])
    expect(gitStatusForPath(map, 'src/a.ts')).toBe('added')
    expect(gitStatusForPath(map, 'docs/readme.md')).toBe('modified')
    expect(gitStatusForPath(map, 'gone.txt')).toBe('deleted')
    expect(gitStatusForPath(map, 'src', true)).toBe('added')
    expect(normalizeWorkspacePath('foo\\bar\\')).toBe('foo/bar')
  })
})
