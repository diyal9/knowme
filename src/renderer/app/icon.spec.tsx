import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from './Icon'
import './knowme-icons'

describe('Icon', () => {
  it('injects KnowMeIcons svg for a known glyph', () => {
    const { container } = render(<Icon name="chat" />)
    const ico = container.querySelector('.ico[data-icon="chat"]')
    expect(ico?.querySelector('svg')).toBeTruthy()
  })

  it('mounts lucide viewBox icons used by rail', () => {
    const { container } = render(<Icon name="workbench" />)
    const svg = container.querySelector('.ico[data-icon="workbench"] svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
  })
})
