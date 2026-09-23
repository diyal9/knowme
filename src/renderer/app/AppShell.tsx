/**
 * Workspace chrome: assistant is eager; other surfaces are lazy in production.
 * Workbench CSS is registered statically in a deterministic cascade before
 * any lazy workbench surface is rendered.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { studioReturnLabel } from '../../domain/rail'
import type { KnowledgePage } from '../../domain/knowledge-surface'
import { resolveWorkbenchTaskKind } from '../../domain/workbench-task-room'
import { bindAttentionEvents } from './store-attention'
import { BrandMark } from './BrandMark'
import { BackButton } from './BackButton'
import { Icon } from './Icon'
import '../features/workbench/workbench-styles'
import '../features/workbench/workbench-chrome.css'
import { SurfacePending } from './lazySurface'
import { SideRail } from './SideRail'
import {
  CapabilityHubSurface,
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
import { ProjectContextSwitcher } from './ProjectContextSwitcher'

/** Visible chrome copy; escapes keep CJK intact under Windows encoding tools. */
const T = {
  collab: '\u4e13\u5bb6\u534f\u4f5c',
  workflow: '\u5de5\u4f5c\u6d41',
  daemon: '\u7ba1\u7ebf\u670d\u52a1',
  files: '\u9879\u76ee\u7a7a\u95f4',
  workbench: '\u5de5\u4f5c\u53f0',
  wbViews: '\u5de5\u4f5c\u53f0\u89c6\u56fe',
  search: '\u641c\u7d22',
  searchExpertPh: '\u641c\u7d22\u4e13\u5bb6\u6216\u4efb\u52a1',
  searchWorkflowPh: '\u641c\u7d22\u5de5\u4f5c\u6d41',
  reload: '\u5237\u65b0',
  reloadWb: '\u5237\u65b0\u5de5\u4f5c\u53f0',
  shelf: '\u5de5\u4f5c\u6d41\u8d27\u67b6',
  automation: '\u81ea\u52a8\u5316\u4e2d\u5fc3',
  automationTab: '\u81ea\u52a8\u5316',
  automationTask: '\u4efb\u52a1',
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
  const leaveStudio = useAppStore((s) => s.leaveStudio)
  const linkPreview = useAppStore((s) => s.linkPreview)
  const linkFullscreen = useAppStore((s) => s.linkFullscreen)
  const [searchOpen, setSearchOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  useKnowMeIcons(route + surfaceId + String(filesOpen) + String(!!linkPreview) + String(linkFullscreen), shellRef)

  useEffect(() => bindAttentionEvents(useAppStore.getState), [])
  useEffect(() => {
    void useAppStore.getState().loadProjects?.()
  }, [])
  useEffect(() => window.api?.onWorkspaceOpenSettings?.((tab) => {
    openSettingsSurface(tab)
  }), [openSettingsSurface])
  useEffect(() => window.api?.onWorkspaceOpenRoute?.((payload) => {
    if (payload.route === 'knowledge') {
      useAppStore.getState().setRoute('knowledge')
      useAppStore.getState().setKnowledgePage((payload.page || 'status') as KnowledgePage)
    }
  }), [])

  useEffect(() => {
    if (!filesOpen) return
    void useAppStore.getState().loadFileCatalog?.()
  }, [filesOpen])

  const isStudio = surfaceId === 'studio'
  const showModeTabs = route === 'workbench'
    && managePanel !== 'automation'
    && ['taskhome', 'shelf', 'manage'].includes(surfaceId)
  const showAutomationTab = route === 'automation'
  const showTopTabs = showModeTabs || showAutomationTab
  const searchAvailable = route === 'workbench' && (surfaceId === 'taskhome' || surfaceId === 'shelf')
  const searchPlaceholder = surfaceId === 'shelf' ? T.searchWorkflowPh : T.searchExpertPh
  const activeTabMode = resolveWorkbenchTabMode(surfaceId, managePanel)
  const backLabel = studioReturnLabel(studioReturnSurface)
  const headTitle = workbenchHeadTitle(route, surfaceId)

  useEffect(() => {
    if (!searchAvailable) setSearchOpen(false)
  }, [searchAvailable])

  useEffect(() => {
    if (!searchOpen) return undefined
    searchInputRef.current?.focus()
    function closeSearch(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    function closeSearchOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSearchOpen(false)
      searchTriggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeSearch)
    document.addEventListener('keydown', closeSearchOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeSearch)
      document.removeEventListener('keydown', closeSearchOnEscape)
    }
  }, [searchOpen])
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
          {linkPreview && (route === 'assistant' || linkPreview.presentation === 'overlay') ? (
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
              {showAutomationTab ? (
                <div className="wb-automation-head-title" aria-label={T.automationTab}>
                  <Icon name="automation" />
                  <span>{T.automationTab}</span>
                </div>
              ) : !isStudio && !showTopTabs ? (
                <div className="wb-head-title">
                  <Icon name="workbench" />
                  <span id="wbHeadTitle">{headTitle}</span>
                  <span className="wb-head-sub" id="wbHeadSub" />
                </div>
              ) : null}
              {isStudio ? <StudioHeadNav /> : null}
              <div className="wb-mode-tabs" id="wbModeTabs" role="tablist" aria-label={showAutomationTab ? T.automation : T.wbViews} hidden={!showTopTabs}>
                {showAutomationTab ? (
                  <button
                    type="button"
                    className="wb-mode-tab active"
                    role="tab"
                    aria-selected="true"
                    onClick={() => useAppStore.getState().openAutomationCenter()}
                  >
                    {T.automationTask}
                  </button>
                ) : WB_TABS.map((tab) => {
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
                {searchAvailable ? (
                  <div className="wb-head-search" ref={searchRef}>
                    <button
                      ref={searchTriggerRef}
                      type="button"
                      className={`wb-search-trigger${searchOpen ? ' is-open' : ''}${shelfQuery.trim() ? ' has-query' : ''}`}
                      aria-label={`${T.search}\uff1a${searchPlaceholder.replace(/^\u641c\u7d22/, '')}`}
                      aria-expanded={searchOpen}
                      aria-controls="wbSearchPopover"
                      onClick={() => setSearchOpen((open) => !open)}
                    >
                      <Icon name="searchLine" />
                    </button>
                    {searchOpen ? (
                      <div className="wb-search-popover" id="wbSearchPopover" role="search" aria-label={searchPlaceholder}>
                        <label className="wb-search-field" htmlFor="wbShelfSearch">
                          <Icon name="searchLine" />
                          <input
                            ref={searchInputRef}
                            type="search"
                            className="wb-shelf-search"
                            id="wbShelfSearch"
                            placeholder={searchPlaceholder}
                            autoComplete="off"
                            value={shelfQuery}
                            onChange={(event) => setShelfQuery(event.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {route === 'workbench' ? <ProjectContextSwitcher /> : null}
                <div className="wb-head-detail-actions" id="wbHeadDetailActions" />
                <BackButton
                  label={backLabel}
                  iconOnly
                  className="wb-icon-btn"
                  id="wbReload"
                  data-testid="studio-leave"
                  hidden={!isStudio}
                  onClick={() => leaveStudio()}
                />
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
                      ? null
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
              />
            </Suspense>
          ) : null}
        </main>
      </div>
      <WorkspaceOverlays />
    </>
  )
}
