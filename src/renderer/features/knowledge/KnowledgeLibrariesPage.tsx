import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentSourceRef, KnowledgeProviderItem } from '../../../shared/api'
import { useAppStore } from '../../app/store'

type TreeNode = { type: 'dir' | 'file'; name: string; path: string; depth?: number }

function isMountedLibrary(provider: KnowledgeProviderItem) {
  return ['local', 'qmd-local', 'folder', 'gitlab'].includes(String(provider.kind || ''))
}

function libraryKind(provider: KnowledgeProviderItem) {
  if (provider.kind === 'gitlab') return 'GitLab'
  if (provider.kind === 'folder') return '文件夹'
  return 'LLM Wiki'
}

function sourceFor(provider: KnowledgeProviderItem | null, sources: ContentSourceRef[]) {
  if (!provider) return null
  const sourceId = provider.sourceId || provider.spaceSourceId
  return sources.find((source) => source.id === sourceId) || null
}

export function KnowledgeLibrariesPage() {
  const providers = useAppStore((state) => state.knowledgeProviders)
  const activeId = useAppStore((state) => state.knowledgeActiveProviderId)
  const loadKnowledge = useAppStore((state) => state.loadKnowledge)
  const loadBrain = useAppStore((state) => state.loadBrain)
  const setProvider = useAppStore((state) => state.setKnowledgeProvider)
  const syncProvider = useAppStore((state) => state.syncBrainProvider)
  const showToast = useAppStore((state) => state.showToast)
  const libraries = useMemo(() => providers.filter(isMountedLibrary), [providers])
  const [sources, setSources] = useState<ContentSourceRef[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({})
  const [expanded, setExpanded] = useState<Record<string, true>>({})
  const [rootPath, setRootPath] = useState('')
  const [treeError, setTreeError] = useState('')
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const selected = libraries.find((provider) => provider.id === selectedId) || libraries[0] || null
  const selectedSource = sourceFor(selected, sources)

  const reloadSources = async () => {
    const result = await window.api?.sourcesList?.()
    setSources(result?.sources || [])
  }

  useEffect(() => { void reloadSources() }, [])
  useEffect(() => {
    if (!actionsOpen) return
    const closeFromOutside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false)
    }
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsOpen(false)
    }
    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('keydown', closeFromKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('keydown', closeFromKeyboard)
    }
  }, [actionsOpen])
  useEffect(() => {
    if (!selectedId || !libraries.some((provider) => provider.id === selectedId)) {
      setSelectedId(libraries.find((provider) => provider.id === activeId)?.id || libraries[0]?.id || null)
    }
  }, [activeId, libraries, selectedId])

  useEffect(() => {
    setRootNodes([])
    setChildren({})
    setExpanded({})
    setPreview(null)
    setTreeError('')
    setRootPath('')
    const sourceId = selected?.sourceId || selected?.spaceSourceId
    if (!sourceId) return
    void window.api?.sourcesTree?.(sourceId).then((result) => {
      if (result?.ok === false) return setTreeError(result.error || '目录暂不可用')
      setRootNodes(result?.nodes || [])
      setRootPath(result?.rootPath || selectedSource?.rootPath || '')
    })
  }, [selected?.id, selected?.sourceId, selected?.spaceSourceId, selectedSource?.rootPath])

  const addLibrary = async () => {
    if (adding) return
    setAdding(true)
    try {
      const picked = await window.api?.sourcesAddLocal?.()
      if (!picked || picked.canceled) return
      if (picked.ok === false || !picked.source) return showToast(picked.error || '无法挂载这个目录')
      const source = picked.source
      const saved = await window.api?.knowledgeProviderSave?.({
        kind: 'qmd-local',
        displayName: source.displayName || 'LLM Wiki',
        sourceId: source.id,
        collectionId: `wiki_${source.id}`,
      })
      if (saved?.ok === false) return showToast(saved.error || '知识库保存失败')
      await reloadSources()
      await loadKnowledge()
      await loadBrain()
      if (saved?.id) setSelectedId(saved.id)
      showToast('已挂载新的 LLM Wiki；正文仍保留在原目录')
    } finally {
      setAdding(false)
    }
  }

  const toggleDir = async (node: TreeNode) => {
    if (expanded[node.path]) {
      setExpanded((current) => { const next = { ...current }; delete next[node.path]; return next })
      return
    }
    const sourceId = selected?.sourceId || selected?.spaceSourceId
    if (!sourceId) return
    if (!children[node.path]) {
      const result = await window.api?.sourcesTreeChildren?.({ sourceId, path: node.path })
      if (result?.ok === false) return showToast(result.error || '无法展开目录')
      setChildren((current) => ({ ...current, [node.path]: result?.nodes || [] }))
    }
    setExpanded((current) => ({ ...current, [node.path]: true }))
  }

  const openFile = async (node: TreeNode) => {
    const sourceId = selected?.sourceId || selected?.spaceSourceId
    if (!sourceId) return
    const result = await window.api?.sourcesReadFile?.({ sourceId, path: node.path })
    if (result?.ok === false) return showToast(result.error || '无法读取资料')
    setPreview({ path: node.path, content: result?.content || '' })
  }

  const removeLibrary = async () => {
    if (!selected || selected.id === 'local-default') return
    if (!window.confirm(`移除“${selected.displayName || selected.id}”？原目录不会被删除。`)) return
    const result = await window.api?.knowledgeProviderRemove?.(selected.id)
    if (result?.ok === false) return showToast(result.error || '无法移除知识库')
    setSelectedId(null)
    await loadKnowledge()
    await loadBrain()
    showToast('已移除知识库入口，原目录未改动')
  }

  const renderNodes = (nodes: TreeNode[], level = 0): React.ReactNode => nodes.map((node) => {
    const open = Boolean(expanded[node.path])
    return <div key={node.path}>
      <button
        type="button"
        className={`library-tree-row${preview?.path === node.path ? ' selected' : ''}`}
        style={{ paddingLeft: `${10 + level * 16}px` }}
        onClick={() => void (node.type === 'dir' ? toggleDir(node) : openFile(node))}
      >
        <span className="library-tree-caret">{node.type === 'dir' ? (open ? '⌄' : '›') : ''}</span>
        <span className={`library-tree-icon ${node.type}`} aria-hidden="true">{node.type === 'dir' ? '□' : '≡'}</span>
        <span>{node.name}</span>
      </button>
      {node.type === 'dir' && open ? renderNodes(children[node.path] || [], level + 1) : null}
    </div>
  })

  return <main className="library-manager" aria-label="LLM Wiki 知识库管理">
    <section className="library-browser">
      <header className="library-browser-head">
        <div className="library-selector-block">
          <small>{selected ? `${libraryKind(selected)} · 外挂知识库` : '外部本地知识'}</small>
          <label className="library-selector">
            <select aria-label="切换知识库" value={selected?.id || ''} disabled={!libraries.length} onChange={(event) => setSelectedId(event.target.value)}>
              {!libraries.length ? <option value="">暂无知识库</option> : null}
              {libraries.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName || provider.name || provider.id}{provider.id === activeId ? ' · 默认' : ''}</option>)}
            </select>
            <span aria-hidden="true">⌄</span>
          </label>
          <p>{selected ? rootPath || selectedSource?.rootPath || '目录等待连接' : '配置一个本地目录作为外挂知识库'}</p>
        </div>
        <div className="library-actions" ref={actionsRef}>
          <button type="button" className="library-actions-trigger" aria-label="知识库操作" aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}>•••</button>
          {actionsOpen ? <div className="library-actions-popover" role="menu">
            <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void addLibrary() }} disabled={adding}><span>＋</span>{adding ? '正在添加…' : '添加知识库'}</button>
            {selected ? <>
              <div className="library-actions-divider" />
              {selected.id !== activeId
                ? <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void setProvider(selected.id) }}><span>✓</span>设为默认检索</button>
                : <button type="button" role="menuitem" disabled><span>✓</span>当前默认检索</button>}
              <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void syncProvider(selected.id) }}><span>↻</span>刷新索引</button>
              {selectedSource ? <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void window.api?.sourcesOpenRoot?.(selectedSource.id) }}><span>↗</span>打开原目录</button> : null}
              {selected.id !== 'local-default' ? <><div className="library-actions-divider" /><button type="button" role="menuitem" className="danger" onClick={() => { setActionsOpen(false); void removeLibrary() }}><span>−</span>移除知识库</button></> : null}
            </> : null}
          </div> : null}
        </div>
      </header>
      {selected ? <>
        <div className="library-boundary"><strong>外挂知识</strong><span>目录内容不会全量导入 Brain；Agent 只在授权查询时读取。</span></div>
        <div className="library-browser-body">
          <aside className="library-tree"><div className="library-tree-head"><strong>目录</strong><span>{rootNodes.length} 项</span></div>{treeError ? <div className="library-tree-empty">{treeError}</div> : rootNodes.length ? renderNodes(rootNodes) : <div className="library-tree-empty">{selectedSource ? '目录为空或等待刷新' : '这个兼容知识库还没有绑定可浏览目录'}</div>}</aside>
          <article className="library-preview">
            {preview ? <><header><span>W</span><div><strong>{preview.path.split('/').pop()}</strong><small>{preview.path}</small></div></header><pre>{preview.content}</pre></> : <div className="library-preview-empty"><span>W</span><h3>从左侧选择一份资料</h3><p>在这里阅读外部知识；需要长期记住时，再通过提案沉淀到 Brain。</p></div>}
          </article>
        </div>
      </> : <div className="library-browser-empty"><span>W</span><h2>连接你的第一个 LLM Wiki</h2><p>可以配置多个本地目录，每个知识库独立检索和管理。</p><button type="button" onClick={() => void addLibrary()}>选择知识库目录</button></div>}
    </section>
  </main>
}
