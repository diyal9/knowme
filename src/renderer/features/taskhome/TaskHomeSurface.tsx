/**
 * 工作台「任务」首页：快捷任务、最近任务、新建任务弹层。
 * 不负责任务房内对话。
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { expertHomeTasks } from '../../../domain/run-projection'
import { previewNeedsToggle, previewSlice, TASK_QUICK_PREVIEW, workbenchHomeExperts } from '../../../domain/workbench-home'
import { useAppStore } from '../../app/store'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { filterByWorkbenchQuery } from '../../../domain/workbench-search'
import { isCapabilityInstalled } from '../../../domain/capability-hub'
import { TaskManageModal } from './TaskManageModal'
import { TaskComposerModal } from './TaskComposerModal'
import { TaskBoard } from './TaskBoard'
import { TaskQuickCard } from './TaskQuickCard'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'
import { ExpertDetailSurface } from '../expert/ExpertDetailSurface'
import type { ExpertWorkbenchDetail } from '../../../domain/expert-workbench-detail'

export function TaskHomeSurface() {
  const load = useAppStore((s) => s.loadTasks)
  const loadHub = useAppStore((s) => s.loadHubCapabilities)
  const loadModes = useAppStore((s) => s.loadWorkbenchModes)
  const tasks = useAppStore((s) => s.tasks)
  const hubItems = useAppStore((s) => s.hubItems)
  const modes = useAppStore((s) => s.modes)
  const experts = useMemo(
    () => workbenchHomeExperts(hubItems, modes),
    [hubItems, modes],
  )
  const installedExperts = useMemo(
    () => hubItems.filter((item) => item.kind === 'expert' && isCapabilityInstalled(item)),
    [hubItems],
  )
  const shelfQuery = useAppStore((s) => s.shelfQuery)
  const openExpertRoom = useAppStore((s) => s.openExpertRoom)
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerExpertId, setComposerExpertId] = useState('')
  const [selectedExpertId, setSelectedExpertId] = useState('')
  const [selectedExpertDetail, setSelectedExpertDetail] = useState<ExpertWorkbenchDetail | null>(null)
  const [quickExpanded, setQuickExpanded] = useState(false)
  const openTaskManage = useAppStore((s) => s.openTaskManage)
  const expertRoom = useAppStore((s) => s.expertRoom)
  const expertTasks = useMemo(() => {
    const list = expertHomeTasks(tasks)
    return filterByWorkbenchQuery(list.map((item) => ({
      ...item,
      id: String(item.id || ''),
      name: String(item.title || ''),
    })), shelfQuery)
  }, [tasks, shelfQuery])
  const filteredExperts = useMemo(
    () => filterByWorkbenchQuery(experts.map((item) => ({ ...item, id: item.id, name: item.name })), shelfQuery),
    [experts, shelfQuery],
  )
  const visibleExperts = previewSlice(filteredExperts, quickExpanded, TASK_QUICK_PREVIEW)
  const quickNeedsToggle = previewNeedsToggle(filteredExperts.length, TASK_QUICK_PREVIEW)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 直接写 hubTab，避免 setHubTab 再触发一轮 loadHubCapabilities
    useAppStore.setState({ hubTab: 'expert' })
    void load()
    void loadHub()
    void loadModes()
  }, [load, loadHub, loadModes])

  useEffect(() => {
    const requestedId = window.sessionStorage.getItem('knowme.workbench-expert-id')
    if (!requestedId || (!experts.some((item) => item.id === requestedId) && !installedExperts.some((item) => item.id === requestedId))) return
    window.sessionStorage.removeItem('knowme.workbench-expert-id')
    setSelectedExpertId(requestedId)
  }, [experts, installedExperts])
  useKnowMeIcons(`${experts.length}:${expertTasks.length}`, surfaceRef)

  if (expertRoom) return null

  const selectedExpert = experts.find((item) => item.id === selectedExpertId)
    || installedExperts.find((item) => item.id === selectedExpertId)
    || null
  if (selectedExpert) {
    return (
      <>
        <ExpertDetailSurface
          expert={selectedExpert}
          onBack={() => { setSelectedExpertId(''); setSelectedExpertDetail(null) }}
          onStart={(detail) => {
            setSelectedExpertDetail(detail)
            setComposerExpertId(selectedExpert.id)
            setComposerOpen(true)
          }}
        />
        {composerOpen ? (
          <TaskComposerModal
            experts={experts}
            initialExpertId={composerExpertId}
            expertDetail={selectedExpertDetail || undefined}
            lockExpert
            onClose={() => setComposerOpen(false)}
          />
        ) : null}
      </>
    )
  }

  return (
    <>
      <div ref={surfaceRef} className="wb-task-home wb-workbench-home-surface" data-testid="taskhome-surface">
        <section
          className="wb-task-home-panel wb-task-recent"
          aria-labelledby="wbTaskRecentTitle"
        >
          <div className="wb-task-home-head">
            <h2 className="wb-workbench-page-title" id="wbTaskRecentTitle">专家任务</h2>
          </div>
          {expertTasks.length === 0 ? (
            <div className="wb-task-recent-empty" id="wbTaskRecentEmpty" data-testid="wbTaskRecentEmpty">还没有专家任务。选择一位专家，说明目标后即可开始。</div>
          ) : (
            <TaskBoard
              tasks={expertTasks}
              idPrefix="wbTask"
              manageLabel="清理已完成任务"
              resolveExpert={(task) => hubItems.find((item) => item.kind === 'expert' && item.id === task.expertId)}
              onOpen={(task) => openExpertRoom({ id: task.id, name: task.expertName || task.title || task.id, goal: task.brief?.goal || task.goal })}
              onManageCompleted={openTaskManage}
            />
          )}
        </section>
        <section
          className={`wb-task-home-panel wb-task-quick wb-section-gradient-divider${quickExpanded && quickNeedsToggle ? ' expanded' : ''}`}
          aria-labelledby="wbTaskQuickTitle"
        >
          <div className="wb-task-home-head">
            <h2 id="wbTaskQuickTitle">常用专家</h2>
            <div className="wb-task-home-actions">
              <button type="button" className="wb-task-home-link" onClick={() => {
                window.sessionStorage.setItem('knowme.capability-view', 'my-experts')
                setHubTab('expert')
                setRoute('capabilities')
              }}>管理常用专家</button>
            </div>
          </div>
          <div className={`wb-task-quick-grid${quickExpanded && quickNeedsToggle ? ' is-expanded' : ''}`} id="wbTaskQuickGrid" aria-label="快捷专家入口">
            {experts.length === 0 ? (
              <div className="wb-task-quick-empty">还没有常用专家。请先到能力中心添加专家，并在“我的专家”中设为常用。</div>
            ) : visibleExperts.map((item, index) => (
              <TaskQuickCard
                key={item.id}
                item={item}
                index={index}
                onStart={() => { setComposerExpertId(item.id); setComposerOpen(true) }}
                onDetail={() => setSelectedExpertId(item.id)}
              />
            ))}
          </div>
          <WorkbenchListToggle id="wbTaskQuickToggle" expanded={quickExpanded} remaining={experts.length - TASK_QUICK_PREVIEW} hidden={!quickNeedsToggle} onToggle={() => setQuickExpanded((value) => !value)} />
        </section>
      </div>
      {composerOpen ? (
        <TaskComposerModal experts={experts} initialExpertId={composerExpertId} lockExpert={Boolean(composerExpertId)} onClose={() => setComposerOpen(false)} />
      ) : null}
      <TaskManageModal scope="expert" />
    </>
  )
}
