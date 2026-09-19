import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createArtifactPreviewContract } from '../../../domain/artifact-preview'
import { ArtifactPreview } from '../artifact/ArtifactPreview'
import type { AgentRunArtifact, WorkbenchTask } from '../../../shared/api'
import { artifactPreviewSource, artifactPreviewSources } from '../../../domain/artifact-preview'
import { expertDeliverableDisplayTitle } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { useArtifactPreviewSource } from '../artifact/useArtifactPreviewSource'

type Deliverable = NonNullable<WorkbenchTask['deliverables']>[number]

export interface ExpertImagePreviewItem {
  id: string
  title: string
  source?: string
  sources?: string[]
  version?: number
  loading?: boolean
}

export function imagePreviewSource(artifact: AgentRunArtifact | null | undefined, body = ''): string {
  return artifactPreviewSource(artifact, body)
}

export function imagePreviewItem(
  item: Deliverable,
  artifact?: AgentRunArtifact | null,
  fallback?: string,
  loading = false,
): ExpertImagePreviewItem {
  const itemTitle = expertDeliverableDisplayTitle(item.title)
  const artifactTitle = expertDeliverableDisplayTitle(artifact?.title)
  const title = itemTitle && itemTitle !== '生成图片'
    ? itemTitle
    : artifactTitle || itemTitle || '图片预览'
  return {
    id: `${String(item.deliverableId || item.artifactRef || item.title || 'image')}-${item.version || 1}`,
    title,
    source: imagePreviewSource(artifact, fallback || artifact?.body || ''),
    sources: artifactPreviewSources(artifact, fallback || artifact?.body || ''),
    version: item.version,
    loading,
  }
}

export function ExpertImagePreview({
  images,
  onOpen,
}: {
  images: ExpertImagePreviewItem[]
  onOpen?: (index: number) => void
}) {
  if (!images.length) return null
  return (
    <div className="wb-image-preview-sequence" aria-label="图片预览">
        {images.map((image, index) => (
          <ArtifactPreview key={image.id} artifact={createArtifactPreviewContract({
            id: image.id, type: 'image', title: image.title, source: image.source,
            sources: image.sources,
            state: image.loading ? 'loading' : 'ready', actions: ['open'],
          })} onAction={onOpen ? () => onOpen(index) : undefined} />
        ))}
    </div>
  )
}

function ResolvedDialogImage({ image }: { image: ExpertImagePreviewItem }) {
  const resolved = useArtifactPreviewSource(image.sources || image.source)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image.id, image.source])
  if (image.loading || resolved.loading) return <div className="wb-image-preview-loading is-dialog" role="status"><span aria-hidden="true" />正在读取图片</div>
  if (resolved.source && !failed) return <img src={resolved.source} alt={image.title || '图片预览'} onError={() => { if (!resolved.onSourceError()) setFailed(true) }} />
  return <div className="wb-image-preview-empty"><Icon name="image" /><span>{resolved.error || '图片暂时不可用'}</span></div>
}

function ResolvedDialogThumbnail({ image, fallback }: { image: ExpertImagePreviewItem; fallback: number }) {
  const resolved = useArtifactPreviewSource(image.sources || image.source)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image.id, image.source])
  return resolved.source && !failed
    ? <img src={resolved.source} alt="" onError={() => { if (!resolved.onSourceError()) setFailed(true) }} />
    : <span>{fallback}</span>
}

export function ExpertImagePreviewDialog({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: ExpertImagePreviewItem[]
  initialIndex?: number
  onClose: () => void
}) {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)))
  useEffect(() => {
    setActiveIndex(Math.max(0, Math.min(initialIndex, images.length - 1)))
  }, [initialIndex, images.length])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setActiveIndex((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setActiveIndex((current) => Math.min(images.length - 1, current + 1))
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [images.length, onClose])

  const active = images[activeIndex]
  if (!active) return null
  return createPortal(
    <div className="wb-expert-artifact-mask wb-expert-image-mask" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="wb-expert-image-dialog" role="dialog" aria-modal="true" aria-labelledby="expertImageDialogTitle">
        <header>
          <div>
            <h2 id="expertImageDialogTitle">{active.title || '图片预览'}</h2>
            <span>{images.length > 1 ? `${activeIndex + 1} / ${images.length}` : `第 ${active.version || 1} 版`}</span>
          </div>
          <button type="button" aria-label="关闭图片预览" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="wb-expert-image-dialog-body">
          <ResolvedDialogImage image={active} />
        </div>
        {images.length > 1 ? (
          <footer className="wb-expert-image-dialog-nav">
            <button type="button" aria-label="上一张图片" disabled={activeIndex === 0} onClick={() => setActiveIndex((current) => current - 1)}><Icon name="chevronLeft" /></button>
            <div className="wb-expert-image-thumbs" aria-label="图片列表">
              {images.map((image, index) => (
                <button type="button" key={image.id} className={index === activeIndex ? 'is-active' : ''} aria-label={`查看第 ${index + 1} 张图片`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => setActiveIndex(index)}>
                  <ResolvedDialogThumbnail image={image} fallback={index + 1} />
                </button>
              ))}
            </div>
            <button type="button" aria-label="下一张图片" disabled={activeIndex === images.length - 1} onClick={() => setActiveIndex((current) => current + 1)}><Icon name="chevronRight" /></button>
          </footer>
        ) : null}
      </section>
    </div>, document.body
  )
}
