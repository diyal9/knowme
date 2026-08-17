/**
 * 表面级 CSS 懒加载：同一 id 只 import 一次，避免首屏打进工作台/Hub/Run 全量样式。
 * 不负责卸载（Electron 单页会话内保留已加载表）。
 */

const loaded = new Set<string>()

/** 幂等加载表面样式；importer 应为 `() => import('...css')`。 */
export function ensureSurfaceCss(id: string, importer: () => Promise<unknown>): void {
  if (loaded.has(id)) return
  loaded.add(id)
  void importer().catch(() => {
    // 允许重试：失败时清掉标记
    loaded.delete(id)
  })
}
