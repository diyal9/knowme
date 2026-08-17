import { useAppStore } from '../../app/store'
import { KnowledgeTabs } from './KnowledgeTabs'

const CONTEXT_LABEL: Record<string, string> = {
  health: '健康检查',
  organize: 'AI 整理',
}

export function KnowledgeTopbar() {
  const page = useAppStore((s) => s.knowledgePage)
  const wiki = useAppStore((s) => s.knowledgeWiki)
  const okf = useAppStore((s) => s.knowledgeOkf)
  const refresh = useAppStore((s) => s.refreshKnowledge)
  const moreOpen = useAppStore((s) => s.knowledgeMoreOpen)
  const setMoreOpen = useAppStore((s) => s.setKnowledgeMoreOpen)
  const lint = useAppStore((s) => s.lintKnowledge)
  const openObsidian = useAppStore((s) => s.openObsidian)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const context = CONTEXT_LABEL[page] || ''

  return (
    <header className="knowledge-tab-head">
      <KnowledgeTabs />
      {context ? <span className="knowledge-context">{context}</span> : null}
      <div className="knowledge-stats" aria-label="知识统计">
        <div className="knowledge-stat"><strong>{wiki.length + okf.length}</strong><span>条目</span></div>
        <div className="knowledge-stat"><strong>{wiki.length}</strong><span>资料</span></div>
        <div className="knowledge-stat"><strong>{okf.length}</strong><span>已整理</span></div>
      </div>
      <div className="knowledge-toolbar">
        <button type="button" className="knowledge-btn" onClick={() => void refresh()}>重新读取</button>
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
