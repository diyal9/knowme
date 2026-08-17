import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetAppStore, useAppStore } from '../../test/helpers'
import { ContentView } from './ContentView'

describe('ContentView', () => {
  afterEach(() => {
    cleanup()
    resetAppStore()
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
})
