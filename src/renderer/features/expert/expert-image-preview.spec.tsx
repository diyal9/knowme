import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExpertImagePreview, imagePreviewSource } from './ExpertImagePreview'

describe('expert image sequence', () => {
  afterEach(cleanup)

  it('keeps GIF sources and image order without captions or review controls', () => {
    const onOpen = vi.fn()
    const images = [
      { id: 'gif-a', title: '动图 A', source: 'https://example.test/a.gif' },
      { id: 'png-b', title: '图片 B', source: 'https://example.test/b.png' },
      { id: 'gif-c', title: '动图 C', source: 'https://example.test/c.gif' },
    ]
    render(<ExpertImagePreview images={images} onOpen={onOpen} />)
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('src'))).toEqual(images.map((image) => image.source))
    expect(screen.queryByText(/第.*版|待验收|已查看/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查看动图 C原图' }))
    expect(onOpen).toHaveBeenCalledWith(2)
  })

  it('accepts generic artifact url and path sources', () => {
    expect(imagePreviewSource({ id: 'remote', type: 'image', url: 'https://cdn.example.test/image.png' })).toBe('https://cdn.example.test/image.png')
    expect(imagePreviewSource({ id: 'local', type: 'image', path: 'generated/image.png' })).toBe('generated/image.png')
  })

  it('prefers a usable provider URL over a stale local target path', () => {
    expect(imagePreviewSource({
      id: 'mixed',
      type: 'image',
      targetPath: 'C:\\old-run\\missing.png',
      url: 'https://cdn.example.test/current.png',
    })).toBe('https://cdn.example.test/current.png')
  })

  it('skips opaque artifact identifiers and falls back to a URL in the result text', () => {
    expect(imagePreviewSource({ id: 'opaque', type: 'image', targetPath: 'memory://generated-image' }, '预览地址：https://cdn.example.test/current.png'))
      .toBe('https://cdn.example.test/current.png')
  })

  it('prefers an image URL in the result text over a stale local path', () => {
    expect(imagePreviewSource({ id: 'stale-path', type: 'image', targetPath: 'C:\\old-run\\missing.png' }, '已生成：https://cdn.example.test/current.png'))
      .toBe('https://cdn.example.test/current.png')
  })
})
