/**
 * 右侧链接预览面冒烟：store 打开后挂载 surface 与 webview host。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
})
