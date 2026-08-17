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
    if (managePanel === 'automation') return 'tasks'
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
