import { useEffect } from 'react'
import '../../styles/knowledge-chrome.css'
import { useAppStore } from '../../app/store'
import { KnowledgeHealthPage } from './KnowledgeHealthPage'
import { KnowledgeLibrariesPage } from './KnowledgeLibrariesPage'
import { KnowledgeOrganizePage } from './KnowledgeOrganizePage'
import { KnowledgeReviewPage } from './KnowledgeReviewPage'
import { KnowledgeSourcesPage } from './KnowledgeSourcesPage'
import { KnowledgeStatusPage } from './KnowledgeStatusPage'
import { KnowledgeTopbar } from './KnowledgeTopbar'

export function KnowledgeSurface() {
  const page = useAppStore((s) => s.knowledgePage)
  const message = useAppStore((s) => s.knowledgeMessage)
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const loadKnowledgeIo = useAppStore((s) => s.loadKnowledgeIo)
  const loadBrain = useAppStore((s) => s.loadBrain)
  const brainLoaded = useAppStore((s) => Boolean(s.brainSnapshot))

  useEffect(() => {
    if (page === 'status') {
      if (!brainLoaded) void loadBrain()
      return
    }
    if (page === 'libraries' || page === 'rag' || page === 'health' || page === 'organize') {
      void loadKnowledge()
    }
    if (page === 'review' || page === 'organize') {
      void loadKnowledgeIo()
    }
    if (page === 'review' && !brainLoaded) void loadBrain()
  }, [brainLoaded, loadBrain, loadKnowledge, loadKnowledgeIo, page])

  return (
    <div className="knowledge-tabbed-surface" data-testid="knowledge-surface">
      <KnowledgeTopbar />
      {message && page === 'health' ? null : message && page !== 'status' ? <p className="knowledge-msg">{message}</p> : null}
      {page === 'status' ? <KnowledgeStatusPage /> : null}
      {page === 'review' ? <KnowledgeReviewPage /> : null}
      {page === 'libraries' ? <KnowledgeLibrariesPage /> : null}
      {page === 'rag' ? <KnowledgeSourcesPage /> : null}
      {page === 'health' ? <KnowledgeHealthPage /> : null}
      {page === 'organize' ? <KnowledgeOrganizePage /> : null}
    </div>
  )
}
