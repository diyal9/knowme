import { useLayoutEffect, useRef } from 'react'
import { mountStickyIcons, stickyIconSvg } from './sticky-icons'

export function Icon({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const html = stickyIconSvg(name)
    if (html) el.innerHTML = html
    else mountStickyIcons(el)
  }, [name])

  return <span ref={ref} className="ico" data-icon={name} />
}
