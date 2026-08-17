import { useLayoutEffect, useRef } from 'react'
import { mountKnowMeIcons, knowMeIconSvg } from '../../app/knowme-icons'

export function TreeIcon({ name, extraClass = '' }: { name: string; extraClass?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const html = knowMeIconSvg(name)
    if (html) el.innerHTML = html
    else mountKnowMeIcons(el)
  }, [name])

  return <span ref={ref} className={extraClass ? `ico ${extraClass}` : 'ico'} data-icon={name} />
}
