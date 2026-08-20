import { describe, expect, it } from 'vitest'
import {
  expertArtifactBody,
  expertArtifactKind,
  expertArtifactKindLabel,
  parseExpertArtifactRef,
} from './expert-artifact'

describe('expert artifact presentation', () => {
  it('parses a bounded session and artifact reference', () => {
    expect(parseExpertArtifactRef('session-review#artifact-v2')).toEqual({
      sessionId: 'session-review',
      artifactId: 'artifact-v2',
    })
    expect(parseExpertArtifactRef('missing-marker')).toBeNull()
  })

  it('maps internal artifact types to user-facing product kinds', () => {
    expect(expertArtifactKind('report')).toBe('document')
    expect(expertArtifactKind('csv')).toBe('table')
    expect(expertArtifactKindLabel('document')).toBe('文档')
    expect(expertArtifactKindLabel('spreadsheet')).toBe('表格')
  })

  it('removes the model-facing deliverable envelope from a document', () => {
    const body = expertArtifactBody({
      id: 'a1',
      type: 'document',
      body: '交付物 1：可直接审阅的同步稿（Document）\n\n---\n\n# 飞书消息处理清单\n\n正文',
    })
    expect(body).toBe('# 飞书消息处理清单\n\n正文')
    expect(body).not.toContain('Document')
  })
})
