import type { ExpertLike } from '../../domain/expert-present'
import { expertAvatarSrc } from '../../domain/expert-present'
import { resolveAvatarAssetUrl } from './avatar-urls'

/** Renderer-only: logical preset path → Vite/Electron-safe img src. */
export function resolveExpertAvatarUrl(agent: ExpertLike): string {
  return resolveAvatarAssetUrl(expertAvatarSrc(agent))
}
