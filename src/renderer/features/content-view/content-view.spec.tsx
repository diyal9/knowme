import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '../../test/helpers'
import { ContentView } from './ContentView'

describe('ContentView', () => {
  afterEach(() => cleanup())

  it('renders feishu doc links as a shared card', () => {
    render(<ContentView source={'见 [纪要](https://sample.feishu.cn/docx/abc123)'} />)
    const card = screen.getByTestId('feishu-resource-card')
    expect(card).toHaveTextContent('飞书文档')
    expect(card).toHaveTextContent('纪要')
    expect(card).toHaveAttribute('href', 'https://sample.feishu.cn/docx/abc123')
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
})
