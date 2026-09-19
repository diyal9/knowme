import { ContentView } from '../content-view/ContentView'
import { useAppStore } from '../../app/store'
import type { BrainHit } from '../../../shared/api'

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
  const brain = useAppStore((s) => s.brainSnapshot)
  const showToast = useAppStore((s) => s.showToast)
  const saveReference = useAppStore((s) => s.saveBrainReference)
  const promote = useAppStore((s) => s.promoteBrainHit)

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
  const relatedNodes = (brain?.nodes || []).filter((node) => node.sourceRef === reader.path || node.label === reader.title)
  const relatedIds = new Set(relatedNodes.map((node) => node.id))
  const relatedClaims = (brain?.claims || []).filter((claim) => relatedIds.has(claim.subjectId) || (!!claim.objectNodeId && relatedIds.has(claim.objectNodeId)))
  const hit: BrainHit = {
    ref: reader.path || reader.title || 'local-document',
    title: reader.title || reader.path || '本地资料',
    snippet: String(reader.content || '').replace(/\s+/g, ' ').slice(0, 400),
    sourceKind: 'local', authority: editable ? 2 : 4, persistence: 'external',
    evidence: [{ id: `reader:${reader.path}`, type: 'local_file', documentRef: reader.path, title: reader.title, persistence: 'reference' }],
    explanation: '来自当前打开的本地资料',
  }
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
        <aside className="knowledge-brain-context" aria-label="资料与 Brain 的关系">
          <div><strong>这份资料在 Brain 中的关系</strong><span>{relatedNodes.length ? `关联 ${relatedNodes.length} 项理解 · 被 ${relatedClaims.length} 条关系引用` : '尚未形成长期理解'}</span></div>
          {relatedNodes.length ? <div className="knowledge-brain-tags">{relatedNodes.slice(0, 6).map((node) => <span key={node.id}>{node.label} · {node.kind}</span>)}</div> : null}
          <dl><div><dt>来源</dt><dd>{reader.path || '本地资料'}</dd></div><div><dt>可信程度</dt><dd>{editable ? '原始资料，需结合上下文' : '已整理知识'}</dd></div></dl>
          <div className="knowledge-brain-actions"><button type="button" onClick={() => showToast('本轮对话会按需使用，不会自动写入长期 Brain')}>仅本轮使用</button><button type="button" onClick={() => void saveReference(hit)}>收藏引用</button><button type="button" onClick={() => void promote(hit)}>沉淀到 Brain</button></div>
        </aside>
      </div>
    </main>
  )
}
