import { useEffect, useMemo, useState } from 'react'
import { expertHomeTasks } from '../../../domain/run-projection'
import {
  previewNeedsToggle,
  previewSlice,
  TASK_QUICK_PREVIEW,
  TASK_RECENT_PREVIEW,
  workbenchHomeExperts,
} from '../../../domain/workbench-home'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { useStickyIcons } from '../../app/useStickyIcons'
import { TaskComposerModal } from './TaskComposerModal'
import { TaskManageModal } from './TaskManageModal'
import { TaskQuickCard } from './TaskQuickCard'
import { TaskRecentCard } from './TaskRecentCard'
import { WorkbenchListToggle } from '../workbench/WorkbenchListToggle'

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
  const setHubTab = useAppStore((s) => s.setHubTab)
  const setRoute = useAppStore((s) => s.setRoute)
  const showToast = useAppStore((s) => s.showToast)
  const openExpertRoom = useAppStore((s) => s.openExpertRoom)
  const [composerOpen, setComposerOpen] = useState(false)
  const [quickExpanded, setQuickExpanded] = useState(false)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const reopenTaskRun = useAppStore((s) => s.reopenTaskRun)
  const openTaskManage = useAppStore((s) => s.openTaskManage)
  const expertRoom = useAppStore((s) => s.expertRoom)
  const expertTasks = useMemo(() => expertHomeTasks(tasks), [tasks])
  const visibleExperts = previewSlice(experts, quickExpanded, TASK_QUICK_PREVIEW)
  const visibleRecent = previewSlice(expertTasks, recentExpanded, TASK_RECENT_PREVIEW)
  const quickNeedsToggle = previewNeedsToggle(experts.length, TASK_QUICK_PREVIEW)
  const recentNeedsToggle = previewNeedsToggle(expertTasks.length, TASK_RECENT_PREVIEW)

  useEffect(() => {
    setHubTab('expert')
    void load()
    void loadHub()
    void loadModes()
  }, [load, loadHub, loadModes, setHubTab])
  useStickyIcons(`${experts.length}:${expertTasks.length}`)

  if (expertRoom) return null

  return (
    <>
      <div className="wb-task-home" data-testid="taskhome-surface">
        <section
          className={`wb-task-home-panel wb-task-quick${quickExpanded && quickNeedsToggle ? ' expanded' : ''}`}
          aria-labelledby="wbTaskQuickTitle"
        >
          <div className="wb-task-home-head">
            <div>
              <div className="wb-section-label">快捷专家</div>
              <h2 id="wbTaskQuickTitle">安排专家协作</h2>
            </div>
            <button
              type="button"
              className="wb-modal-btn primary"
              data-testid="task-new-collab"
              onClick={() => {
                if (!experts.length) {
                  showToast('还没有可用专家，请先到专家库创建专家')
                  setRoute('capabilities')
                  return
                }
                setComposerOpen(true)
              }}
            >
              + 新建协作
            </button>
          </div>
          <p className="wb-task-home-hint">选择一位专家并描述目标，KnowMe 会创建协作并持久保存，随时回来查看进展。</p>
          <div
            className={`wb-task-quick-grid${quickExpanded && quickNeedsToggle ? ' is-expanded' : ''}`}
            id="wbTaskQuickGrid"
            aria-label="快捷专家入口"
          >
            {experts.length === 0 ? (
              <div className="wb-task-quick-empty">还没有添加到工作台的专家。到专家库选择专家并「添加到工作台」，就会出现在这里。</div>
            ) : visibleExperts.map((item, index) => (
              <TaskQuickCard
                key={item.id}
                item={item}
                index={index}
                onOpen={() => openExpertRoom({ id: item.id, name: item.name || item.id })}
              />
            ))}
          </div>
          <WorkbenchListToggle
            id="wbTaskQuickToggle"
            expanded={quickExpanded}
            remaining={experts.length - TASK_QUICK_PREVIEW}
            hidden={!quickNeedsToggle}
            onToggle={() => setQuickExpanded((value) => !value)}
          />
        </section>
        <section
          className={`wb-task-home-panel wb-task-recent${recentExpanded && recentNeedsToggle ? ' expanded' : ''}`}
          aria-labelledby="wbTaskRecentTitle"
        >
          <div className="wb-task-home-head">
            <div>
              <div className="wb-section-label">最近协作</div>
              <h2 id="wbTaskRecentTitle">你的协作</h2>
            </div>
            <button
              type="button"
              className="wb-task-home-link wb-task-home-icon"
              title="管理最近协作"
              aria-label="管理最近协作"
              onClick={openTaskManage}
            >
              <Icon name="settingsLine" />
            </button>
          </div>
          {expertTasks.length === 0 ? (
            <div className="wb-task-recent-empty" id="wbTaskRecentEmpty" data-testid="wbTaskRecentEmpty">还没有协作记录，点击「新建协作」安排专家开始工作。</div>
          ) : (
            <>
              <div
                className={`wb-task-recent-list${recentExpanded && recentNeedsToggle ? ' is-expanded' : ''}`}
                id="wbTaskRecentList"
                aria-label="最近协作列表"
              >
                {visibleRecent.map((task) => (
                  <TaskRecentCard
                    key={task.id}
                    task={task}
                    onOpen={() => {
                      if (task.workflowId) void reopenTaskRun(task)
                      else openExpertRoom({ id: task.id, name: task.title || task.id })
                    }}
                  />
                ))}
              </div>
              <WorkbenchListToggle
                id="wbTaskRecentToggle"
                expanded={recentExpanded}
                remaining={expertTasks.length - TASK_RECENT_PREVIEW}
                hidden={!recentNeedsToggle}
                onToggle={() => setRecentExpanded((value) => !value)}
              />
            </>
          )}
        </section>
      </div>
      {composerOpen ? (
        <TaskComposerModal experts={experts} onClose={() => setComposerOpen(false)} />
      ) : null}
      <TaskManageModal />
    </>
  )
}
