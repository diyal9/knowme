import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useKnowMeIcons } from './useKnowMeIcons'
import * as icons from './knowme-icons'

function IconProbe({ dep }: { dep: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useKnowMeIcons(dep, ref)
  return <div ref={ref} data-testid="scoped-root"><span data-icon="workbench" /></div>
}

describe('useKnowMeIcons', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mounts only when rootRef is attached', () => {
    const mountSpy = vi.spyOn(icons, 'mountKnowMeIcons').mockImplementation(() => undefined)
    const { rerender } = render(<IconProbe dep={1} />)
    expect(mountSpy).toHaveBeenCalled()
    expect(mountSpy.mock.calls[0]?.[0]).toHaveProperty('querySelector')
    mountSpy.mockClear()
    rerender(<IconProbe dep={2} />)
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  it('no-ops without rootRef', () => {
    const mountSpy = vi.spyOn(icons, 'mountKnowMeIcons').mockImplementation(() => undefined)
    function NoRoot() {
      useKnowMeIcons(1)
      return <div />
    }
    render(<NoRoot />)
    expect(mountSpy).not.toHaveBeenCalled()
  })
})
