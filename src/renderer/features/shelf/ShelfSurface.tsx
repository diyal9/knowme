/**
 * 工作流货架：卡片打开对话；空态可新建编排。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { filterShelfCards, shelfLockHint, shelfSupplyHint, type ShelfDomain } from '../../../domain/shelf'
import { workflowShelfTasks } from '../../../domain/run-projection'
import {
  previewNeedsToggle,
  previewSlice,
  shelfRowCapacity,
  shelfSummaryText,
} from '../../../domain/workbench-home'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { ShelfCard } from './ShelfCard'
import { TaskManageModal } from '../taskhome/TaskManageModal'
import { TaskBoard } from '../taskhome/TaskBoard'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'
import { WorkflowDetailSurface } from '../workflow/WorkflowDetailSurface'

const DOMAINS: { id: ShelfDomain; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'office', label: '办公' },
  { id: 'engineering', label: '研发' },
  { id: 'visual', label: '视觉' },
]

export function ShelfSurface() {
  const load = useAppStore((s) => s.loadWorkbench)
  const query = useAppStore((s) => s.shelfQuery)
  const domain = useAppStore((s) => s.shelfDomain)
  const setDomain = useAppStore((s) => s.setShelfDomain)
  const launchWorkflow = useAppStore((s) => s.launchWorkflow)
  const reopenTaskRun = useAppStore((s) => s.reopenTaskRun)
  const openWorkflowManage = useAppStore((s) => s.openWorkflowManage)
  const enterStudio = useAppStore((s) => s.enterStudio)
  const openTaskManage = useAppStore((s) => s.openTaskManage)
  const loading = useAppStore((s) => s.shelfLoading)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const tasks = useAppStore((s) => s.tasks)
  const daemonOnline = useAppStore((s) => s.shelfDaemonOnline)
  const catalogCards = filterShelfCards(shelfCards, '', 'all')
  const cards = filterShelfCards(shelfCards, query, domain)
  const recentRuns = useMemo(() => workflowShelfTasks(tasks), [tasks])
  const lockHint = shelfLockHint(daemonOnline)
  const runnable = catalogCards.filter((card) => !card.blocked).length
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [gridExpanded, setGridExpanded] = useState(false)
  const [rowCapacity, setRowCapacity] = useState(2)
  const gridRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const visibleCards = previewSlice(cards, gridExpanded, rowCapacity)
  const gridNeedsToggle = previewNeedsToggle(cards.length, rowCapacity)
  const catalogExpanded = gridNeedsToggle && gridExpanded

  useEffect(() => { void load() }, [load])
  useKnowMeIcons(`${cards.length}:${recentRuns.length}:${catalogExpanded}`, surfaceRef)

  useEffect(() => {
    const node = gridRef.current
    if (!node) return undefined
    const apply = () => setRowCapacity(shelfRowCapacity(node.clientWidth || 1280))
    apply()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => observer.disconnect()
  }, [cards.length, loading])

  const selectedWorkflow = selectedWorkflowId
    ? shelfCards.find((card) => card.id === selectedWorkflowId) || null
    : null

  if (selectedWorkflow) {
    return (
      <WorkflowDetailSurface
        card={selectedWorkflow}
        onBack={() => setSelectedWorkflowId(null)}
        onLaunch={(payload) => launchWorkflow(selectedWorkflow, payload)}
        onFork={() => void useAppStore.getState().forkWorkflow(selectedWorkflow.id)}
      />
    )
  }

  return (
    <div ref={surfaceRef} className="wb-shelf wb-workbench-home-surface" data-testid="shelf-surface">
      <section
        className="wb-task-home-panel wb-task-recent wb-shelf-run-board"
        aria-labelledby="wbShelfRecentTitle"
      >
        <div className="wb-task-home-head">
          <h1 className="wb-workbench-page-title" id="wbShelfRecentTitle">运行记录</h1>
        </div>
        <div id="wbShelfRecentList" data-testid="shelf-recent-list">
          <TaskBoard
            tasks={recentRuns}
            workflowMode
            idPrefix="wbWorkflowRun"
            manageLabel="管理工作流运行"
            manageIcon="settingsLine"
            onOpen={(task) => void reopenTaskRun(task, { lane: 'workflow' })}
            onManageCompleted={openTaskManage}
          />
        </div>
      </section>

      <section className="wb-shelf-catalog-section wb-section-gradient-divider" data-testid="shelf-catalog-section" aria-labelledby="wbShelfCatalogTitle">
        <header className="wb-shelf-intro">
          <div className="wb-shelf-intro-copy">
            <h2 className="wb-workbench-page-title" id="wbShelfCatalogTitle">选择工作流</h2>
          </div>
          <div className="wb-shelf-intro-actions">
            <p className="wb-shelf-status" data-testid="shelf-status" aria-live="polite">
              {loading ? '读取中…' : shelfSummaryText(catalogCards.length, runnable)}
            </p>
            <button type="button" className="wb-shelf-manage" id="wbShelfManage" onClick={openWorkflowManage}>
              <Icon name="settingsLine" />
              <span>管理工作流</span>
            </button>
          </div>
        </header>
        <div className="wb-shelf-filters">
          <div className="wb-domain-switcher" id="wbDomainSwitcher" role="group" aria-label="工作流领域筛选">
            {DOMAINS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`wb-domain-chip${domain === item.id ? ' active' : ''}`}
                data-domain={item.id}
                aria-pressed={domain === item.id}
                onClick={() => setDomain(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="wb-shelf-summary wb-sr-only" id="wbShelfSummary" aria-live="polite">
            {loading ? '加载工作流…' : shelfSummaryText(catalogCards.length, runnable)}
          </p>
        </div>
        {lockHint ? <div className="wb-shelf-locked" id="wbShelfLocked" data-testid="shelf-locked" role="status">{lockHint}</div> : null}
        <div className={`wb-shelf-catalog${catalogExpanded ? ' expanded' : ''}`}>
          {!loading && cards.length === 0 ? (
            <div className="wb-shelf-empty" id="wbShelfEmpty" data-testid="shelf-empty">
              {query.trim() || domain !== 'all' ? (
                <><strong>没有匹配的工作流</strong><span>点「全部」或清空搜索再看看。</span></>
              ) : (
                <>
                  <strong>还没有工作流</strong>
                  <span>{shelfSupplyHint(daemonOnline)}</span>
                  <div className="wb-empty-actions">
                    <button type="button" className="wb-modal-btn primary" data-shelf-action="studio" data-testid="shelf-create-workflow" onClick={() => enterStudio('shelf')}>
                      + 新建工作流
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div ref={gridRef} className={`wb-shelf-grid${catalogExpanded ? ' is-expanded' : ''}`} id="wbShelfGrid">
            {visibleCards.map((card) => <ShelfCard key={card.id} card={card} onOpen={() => setSelectedWorkflowId(card.id)} />)}
          </div>
          <WorkbenchListToggle
            id="wbShelfGridToggle"
            expanded={gridExpanded}
            remaining={cards.length - rowCapacity}
            hidden={!gridNeedsToggle}
            onToggle={() => setGridExpanded((value) => !value)}
          />
        </div>
      </section>
      <TaskManageModal scope="workflow" />
    </div>
  )
}
