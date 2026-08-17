import { useLayoutEffect, useRef } from 'react'
import { mountKnowMeIcons, knowMeIconSvg } from './knowme-icons'

export function Icon({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const html = knowMeIconSvg(name)
    if (html) el.innerHTML = html
    else mountKnowMeIcons(el)
  }, [name])

  return <span ref={ref} className="ico" data-icon={name} />
}
