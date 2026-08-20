import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as ContentBlocks from '../../../domain/content-blocks'
import { CONTENT_BLOCKS_WORKER_THRESHOLD } from '../../../domain/content-blocks-async'
import { mockApi, resetAppStore, useAppStore } from '../../test/helpers'
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

  it('renders feishu documents as branded inline links', () => {
    render(<ContentView source={'见 [纪要](https://sample.feishu.cn/docx/abc123)'} />)
    const link = screen.getByTestId('feishu-doc-link')
    expect(link).toHaveTextContent('纪要')
    expect(link).toHaveAttribute('data-resource-type', 'doc')
    expect(link).toHaveAttribute('href', 'https://sample.feishu.cn/docx/abc123')
    expect(screen.queryByTestId('feishu-resource-card')).toBeNull()
  })

  it('turns URLs wrapped in inline code into clickable links', () => {
    render(<ContentView source={'查看 `https://forever9.feishu.cn/docx/abc123` 和 `https://example.com/a`'} />)
    expect(screen.getAllByTestId('feishu-doc-link')).toHaveLength(1)
    expect(screen.getByTestId('content-resource-link')).toHaveAttribute('href', 'https://example.com/a')
  })

  it('opens feishu document links in the browser', () => {
    const openExternal = vi.fn(async () => ({ ok: true }))
    mockApi({ openExternal })
    render(<ContentView source={'见 [纪要](https://sample.feishu.cn/docx/abc123)'} />)
    fireEvent.click(screen.getByTestId('feishu-doc-link'))
    expect(openExternal).toHaveBeenCalledWith('https://sample.feishu.cn/docx/abc123')
  })

  it('renders feishu meetings as information cards', () => {
    render(<ContentView source={'[1. 对九九AI规划｜2026-08-17 16:00｜组织者：Viola-晏希](https://sample.feishu.cn/minutes/meeting123)'} />)
    const card = screen.getByTestId('feishu-resource-card')
    expect(card).toHaveClass('feishu-meeting-card')
    expect(card).toHaveTextContent('飞书妙记 · 第1场')
    expect(card).toHaveTextContent('对九九AI规划')
    expect(card).toHaveTextContent('2026-08-17 16:00 ｜ 组织者：Viola-晏希')
    expect(screen.queryByTestId('feishu-doc-link')).toBeNull()
  })

  it('opens ordinary web links in the right preview and exposes shared context actions', () => {
    mockApi()
    render(<ContentView source={'查看 [项目主页](https://example.com/project)'} />)
    const link = screen.getByTestId('content-resource-link')
    expect(link).toHaveAttribute('data-resource-kind', 'web')
    fireEvent.click(link)
    expect(useAppStore.getState().linkPreview?.href).toBe('https://example.com/project')
    fireEvent.contextMenu(link, { clientX: 24, clientY: 36 })
    expect(useAppStore.getState().overlayContextMenu?.items.map((item) => item.label)).toEqual([
      '在外部浏览器打开',
      '复制链接',
    ])
  })

  it('reads local markdown links from the active source for the right document preview', async () => {
    const read = vi.fn(async () => ({ ok: true, content: '# 技术架构\n\n正文内容' }))
    mockApi({ sourcesReadFile: read })
    useAppStore.setState({
      sources: [{ id: 'source-1', type: 'local', rootPath: 'D:/knowledge' }],
      activeSourceId: 'source-1',
    })
    render(<ContentView source={'查看 [ActivityScheduler 技术架构](tech/ActivityScheduler.md)'} />)
    const link = screen.getByTestId('content-resource-link')
    expect(link).toHaveAttribute('data-resource-kind', 'markdown')
    fireEvent.click(link)
    await waitFor(() => {
      expect(useAppStore.getState().linkPreview?.loading).toBe(false)
    })
    expect(read).toHaveBeenCalledWith({ sourceId: 'source-1', path: 'tech/ActivityScheduler.md' })
    expect(useAppStore.getState().linkPreview).toMatchObject({
      kind: 'markdown',
      path: 'tech/ActivityScheduler.md',
      content: '# 技术架构\n\n正文内容',
    })
    fireEvent.contextMenu(link)
    expect(useAppStore.getState().overlayContextMenu?.items.map((item) => item.label)).toEqual([
      '在系统中打开',
      '复制链接',
    ])
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
    expect(view).toHaveTextContent('正在整理内容…')
    expect(view).not.toHaveTextContent('paragraph line.')
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
