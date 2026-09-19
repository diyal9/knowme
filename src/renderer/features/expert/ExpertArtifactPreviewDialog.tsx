import { useEffect } from 'react'
import type { AgentRunArtifact, WorkbenchTask } from '../../../shared/api'
import { expertDeliverableDisplayTitle } from '../../../domain/expert-present'
import { expertArtifactKindLabel } from '../../../domain/expert-artifact'
import { Icon } from '../../app/Icon'
import { ExpertDeliverableArtifact } from './ExpertDeliverableArtifact'

type Deliverable = NonNullable<WorkbenchTask['deliverables']>[number]

export function ExpertArtifactPreviewDialog({
  item,
  artifact,
  fallback,
  loading,
  onClose,
}: {
  item: Deliverable
  artifact?: AgentRunArtifact | null
  fallback?: string
  loading?: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const title = expertDeliverableDisplayTitle(item.title)
  const artifactType = artifact?.type || item.type || 'document'

  return (
    <div className="wb-expert-artifact-mask" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="wb-expert-artifact-dialog" role="dialog" aria-modal="true" aria-labelledby="expertArtifactDialogTitle">
        <header>
          <div className="wb-expert-artifact-dialog-title">
            <h2 id="expertArtifactDialogTitle">{title}</h2>
            <span>{expertArtifactKindLabel(artifactType)} · 第 {item.version || 1} 版</span>
            <span className="wb-expert-artifact-dialog-submeta">只读预览</span>
          </div>
          <span className="wb-expert-artifact-dialog-mode" aria-label="预览模式">阅读模式</span>
          <button type="button" className="wb-expert-artifact-dialog-close" aria-label="关闭文档预览" onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="wb-expert-artifact-dialog-body" role="document" aria-label={`${title}正文`}>
          <ExpertDeliverableArtifact
            artifact={artifact}
            fallback={fallback}
            loading={loading}
            title={title}
            type={item.type}
            version={item.version}
            showToolbar={false}
          />
        </div>
      </section>
    </div>
  )
}
