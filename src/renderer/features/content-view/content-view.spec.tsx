import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as ContentBlocks from '../../../domain/content-blocks'
import { CONTENT_BLOCKS_WORKER_THRESHOLD } from '../../../domain/content-blocks-async'
import { resetAppStore, useAppStore } from '../../test/helpers'
import { ContentView } from './ContentView'

vi.mock('../../../domain/content-blocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/content-blocks')>()
  return {
    ...actual,
    parseContentBlocks: vi.fn((src: string) => actual.parseContentBlocks(src)),
  }
})

describe('ContentView', () => {
  afterEach(() => {
    cleanup()
    resetAppStore()
    vi.mocked(ContentBlocks.parseContentBlocks).mockClear()
  })

  it('renders feishu doc links as a shared card', () => {
    render(<ContentView source={'见 [纪要](https://sample.feishu.cn/docx/abc123)'} />)
    const card = screen.getByTestId('feishu-resource-card')
    expect(card).toHaveTextContent('飞书文档')
    expect(card).toHaveTextContent('纪要')
    expect(card).toHaveAttribute('href', 'https://sample.feishu.cn/docx/abc123')
  })

  it('opens feishu cards in the right link preview instead of a blank window', () => {
    render(<ContentView source={'见 [纪要](https://sample.feishu.cn/docx/abc123)'} />)
    fireEvent.click(screen.getByTestId('feishu-resource-card'))
    expect(useAppStore.getState().linkPreview?.href).toBe('https://sample.feishu.cn/docx/abc123')
    expect(useAppStore.getState().linkPreview?.title).toBe('纪要')
  })

  it('renders GFM tables', () => {
    render(<ContentView source={'| 项 | 状态 |\n| --- | --- |\n| **A** | `ok` |'} />)
    const table = screen.getByTestId('content-table')
    expect(table.querySelector('th')?.textContent).toContain('项')
    expect(table.querySelector('strong')?.textContent).toBe('A')
    expect(table.querySelector('code')?.textContent).toBe('ok')
  })

  it('keeps the stream caret inside the last paragraph', () => {
    render(<ContentView source="你好" caret={<span data-testid="stream-caret">▍</span>} />)
    const paragraph = screen.getByTestId('content-view').querySelector('p')
    expect(paragraph).toContainElement(screen.getByTestId('stream-caret'))
  })

  it('accepts streaming prop without throwing', () => {
    render(<ContentView source={'a\n\nb'} streaming caret={<span data-testid="stream-caret">▍</span>} />)
    expect(screen.getByTestId('content-view')).toBeTruthy()
  })

  it('does not synchronously parse long markdown on first paint', async () => {
    const source = `# Title\n\n${'paragraph line.\n\n'.repeat(400)}`
    expect(source.length).toBeGreaterThanOrEqual(CONTENT_BLOCKS_WORKER_THRESHOLD)
    render(<ContentView source={source} />)
    const view = screen.getByTestId('content-view')
    expect(view).toHaveAttribute('data-content-pending', '1')
    expect(view.querySelector('h1')).toBeNull()
    expect(ContentBlocks.parseContentBlocks).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId('content-view').querySelector('h1')).toHaveTextContent('Title')
    })
    expect(screen.getByTestId('content-view')).not.toHaveAttribute('data-content-pending')
  })

  it('does not show stale blocks when source switches short to short', () => {
    const { rerender } = render(<ContentView source="# Doc A\n\nAlpha content" />)
    expect(screen.getByTestId('content-view').querySelector('h1')).toHaveTextContent('Doc A')
    rerender(<ContentView source="# Doc B\n\nBeta content" />)
    const view = screen.getByTestId('content-view')
    expect(view.textContent).not.toContain('Alpha content')
    expect(view.querySelector('h1')).toHaveTextContent('Doc B')
  })

  it('does not show stale blocks when switching short to long', async () => {
    const short = '# Short\n\nbrief'
    const long = `# Long\n\n${'long line.\n\n'.repeat(400)}`
    expect(long.length).toBeGreaterThanOrEqual(CONTENT_BLOCKS_WORKER_THRESHOLD)
    const { rerender } = render(<ContentView source={short} />)
    expect(screen.getByTestId('content-view').querySelector('h1')).toHaveTextContent('Short')
    rerender(<ContentView source={long} />)
    const view = screen.getByTestId('content-view')
    expect(view).toHaveAttribute('data-content-pending', '1')
    expect(view.textContent).not.toContain('brief')
    expect(view.querySelector('h1')).toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('content-view').querySelector('h1')).toHaveTextContent('Long')
    })
  })

  it('ignores stale async parse when source changes before completion', async () => {
    const longA = `# A\n\n${'a'.repeat(CONTENT_BLOCKS_WORKER_THRESHOLD)}`
    const longB = `# B\n\n${'b'.repeat(CONTENT_BLOCKS_WORKER_THRESHOLD)}`
    const { rerender } = render(<ContentView source={longA} />)
    expect(screen.getByTestId('content-view')).toHaveAttribute('data-content-pending', '1')
    rerender(<ContentView source={longB} />)
    await waitFor(() => {
      expect(screen.getByTestId('content-view').querySelector('h1')).toHaveTextContent('B')
    })
    expect(screen.getByTestId('content-view').textContent).not.toMatch(/^A/m)
  })
})
