import { useLayoutEffect, useRef } from 'react'
import { mountStickyIcons, stickyIconSvg } from '../../app/sticky-icons'

export function TreeIcon({ name, extraClass = '' }: { name: string; extraClass?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const html = stickyIconSvg(name)
    if (html) el.innerHTML = html
    else mountStickyIcons(el)
  }, [name])

  return <span ref={ref} className={extraClass ? `ico ${extraClass}` : 'ico'} data-icon={name} />
}
