/**
 * 右侧链接预览面冒烟：store 打开后挂载 surface 与 webview host。
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockApi, resetAppStore, useAppStore } from '../../test/helpers'
import { AppShell } from '../../app/AppShell'
import { LinkPreviewSurface } from './LinkPreviewSurface'

describe('link preview surface', () => {
  afterEach(() => {
    cleanup()
    resetAppStore()
  })

  it('embeds feishu minutes with persist knowme-preview partition', () => {
    mockApi()
    const ok = useAppStore.getState().openLinkPreview(
      'https://forever9.feishu.cn/minutes/obcnabc',
      '周会',
    )
    expect(ok).toBe(true)
    render(<LinkPreviewSurface />)
    const surface = screen.getByTestId('link-preview-surface')
    expect(surface).toHaveClass('surface-link')
    const webview = surface.querySelector('webview.work-link-webview')
    expect(webview?.getAttribute('partition')).toBe('persist:knowme-preview')
    expect(webview?.getAttribute('src')).toContain('/minutes/')
    expect(screen.getByText('周会')).toBeInTheDocument()
  })

  it('closes preview from toolbar in AppShell', () => {
    mockApi()
    useAppStore.setState({
      route: 'assistant',
      linkPreview: {
        href: 'https://sample.feishu.cn/docx/abc',
        title: '文档',
        protocol: 'https:',
        isFeishu: true,
      },
    })
    render(<AppShell />)
    fireEvent.click(screen.getByLabelText('关闭预览'))
    expect(useAppStore.getState().linkPreview).toBeNull()
    expect(screen.queryByTestId('link-preview-surface')).toBeNull()
  })

  it('keeps fullscreen preview below the titlebar so toolbar stays usable', () => {
    mockApi()
    useAppStore.setState({
      route: 'assistant',
      linkPreview: {
        href: 'https://forever9.feishu.cn/minutes/obcnabc',
        title: '周会',
        protocol: 'https:',
        isFeishu: true,
      },
      linkFullscreen: true,
    })
    const { container } = render(<AppShell />)
    expect(container.querySelector('#appShell')).toHaveClass('link-preview-fullscreen')
    fireEvent.click(screen.getByLabelText('退出全屏预览（Esc）'))
    expect(useAppStore.getState().linkFullscreen).toBe(false)
    expect(screen.getByTestId('link-preview-surface')).toBeInTheDocument()
  })

  it('opens a pipeline document over the workbench and learns its page title', async () => {
    mockApi()
    resetAppStore()
    useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'daemon' })
    const sourceUrl = 'https://forever9.feishu.cn/wiki/DB8YwCuKtiRUkhkL6lyc'
    const ok = useAppStore.getState().openLinkPreview(
      sourceUrl,
      '飞书知识库',
      { presentation: 'overlay', resolveTitle: true },
    )

    expect(ok).toBe(true)
    expect(useAppStore.getState().route).toBe('workbench')
    const { container } = render(<AppShell />)
    expect(container.querySelector('#appShell')).toHaveClass('link-preview-fullscreen')
    expect(screen.getByText('管线文档')).toBeInTheDocument()

    const webview = screen.getByTestId('link-preview-webview-host').querySelector('webview') as (HTMLElement & {
      executeJavaScript?: (code: string) => Promise<string>
    }) | null
    const genericTitleEvent = new Event('page-title-updated') as Event & { title: string }
    genericTitleEvent.title = '飞书云文档'
    act(() => webview?.dispatchEvent(genericTitleEvent))
    expect(useAppStore.getState().linkPreview?.title).toBe('飞书知识库')

    if (webview) webview.executeJavaScript = async () => '【FF项目】0元礼包'
    act(() => webview?.dispatchEvent(new Event('dom-ready')))

    await waitFor(() => expect(useAppStore.getState().linkPreview?.title).toBe('【FF项目】0元礼包'))
    expect(useAppStore.getState().linkTitleCache[sourceUrl]).toBe('【FF项目】0元礼包')
    fireEvent.click(screen.getByLabelText('返回管线服务'))
    expect(useAppStore.getState().route).toBe('workbench')
    expect(useAppStore.getState().linkPreview).toBeNull()
  })

  it('renders loaded markdown content as a document instead of a webview', () => {
    mockApi()
    useAppStore.setState({
      route: 'assistant',
      linkPreview: {
        kind: 'markdown',
        href: 'docs/architecture.md',
        title: '架构说明',
        protocol: 'file:',
        isFeishu: false,
        sourceId: 'source-1',
        path: 'docs/architecture.md',
        content: '# 架构说明\n\n这是正文。',
        loading: false,
      },
    })
    render(<LinkPreviewSurface />)
    const document = screen.getByTestId('markdown-preview-document')
    expect(document.querySelector('h1')).toHaveTextContent('架构说明')
    expect(document).toHaveTextContent('这是正文。')
    expect(document.querySelector('webview')).toBeNull()
  })
})
