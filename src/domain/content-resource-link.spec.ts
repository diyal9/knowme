import { describe, expect, it } from 'vitest'
import {
  classifyContentResource,
  normalizeLocalMarkdownPath,
  sourceFileUrl,
} from './content-resource-link'

describe('content-resource-link', () => {
  it('recognizes safe relative markdown paths', () => {
    expect(normalizeLocalMarkdownPath('./tech/架构文档.md')).toBe('tech/架构文档.md')
    expect(normalizeLocalMarkdownPath('docs/guide.markdown#section')).toBe('docs/guide.markdown')
    expect(classifyContentResource('docs/guide.md')).toBe('markdown')
  })

  it('rejects absolute, remote, and traversal paths as local markdown', () => {
    expect(normalizeLocalMarkdownPath('../secret.md')).toBeNull()
    expect(normalizeLocalMarkdownPath('D:/secret.md')).toBeNull()
    expect(normalizeLocalMarkdownPath('https://example.com/readme.md')).toBeNull()
    expect(classifyContentResource('https://example.com/readme.md')).toBe('web')
  })

  it('builds an encoded file URL inside the source root', () => {
    expect(sourceFileUrl('D:/knowledge base', 'tech/架构文档.md'))
      .toBe('file:///D:/knowledge%20base/tech/%E6%9E%B6%E6%9E%84%E6%96%87%E6%A1%A3.md')
  })
})
