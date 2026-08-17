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
  TASK_RECENT_PREVIEW,
} from '../../../domain/workbench-home'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { useStickyIcons } from '../../app/useStickyIcons'
import { ShelfCard } from './ShelfCard'
import { TaskManageModal } from '../taskhome/TaskManageModal'
import { TaskRecentCard } from '../taskhome/TaskRecentCard'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'

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
  const startRun = useAppStore((s) => s.startRun)
  const reopenTaskRun = useAppStore((s) => s.reopenTaskRun)
  const openWorkflowManage = useAppStore((s) => s.openWorkflowManage)
  const enterStudio = useAppStore((s) => s.enterStudio)
  const openTaskManage = useAppStore((s) => s.openTaskManage)
  const loading = useAppStore((s) => s.shelfLoading)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const tasks = useAppStore((s) => s.tasks)
  const daemonOnline = useAppStore((s) => s.shelfDaemonOnline)
  const cards = filterShelfCards(shelfCards, query, domain)
  const recentRuns = useMemo(() => workflowShelfTasks(tasks), [tasks])
  const lockHint = shelfLockHint(daemonOnline)
  const runnable = cards.filter((card) => !card.blocked && daemonOnline !== false).length
  const [gridExpanded, setGridExpanded] = useState(false)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [rowCapacity, setRowCapacity] = useState(2)
  const gridRef = useRef<HTMLDivElement>(null)
  const visibleCards = previewSlice(cards, gridExpanded, rowCapacity)
  const visibleRecentRuns = previewSlice(recentRuns, recentExpanded, TASK_RECENT_PREVIEW)
  const gridNeedsToggle = previewNeedsToggle(cards.length, rowCapacity)
  const recentNeedsToggle = previewNeedsToggle(recentRuns.length, TASK_RECENT_PREVIEW)
  const catalogExpanded = gridNeedsToggle && gridExpanded
  const recentOpen = recentNeedsToggle && recentExpanded
  const homeLocked = !(catalogExpanded || recentOpen)

  useEffect(() => { void load() }, [load])
  useStickyIcons(`${cards.length}:${recentRuns.length}:${catalogExpanded}`)

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

  useEffect(() => {
    const body = document.querySelector('#workbench .wb-body')
    if (!body) return undefined
    body.classList.toggle('is-shelf-home-locked', homeLocked)
    return () => body.classList.remove('is-shelf-home-locked')
  }, [homeLocked])

  return (
    <div className="wb-shelf" data-testid="shelf-surface">
      <div className="wb-shelf-filters">
        <div className="wb-domain-switcher" id="wbDomainSwitcher" role="group" aria-label="领域筛选">
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
        <p className="wb-shelf-summary" id="wbShelfSummary" aria-live="polite">
          {loading ? '加载工作流…' : shelfSummaryText(cards.length, runnable)}
        </p>
        <button type="button" className="wb-shelf-manage" id="wbShelfManage" onClick={openWorkflowManage}>
          <Icon name="settingsLine" />
          <span>管理工作流</span>
        </button>
      </div>
      {lockHint ? (
        <div className="wb-shelf-locked" id="wbShelfLocked" data-testid="shelf-locked" role="status">{lockHint}</div>
      ) : null}
      <div className={`wb-shelf-catalog${catalogExpanded ? ' expanded' : ''}`}>
        {!loading && cards.length === 0 ? (
          <div className="wb-shelf-empty" id="wbShelfEmpty" data-testid="shelf-empty">
            {query.trim() || domain !== 'all' ? (
              <>
                <strong>没有匹配的工作流</strong>
                <span>点「全部」或清空搜索再看看。</span>
              </>
            ) : (
              <>
                <strong>还没有工作流</strong>
                <span>{shelfSupplyHint(daemonOnline)}</span>
                <div className="wb-empty-actions">
                  <button
                    type="button"
                    className="wb-modal-btn primary"
                    data-shelf-action="studio"
                    data-testid="shelf-create-workflow"
                    onClick={() => enterStudio('shelf')}
                  >
                    + 新建工作流
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
        <div
          ref={gridRef}
          className={`wb-shelf-grid${catalogExpanded ? ' is-expanded' : ''}`}
          id="wbShelfGrid"
        >
          {visibleCards.map((card) => (
            <ShelfCard key={card.id} card={card} onStart={() => startRun(card)} />
          ))}
        </div>
        <WorkbenchListToggle
          id="wbShelfGridToggle"
          expanded={gridExpanded}
          remaining={cards.length - rowCapacity}
          hidden={!gridNeedsToggle}
          onToggle={() => setGridExpanded((value) => !value)}
        />
      </div>
      <section
        className={`wb-task-home-panel wb-task-recent wb-shelf-recent${recentOpen ? ' expanded' : ''}`}
        aria-labelledby="wbShelfRecentTitle"
      >
        <div className="wb-task-home-head">
          <div>
            <div className="wb-section-label">工作流运行</div>
            <h2 id="wbShelfRecentTitle">你的工作流运行</h2>
          </div>
          <button
            type="button"
            className="wb-task-home-link wb-task-home-icon"
            title="管理工作流运行"
            aria-label="管理工作流运行"
            onClick={openTaskManage}
          >
            <Icon name="settingsLine" />
          </button>
        </div>
        {recentRuns.length === 0 ? (
          <div className="wb-task-recent-empty" id="wbShelfRecentEmpty">还没有工作流运行，从上方选一个工作流开始即可在此回看。</div>
        ) : (
          <>
            <div
              className={`wb-task-recent-list${recentOpen ? ' is-expanded' : ''}`}
              id="wbShelfRecentList"
              data-testid="shelf-recent-list"
              aria-label="工作流运行列表"
            >
              {visibleRecentRuns.map((task) => (
                <TaskRecentCard
                  key={task.id}
                  task={task}
                  workflowMode
                  onOpen={() => void reopenTaskRun(task, { lane: 'workflow' })}
                />
              ))}
            </div>
            <WorkbenchListToggle
              id="wbShelfRecentToggle"
              expanded={recentExpanded}
              remaining={recentRuns.length - TASK_RECENT_PREVIEW}
              hidden={!recentNeedsToggle}
              onToggle={() => setRecentExpanded((value) => !value)}
            />
          </>
        )}
      </section>
      <TaskManageModal />
    </div>
  )
}
