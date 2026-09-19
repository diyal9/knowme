import { describe, expect, it } from 'vitest'
import {
  conversationFileKind,
  conversationFileKindLabel,
  conversationFileName,
} from './conversation-file'

describe('conversation file presentation helpers', () => {
  it('classifies explicit artifact types before falling back to file extensions', () => {
    expect(conversationFileKind('image', 'result.bin')).toBe('image')
    expect(conversationFileKind(undefined, 'budget.xlsx')).toBe('table')
    expect(conversationFileKind(undefined, 'worker.ts')).toBe('code')
    expect(conversationFileKind(undefined, 'brief.pdf')).toBe('document')
    expect(conversationFileKind(undefined, undefined, 'https://example.test/view')).toBe('link')
  })

  it('keeps card metadata compact and human readable', () => {
    expect(conversationFileKindLabel('table')).toBe('表格')
    expect(conversationFileName('https://example.test/path/design%20brief.pdf?download=1')).toBe('design brief.pdf')
    expect(conversationFileName('', '附件')).toBe('附件')
  })
})
