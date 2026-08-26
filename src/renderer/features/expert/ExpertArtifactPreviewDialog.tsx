import { useEffect } from 'react'
import type { AgentRunArtifact, WorkbenchTask } from '../../../shared/api'
import { expertDeliverableTitle } from '../../../domain/expert-present'
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

  const title = expertDeliverableTitle(item.title)
  const artifactType = artifact?.type || item.type || 'document'

  return (
    <div className="wb-expert-artifact-mask" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="wb-expert-artifact-dialog" role="dialog" aria-modal="true" aria-labelledby="expertArtifactDialogTitle">
        <header>
          <h2 id="expertArtifactDialogTitle">{title}</h2>
          <div className="wb-expert-artifact-dialog-actions">
            <span>{expertArtifactKindLabel(artifactType)} · 第 {item.version || 1} 版</span>
            <button type="button" aria-label="关闭成果物预览" onClick={onClose}><Icon name="close" /></button>
          </div>
        </header>
        <div className="wb-expert-artifact-dialog-body">
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
