import { conversationFileKind, type ConversationFileKind } from './conversation-file'
import { extractImageUrls } from './agent-session'
import type { AgentRunArtifact } from '../shared/api'

export const ARTIFACT_PREVIEW_PROTOCOL = 'knowme.artifact-preview/v1' as const

function extractImageLinkSource(body: string): string {
  const source = String(body || '')
  const markdownLink = /!?\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)\s]+)\)/i
  const markdownMatch = markdownLink.exec(source)
  if (markdownMatch?.[1]) return markdownMatch[1]
  const bareLink = /(https?:\/\/[^\s<>'")\]]+|data:image\/[^\s<>'")\]]+)/i.exec(source)
  return bareLink?.[1] || ''
}

function isUsableImageSource(value: unknown): value is string {
  const source = String(value || '').trim()
  if (!source) return false
  // Browser-safe sources can be rendered directly. Ordinary local paths are
  // resolved by the preload bridge; opaque URI schemes are identifiers, not media.
  if (/^(?:https?:\/\/|data:image\/|blob:|file:)/i.test(source)) return true
  if (/^[a-z][a-z\d+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) return false
  return true
}

/**
 * Resolve the platform-level image source order for every Agent artifact surface.
 * Provider/result URLs must win over stale local paths; opaque IDs must never be
 * handed to the browser as if they were image files.
 */
export function artifactPreviewSource(
  artifact: Pick<AgentRunArtifact, 'url' | 'targetPath' | 'path' | 'meta' | 'body'> | null | undefined,
  body = '',
): string {
  return artifactPreviewSources(artifact, body)[0] || ''
}

/**
 * Return the ordered media candidates for a generic artifact preview.
 *
 * A provider URL is preferred because it is the freshest representation, but
 * a decoded local artifact is still a valid recovery source when a CDN URL
 * expires or is not reachable from the renderer.
 */
export function artifactPreviewSources(
  artifact: Pick<AgentRunArtifact, 'url' | 'targetPath' | 'path' | 'meta' | 'body'> | null | undefined,
  body = '',
): string[] {
  const artifactBody = body || artifact?.body || ''
  const bodySources = [...extractImageUrls(artifactBody), extractImageLinkSource(artifactBody)]
  const candidates = [
    artifact?.url,
    ...bodySources,
    artifact?.targetPath,
    artifact?.path,
    artifact?.meta?.path,
  ]
  return [...new Set(candidates.filter(isUsableImageSource))]
}

export type ArtifactPreviewState =
  | 'loading'
  | 'ready'
  | 'pending'
  | 'accepted'
  | 'revising'
  | 'rejected'
  | 'failed'

export type ArtifactPreviewAction =
  | 'open'
  | 'accept'
  | 'revise'
  | 'reject'
  | 'copy'
  | 'continue'
  | 'retry'

/**
 * 平台级产物预览契约。Agent 与工具只描述“产物是什么、当前状态、允许做什么”，
 * 对话界面统一决定图片、文档、表格、代码和链接的展示方式。
 */
export interface ArtifactPreviewContract {
  protocol: typeof ARTIFACT_PREVIEW_PROTOCOL
  id: string
  kind: ConversationFileKind
  title: string
  source?: string
  /** Ordered fallback media sources; the first source remains the canonical preview source. */
  sources?: string[]
  fileName?: string
  version?: number
  state: ArtifactPreviewState
  actions: ArtifactPreviewAction[]
}

export function createArtifactPreviewContract(input: {
  id: unknown
  type?: unknown
  title?: unknown
  source?: unknown
  sources?: readonly unknown[]
  fileName?: unknown
  version?: unknown
  state?: ArtifactPreviewState
  actions?: readonly ArtifactPreviewAction[]
}): ArtifactPreviewContract {
  const source = String(input.source || '').trim()
  const sources = [...new Set([
    source,
    ...(Array.isArray(input.sources) ? input.sources : []).map((item) => String(item || '').trim()),
  ].filter(Boolean))]
  const canonicalSource = sources[0] || ''
  const title = String(input.title || input.fileName || '未命名产物').trim()
  const parsedVersion = Number(input.version)
  return {
    protocol: ARTIFACT_PREVIEW_PROTOCOL,
    id: String(input.id || `${title}-${parsedVersion || 1}`),
    kind: conversationFileKind(input.type, title, canonicalSource),
    title,
    source: canonicalSource || undefined,
    ...(sources.length > 1 ? { sources } : {}),
    fileName: String(input.fileName || '').trim() || undefined,
    version: Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : undefined,
    state: input.state || 'ready',
    actions: [...new Set(input.actions || [])],
  }
}

export function artifactPreviewStateLabel(state: ArtifactPreviewState): string {
  if (state === 'loading') return '读取中'
  if (state === 'pending') return '待验收'
  if (state === 'accepted') return '已接受'
  if (state === 'revising') return '修改中'
  if (state === 'rejected') return '已拒绝'
  if (state === 'failed') return '不可用'
  return '已就绪'
}

export function artifactPreviewActionLabel(action: ArtifactPreviewAction): string {
  if (action === 'accept') return '接受成果'
  if (action === 'revise') return '退回修改'
  if (action === 'reject') return '拒绝'
  if (action === 'copy') return '复制'
  if (action === 'continue') return '继续处理'
  if (action === 'retry') return '重试'
  return '打开'
}
