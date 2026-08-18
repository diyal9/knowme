import { describe, expect, it } from 'vitest'
import { detectKind, escapeHtml, renderPreview } from './workspace-blob-preview'

describe('workspace-blob-preview', () => {
  it('detects markdown / code / text', () => {
    expect(detectKind('a.md')).toBe('markdown')
    expect(detectKind('main.go')).toBe('code')
    expect(detectKind('notes.txt')).toBe('text')
    expect(detectKind('x.bin', true)).toBe('binary')
  })

  it('escapes script tags in markdown and code', () => {
    const md = renderPreview({ path: 'a.md', content: '<script>alert(1)</script>' })
    expect(md.html).not.toContain('<script>')
    expect(md.html).toContain('&lt;script&gt;')
    const code = renderPreview({ path: 'a.ts', content: 'const x = "<script>"' })
    expect(code.html).not.toMatch(/<script>/)
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toContain('&lt;img')
  })
})
