import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createArtifactPreviewContract } from '../../../domain/artifact-preview'
import { ArtifactActionBar, ArtifactPreview } from './ArtifactPreview'

describe('ArtifactPreview', () => {
  afterEach(() => cleanup())

  it('shows only the image and open action, leaving review to the conversation', () => {
    const onAction = vi.fn()
    const artifact = createArtifactPreviewContract({
      id: 'image-1',
      type: 'image',
      title: '机器人 Icon',
      source: 'https://images.example.test/robot.png',
      version: 1,
      state: 'pending',
      actions: ['open', 'revise', 'accept'],
    })
    render(<>
      <ArtifactPreview artifact={artifact} onAction={onAction} showActions={false} />
      <ArtifactActionBar artifact={artifact} onAction={onAction} showState />
    </>)

    expect(screen.getByTestId('artifact-preview').getAttribute('data-artifact-contract')).toBe('knowme.artifact-preview/v1')
    expect(screen.queryByText('交付物')).toBeNull()
    expect(screen.getByText('查看大图')).toBeTruthy()
    expect(screen.queryByText('images.example.test')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看机器人 Icon原图' }))
    expect(onAction).toHaveBeenCalledWith('open', expect.objectContaining({ id: artifact.id, source: artifact.source }))
    const preview = within(screen.getByTestId('artifact-preview'))
    expect(preview.queryByRole('button', { name: '接受成果' })).toBeNull()
    expect(preview.queryByText('待验收')).toBeNull()
    expect(preview.queryByText('机器人 Icon')).toBeNull()
    expect(preview.queryByText('v1')).toBeNull()
    expect(within(screen.getByTestId('artifact-action-bar')).getByText('待验收')).toBeTruthy()
    fireEvent.click(within(screen.getByTestId('artifact-action-bar')).getByRole('button', { name: '接受成果' }))
    expect(onAction).toHaveBeenCalledWith('accept', expect.objectContaining({ id: artifact.id }))
  })

  it('presents document artifacts as readable conversation cards with a plain-text excerpt', () => {
    const onAction = vi.fn()
    const artifact = createArtifactPreviewContract({
      id: 'prd-v1', type: 'document', title: '百炼商业化活动 PRD 初稿.md', version: 1, actions: ['open'],
    })
    render(<ArtifactPreview
      artifact={artifact}
      excerpt={'# 百炼商业化活动 PRD 初稿\n\n## 背景与目标\n\n支持限时商业化活动，并建立可测试的验收标准。'}
      onAction={onAction}
    />)

    const preview = screen.getByTestId('artifact-preview')
    expect(preview.classList.contains('has-excerpt')).toBe(true)
    expect(preview.textContent).toContain('背景与目标 支持限时商业化活动，并建立可测试的验收标准。')
    expect(within(preview).queryByText('# 百炼商业化活动 PRD 初稿')).toBeNull()
    fireEvent.click(within(preview).getByRole('button', { name: '打开百炼商业化活动 PRD 初稿.md' }))
    expect(onAction).toHaveBeenCalledWith('open', expect.objectContaining({ id: 'prd-v1' }))
  })

  it('loads a local artifact path through the preload resolver', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'api')
    const artifactPreviewResolve = vi.fn(async () => ({ ok: true, source: 'data:image/png;base64,iVBORw==' }))
    Object.defineProperty(window, 'api', { configurable: true, value: { artifactPreviewResolve } })
    const artifact = createArtifactPreviewContract({
      id: 'local-image', type: 'image', title: '本地图片', source: 'C:\\KnowMe\\generated-images\\robot.png', actions: ['open'],
    })
    render(<ArtifactPreview artifact={artifact} onAction={vi.fn()} />)
    expect((await screen.findByRole('img', { name: '本地图片' })).getAttribute('src')).toBe('data:image/png;base64,iVBORw==')
    expect(artifactPreviewResolve).toHaveBeenCalledWith('C:\\KnowMe\\generated-images\\robot.png')
    if (original) Object.defineProperty(window, 'api', original)
    else Reflect.deleteProperty(window, 'api')
  })

  it('keeps provider HTTP image URLs remote instead of treating them as local paths', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'api')
    const artifactPreviewResolve = vi.fn(async () => ({ ok: false, error: 'should not resolve remote media' }))
    Object.defineProperty(window, 'api', { configurable: true, value: { artifactPreviewResolve } })
    const artifact = createArtifactPreviewContract({
      id: 'http-image', type: 'image', title: 'HTTP 图片', source: 'http://127.0.0.1:4317/generated/robot.png', actions: ['open'],
    })
    render(<ArtifactPreview artifact={artifact} onAction={vi.fn()} />)
    expect((await screen.findByRole('img', { name: 'HTTP 图片' })).getAttribute('src')).toBe(artifact.source)
    expect(artifactPreviewResolve).not.toHaveBeenCalled()
    if (original) Object.defineProperty(window, 'api', original)
    else Reflect.deleteProperty(window, 'api')
  })

  it('replaces a failed image element with a quiet unavailable state', () => {
    const artifact = createArtifactPreviewContract({
      id: 'image-2', type: 'image', title: '图片', source: 'https://invalid.example.test/image.png',
    })
    render(<ArtifactPreview artifact={artifact} />)
    fireEvent.error(screen.getByRole('img', { name: '图片' }))
    expect(screen.getByText('图片预览不可用')).toBeTruthy()
    expect(screen.queryByRole('img', { name: '图片' })).toBeNull()
  })

  it('falls back to the decoded local artifact when the provider image fails', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'api')
    const artifactPreviewResolve = vi.fn(async () => ({ ok: true, source: 'data:image/png;base64,iVBORw==' }))
    Object.defineProperty(window, 'api', { configurable: true, value: { artifactPreviewResolve } })
    const artifact = createArtifactPreviewContract({
      id: 'fallback-image',
      type: 'image',
      title: '回退图片',
      source: 'https://cdn.example.test/expired.png',
      sources: ['https://cdn.example.test/expired.png', 'C:\\KnowMe\\generated-images\\current.png'],
      actions: ['open'],
    })
    render(<ArtifactPreview artifact={artifact} onAction={vi.fn()} />)
    const image = await screen.findByRole('img', { name: '回退图片' })
    fireEvent.error(image)
    await waitFor(() => expect(screen.getByRole('img', { name: '回退图片' }).getAttribute('src')).toBe('data:image/png;base64,iVBORw=='))
    expect(artifactPreviewResolve).toHaveBeenCalledWith('C:\\KnowMe\\generated-images\\current.png')
    if (original) Object.defineProperty(window, 'api', original)
    else Reflect.deleteProperty(window, 'api')
  })

  it('resets the fallback cursor when a newer artifact provides a fresh canonical image', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'api')
    const artifactPreviewResolve = vi.fn(async (source: string) => ({
      ok: true,
      source: source.includes('current') ? 'data:image/png;base64,current' : 'data:image/png;base64,old',
    }))
    Object.defineProperty(window, 'api', { configurable: true, value: { artifactPreviewResolve } })
    const first = createArtifactPreviewContract({
      id: 'image-v1', type: 'image', title: '版本图片',
      source: 'https://cdn.example.test/expired-v1.png',
      sources: ['https://cdn.example.test/expired-v1.png', 'C:\\KnowMe\\generated-images\\current-v1.png'],
      actions: ['open'],
    })
    const { rerender } = render(<ArtifactPreview artifact={first} />)
    fireEvent.error(await screen.findByRole('img', { name: '版本图片' }))
    await waitFor(() => expect(screen.getByRole('img', { name: '版本图片' }).getAttribute('src')).toBe('data:image/png;base64,current'))

    const second = createArtifactPreviewContract({
      id: 'image-v2', type: 'image', title: '版本图片',
      source: 'https://cdn.example.test/fresh-v2.png',
      sources: ['https://cdn.example.test/fresh-v2.png', 'C:\\KnowMe\\generated-images\\current-v2.png'],
      actions: ['open'],
    })
    rerender(<ArtifactPreview artifact={second} />)
    await waitFor(() => expect(screen.getByRole('img', { name: '版本图片' }).getAttribute('src')).toBe('https://cdn.example.test/fresh-v2.png'))
    expect(artifactPreviewResolve).not.toHaveBeenCalledWith('C:\\KnowMe\\generated-images\\current-v2.png')
    if (original) Object.defineProperty(window, 'api', original)
    else Reflect.deleteProperty(window, 'api')
  })
})
