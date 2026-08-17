/** Side-effect: registers window.StickyIcons (Codicon + Lucide paths). */
import '../../ui-icons.js'

declare global {
  interface Window {
    StickyIcons?: {
      svg: (name: string) => string
      mount: (root?: ParentNode) => void
      paths: Record<string, string>
    }
  }
}

export function stickyIconSvg(name: string): string {
  return window.StickyIcons?.svg(name) ?? ''
}

export function mountStickyIcons(root: ParentNode = document): void {
  window.StickyIcons?.mount(root)
}
