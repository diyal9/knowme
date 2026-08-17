/**
 * Map logical avatar paths (assets/avatars/...) to Vite-resolved URLs that work
 * under Electron file:// and the Vite dev server.
 */
const avatarModules = import.meta.glob<string>('../../assets/avatars/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const URL_BY_LOGICAL_PATH = new Map<string, string>()

for (const [filePath, url] of Object.entries(avatarModules)) {
  const match = filePath.match(/assets\/avatars\/(.+\.png)$/)
  if (match) URL_BY_LOGICAL_PATH.set(`assets/avatars/${match[1]}`, url)
}

/** Resolve agent-identity logical path to a bundler URL. */
export function resolveAvatarAssetUrl(logicalPath: string): string {
  const key = String(logicalPath || '').trim()
  if (!key) return ''
  return URL_BY_LOGICAL_PATH.get(key) || ''
}
