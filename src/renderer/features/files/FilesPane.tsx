import { useEffect, useMemo, useRef, useState } from 'react'
import '../../../secondary-dialog.css'
import type { AgentRunArtifact } from '../../../shared/api'
import { fileTreeNodeIcon, filterVisibleNodes, sourceDirKey } from '../../../domain/file-tree'
import { Icon } from '../../app/Icon'
import { ProjectManagerDialog } from '../../app/ProjectManagerDialog'
import { useAppStore } from '../../app/store'
import { TreeIcon } from './TreeIcon'

export function FilesPane() {
  const query = useAppStore((s) => s.fileTreeQuery)
  const projects = useAppStore((s) => s.projects)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const sources = useAppStore((s) => s.sources)
  const sessions = useAppStore((s) => s.sessions)
  const activeSourceId = useAppStore((s) => s.activeSourceId)
  const fileTreeNodes = useAppStore((s) => s.fileTreeNodes)
  const loading = useAppStore((s) => s.fileTreeLoading)
  const truncated = useAppStore((s) => s.fileTreeTruncated)
  const collapsed = useAppStore((s) => s.fileTreeCollapsed)
  const setQuery = useAppStore((s) => s.setFileTreeQuery)
  const loadFileTree = useAppStore((s) => s.loadFileTree)
  const loadProjects = useAppStore((s) => s.loadProjects)
  const selectProject = useAppStore((s) => s.selectProject)
  const relinkProject = useAppStore((s) => s.relinkProject)
  const toggleFileDir = useAppStore((s) => s.toggleFileDir)
  const createSourceFile = useAppStore((s) => s.createSourceFile)
  const collapseFileTree = useAppStore((s) => s.collapseFileTree)
  const openSettingsSurface = useAppStore((s) => s.openSettingsSurface)
  const openSourceRoot = useAppStore((s) => s.openSourceRoot)
  const showToast = useAppStore((s) => s.showToast)
  const setAssistantApplyTarget = useAppStore((s) => s.setAssistantApplyTarget)
  const [projectMenu, setProjectMenu] = useState(false)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const [projectBusy, setProjectBusy] = useState(false)
  const [view, setView] = useState<'files' | 'archive'>('files')
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [splitPath, setSplitPath] = useState<string | null>(null)
  const [splitText, setSplitText] = useState('')
  const [splitLoading, setSplitLoading] = useState(false)
  const [pickingSplit, setPickingSplit] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement>(null)

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  )
  const archiveRoot = useMemo(
    () => String(activeProject?.outputPolicy?.deliverablesDir || 'outputs')
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '') || 'outputs',
    [activeProject],
  )
  const scopedNodes = useMemo(() => {
    if (view === 'files') return fileTreeNodes
    const rootDepth = Math.max(0, archiveRoot.split('/').length - 1)
    return fileTreeNodes
      .filter((node) => node.path.startsWith(`${archiveRoot}/`))
      .map((node) => ({
        ...node,
        depth: Math.max(0, (node.depth ?? node.path.split('/').length - 1) - rootDepth - 1),
      }))
  }, [archiveRoot, fileTreeNodes, view])

  const visibleNodes = useMemo(() => {
    if (!activeSourceId) return []
    return filterVisibleNodes(scopedNodes, {
      query,
      sourceId: activeSourceId,
      collapsed: new Set(Object.keys(collapsed)),
    })
  }, [activeSourceId, collapsed, query, scopedNodes])

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeSourceId) || null,
    [sources, activeSourceId],
  )

  const recentArtifacts = useMemo(() => {
    const seen = new Set<string>()
    return sessions.flatMap((session) => (session.run?.artifacts || []).map((artifact) => ({
      ...artifact,
      ownerProjectId: artifact.projectId || artifact.meta?.projectId || session.projectId || null,
      path: artifact.targetPath || artifact.meta?.path || '',
      content: artifact.body || String((artifact as AgentRunArtifact & { content?: string }).content || ''),
    }))).filter((artifact) => {
      if (!activeProjectId || artifact.ownerProjectId !== activeProjectId) return false
      const key = `${artifact.id}:${artifact.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(-6).reverse()
  }, [activeProjectId, sessions])

  useEffect(() => {
    void loadFileTree()
  }, [loadFileTree])

  useEffect(() => {
    if (!projectMenu) return undefined
    function close(event: PointerEvent) {
      if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenu(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setProjectMenu(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [projectMenu])

  useEffect(() => {
    if (view !== 'archive' || !activeSourceId) return
    const parts = archiveRoot.split('/').filter(Boolean)
    const prefixes = parts.map((_, index) => parts.slice(0, index + 1).join('/'))
    const nextDir = prefixes.find((path) =>
      fileTreeNodes.some((node) => node.type === 'dir' && node.path === path)
      && collapsed[sourceDirKey(activeSourceId, path)],
    )
    if (nextDir) void toggleFileDir(activeSourceId, nextDir)
  }, [activeSourceId, archiveRoot, collapsed, fileTreeNodes, toggleFileDir, view])

  async function addLocalProject() {
    setProjectBusy(true)
    try {
      const result = await window.api?.sourcesAddLocal?.()
      if (!result || result.canceled) return
      if (result.ok === false) {
        showToast(result.error || '无法打开项目目录')
        return
      }
      const listed = await window.api?.projectsList?.()
      const sourceId = String(result.source?.id || '')
      const project = listed?.projects?.find((item) => item.workspaceSourceId === sourceId)
      if (project) await selectProject(project.id)
      else {
        await loadProjects()
        await loadFileTree()
      }
      showToast(project ? `已切换到“${project.name}”` : '项目已添加')
      setProjectMenu(false)
    } catch {
      showToast('无法打开项目目录')
    } finally {
      setProjectBusy(false)
    }
  }

  function openRepositorySettings() {
    setProjectMenu(false)
    openSettingsSurface('sources')
    window.api?.openSettings?.('sources')
  }

  async function openFilePreview(path: string, target: 'main' | 'split' = 'main') {
    if (!activeSourceId) return
    if (pickingSplit || target === 'split') {
      setPickingSplit(false)
      setSplitPath(path)
      setSplitLoading(true)
      setSplitText('')
      try {
        const result = await window.api?.sourcesReadFile?.({ sourceId: activeSourceId, path })
        setSplitText(String(result?.content || '').slice(0, 12000) || (result?.ok === false ? (result.error || '无法读取') : '（空文件）'))
      } catch {
        setSplitText('无法读取文件')
      } finally {
        setSplitLoading(false)
      }
      return
    }
    setPreviewPath(path)
    setAssistantApplyTarget({ sourceId: activeSourceId, path })
    setPreviewLoading(true)
    setPreviewText('')
    try {
      const result = await window.api?.sourcesReadFile?.({ sourceId: activeSourceId, path })
      if (result?.ok === false) {
        showToast(result.error || '无法读取文件')
        setPreviewPath(null)
        return
      }
      setPreviewText(String(result?.content || '').slice(0, 12000))
    } catch {
      showToast('无法读取文件')
      setPreviewPath(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  function openArtifactPreview(artifact: typeof recentArtifacts[number]) {
    const path = String(artifact.path || '').replace(/\\/g, '/')
    if (path && !/^[a-z]:\//i.test(path) && !path.split('/').includes('..')) {
      void openFilePreview(path)
      return
    }
    setPreviewPath(`成果 / ${artifact.title || artifact.id}`)
    setPreviewText(artifact.content || '此成果只保留了运行引用，可回到原任务查看完整内容。')
    setPreviewLoading(false)
  }

  return (
    <div data-testid="files-pane">
      <div className="side-head">
        <button className="side-btn" type="button" hidden title="返回我的空间" aria-label="返回我的空间">
          <Icon name="chevronLeftLine" />
        </button>
        <div className="side-actions" role="toolbar" aria-label="文件中心操作">
          <div className="side-action-menu-wrap" ref={projectMenuRef}>
            <button
              className={`side-btn${projectMenu ? ' active' : ''}`}
              type="button"
              title="项目菜单"
              aria-label="项目菜单"
              aria-haspopup="menu"
              aria-expanded={projectMenu}
              onClick={() => setProjectMenu((open) => !open)}
            >
              <Icon name="obsidianFolderPlus" />
            </button>
            {projectMenu ? (
              <div className="side-action-menu project-action-menu" role="menu" aria-label="项目菜单">
                <button className="side-menu-item" type="button" role="menuitem" disabled={projectBusy} onClick={() => void addLocalProject()}>
                  <Icon name="obsidianFolderPlus" /><span>{projectBusy ? '正在打开…' : '打开本地项目'}</span>
                </button>
                <button className="side-menu-item" type="button" role="menuitem" onClick={openRepositorySettings}>
                  <Icon name="gitFork" /><span>克隆 Git 项目</span>
                </button>
                <button className="side-menu-item" type="button" role="menuitem" disabled={!projects.length} onClick={() => {
                  setProjectMenu(false)
                  setProjectManagerOpen(true)
                }}>
                  <Icon name="settingsLine" /><span>项目设置</span>
                </button>
                <div className="side-menu-separator" role="separator" />
                <button className="side-menu-item" type="button" role="menuitem" disabled={!activeSource} onClick={() => { setProjectMenu(false); void createSourceFile() }}>
                  <Icon name="obsidianNewNote" /><span>新建文件</span>
                </button>
                <button className="side-menu-item" type="button" role="menuitem" disabled={!activeSource} onClick={() => { setProjectMenu(false); void openSourceRoot() }}>
                  <Icon name="externalLink" /><span>打开项目目录</span>
                </button>
                <button className="side-menu-item" type="button" role="menuitem" disabled={!activeSource} onClick={() => {
                  setProjectMenu(false)
                  setPickingSplit(true)
                  showToast('再点一个文件，打开只读分屏预览')
                }}>
                  <Icon name="obsidianPanel" /><span>分屏预览</span>
                </button>
              </div>
            ) : null}
          </div>
          <button className="side-btn" type="button" title="刷新文件中心" aria-label="刷新文件中心" onClick={() => void loadFileTree()}>
            <Icon name="refresh" />
          </button>
          <button
            className="side-btn"
            type="button"
            hidden={!activeSource}
            title="折叠当前目录"
            aria-label="折叠当前目录"
            onClick={collapseFileTree}
          >
            <Icon name="obsidianCollapse" />
          </button>
        </div>
        <span className="side-title" id="sideTitle" />
      </div>
      <div className="files-view-switch" role="tablist" aria-label="项目内容">
        <button type="button" role="tab" aria-selected={view === 'files'} className={view === 'files' ? 'active' : ''} onClick={() => { setView('files'); setQuery('') }}>项目文件</button>
        <button type="button" role="tab" aria-selected={view === 'archive'} className={view === 'archive' ? 'active' : ''} onClick={() => { setView('archive'); setQuery('') }}>KnowMe 归档</button>
      </div>
      <div className="side-search">
        <span className="ico search-ico" data-icon="searchLine" aria-hidden="true" />
        <input
          type="search"
          placeholder={view === 'archive' ? '搜索归档文件…' : '搜索项目文件…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索文件"
          spellCheck={false}
        />
      </div>
      <div className="tree" id="tree">
        {loading ? <div className="tree-empty">加载文件树…</div> : null}
        {!loading && projects.length === 0 ? (
          <div className="tree-empty">打开本地文件夹或克隆 Git 仓库，创建第一个项目。</div>
        ) : null}
        {!loading && activeProject?.status === 'missing' ? (
          <div className="tree-empty">
            文件目录不可用。<button type="button" className="link-btn" onClick={() => void relinkProject(activeProject.id)}>重新定位</button>
          </div>
        ) : null}
        {!loading && activeProject?.status === 'readonly' ? (
          <div className="tree-empty tiny">此目录为只读，Agent 不会写入文件。</div>
        ) : null}
        {!loading && view === 'archive' && recentArtifacts.length ? (
          <section className="project-recent-artifacts" aria-label="最近成果" data-testid="project-recent-artifacts">
            <header><span>最近成果</span><small>来自 Agent 与工作流</small></header>
            {recentArtifacts.map((artifact) => (
              <button type="button" key={`${artifact.id}:${artifact.path}`} onClick={() => openArtifactPreview(artifact)} title={artifact.path || artifact.title || artifact.id}>
                <TreeIcon name="fileText" extraClass="file-ico" />
                <span>{artifact.title || artifact.path || '未命名成果'}</span>
                <small>{artifact.path || artifact.type || '运行成果'}</small>
              </button>
            ))}
          </section>
        ) : null}
        {!loading && activeSource && visibleNodes.length === 0 && (view !== 'archive' || recentArtifacts.length === 0) ? (
          <div className="tree-empty">
            {query.trim()
              ? '没有匹配的文件。'
              : view === 'archive'
                ? `“${archiveRoot}”中还没有 KnowMe 归档文件。`
                : '项目中暂无可显示的文件。'}
          </div>
        ) : null}
        {!loading && visibleNodes.length > 0 ? (
          <div className="grp source-tree-list">
            <div className="grp-items" aria-label="内容源文件树">
              {visibleNodes.map((node) => {
                const pad = Math.min(node.depth || 0, 8) * 12
                if (node.type === 'dir') {
                  const open = !!query.trim() || !collapsed[`${activeSourceId}:${node.path}`]
                  return (
                    <div
                      key={node.path}
                      className={`file source-dir${open ? ' open' : ''}`}
                      data-src-dir={node.path}
                      style={{ paddingLeft: pad }}
                      title={node.path}
                      role="treeitem"
                      aria-expanded={open}
                      onClick={() => void toggleFileDir(activeSourceId!, node.path)}
                    >
                      <button
                        type="button"
                        className="tree-twist"
                        aria-expanded={open}
                        title={open ? '收起目录' : '展开目录'}
                        onClick={(e) => {
                          e.stopPropagation()
                          void toggleFileDir(activeSourceId!, node.path)
                        }}
                      >
                        <TreeIcon name="chevronTree" extraClass="chev" />
                      </button>
                      <TreeIcon name={fileTreeNodeIcon(node)} extraClass="file-ico" />
                      <span className="file-name">{node.name}</span>
                    </div>
                  )
                }
                const active = previewPath === node.path
                return (
                  <div
                    key={node.path}
                    className={`file head${active ? ' active' : ''}`}
                    data-rel={node.path}
                    style={{ paddingLeft: pad }}
                    title={node.path}
                    role="treeitem"
                    onClick={() => void openFilePreview(node.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        void openFilePreview(node.path)
                      }
                    }}
                    tabIndex={0}
                  >
                    <span className="tree-gutter" aria-hidden="true" />
                    <TreeIcon name={fileTreeNodeIcon(node)} extraClass="file-ico" />
                    <span className="file-name">{node.name}</span>
                  </div>
                )
              })}
            </div>
            {truncated ? <div className="tree-empty tiny">部分目录子项过多，已截断</div> : null}
          </div>
        ) : null}
        {previewPath ? (
          <div className={`files-preview-stack${splitPath ? ' is-split' : ''}`}>
            <div className="files-preview-panel" data-testid="files-preview-panel">
              <header>
                <strong>{previewPath}</strong>
                <button type="button" className="files-preview-close" aria-label="关闭预览" onClick={() => { setPreviewPath(null); setSplitPath(null) }}>×</button>
              </header>
              {previewLoading ? <p className="tree-empty tiny">读取中…</p> : (
                <pre className="files-preview-body">{previewText || '（空文件）'}</pre>
              )}
            </div>
            {splitPath ? (
              <div className="files-preview-panel" data-testid="files-preview-split">
                <header>
                  <strong>{splitPath}</strong>
                  <button type="button" className="files-preview-close" aria-label="关闭分屏" onClick={() => setSplitPath(null)}>×</button>
                </header>
                {splitLoading ? <p className="tree-empty tiny">读取中…</p> : (
                  <pre className="files-preview-body">{splitText || '（空文件）'}</pre>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ProjectManagerDialog
        open={projectManagerOpen}
        initialProjectId={activeProjectId}
        onClose={() => setProjectManagerOpen(false)}
      />
    </div>
  )
}
