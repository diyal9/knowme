import { useEffect, useMemo, useState } from 'react'
import { fileTreeNodeIcon, filterVisibleNodes, sourceKindLabel } from '../../../domain/file-tree'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { TreeIcon } from './TreeIcon'

export function FilesPane() {
  const query = useAppStore((s) => s.fileTreeQuery)
  const sources = useAppStore((s) => s.sources)
  const activeSourceId = useAppStore((s) => s.activeSourceId)
  const fileTreeNodes = useAppStore((s) => s.fileTreeNodes)
  const loading = useAppStore((s) => s.fileTreeLoading)
  const truncated = useAppStore((s) => s.fileTreeTruncated)
  const collapsed = useAppStore((s) => s.fileTreeCollapsed)
  const setQuery = useAppStore((s) => s.setFileTreeQuery)
  const loadFileTree = useAppStore((s) => s.loadFileTree)
  const selectSource = useAppStore((s) => s.selectSource)
  const toggleFileDir = useAppStore((s) => s.toggleFileDir)
  const createSourceFile = useAppStore((s) => s.createSourceFile)
  const collapseFileTree = useAppStore((s) => s.collapseFileTree)
  const openSettingsSurface = useAppStore((s) => s.openSettingsSurface)
  const openSourceRoot = useAppStore((s) => s.openSourceRoot)
  const showToast = useAppStore((s) => s.showToast)
  const [fileMenu, setFileMenu] = useState(false)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const visibleNodes = useMemo(() => {
    if (!activeSourceId) return []
    return filterVisibleNodes(fileTreeNodes, {
      query,
      sourceId: activeSourceId,
      collapsed: new Set(Object.keys(collapsed)),
    })
  }, [activeSourceId, collapsed, fileTreeNodes, query])

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeSourceId) || null,
    [sources, activeSourceId],
  )

  useEffect(() => {
    void loadFileTree()
  }, [loadFileTree])

  async function openFilePreview(path: string) {
    if (!activeSourceId) return
    setPreviewPath(path)
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

  function renderSourceSwitcher() {
    if (!activeSource) return null
    const meta = sourceKindLabel(activeSource)
    const title = activeSource.rootPath || activeSource.displayName || ''
    if (sources.length > 1) {
      return (
        <label className="source-switcher files-source-switch" title={title}>
          <div className="source-switcher-text">
            <select
              className="source-switcher-select"
              aria-label="切换内容源"
              value={activeSourceId || ''}
              onChange={(e) => void selectSource(e.target.value)}
            >
              {sources.map((src) => (
                <option key={src.id} value={src.id}>{src.displayName || src.id}</option>
              ))}
            </select>
            <span className="source-switcher-meta">{meta}</span>
          </div>
        </label>
      )
    }
    return (
      <div className="source-switcher" title={title}>
        <div className="source-switcher-text">
          <span className="source-switcher-name">{activeSource.displayName || '未命名目录'}</span>
          <span className="source-switcher-meta">{meta}</span>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="files-pane">
      <div className="side-head">
        <button className="side-btn" type="button" hidden title="返回我的空间" aria-label="返回我的空间">
          <Icon name="chevronLeftLine" />
        </button>
        <div className="side-actions" role="toolbar" aria-label="文件中心操作">
          <button className="side-btn" type="button" title="添加内容源" aria-label="添加内容源" onClick={() => {
              openSettingsSurface('sources')
              window.api?.openSettings?.('sources')
            }}>
            <Icon name="obsidianFolderPlus" />
          </button>
          <button className="side-btn" type="button" title="管理内容源" aria-label="管理内容源" onClick={() => {
              openSettingsSurface('sources')
              window.api?.openSettings?.('sources')
            }}>
            <Icon name="settingsLine" />
          </button>
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
          <div className="side-action-menu-wrap" id="fileActionsWrap" hidden={!activeSource}>
            <button
              className="side-btn"
              type="button"
              title="文件操作"
              aria-label="文件操作"
              aria-expanded={fileMenu}
              onClick={() => setFileMenu((open) => !open)}
            >
              <Icon name="moreHorizontal" />
            </button>
            {fileMenu ? (
              <div className="side-action-menu" role="menu" aria-label="文件操作菜单">
                <button className="side-menu-item" type="button" role="menuitem" onClick={() => { setFileMenu(false); void createSourceFile() }}>
                  <Icon name="obsidianNewNote" /><span>新建文件</span>
                </button>
                <button className="side-menu-item" type="button" role="menuitem" onClick={() => { setFileMenu(false); void openSourceRoot() }}>
                  <Icon name="externalLink" /><span>打开源目录</span>
                </button>
                <button className="side-menu-item side-menu-item-disabled" type="button" role="menuitem" disabled title="React 工作台未恢复独立编辑器分屏">
                  <Icon name="obsidianPanel" /><span>分屏编辑（未接入）</span>
                </button>
                <button className="side-menu-item side-menu-item-disabled" type="button" role="menuitem" disabled title="版本对比依赖 Git 编辑器窗，当前仅支持读文件预览">
                  <Icon name="obsidianSort" /><span>版本对比（未接入）</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <span className="side-title" id="sideTitle" />
      </div>
      <div className="side-search">
        <span className="ico search-ico" data-icon="searchLine" aria-hidden="true" />
        <input
          type="search"
          placeholder={sources.length ? '搜索文件…' : '搜索源…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜索文件"
          spellCheck={false}
        />
      </div>
      <div className="tree" id="tree">
        {loading ? <div className="tree-empty">加载文件树…</div> : null}
        {!loading && sources.length === 0 ? (
          <div className="tree-empty">前往设置添加本地文件夹或 GitLab 项目。</div>
        ) : null}
        {!loading && activeSource ? renderSourceSwitcher() : null}
        {!loading && activeSource && visibleNodes.length === 0 ? (
          <div className="tree-empty">
            {query.trim() ? '没有匹配的文件。' : '此源下暂无文本文件。'}
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
          <div className="files-preview-panel" data-testid="files-preview-panel">
            <header>
              <strong>{previewPath}</strong>
              <button type="button" className="files-preview-close" aria-label="关闭预览" onClick={() => setPreviewPath(null)}>×</button>
            </header>
            {previewLoading ? <p className="tree-empty tiny">读取中…</p> : (
              <pre className="files-preview-body">{previewText || '（空文件）'}</pre>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
