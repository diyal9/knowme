import type { AgentRunArtifact } from '../../../shared/api'
import {
  expertArtifactBody,
  expertArtifactKind,
  expertArtifactKindLabel,
} from '../../../domain/expert-artifact'
import { ContentView } from '../content-view/ContentView'

export function ExpertDeliverableArtifact({
  artifact,
  fallback,
  loading,
  title,
  type,
  version,
  showToolbar = true,
}: {
  artifact?: AgentRunArtifact | null
  fallback?: string
  loading?: boolean
  title?: string
  type?: string
  version?: number
  showToolbar?: boolean
}) {
  const artifactType = artifact?.type || type || 'document'
  const kind = expertArtifactKind(artifactType)
  const body = expertArtifactBody(artifact, fallback)
  const displayTitle = String(artifact?.title || title || '').trim()
  const summaryFallback = !artifact && Boolean(body)

  return (
    <section className={`wb-artifact-view is-${kind}`} data-testid="expert-artifact-view" data-artifact-kind={kind}>
      {showToolbar ? (
        <header className="wb-artifact-toolbar">
          <div>
            <span>{summaryFallback ? '成果摘要' : expertArtifactKindLabel(artifactType)}</span>
            {displayTitle ? <strong>{displayTitle}</strong> : null}
          </div>
          <span>第 {version || 1} 版</span>
        </header>
      ) : null}
      {loading ? (
        <div className="wb-artifact-loading" role="status">
          <span aria-hidden="true" />
          <div><strong>正在打开完整产物</strong><p>正在读取专家提交的正文。</p></div>
        </div>
      ) : body ? (
        <>
          {summaryFallback ? <p className="wb-artifact-fallback-note">完整产物暂时不可用，以下显示任务摘要。</p> : null}
          <article className="wb-artifact-sheet" aria-label={`${expertArtifactKindLabel(artifactType)}内容`}>
            <ContentView source={body} className="wb-artifact-content" />
          </article>
        </>
      ) : (
        <div className="wb-artifact-empty">
          <strong>暂时无法打开完整产物</strong>
          <span>可以稍后重试，任务记录和验收状态不会丢失。</span>
        </div>
      )}
    </section>
  )
}
