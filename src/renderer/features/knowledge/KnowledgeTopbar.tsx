import { useAppStore } from '../../app/store'
import { KnowledgeTabs } from './KnowledgeTabs'

const CONTEXT_LABEL: Record<string, string> = {
  review: '待我确认',
  health: '健康检查',
  organize: 'AI 整理',
}

export function KnowledgeTopbar() {
  const page = useAppStore((s) => s.knowledgePage)
  const wiki = useAppStore((s) => s.knowledgeWiki)
  const okf = useAppStore((s) => s.knowledgeOkf)
  const brain = useAppStore((s) => s.brainSnapshot)
  const loadBrain = useAppStore((s) => s.loadBrain)
  const refresh = useAppStore((s) => s.refreshKnowledge)
  const moreOpen = useAppStore((s) => s.knowledgeMoreOpen)
  const setMoreOpen = useAppStore((s) => s.setKnowledgeMoreOpen)
  const lint = useAppStore((s) => s.lintKnowledge)
  const openObsidian = useAppStore((s) => s.openObsidian)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const context = CONTEXT_LABEL[page] || ''
  const externalNodeIds = new Set((brain?.nodes || []).filter((node) => node.external || node.kind === 'source' || node.kind === 'collection').map((node) => node.id))
  const taxonomyNodeIds = new Set((brain?.nodes || []).filter((node) => node.tags?.includes('brain-taxonomy')).map((node) => node.id))
  const cognitionCount = brain?.nodes
    ? brain.nodes.filter((node) => !externalNodeIds.has(node.id) && !taxonomyNodeIds.has(node.id)).length
    : brain?.stats?.nodes || 0
  const cognitionClaimCount = brain?.claims
    ? brain.claims.filter((claim) => !externalNodeIds.has(claim.subjectId) && !taxonomyNodeIds.has(claim.subjectId) && (!claim.objectNodeId || (!externalNodeIds.has(claim.objectNodeId) && !taxonomyNodeIds.has(claim.objectNodeId)))).length
    : brain?.stats?.claims || 0

  return (
    <header className="knowledge-tab-head">
      <KnowledgeTabs />
      {context ? <span className="knowledge-context">{context}</span> : null}
      {page === 'status' || page === 'review' ? <div className="knowledge-stats" aria-label="知识统计">
        <div className="knowledge-stat"><strong>{cognitionCount}</strong><span>项理解</span></div>
        <div className="knowledge-stat"><strong>{cognitionClaimCount}</strong><span>条关系</span></div>
        <div className="knowledge-stat"><strong>{brain?.stats?.proposals || 0}</strong><span>待确认</span></div>
      </div> : <div className="knowledge-tab-boundary">外部知识只在查询时读取，不会并入 Brain</div>}
      <div className="knowledge-toolbar">
        <button type="button" className="knowledge-btn" onClick={() => void (async () => { await refresh(); await loadBrain() })()}>同步</button>
        <details className="knowledge-more" open={moreOpen} onToggle={(e) => setMoreOpen((e.target as HTMLDetailsElement).open)}>
          <summary aria-label="更多知识操作">更多</summary>
          <div className="knowledge-more-menu">
            <button type="button" onClick={() => { setMoreOpen(false); void lint() }}>检查问题</button>
            <button type="button" onClick={() => { setMoreOpen(false); setPage('organize') }}>交给 AI 整理</button>
            <button type="button" onClick={() => { setMoreOpen(false); void openObsidian() }}>用 Obsidian 打开</button>
          </div>
        </details>
      </div>
    </header>
  )
}
