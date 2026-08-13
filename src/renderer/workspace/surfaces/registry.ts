/**
 * Surface registry for progressive React ownership.
 * Status: hosted = legacy DOM/scripts; react = React-owned UI.
 */
export type SurfaceId =
  | 'shell-rail'
  | 'assistant'
  | 'shelf'
  | 'taskhome'
  | 'run'
  | 'daemon-review'
  | 'manage'
  | 'studio'

export type SurfaceStatus = 'hosted' | 'react'

export const WORKSPACE_SURFACES: Record<SurfaceId, SurfaceStatus> = {
  'shell-rail': 'hosted',
  assistant: 'hosted',
  shelf: 'hosted',
  taskhome: 'hosted',
  run: 'hosted',
  'daemon-review': 'hosted',
  manage: 'hosted',
  studio: 'hosted',
}

export function surfaceStatus(id: SurfaceId): SurfaceStatus {
  return WORKSPACE_SURFACES[id]
}
