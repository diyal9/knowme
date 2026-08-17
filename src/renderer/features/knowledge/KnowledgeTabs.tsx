import { KNOWLEDGE_SURFACE_TABS, primaryKnowledgeTab, type KnowledgePage } from '../../../domain/knowledge-surface'
import { useAppStore } from '../../app/store'

export function KnowledgeTabs() {
  const page = useAppStore((s) => s.knowledgePage)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const active = primaryKnowledgeTab(page)

  return (
    <div className="drawer-surface-tabs" role="tablist" aria-label="知识库页面">
      {KNOWLEDGE_SURFACE_TABS.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`drawer-surface-tab${selected ? ' active' : ''}`}
            role="tab"
            aria-selected={selected}
            data-center-surface-tab={tab.id}
            onClick={() => setPage(tab.id as KnowledgePage)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
