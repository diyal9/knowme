import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogViewerSurface } from './LogViewerSurface'
import { mockApi } from '../../test/helpers'

describe('log-viewer-surface', () => {
  beforeEach(() => {
    mockApi({
      logsQuery: vi.fn(async () => ({
        ok: true,
        entries: [{
          ts: new Date().toISOString(),
          level: 'info',
          category: 'operation',
          event: 'open-log-viewer',
          msg: '打开日志中心',
        }],
      })),
      logsCounts: vi.fn(async () => ({ ok: true, counts: { total: 1, operation: 1 } })),
    })
  })
  afterEach(() => cleanup())

  it('loads and shows log entries', async () => {
    render(<LogViewerSurface />)
    await waitFor(() => expect(screen.getByTestId('log-viewer-surface')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('打开日志中心')).toBeInTheDocument())
    expect(screen.getByTestId('log-list')).toBeInTheDocument()
  })
})
