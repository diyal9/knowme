import { useLayoutEffect } from 'react'
import { mountStickyIcons } from './sticky-icons'

export function useStickyIcons(dep?: unknown) {
  useLayoutEffect(() => {
    mountStickyIcons(document)
  }, [dep])
}
