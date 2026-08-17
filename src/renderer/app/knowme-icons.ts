/**
 * 渲染层图标桥：加载 ui-icons.js 并在 window 上暴露 KnowMeIcons。
 * 不负责 SVG path 定义（见 src/ui-icons.js）。
 */
import '../../ui-icons.js'

declare global {
  interface Window {
    KnowMeIcons?: {
      svg: (name: string) => string
      mount: (root?: ParentNode) => void
      paths: Record<string, string>
    }
  }
}

/** 按 data-icon 名取内联 SVG 字符串；未知名返回空串。 */
export function knowMeIconSvg(name: string): string {
  return window.KnowMeIcons?.svg(name) ?? ''
}

/** 在 root 下扫描 [data-icon] 并注入 SVG；调用方 MUST 传入作用域 root，禁止默认 document。 */
export function mountKnowMeIcons(root: ParentNode): void {
  window.KnowMeIcons?.mount(root)
}
