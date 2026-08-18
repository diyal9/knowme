/**
 * Workspace chrome: assistant is eager; other surfaces are lazy in production.
 * Head chrome CSS is static; feature modules own their surface stylesheets.
 */
import { Suspense, useEffect, useRef } from 'react'
import { studioReturnLabel } from '../../domain/rail'
import { resolveWorkbenchTaskKind } from '../../domain/workbench-task-room'
import { bindAttentionEvents } from './store-attention'
import { BrandMark } from './BrandMark'
import { Icon } from './Icon'
import '../features/workbench/workbench-chrome.css'
import { SurfacePending } from './lazySurface'
import { SideRail } from './SideRail'
import {
  CapabilityHubSurface,
  ExpertRoomSurface,
  FilesPane,
  KnowledgeSurface,
  LinkPreviewSurface,
  ManageSurface,
  RunSurface,
  SettingsSurface,
  ShelfSurface,
  StudioSurface,
  TaskHomeSurface,
  TaskRoomHost,
  WorkflowRoomSurface,
} from './surface-registry'
import { useAppStore } from './store'
import { useKnowMeIcons } from './useKnowMeIcons'
import { AssistantPane } from '../features/assistant/AssistantPane'
import { StudioHeadNav } from '../features/workbench/StudioHeadNav'
import { resolveWorkbenchTabMode, workbenchHeadTitle } from '../features/workbench/workbench-head'
import { WorkspaceOverlays } from './WorkspaceOverlays'

/** Visible chrome copy; escapes keep CJK intact under Windows encoding tools. */
const T = {
  collab: '\u4e13\u5bb6\u534f\u4f5c',
  workflow: '\u5de5\u4f5c\u6d41',
  daemon: '\u7ba1\u7ebf\u670d\u52a1',
  files: '\u6587\u4ef6\u4e2d\u5fc3',
  workbench: '\u5de5\u4f5c\u53f0',
  wbViews: '\u5de5\u4f5c\u53f0\u89c6\u56fe',
  searchWf: '\u641c\u7d22\u5de5\u4f5c\u6d41',
  searchPh: '\u641c\u7d22\u60f3\u8981\u7684\u7ed3\u679c',
  reload: '\u5237\u65b0',
  reloadWb: '\u5237\u65b0\u5de5\u4f5c\u53f0',
  shelf: '\u5de5\u4f5c\u6d41\u8d27\u67b6',
  automation: '\u81ea\u52a8\u5316\u4e2d\u5fc3',
  manageWf: '\u7ba1\u7406\u5de5\u4f5c\u6d41',
  studio: '\u642d\u5efa',
  run: '\u8fd0\u884c',
}

const WB_TABS = [
  { id: 'taskhome', mode: 'tasks', label: T.collab },
  { id: 'shelf', mode: 'workflows', label: T.workflow },
  { id: 'manage', mode: 'daemon', label: T.daemon },
] as const

