import { lazy, Suspense, useEffect, useRef } from 'react'
import { studioReturnLabel } from '../../domain/rail'
import { resolveWorkbenchTaskKind } from '../../domain/workbench-task-room'
import { bindAttentionEvents } from './store-attention'
import { BrandMark } from './BrandMark'
import { ensureSurfaceCss } from './ensureSurfaceCss'
import { Icon } from './Icon'
import { SideRail } from './SideRail'
import { useAppStore } from './store'
import { useKnowMeIcons } from './useKnowMeIcons'
import { AssistantPane } from '../features/assistant/AssistantPane'
import { StudioHeadNav } from '../features/workbench/StudioHeadNav'
import { resolveWorkbenchTabMode, workbenchHeadTitle } from '../features/workbench/workbench-head'
import { WorkspaceOverlays } from './WorkspaceOverlays'

/** 默认路由助手保持同步；其余表面按需分包，减冷启动解析量。 */
const ManageSurface = lazy(() => import('../features/manage/ManageSurface').then((m) => ({ default: m.ManageSurface })))
const StudioSurface = lazy(() => import('../features/studio/StudioSurface').then((m) => ({ default: m.StudioSurface })))
const ShelfSurface = lazy(() => import('../features/shelf/ShelfSurface').then((m) => ({ default: m.ShelfSurface })))
const TaskHomeSurface = lazy(() => import('../features/taskhome/TaskHomeSurface').then((m) => ({ default: m.TaskHomeSurface })))
const RunSurface = lazy(() => import('../features/run/RunSurface').then((m) => ({ default: m.RunSurface })))
const FilesPane = lazy(() => import('../features/files/FilesPane').then((m) => ({ default: m.FilesPane })))
const KnowledgeSurface = lazy(() => import('../features/knowledge/KnowledgeSurface').then((m) => ({ default: m.KnowledgeSurface })))
const SettingsSurface = lazy(() => import('../features/settings/SettingsSurface').then((m) => ({ default: m.SettingsSurface })))
const CapabilityHubSurface = lazy(() => import('../features/capability-hub/CapabilityHubSurface').then((m) => ({ default: m.CapabilityHubSurface })))
const ExpertRoomSurface = lazy(() => import('../features/expert/ExpertRoomSurface').then((m) => ({ default: m.ExpertRoomSurface })))
const TaskRoomHost = lazy(() => import('../features/task-dialogue/TaskRoomHost').then((m) => ({ default: m.TaskRoomHost })))
const WorkflowRoomSurface = lazy(() => import('../features/workflow/WorkflowRoomSurface').then((m) => ({ default: m.WorkflowRoomSurface })))
const LinkPreviewSurface = lazy(() => import('../features/link-preview/LinkPreviewSurface').then((m) => ({ default: m.LinkPreviewSurface })))

const WB_TABS = [
  { id: 'taskhome', mode: 'tasks', label: '专家协作' },
  { id: 'shelf', mode: 'workflows', label: '工作流' },
  { id: 'manage', mode: 'daemon', label: '管线服务' },
] as const

