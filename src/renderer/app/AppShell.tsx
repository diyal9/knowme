import { lazy, Suspense, useEffect } from 'react'
import { studioReturnLabel } from '../../domain/rail'
import { resolveWorkbenchTaskKind } from '../../domain/workbench-task-room'
import { bindAttentionEvents } from './store-attention'
import { BrandMark } from './BrandMark'
import { Icon } from './Icon'
import { SideRail } from './SideRail'
import { useAppStore } from './store'
import { useStickyIcons } from './useStickyIcons'
import { AssistantPane } from '../features/assistant/AssistantPane'
import { ShelfSurface } from '../features/shelf/ShelfSurface'
import { TaskHomeSurface } from '../features/taskhome/TaskHomeSurface'
import { RunSurface } from '../features/run/RunSurface'
import { StudioHeadNav } from '../features/workbench/StudioHeadNav'
import { resolveWorkbenchTabMode, workbenchHeadTitle } from '../features/workbench/workbench-head'
import { FilesPane } from '../features/files/FilesPane'
import { KnowledgeSurface } from '../features/knowledge/KnowledgeSurface'
import { SettingsSurface } from '../features/settings/SettingsSurface'
import { CapabilityHubSurface } from '../features/capability-hub/CapabilityHubSurface'
import { WorkspaceOverlays } from './WorkspaceOverlays'
import { ExpertRoomSurface } from '../features/expert/ExpertRoomSurface'
import { TaskRoomHost } from '../features/task-dialogue/TaskRoomHost'
import { WorkflowRoomSurface } from '../features/workflow/WorkflowRoomSurface'

const ManageSurface = lazy(() => import('../features/manage/ManageSurface').then((m) => ({ default: m.ManageSurface })))
const StudioSurface = lazy(() => import('../features/studio/StudioSurface').then((m) => ({ default: m.StudioSurface })))

const WB_TABS = [
  { id: 'taskhome', mode: 'tasks', label: '专家协作' },
  { id: 'shelf', mode: 'workflows', label: '工作流' },
  { id: 'manage', mode: 'daemon', label: '管线服务' },
] as const