export function AppShell() {
  const route = useAppStore((s) => s.route)
  const surfaceId = useAppStore((s) => s.workbenchSurface)
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
  useKnowMeIcons(route + surfaceId + String(filesOpen) + String(!!linkPreview) + String(linkFullscreen), shellRef)

  useEffect(() => bindAttentionEvents(useAppStore.getState), [])
  useEffect(() => window.api?.onWorkspaceOpenSettings?.((tab) => {
    openSettingsSurface(tab)
  }), [openSettingsSurface])

  useEffect(() => {
    if (!filesOpen) return
    void useAppStore.getState().loadFileCatalog?.()
  }, [filesOpen])

  const isStudio = surfaceId === 'studio'
  const showModeTabs = route === 'workbench'
    && managePanel !== 'automation'
    && ['taskhome', 'shelf', 'manage'].includes(surfaceId)
  const activeTabMode = resolveWorkbenchTabMode(surfaceId, managePanel)
  const backLabel = studioReturnLabel(studioReturnSurface)
  const headTitle = workbenchHeadTitle(route, surfaceId)
  const taskKind = resolveWorkbenchTaskKind({ expertRoom: hasExpertRoom, lane: runLane })

  const mode = route === 'workbench' ? 'workbench' : route === 'knowledge' ? 'knowledge' : route === 'capabilities' ? 'capabilities' : route === 'automation' ? 'automation' : route === 'settings' ? 'settings' : 'agent'
  const showWorkbench = route === 'workbench' || route === 'automation'
  const taskRoomActive = route === 'workbench' && (surfaceId === 'run' || hasExpertRoom)
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
        <aside className="sidebar" id="sidebar" data-ui="obsidian-files" hidden={!filesOpen} aria-label={T.files}>
          {filesOpen ? (
            <Suspense fallback={<SurfacePending />}>
              <FilesPane />
            </Suspense>
          ) : null}
        </aside>
        <main className="main">
          {route === 'assistant' ? <AssistantPane /> : null}
          {route === 'assistant' && linkPreview ? (
            <Suspense fallback={<SurfacePending />}>
              <LinkPreviewSurface />
            </Suspense>
          ) : null}
          {taskRoomActive ? (
            <Suspense fallback={<SurfacePending />}>
              <TaskRoomHost />
            </Suspense>
          ) : null}
          <section
            className={`workbench${isStudio ? ' wb-studio-active' : ''}`}
            id="workbench"
            hidden={!showWorkbench}
            data-surface={taskRoomActive ? 'run' : isStudio ? 'studio' : 'home'}
            data-layout={taskRoomActive ? 'task-room' : 'overview'}
            aria-label={T.workbench}
          >
            <header className="wb-head" id="wbHead" hidden={taskRoomActive || surfaceId === 'run'}>
              {!isStudio && !showModeTabs ? (
                <div className="wb-head-title">
                  <Icon name="workbench" />
                  <span id="wbHeadTitle">{headTitle}</span>
                  <span className="wb-head-sub" id="wbHeadSub" />
                </div>
              ) : null}
              {isStudio ? <StudioHeadNav /> : null}
              <div className="wb-mode-tabs" id="wbModeTabs" role="tablist" aria-label={T.wbViews} hidden={!showModeTabs}>
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
                <label className="wb-sr-only" htmlFor="wbShelfSearch">{T.searchWf}</label>
                <input
                  type="search"
                  className="wb-shelf-search"
                  id="wbShelfSearch"
                  placeholder={T.searchPh}
                  autoComplete="off"
                  hidden={isStudio}
                  value={shelfQuery}
                  onChange={(e) => setShelfQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="wb-icon-btn"
                  id="wbReload"
                  data-testid="studio-leave"
                  title={isStudio ? backLabel : T.reload}
                  aria-label={isStudio ? backLabel : T.reloadWb}
                  hidden={!isStudio}
                  onClick={() => leaveStudio()}
                >
                  <Icon name="chevronLeft" />
                </button>
              </div>
            </header>
            <div className="wb-body">
              <section className={`wb-surface${surfaceId === 'taskhome' ? ' active' : ''}`} id="wbTaskSurface" data-wb-surface="taskhome" aria-label={T.collab}>
                {showWorkbench && surfaceId === 'taskhome' ? (
                  <Suspense fallback={<SurfacePending />}><TaskHomeSurface /></Suspense>
                ) : null}
              </section>
              <section className={`wb-surface${surfaceId === 'shelf' ? ' active' : ''}`} id="wbShelfSurface" data-wb-surface="shelf" aria-label={T.shelf}>
                {showWorkbench && surfaceId === 'shelf' ? (
                  <Suspense fallback={<SurfacePending />}><ShelfSurface /></Suspense>
                ) : null}
              </section>
              <section className={`wb-surface wb-manage-surface${managePanel === 'daemon' ? ' wb-manage-daemon' : ''}${managePanel === 'workflows' ? ' wb-manage-workflows' : ''}${surfaceId === 'manage' ? ' active' : ''}`} id="wbManageSurface" data-wb-surface="manage" aria-label={managePanel === 'automation' ? T.automation : managePanel === 'workflows' ? T.manageWf : T.daemon}>
                {showWorkbench && surfaceId === 'manage' ? <Suspense fallback={<SurfacePending />}><ManageSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surfaceId === 'studio' ? ' active' : ''}`} id="wbStudioSurface" data-wb-surface="studio" aria-label={T.studio}>
                {showWorkbench && surfaceId === 'studio' ? <Suspense fallback={<SurfacePending />}><StudioSurface /></Suspense> : null}
              </section>
              <section className={`wb-surface${surfaceId === 'run' ? ' active' : ''}`} id="wbRunSurface" data-wb-surface="run" aria-label={T.run}>
                {showWorkbench && surfaceId === 'run' ? (
                  <Suspense fallback={<SurfacePending />}>
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
              <Suspense fallback={<SurfacePending />}>
                <CapabilityHubSurface />
              </Suspense>
            </div>
          ) : null}
          {route === 'knowledge' ? (
            <Suspense fallback={<SurfacePending />}>
              <KnowledgeSurface />
            </Suspense>
          ) : null}
          {route === 'settings' ? (
            <Suspense fallback={<SurfacePending />}>
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
