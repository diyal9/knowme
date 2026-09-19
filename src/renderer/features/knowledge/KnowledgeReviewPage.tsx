import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../app/store'

type ReviewFilter = 'all' | 'about' | 'project' | 'relation' | 'conflict' | 'capability'

const FILTERS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'about', label: '关于我' },
  { id: 'project', label: '项目与决策' },
  { id: 'relation', label: '知识关系' },
  { id: 'conflict', label: '冲突与过期' },
  { id: 'capability', label: '能力成长' },
]

function categoryLabel(category: ReviewFilter | string) {
  return FILTERS.find((item) => item.id === category)?.label || '新的理解'
}

function targetLabel(target?: string) {
  if (target === 'partner_profile') return '伙伴协作方式'
  if (target === 'capability') return '能力中心'
  return '本地 Brain'
}

export function KnowledgeReviewPage() {
  const steward = useAppStore((s) => s.stewardProposals)
  const brain = useAppStore((s) => s.brainProposals)
  const snapshot = useAppStore((s) => s.brainSnapshot)
  const growthEvents = useAppStore((s) => s.brainGrowthEvents)
  const selectedId = useAppStore((s) => s.knowledgeSelectedProposalId)
  const select = useAppStore((s) => s.selectKnowledgeProposal)
  const decide = useAppStore((s) => s.decideKnowledgeProposal)
  const undoGrowth = useAppStore((s) => s.undoBrainGrowth)
  const openEntry = useAppStore((s) => s.openKnowledgeEntry)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const [filter, setFilter] = useState<ReviewFilter>('all')

  const evidenceById = useMemo(() => new Map((snapshot?.evidence || []).map((item) => [item.id, item])), [snapshot?.evidence])
  const proposals = useMemo(() => [
    ...brain.filter((item) => item.status === 'pending').map((item) => ({
      id: item.id,
      title: item.summary || '新的理解建议',
      sourcePath: item.sourceLabel || item.sourceRef || item.evidenceRefs?.[0] || 'Brain 观察',
      targetPath: targetLabel(item.targetType),
      confidence: Number(item.confidence ?? (item.kind === 'conflict' ? .5 : .8)),
      rationale: item.rationale,
      impact: item.impact || `确认后会更新${targetLabel(item.targetType)}，并保留可撤销记录。`,
      proposedContent: item.summary,
      source: item.source || 'brain',
      kind: item.kind,
      category: (item.category || (item.kind === 'conflict' || item.kind === 'expiry' ? 'conflict' : item.targetType === 'capability' ? 'capability' : item.targetType === 'partner_profile' ? 'about' : 'relation')) as ReviewFilter,
      evidence: (item.evidenceRefs || []).map((id) => evidenceById.get(id)).filter(Boolean),
      observationCount: item.observationCount || 1,
      createdAt: item.createdAt,
    })),
    ...steward.filter((item) => !item.status || item.status === 'draft').map((item) => ({
      ...item,
      id: item.id,
      title: item.title || '知识整理建议',
      proposedContent: item.proposedContent || item.title || '',
      source: 'steward' as const,
      kind: 'cognition',
      category: 'relation' as ReviewFilter,
      targetPath: item.targetPath || '本地知识资料',
      impact: '确认后会整理本地资料结构，不会导入外挂知识库正文。',
      evidence: [],
      observationCount: 1,
    })),
  ], [brain, evidenceById, steward])
  const pending = filter === 'all' ? proposals : proposals.filter((item) => item.category === filter)
  const active = pending.find((item) => item.id === selectedId) || pending[0] || null
  const [draft, setDraft] = useState(active?.proposedContent || '')

  useEffect(() => {
    setDraft(active?.proposedContent || '')
    if (active && active.id !== selectedId) select(active.id)
  }, [active?.id, active?.proposedContent, select, selectedId])

  return (
    <div className="knowledge-workspace review-workspace">
      <nav className="knowledge-review-filters" aria-label="待确认分类">
        {FILTERS.map((item) => {
          const count = item.id === 'all' ? proposals.length : proposals.filter((proposal) => proposal.category === item.id).length
          return <button key={item.id} type="button" className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{count}</span></button>
        })}
      </nav>
      <div className="knowledge-review-grid">
        <section className="knowledge-proposal-list">
          <div className="knowledge-browser-head">
            <div className="knowledge-panel-kicker">待我确认</div>
            <h2>{categoryLabel(filter)} <span>{pending.length}</span></h2>
            <p>所有长期理解都由你决定。</p>
          </div>
          <div className="knowledge-entry-list" data-testid="knowledge-steward-list">
            {pending.length ? pending.map((item) => (
              <button key={item.id} type="button" className={`knowledge-proposal-row${item.id === active?.id ? ' active' : ''}`} onClick={() => select(item.id)}>
                <span className={`knowledge-proposal-kind ${item.category}`}>{categoryLabel(item.category).slice(0, 2)}</span>
                <span className="knowledge-proposal-main">
                  <strong>{item.title || '未命名提案'}</strong>
                  <small>{item.observationCount > 1 ? `近期出现 ${item.observationCount} 次` : item.sourcePath || '知识与理解'}</small>
                </span>
                <span className="knowledge-proposal-confidence">{Math.round((Number(item.confidence) || 0) * 100)}%</span>
              </button>
            )) : <div className="knowledge-task-empty">这个分类暂时没有需要确认的内容。</div>}
          </div>
          {growthEvents.length ? (
            <section className="knowledge-growth-recent">
              <div className="knowledge-growth-title"><strong>最近确认</strong><span>可撤销</span></div>
              {growthEvents.slice(0, 4).map((event) => (
                <div className={`knowledge-growth-row${event.status === 'reverted' ? ' reverted' : ''}`} key={event.id}>
                  <span><strong>{event.summary}</strong><small>{event.status === 'reverted' ? '已撤销' : targetLabel(event.targetType)}</small></span>
                  {event.reversible && event.status !== 'reverted' ? <button type="button" onClick={() => void undoGrowth(event.id)}>撤销</button> : null}
                </div>
              ))}
            </section>
          ) : null}
        </section>
        <main className="knowledge-reader" id="kosProposalReader">
          {active ? (
            <article className="knowledge-proposal-detail">
              <div className="knowledge-proposal-heading"><span className={`knowledge-proposal-type ${active.category}`}>{categoryLabel(active.category)}</span><span>{Math.round((Number(active.confidence) || 0) * 100)}% 把握</span></div>
              <h1>{active.title || '未命名建议'}</h1>
              <p className="knowledge-proposal-lead">KnowMe 认为这项内容可能值得长期保留，决定权始终在你。</p>
              <div className="knowledge-proposal-explain-grid">
                <section><span>为什么这样判断</span><p>{active.rationale || '来自近期协作中的明确表达或重复观察。'}</p></section>
                <section><span>确认后会影响</span><p>{active.impact}</p></section>
              </div>
              <section className="knowledge-proposal-evidence">
                <div className="knowledge-proposal-section-title"><strong>来源与证据</strong><span>{active.evidence.length || 1} 项</span></div>
                {active.evidence.length ? active.evidence.map((item) => item ? (
                  <div className="knowledge-proposal-evidence-row" key={item.id}><span className="evidence-mark">↗</span><span><strong>{item.title || active.sourcePath}</strong><small>{item.snippet || item.documentRef || '本地引用'}</small></span></div>
                ) : null) : (
                  <div className="knowledge-proposal-evidence-row"><span className="evidence-mark">↗</span><span><strong>{active.sourcePath || '近期协作'}</strong><small>只保留必要引用，不复制完整对话。</small></span></div>
                )}
              </section>
              <div className="knowledge-proposal-content">
                <label className="knowledge-proposal-edit-label" htmlFor="kosProposalDraft">KnowMe 将记住</label>
                <textarea className="knowledge-textarea knowledge-proposal-editor" id="kosProposalDraft" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <small>你可以先修改。确认后写入 {active.targetPath || 'Brain'}，原始证据仍会保留。</small>
              </div>
              <div className="knowledge-form-actions">
                <button type="button" className="knowledge-btn primary" disabled={!draft.trim()} onClick={() => void decide('accept', draft)}>确认并记住</button>
                <button type="button" className="knowledge-btn" onClick={() => void decide('snooze')}>稍后处理</button>
                <button type="button" className="knowledge-btn danger-quiet" onClick={() => void decide('reject')}>不是这样</button>
                {active.source === 'steward' && active.sourcePath ? <button type="button" className="knowledge-btn" onClick={() => { void openEntry({ kind: 'wiki', path: active.sourcePath }); setPage('status') }}>查看原资料</button> : null}
              </div>
            </article>
          ) : (
            <div className="knowledge-reader-empty review-empty"><span>✓</span><h3>这里已经处理好了</h3><p>新的理解、知识关系和成长建议出现时，会先来到这里。</p></div>
          )}
        </main>
      </div>
    </div>
  )
}
