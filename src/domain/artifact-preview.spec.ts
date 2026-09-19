import { describe, expect, it } from 'vitest'
import {
  ARTIFACT_PREVIEW_PROTOCOL,
  artifactPreviewSource,
  artifactPreviewActionLabel,
  artifactPreviewStateLabel,
  createArtifactPreviewContract,
} from './artifact-preview'

describe('artifact preview contract', () => {
  it('normalizes every Agent artifact into the same versioned presentation contract', () => {
    expect(createArtifactPreviewContract({
      id: 'image-1',
      type: 'image',
      title: '机器人 Icon',
      source: 'https://images.example.test/robot.png',
      version: '2',
      state: 'pending',
      actions: ['open', 'accept', 'open'],
    })).toEqual({
      protocol: ARTIFACT_PREVIEW_PROTOCOL,
      id: 'image-1',
      kind: 'image',
      title: '机器人 Icon',
      source: 'https://images.example.test/robot.png',
      fileName: undefined,
      version: 2,
      state: 'pending',
      actions: ['open', 'accept'],
    })
  })

  it('owns status and operation wording instead of delegating it to each Agent', () => {
    expect(artifactPreviewStateLabel('pending')).toBe('待验收')
    expect(artifactPreviewStateLabel('accepted')).toBe('已接受')
    expect(artifactPreviewActionLabel('open')).toBe('打开')
    expect(artifactPreviewActionLabel('revise')).toBe('退回修改')
  })

  it('uses the shared image source contract for ordinary Agent artifact cards', () => {
    expect(artifactPreviewSource({
      targetPath: 'C:\\old-run\\missing.png',
      url: 'https://cdn.example.test/current.png',
    })).toBe('https://cdn.example.test/current.png')
    expect(artifactPreviewSource({
      targetPath: 'memory://generated-image',
      body: '结果地址：https://cdn.example.test/current.png',
    })).toBe('https://cdn.example.test/current.png')
  })

  it('keeps an ordered fallback source list for a provider URL and local artifact', () => {
    const contract = createArtifactPreviewContract({
      id: 'fallback-image',
      type: 'image',
      title: '带回退的图片',
      source: 'https://cdn.example.test/expired.png',
      sources: [
        'https://cdn.example.test/expired.png',
        'C:\\KnowMe\\generated-images\\current.png',
        'C:\\KnowMe\\generated-images\\current.png',
      ],
      actions: ['open'],
    })
    expect(contract.source).toBe('https://cdn.example.test/expired.png')
    expect(contract.sources).toEqual([
      'https://cdn.example.test/expired.png',
      'C:\\KnowMe\\generated-images\\current.png',
    ])
  })
})
