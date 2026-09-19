import { useEffect, useState } from 'react'
import {
  artifactPreviewActionLabel,
  artifactPreviewStateLabel,
  type ArtifactPreviewAction,
  type ArtifactPreviewContract,
} from '../../../domain/artifact-preview'
import { conversationFileKindLabel } from '../../../domain/conversation-file'
import { Icon } from '../../app/Icon'
import { useArtifactPreviewSource } from './useArtifactPreviewSource'
import './artifact-preview.css'

function kindIcon(kind: ArtifactPreviewContract['kind']): string {
  if (kind === 'image') return 'image'
  if (kind === 'code') return 'terminal'
  if (kind === 'table') return 'table'
  if (kind === 'link') return 'externalLink'
  return 'file'
}

function actionIcon(action: ArtifactPreviewAction): string {
  if (action === 'accept') return 'check'
  if (action === 'revise' || action === 'reject') return 'edit'
  if (action === 'copy') return 'copy'
  if (action === 'continue') return 'externalLink'
  if (action === 'retry') return 'refresh'
  return 'eye'
}

function readableArtifactExcerpt(value: unknown, title: string): string {
  let excerpt = String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^[\s\S]*?^\s*---+\s*$/m, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s*|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[|*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const plainTitle = String(title || '').replace(/\.[a-z0-9]{1,8}$/i, '').trim()
  if (plainTitle && excerpt.toLocaleLowerCase().startsWith(plainTitle.toLocaleLowerCase())) {
    excerpt = excerpt.slice(plainTitle.length).replace(/^[\s:：·—-]+/, '')
  }
  if (excerpt.length > 180) return `${excerpt.slice(0, 179).trimEnd()}…`
  return excerpt
}

export function ArtifactActionBar({
  artifact,
  onAction,
  showState = false,
}: {
  artifact: ArtifactPreviewContract
  onAction?: (action: ArtifactPreviewAction, artifact: ArtifactPreviewContract) => void
  showState?: boolean
}) {
  const secondaryActions = artifact.actions.filter((action) => action !== 'open')
  if (!secondaryActions.length && !showState) return null
  return (
    <div className="km-artifact-preview-actions" data-testid="artifact-action-bar">
      {showState ? (
        <span className={`km-artifact-preview-state is-${artifact.state}`}>
          <i aria-hidden="true" />{artifactPreviewStateLabel(artifact.state)}
        </span>
      ) : null}
      {secondaryActions.map((action) => (
        <button
          type="button"
          key={action}
          className={action === 'accept' ? 'is-primary' : undefined}
          onClick={() => onAction?.(action, artifact)}
          disabled={!onAction}
        >
          <Icon name={actionIcon(action)} />
          <span>{artifactPreviewActionLabel(action)}</span>
        </button>
      ))}
    </div>
  )
}

export function ArtifactPreview({
  artifact,
  onAction,
  showActions = true,
  excerpt,
}: {
  artifact: ArtifactPreviewContract
  onAction?: (action: ArtifactPreviewAction, artifact: ArtifactPreviewContract) => void
  showActions?: boolean
  excerpt?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [artifact.id, artifact.source])

  const isImage = artifact.kind === 'image'
  const resolvedImage = useArtifactPreviewSource(isImage ? (artifact.sources || artifact.source) : undefined)
  const isLoading = artifact.state === 'loading' || resolvedImage.loading
  const canOpen = artifact.actions.includes('open') && Boolean(onAction)
  const excerptText = artifact.kind === 'document' ? readableArtifactExcerpt(excerpt, artifact.title) : ''
  const metadata = [
    conversationFileKindLabel(artifact.kind),
    artifact.version ? `第 ${artifact.version} 版` : '',
    artifact.fileName && artifact.fileName !== artifact.title ? artifact.fileName : '',
  ].filter(Boolean).join(' · ')

  if (isImage) return (
    <article
      className={`km-artifact-preview is-image is-${artifact.state}`}
      data-testid="artifact-preview"
      data-artifact-contract={artifact.protocol}
      data-artifact-kind="image"
    >
      {isLoading ? (
        <div className="km-artifact-preview-media is-loading" role="status"><span aria-hidden="true" />正在读取图片</div>
      ) : resolvedImage.source && !imageFailed ? (
        <button
          type="button"
          className="km-artifact-preview-media"
          disabled={!canOpen}
          aria-label={canOpen ? `查看${artifact.title}原图` : undefined}
          onClick={() => onAction?.('open', { ...artifact, source: resolvedImage.source })}
        >
          <img
            src={resolvedImage.source}
            alt={artifact.title}
            onError={() => {
              if (!resolvedImage.onSourceError()) setImageFailed(true)
            }}
          />
          {canOpen ? <span className="km-artifact-preview-zoom"><Icon name="eye" />查看大图</span> : null}
        </button>
      ) : (
        <div className="km-artifact-preview-media is-empty" role="status">
          <Icon name="image" /><span>{resolvedImage.error || '图片预览不可用'}</span>
        </div>
      )}
    </article>
  )

  return (
    <article
      className={`km-artifact-preview is-${artifact.kind} is-${artifact.state}${excerptText ? ' has-excerpt' : ''}`}
      data-testid="artifact-preview"
      data-artifact-contract={artifact.protocol}
      data-artifact-kind={artifact.kind}
    >
      <header className="km-artifact-preview-head">
        <span className="km-artifact-preview-icon" aria-hidden="true"><Icon name={kindIcon(artifact.kind)} /></span>
        <div className="km-artifact-preview-title">
          <strong>{artifact.title}</strong>
          <span>{metadata}</span>
        </div>
        <span className={`km-artifact-preview-state is-${artifact.state}`}>
          <i aria-hidden="true" />{artifactPreviewStateLabel(artifact.state)}
        </span>
        {canOpen ? (
          <button
            type="button"
            className="km-artifact-preview-open"
            aria-label={`打开${artifact.title}`}
            title="打开"
            onClick={() => onAction?.('open', artifact)}
          >
            <Icon name="eye" />
            {excerptText ? <span>预览</span> : null}
          </button>
        ) : null}
      </header>

      {excerptText ? <div className="km-artifact-preview-excerpt"><p>{excerptText}</p></div> : null}

      {showActions ? <ArtifactActionBar artifact={artifact} onAction={onAction} /> : null}
    </article>
  )
}
