/**
 * 表面分包：生产 React.lazy；测试由 surface-registry 同步解析。
 * 不负责路由（见 AppShell）。
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * 具名导出转 default。入参用 unknown 避开 named-then 的 never/object 对立；
 * 出参用 P，调用方显式泛型（Run/Settings）或默认 object。
 */
export function lazySurface<P extends object = object>(
  loader: () => Promise<{ default: unknown }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(loader as () => Promise<{ default: ComponentType<P> }>) as LazyExoticComponent<
    ComponentType<P>
  >
}

/** 懒表面尚未解析时的占位；测试可 wait 其消失。 */
export function SurfacePending() {
  return <div data-testid="km-surface-pending" aria-busy="true" />
}