export function AppShell() {
  const route = useAppStore((s) => s.route)
  const surface = useAppStore((s) => s.workbenchSurface)
  const filesOpen = useAppStore((s) => s.filesOpen)
  const hasExpertRoom = useAppStore((s) => !!s.expertRoom)
  const runLane = useAppStore((s) => s.run?.lane ?? null)
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
  const linkPreview = useAppStore((s) => s.linkPreview)
  const linkFullscreen = useAppStore((s) => s.linkFullscreen)
  const shellRef = useRef<HTMLDivElement>(null)
  useKnowMeIcons(route + surface + String(filesOpen) + String(!!linkPreview) + String(linkFullscreen), shellRef)

  useEffect(() => bindAttentionEvents(useAppStore.getState), [])
  useEffect(() => window.api?.onWorkspaceOpenSettings?.((tab) => {
    openSettingsSurface(tab)
  }), [openSettingsSurface])

  // 大表 CSS 按面懒加载，避免助理首屏解析 workbench/hub/run 全量样式
  useEffect(() => {
    if (route === 'workbench' || route === 'automation') {
      ensureSurfaceCss('workbench-layout', () => import('../features/workbench/workbench-layout.css'))
    }
    if (surface === 'shelf') {
      ensureSurfaceCss('shelf', () => import('../features/shelf/shelf.css'))
    }
    if (surface === 'run') {
      ensureSurfaceCss('console', () => import('../features/run/console.css'))
    }
    if (route === 'capabilities') {
      ensureSurfaceCss('capability-hub', () => import('../styles/capability-hub.css'))
    }
    if (filesOpen || linkPreview) {
      ensureSurfaceCss('secondary-dialog', () => import('../../secondary-dialog.css'))
    }
  }, [route, surface, filesOpen, linkPreview])

  useEffect(() => {
    if (!filesOpen) return
    void useAppStore.getState().loadFileCatalog?.()
  }, [filesOpen])

  const isStudio = surface === 'studio'
  const showModeTabs = route === 'workbench' && ['taskhome', 'shelf', 'manage'].includes(surface)
  const activeTabMode = resolveWorkbenchTabMode(surface, managePanel)
  const backLabel = studioReturnLabel(studioReturnSurface)
  const headTitle = workbenchHeadTitle(route, surface)
  const taskKind = resolveWorkbenchTaskKind({ expertRoom: hasExpertRoom, lane: runLane })

  const mode = route === 'workbench' ? 'workbench' : route === 'knowledge' ? 'knowledge' : route === 'capabilities' ? 'capabilities' : route === 'automation' ? 'automation' : route === 'settings' ? 'settings' : 'agent'
  const showWorkbench = route === 'workbench' || route === 'automation'
  const taskRoomActive = route === 'workbench' && (surface === 'run' || hasExpertRoom)
  const appClass = [
    'app',
    `mode-${mode}`,
    filesOpen ? '' : 'side-collapsed',
    taskRoomActive ? 'workbench-task-active' : '',
    isStudio ? 'wb-studio-active' : '',
    linkFullscreen && linkPreview ? 'link-preview-fullscreen' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className="app-chrome-drag" role="presentation">
        <BrandMark />
      </div>
      <div
        ref={shellRef}
        className={appClass}
        id="appShell"
        data-workbench-layout={taskRoomActive ? 'task-room' : undefined}
        data-workbench-task-kind={taskRoomActive ? taskKind : undefined}
      >
        <SideRail />
        <aside className="sidebar" id="sidebar" data-ui="obsidian-files" hidden={!filesOpen} aria-label="文件中心">
          {filesOpen ? (
            <Suspense fallback={null}>
              <FilesPane />
            </Suspense>
          ) : null}
        </aside>
        <main className="main">
          {route === 'assistant' ? <AssistantPane /> : null}
          {route === 'assistant' ? (
            <Suspense fallback={null}>
              <LinkPreviewSurface />
            </Suspense>
          ) : null}
          {taskRoomActive ? (
            <Suspense fallback={null}>
              <TaskRoomHost />
            </Suspense>
          ) : null}
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
                {surface === 'taskhome' ? (
                  <Suspense fallback={null}><TaskHomeSurface /></Suspense>
                ) : null}
              </section>
              <section className={`wb-surface${surface === 'shelf' ? ' active' : ''}`} id="wbShelfSurface" data-wb-surface="shelf" aria-label="工作流货架">
                {surface === 'shelf' ? (
                  <Suspense fallback={null}><ShelfSurface /></Suspense>
                ) : null}
              </section>
              <section className={`wb-surface wb-manage-surface${managePanel === 'daemon' ? ' wb-manage-daemon' : ''}${managePanel === 'workflows' ? ' wb-manage-workflows' : ''}${surface === 'manage' ? ' active' : ''}`} id="wbManageSurface" data-wb-surface="manage" aria-label={managePanel === 'automation' ? '自动化中心' : managePanel === 'workflows' ? '管理工作流' : '管线服务'}>
                {surface === 'manage' ? <Suspense fallback={null}><ManageSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surface === 'studio' ? ' active' : ''}`} id="wbStudioSurface" data-wb-surface="studio" aria-label="搭建">
                {surface === 'studio' ? <Suspense fallback={null}><StudioSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surface === 'run' ? ' active' : ''}`} id="wbRunSurface" data-wb-surface="run" aria-label="运行">
                {surface === 'run' ? (
                  <Suspense fallback={null}>
                    {hasExpertRoom
                      ? <ExpertRoomSurface />
                      : runLane === 'pipeline'
                        ? <RunSurface taskRoom />
                        : <WorkflowRoomSurface />}
                  </Suspense>
                ) : null}
              </section>
            </div>
          </section>
          {route === 'capabilities' ? (
            <div className="hub-overlay-host">
              <Suspense fallback={null}>
                <CapabilityHubSurface />
              </Suspense>
            </div>
          ) : null}
          {route === 'knowledge' ? (
            <Suspense fallback={null}>
              <KnowledgeSurface />
            </Suspense>
          ) : null}
          {route === 'settings' ? (
            <Suspense fallback={null}>
              <SettingsSurface
                embedded
                initialTab={settingsTab}
                onOpenCapabilityHub={() => {
                  setHubTab('skill')
                  setRoute('capabilities')
                }}
              />
            </Suspense>
          ) : null}
        </main>
      </div>
      <WorkspaceOverlays />
    </>
  )
}
