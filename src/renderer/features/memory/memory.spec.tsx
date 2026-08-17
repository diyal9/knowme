import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemorySurface } from './MemorySurface'
import { mockApi } from '../../test/helpers'

describe('memory-surface', () => {
  beforeEach(() => {
    mockApi({
      initMemory: (cb: (items: { kind?: string; summary?: string; ts?: string }[]) => void) => cb([
        { kind: 'open', summary: '打开工作台', ts: new Date().toISOString() },
      ]),
    })
  })
  afterEach(() => cleanup())

  it('lists recent memory records', async () => {
    render(<MemorySurface />)
    await waitFor(() => expect(screen.getByTestId('memory-surface')).toBeInTheDocument())
    expect(screen.getByText('打开工作台')).toBeInTheDocument()
  })

  it('does not open a notes window when a memory row is clicked', async () => {
    const openNote = vi.fn()
    mockApi({
      initMemory: (cb: (items: { kind?: string; summary?: string; ts?: string }[]) => void) => cb([
        { kind: 'open', summary: '打开工作台', ts: new Date().toISOString() },
      ]),
      openNoteWindow: openNote,
    } as never)
    render(<MemorySurface />)
    fireEvent.click(await screen.findByTestId('memory-row'))
    expect(openNote).not.toHaveBeenCalled()
  })
})
