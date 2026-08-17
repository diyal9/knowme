import { ContentView } from '../content-view/ContentView'
import { useAppStore } from '../../app/store'

export function KnowledgeReader({
  wikiCount,
  okfCount,
  onAdd,
}: {
  wikiCount: number
  okfCount: number
  onAdd: () => void
}) {
  const reader = useAppStore((s) => s.knowledgeReader)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const organize = useAppStore((s) => s.organizeKnowledge)
  const lint = useAppStore((s) => s.lintKnowledge)

  if (!reader) {
    return (
      <main className="knowledge-reader llmwiki-reader-pane" id="kosReader" aria-label="阅读与编辑">
        <div className="knowledge-reader-inner llmwiki-welcome">
          <div className="knowledge-reader-empty">
            <div className="knowledge-reader-empty-mark" aria-hidden="true">W</div>
            <h3>{wikiCount + okfCount ? '从左侧选择一份资料' : '你的知识网还没有资料'}</h3>
            <p>{wikiCount + okfCount ? '阅读已整理知识，或打开资料继续编辑。' : '把文件放进资料目录，或直接添加第一份资料。'}</p>
            {wikiCount + okfCount ? (
              <span className="llmwiki-welcome-count">{wikiCount} 份资料 · {okfCount} 条已整理知识</span>
            ) : (
              <div className="knowledge-home-actions">
                <button type="button" className="knowledge-btn primary" onClick={onAdd}>添加资料</button>
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  const editable = String(reader.path || '').startsWith('raw/')
  return (
    <main className="knowledge-reader llmwiki-reader-pane" id="kosReader" data-testid="knowledge-reader" aria-label="阅读与编辑">
      <div className="knowledge-reader-inner">
        <header className="knowledge-doc-head">
          <h1>{reader.title || reader.path || '条目'}</h1>
          <div className="knowledge-doc-path">{reader.path}</div>
          <div className="knowledge-doc-actions">
            <button type="button" className="knowledge-doc-action" onClick={() => void organize()}>交给 AI 整理</button>
            <button type="button" className="knowledge-doc-action" onClick={() => setPage('review')}>查看提案</button>
            {editable ? <button type="button" className="knowledge-doc-action" onClick={() => void lint()}>检查问题</button> : null}
          </div>
        </header>
        {reader.ok === false ? (
          <p className="knowledge-empty">{reader.error || '无法打开条目'}</p>
        ) : (
          <div className="knowledge-markdown">
            <ContentView source={reader.content || ''} />
          </div>
        )}
      </div>
    </main>
  )
}
