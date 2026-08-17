import { useState } from 'react'
import { collectKnowledgeEntries } from '../../../domain/knowledge-tree'
import { useAppStore } from '../../app/store'
import { KnowledgeBrowser } from './KnowledgeBrowser'
import { KnowledgeReader } from './KnowledgeReader'

export function KnowledgeStatusPage() {
  const wiki = useAppStore((s) => s.knowledgeWiki)
  const okf = useAppStore((s) => s.knowledgeOkf)
  const addMaterial = useAppStore((s) => s.addKnowledgeMaterial)
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const entries = collectKnowledgeEntries(wiki, okf)

  const submitAdd = async () => {
    const ok = await addMaterial(draft)
    if (ok) {
      setDraft('')
      setAddOpen(false)
    }
  }

  return (
    <div className="knowledge-workspace llmwiki-workspace">
      <main className="llmwiki-workbench" aria-label="我的知识工作台">
        <section className="llmwiki-pane llmwiki-tree-pane" aria-label="资料树">
          <header className="llmwiki-pane-head">
            <div>
              <h1>我的资料</h1>
              <span className="llmwiki-pane-eyebrow">{entries.length} 个条目</span>
            </div>
            <button type="button" className="knowledge-btn knowledge-btn-sm" onClick={() => setAddOpen(true)}>添加</button>
          </header>
          <KnowledgeBrowser entries={entries} />
        </section>
        <KnowledgeReader wikiCount={wiki.length} okfCount={okf.length} onAdd={() => setAddOpen(true)} />
      </main>
      {addOpen ? (
        <div className="knowledge-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAddOpen(false) }}>
          <section className="knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="knowledgeAddTitle">
            <header className="knowledge-modal-head">
              <h2 id="knowledgeAddTitle">添加资料</h2>
              <button type="button" className="knowledge-modal-close" aria-label="关闭" onClick={() => setAddOpen(false)}>×</button>
            </header>
            <div className="knowledge-modal-body">
              <textarea
                className="knowledge-textarea"
                rows={8}
                placeholder="粘贴一段文字，或写点笔记…"
                aria-label="资料内容"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="knowledge-form-actions">
                <button type="button" className="knowledge-btn primary" onClick={() => void submitAdd()}>保存</button>
                <button type="button" className="knowledge-btn" onClick={() => setAddOpen(false)}>取消</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
