import { useMemo, useState } from 'react'
import { useAppStore } from '../../app/store'

export function KnowledgeReviewPage() {
  const proposals = useAppStore((s) => s.stewardProposals)
  const selectedId = useAppStore((s) => s.knowledgeSelectedProposalId)
  const select = useAppStore((s) => s.selectKnowledgeProposal)
  const decide = useAppStore((s) => s.decideKnowledgeProposal)
  const openEntry = useAppStore((s) => s.openKnowledgeEntry)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const pending = useMemo(() => proposals.filter((item) => !item.status || item.status === 'draft'), [proposals])
  const active = pending.find((item) => item.id === selectedId) || pending[0] || null
  const [draft, setDraft] = useState(active?.proposedContent || active?.body || '')

  return (
    <div className="knowledge-workspace">
      <div className="knowledge-review-grid">
        <section className="knowledge-proposal-list">
          <div className="knowledge-browser-head">
            <div className="knowledge-panel-kicker">AI 整理建议</div>
            <h2>等待你的决定 <span>{pending.length}</span></h2>
          </div>
          <div className="knowledge-entry-list" data-testid="knowledge-steward-list">
            {pending.length ? pending.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`knowledge-proposal-row${item.id === active?.id ? ' active' : ''}`}
                onClick={() => {
                  select(item.id)
                  setDraft(item.proposedContent || item.body || '')
                }}
              >
                <span className="knowledge-proposal-main">
                  <strong>{item.title || '未命名提案'}</strong>
                  <small>{item.sourcePath || '未知来源'}</small>
                </span>
                <span className="knowledge-proposal-confidence">{Math.round((Number(item.confidence) || 0) * 100)}%</span>
              </button>
            )) : (
              <div className="knowledge-task-empty">没有等待确认的建议。AI 整理不会直接改写稳定知识。</div>
            )}
          </div>
        </section>
        <main className="knowledge-reader" id="kosProposalReader">
          {active ? (
            <article className="knowledge-proposal-detail">
              <div className="knowledge-panel-kicker">整理建议</div>
              <h1>{active.title || '未命名建议'}</h1>
              <div className="knowledge-proposal-meta">
                <span>来自：{active.sourcePath || '未知资料'}</span>
                <span>建议保存为：{active.targetPath || '新知识'}</span>
              </div>
              <p className="knowledge-proposal-rationale">{active.rationale || '暂无说明'}</p>
              <div className="knowledge-proposal-content">
                <label className="knowledge-proposal-edit-label" htmlFor="kosProposalDraft">整理后的知识内容，可在接受前编辑</label>
                <textarea
                  className="knowledge-textarea knowledge-proposal-editor"
                  id="kosProposalDraft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>
              <div className="knowledge-form-actions">
                <button type="button" className="knowledge-btn primary" onClick={() => void decide('accept', draft)}>接受并写入</button>
                <button type="button" className="knowledge-btn" onClick={() => void decide('snooze')}>稍后处理</button>
                <button type="button" className="knowledge-btn" onClick={() => void decide('reject')}>拒绝</button>
                <button
                  type="button"
                  className="knowledge-btn"
                  onClick={() => {
                    if (active.sourcePath) {
                      void openEntry({ kind: 'wiki', path: active.sourcePath })
                      setPage('status')
                    }
                  }}
                >
                  查看来源
                </button>
              </div>
            </article>
          ) : (
            <div className="knowledge-reader-empty">
              <h3>没有需要处理的内容</h3>
              <p>AI 产生整理建议后，会先放在这里等你决定。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
