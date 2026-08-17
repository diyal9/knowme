/**
 * React hook：依赖变化后对 surface 根节点执行 KnowMeIcons mount。
 * 调用方 MUST 传入 rootRef；无 root 时 no-op（局部 Icon 组件自行 mount）。
 */
import { useLayoutEffect, type RefObject } from 'react'
import { mountKnowMeIcons } from './knowme-icons'

export function useKnowMeIcons(dep?: unknown, rootRef?: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef?.current
    if (!root) return
    mountKnowMeIcons(root)
  }, [dep, rootRef])
}
