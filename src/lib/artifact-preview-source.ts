const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
}

const DEFAULT_MAX_PREVIEW_BYTES = 24 * 1024 * 1024

function localPathFromSource(pathApi: typeof import('node:path'), source: unknown): string {
  const raw = String(source || '').trim()
  if (!raw) return ''
  if (/^file:/i.test(raw)) {
    try {
      const parsed = new URL(raw)
      if (parsed.protocol !== 'file:') return ''
      let pathname = decodeURIComponent(parsed.pathname)
      if (process.platform === 'win32' && /^\/[a-z]:/i.test(pathname)) pathname = pathname.slice(1)
      return pathApi.normalize(pathname)
    } catch {
      return ''
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw)) return ''
  return pathApi.resolve(raw)
}

/**
 * Resolve a local image artifact into a renderer-safe data URL. Model/tool supplied paths
 * never become arbitrary browser URLs; only real image files below the size cap are read.
 */
export async function readArtifactPreviewSource(
  fsApi: typeof import('node:fs'),
  pathApi: typeof import('node:path'),
  source: unknown,
  maxBytes = DEFAULT_MAX_PREVIEW_BYTES,
): Promise<{ ok: boolean; source?: string; error?: string }> {
  const filePath = localPathFromSource(pathApi, source)
  if (!filePath) return { ok: false, error: '不支持的预览地址' }
  const mime = IMAGE_MIME_BY_EXTENSION[pathApi.extname(filePath).toLowerCase()]
  if (!mime) return { ok: false, error: '该文件类型不支持图片预览' }
  try {
    const stat = await fsApi.promises.stat(filePath)
    if (!stat.isFile()) return { ok: false, error: '预览目标不是文件' }
    if (stat.size > maxBytes) return { ok: false, error: '图片过大，无法直接预览' }
    const bytes = await fsApi.promises.readFile(filePath)
    return { ok: true, source: `data:${mime};base64,${bytes.toString('base64')}` }
  } catch {
    return { ok: false, error: '图片文件不存在或无法读取' }
  }
}

