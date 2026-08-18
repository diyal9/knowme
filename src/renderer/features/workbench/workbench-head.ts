/**
 * 工作台顶栏 Tab / 标题映射。
 * 自动化中心是独立路由，不得映射成「专家协作」。
 */
import type { WorkbenchSurface } from '../../../domain/rail'

export type WorkbenchTabMode = 'tasks' | 'workflows' | 'daemon'

export function resolveWorkbenchTabMode(
  surface: WorkbenchSurface,
  managePanel: 'daemon' | 'workflows' | 'automation',
): WorkbenchTabMode | '' {
  if (surface === 'taskhome') return 'tasks'
  if (surface === 'shelf') return 'workflows'
  if (surface === 'manage') {
    if (managePanel === 'daemon') return 'daemon'
    if (managePanel === 'automation') return ''
    return 'workflows'
  }
  return ''
}

export function workbenchHeadTitle(
  route: string,
  surface: WorkbenchSurface,
): string {
  if (surface === 'studio') return '编排'
  if (route === 'automation') return '自动化'
  return '工作台'
}
