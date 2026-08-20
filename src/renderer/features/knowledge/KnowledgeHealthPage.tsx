import { knowledgeIssueLabel } from '../../../domain/knowledge-surface'
import { useAppStore } from '../../app/store'
import { BackButton } from '../../app/BackButton'

export function KnowledgeHealthPage() {
  const issues = useAppStore((s) => s.knowledgeLintIssues)
  const linting = useAppStore((s) => s.knowledgeLinting)
  const lint = useAppStore((s) => s.lintKnowledge)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const openEntry = useAppStore((s) => s.openKnowledgeEntry)
  const organize = useAppStore((s) => s.organizeKnowledge)

  return (
    <div className="knowledge-workspace">
      <main className="knowledge-page-main">
        <div className="knowledge-reader-inner">
          <section className="knowledge-panel">
      <div className="knowledge-panel-kicker">知识健康</div>
            <h2>{linting ? '正在检查…' : (issues.length ? `发现 ${issues.length} 个需要关注的地方` : '知识状态良好')}</h2>
            <p className="knowledge-panel-desc">你可以先查看建议，再决定是否让 AI 协助整理。</p>
            <div className={`knowledge-result${issues.length ? '' : ' ok'}`} data-testid="knowledge-lint-list">
              {issues.length ? issues.map((issue, index) => (
                <div className="knowledge-issue" key={`${issue.path || index}-${issue.message || ''}`}>
                  <button
                    type="button"
                    className="knowledge-issue-open"
                    onClick={() => {
                      if (issue.path) {
                        void openEntry({ path: issue.path })
                        setPage('status')
                      }
                    }}
                  >
                    <strong>{knowledgeIssueLabel(issue.type)}</strong>
                    {' · '}
                    {issue.path || '整个知识库'}
                  </button>
                  <span>{issue.message}</span>
                </div>
              )) : '暂未发现空内容、重复标题或失效链接。'}
            </div>
            <div className="knowledge-form-actions">
              {issues.length ? (
                <button type="button" className="knowledge-btn primary" onClick={() => void organize()}>让 AI 给出整理方案</button>
              ) : null}
              <BackButton label="返回我的知识" onClick={() => setPage('status')} />
              <button type="button" className="knowledge-btn" disabled={linting} onClick={() => void lint()}>
                {linting ? '检查中…' : '再检查一次'}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
