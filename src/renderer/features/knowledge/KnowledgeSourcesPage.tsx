import { useAppStore } from '../../app/store'

export function KnowledgeSourcesPage() {
  const providers = useAppStore((s) => s.knowledgeProviders)
  const activeId = useAppStore((s) => s.knowledgeActiveProviderId)
  const setProvider = useAppStore((s) => s.setKnowledgeProvider)
  const exportKnowledge = useAppStore((s) => s.exportKnowledge)
  const importKnowledge = useAppStore((s) => s.importKnowledge)

  return (
    <div className="knowledge-workspace">
      <main className="knowledge-page-main">
        <div className="knowledge-reader-inner">
          <section className="knowledge-panel">
            <div className="knowledge-panel-kicker">可选扩展</div>
            <h2>资料来源</h2>
            <p className="knowledge-panel-desc">“我的知识”始终可用。只有需要搜索其他系统时，才在这里添加外部来源。</p>
            <div className="knowledge-source-list">
              {providers.map((provider) => {
                const remote = provider.kind === 'remote-rag'
                const active = provider.id === activeId
                return (
                  <button
                    key={provider.id}
                    type="button"
                    className={`knowledge-provider${active ? ' active' : ''}`}
                    onClick={() => void setProvider(provider.id)}
                  >
                    <span className="knowledge-provider-icon">{remote ? 'R' : 'W'}</span>
                    <span className="knowledge-provider-copy">
                      <span className="knowledge-provider-name">
                        {provider.displayName || (remote ? 'AI 检索源' : '本地知识库')}
                        {active ? ' · 当前' : ''}
                      </span>
                      <span className="knowledge-provider-type">{remote ? 'AI 检索源 · RAG' : '本地知识资料'}</span>
                    </span>
                    <span aria-hidden="true">{active ? '✓' : '›'}</span>
                  </button>
                )
              })}
            </div>
            <div className="knowledge-home-actions">
              <button type="button" className="knowledge-btn" onClick={() => void exportKnowledge()}>导出知识包</button>
              <button type="button" className="knowledge-btn" onClick={() => void importKnowledge()}>导入知识包</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
