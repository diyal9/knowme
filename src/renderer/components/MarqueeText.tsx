import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type MarqueeStyle = CSSProperties & { '--km-marquee-distance'?: string }

/**
 * A single-line label that stays quiet by default and reveals overflow on hover.
 * It measures the real rendered content, so short labels never animate.
 */
export function MarqueeText({
  children,
  className = '',
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  const viewportRef = useRef<HTMLSpanElement | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const [distance, setDistance] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current
      const content = contentRef.current
      if (!viewport || !content) return
      setDistance(Math.max(0, Math.ceil(content.scrollWidth - viewport.clientWidth)))
    }
    measure()
    const frame = requestAnimationFrame(measure)
    const fontsReady = typeof document !== 'undefined' && document.fonts
      ? document.fonts.ready.then(measure)
      : undefined
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (contentRef.current) observer.observe(contentRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      void fontsReady
    }
  }, [children])

  const style: MarqueeStyle | undefined = distance > 0
    ? { '--km-marquee-distance': `-${distance}px` }
    : undefined
  const classes = ['km-marquee-text', distance > 0 ? 'is-overflowing' : '', className].filter(Boolean).join(' ')

  return (
    <span ref={viewportRef} className={classes} style={style} title={title}>
      <span ref={contentRef} className="km-marquee-text-content">{children}</span>
    </span>
  )
}