export function AppShell() {
  const route = useAppStore((s) => s.route)
  const surface = useAppStore((s) => s.workbenchSurface)
  const filesOpen = useAppStore((s) => s.filesOpen)
  const expertRoom = useAppStore((s) => s.expertRoom)
  const run = useAppStore((s) => s.run)
  const setWorkbenchSurface = useAppStore((s) => s.setWorkbenchSurface)
  const setShelfQuery = useAppStore((s) => s.setShelfQuery)
  const shelfQuery = useAppStore((s) => s.shelfQuery)
  const studioReturnSurface = useAppStore((s) => s.studioReturnSurface)
  const managePanel = useAppStore((s) => s.managePanel)
  const settingsTab = useAppStore((s) => s.settingsTab)
  const openSettingsSurface = useAppStore((s) => s.openSettingsSurface)
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const leaveStudio = useAppStore((s) => s.leaveStudio)
  useStickyIcons(route + surface + String(filesOpen))

  useEffect(() => bindAttentionEvents(useAppStore.getState), [])
  useEffect(() => window.api?.onWorkspaceOpenSettings?.((tab) => {
    openSettingsSurface(tab)
  }), [openSettingsSurface])

  const isStudio = surface === 'studio'
  const showModeTabs = route === 'workbench' && ['taskhome', 'shelf', 'manage'].includes(surface)
  const activeTabMode = resolveWorkbenchTabMode(surface, managePanel)
  const backLabel = studioReturnLabel(studioReturnSurface)
  const headTitle = workbenchHeadTitle(route, surface)
  const taskKind = resolveWorkbenchTaskKind({ expertRoom: !!expertRoom, lane: run?.lane })

  const mode = route === 'workbench' ? 'workbench' : route === 'knowledge' ? 'knowledge' : route === 'capabilities' ? 'capabilities' : route === 'automation' ? 'automation' : route === 'settings' ? 'settings' : 'agent'
  const showWorkbench = route === 'workbench' || route === 'automation'
  const taskRoomActive = route === 'workbench' && (surface === 'run' || !!expertRoom)
  const appClass = [
    'app',
    `mode-${mode}`,
    filesOpen ? '' : 'side-collapsed',
    taskRoomActive ? 'workbench-task-active' : '',
    isStudio ? 'wb-studio-active' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className="app-chrome-drag" role="presentation">
        <BrandMark />
      </div>
      <div
        className={appClass}
        id="appShell"
        data-workbench-layout={taskRoomActive ? 'task-room' : undefined}
        data-workbench-task-kind={taskRoomActive ? taskKind : undefined}
      >
        <SideRail />
        <aside className="sidebar" id="sidebar" data-ui="obsidian-files" hidden={!filesOpen} aria-label="文件中心">
          <FilesPane />
        </aside>
        <main className="main">
          {route === 'assistant' ? <AssistantPane /> : null}
          {taskRoomActive ? <TaskRoomHost /> : null}
          <section
            className={`workbench${isStudio ? ' wb-studio-active' : ''}`}
            id="workbench"
            hidden={!showWorkbench}
            data-surface={taskRoomActive ? 'run' : isStudio ? 'studio' : 'home'}
            data-layout={taskRoomActive ? 'task-room' : 'overview'}
            aria-label="工作台"
          >
            <header className="wb-head" id="wbHead" hidden={taskRoomActive || surface === 'run'}>
              {!isStudio ? (
                <div className="wb-head-title">
                  <Icon name="workbench" />
                  <span id="wbHeadTitle">{headTitle}</span>
                  <span className="wb-head-sub" id="wbHeadSub" />
                </div>
              ) : null}
              {isStudio ? <StudioHeadNav /> : null}
              <div className="wb-mode-tabs" id="wbModeTabs" role="tablist" aria-label="工作台视图" hidden={!showModeTabs}>
                {WB_TABS.map((tab) => {
                  const selected = activeTabMode === tab.mode
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`wb-mode-tab${selected ? ' active' : ''}`}
                      role="tab"
                      data-wb-mode={tab.mode}
                      aria-selected={selected}
                      onClick={() => {
                        if (tab.id === 'manage') {
                          useAppStore.setState({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'daemon' })
                          return
                        }
                        setWorkbenchSurface(tab.id)
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              <div className="wb-head-tools">
                <label className="wb-sr-only" htmlFor="wbShelfSearch">搜索工作流</label>
                <input
                  type="search"
                  className="wb-shelf-search"
                  id="wbShelfSearch"
                  placeholder="搜索想要的结果"
                  autoComplete="off"
                  hidden={surface !== 'shelf'}
                  value={shelfQuery}
                  onChange={(e) => setShelfQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="wb-icon-btn"
                  id="wbReload"
                  data-testid="studio-leave"
                  title={isStudio ? backLabel : '刷新'}
                  aria-label={isStudio ? backLabel : '刷新工作台'}
                  hidden={!isStudio}
                  onClick={() => leaveStudio()}
                >
                  <Icon name="chevronLeft" />
                </button>
              </div>
            </header>
            <div className="wb-body">
              <section className={`wb-surface${surface === 'taskhome' ? ' active' : ''}`} id="wbTaskSurface" data-wb-surface="taskhome" aria-label="专家协作">
                {surface === 'taskhome' ? <TaskHomeSurface /> : null}
              </section>
              <section className={`wb-surface${surface === 'shelf' ? ' active' : ''}`} id="wbShelfSurface" data-wb-surface="shelf" aria-label="工作流货架">
                {surface === 'shelf' ? <ShelfSurface /> : null}
              </section>
              <section className={`wb-surface wb-manage-surface${managePanel === 'daemon' ? ' wb-manage-daemon' : ''}${managePanel === 'workflows' ? ' wb-manage-workflows' : ''}${surface === 'manage' ? ' active' : ''}`} id="wbManageSurface" data-wb-surface="manage" aria-label={managePanel === 'automation' ? '自动化中心' : managePanel === 'workflows' ? '管理工作流' : '管线服务'}>
                {surface === 'manage' ? <Suspense fallback={null}><ManageSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surface === 'studio' ? ' active' : ''}`} id="wbStudioSurface" data-wb-surface="studio" aria-label="搭建">
                {surface === 'studio' ? <Suspense fallback={null}><StudioSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surface === 'run' ? ' active' : ''}`} id="wbRunSurface" data-wb-surface="run" aria-label="运行">
                {surface === 'run' ? (
                  expertRoom
                    ? <ExpertRoomSurface />
                    : run?.lane === 'pipeline'
                      ? <RunSurface taskRoom />
                      : <WorkflowRoomSurface />
                ) : null}
              </section>
            </div>
          </section>
          {route === 'capabilities' ? (
            <div className="hub-overlay-host">
              <CapabilityHubSurface />
            </div>
          ) : null}
          {route === 'knowledge' ? <KnowledgeSurface /> : null}
          {route === 'settings' ? (
            <SettingsSurface
              embedded
              initialTab={settingsTab}
              onOpenCapabilityHub={() => {
                setHubTab('skill')
                setRoute('capabilities')
              }}
            />
          ) : null}
        </main>
      </div>
      <WorkspaceOverlays />
    </>
  )
}
