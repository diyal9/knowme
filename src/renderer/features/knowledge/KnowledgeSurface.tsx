import { useEffect } from 'react'
import { useAppStore } from '../../app/store'
import { KnowledgeEmptyWelcome } from './KnowledgeEmptyWelcome'
import { KnowledgeHealthPage } from './KnowledgeHealthPage'
import { KnowledgeOrganizePage } from './KnowledgeOrganizePage'
import { KnowledgeReviewPage } from './KnowledgeReviewPage'
import { KnowledgeSourcesPage } from './KnowledgeSourcesPage'
import { KnowledgeStatusPage } from './KnowledgeStatusPage'
import { KnowledgeTopbar } from './KnowledgeTopbar'

export function KnowledgeSurface() {
  const page = useAppStore((s) => s.knowledgePage)
  const loading = useAppStore((s) => s.knowledgeLoading)
  const wiki = useAppStore((s) => s.knowledgeWiki)
  const okf = useAppStore((s) => s.knowledgeOkf)
  const message = useAppStore((s) => s.knowledgeMessage)
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const loadKnowledgeIo = useAppStore((s) => s.loadKnowledgeIo)

  useEffect(() => {
    void loadKnowledge()
    void loadKnowledgeIo()
  }, [loadKnowledge, loadKnowledgeIo])

  const emptyHome = page === 'status' && !loading && wiki.length === 0 && okf.length === 0

  return (
    <div className="knowledge-tabbed-surface" data-testid="knowledge-surface">
      <KnowledgeTopbar />
      {message && page === 'health' ? null : message && page !== 'status' ? <p className="knowledge-msg">{message}</p> : null}
      {emptyHome ? <KnowledgeEmptyWelcome /> : null}
      {!emptyHome && page === 'status' ? <KnowledgeStatusPage /> : null}
      {page === 'review' ? <KnowledgeReviewPage /> : null}
      {page === 'connect' ? <KnowledgeSourcesPage /> : null}
      {page === 'health' ? <KnowledgeHealthPage /> : null}
      {page === 'organize' ? <KnowledgeOrganizePage /> : null}
    </div>
  )
}
