import { useEffect, useMemo, useState } from 'react'
import type { KnowledgeProviderItem } from '../../../shared/api'
import { useAppStore } from '../../app/store'

function providerMark(kind?: string) {
  if (kind === 'ragflow') return 'RAG'
  if (kind === 'gitlab') return 'GL'
  if (kind === 'folder') return 'F'
  if (kind === 'remote-rag') return 'R'
  return 'W'
}

function providerKindLabel(provider: KnowledgeProviderItem) {
  if (provider.kind === 'ragflow') return 'RAG'
  if (provider.kind === 'remote-rag') return '远程 RAG'
  if (provider.kind === 'gitlab') return 'GitLab 工作副本'
  if (provider.kind === 'folder') return '本地文件夹'
  return '外挂 LLM Wiki'
}

function displayTime(value?: string | null) {
  if (!value) return '尚未记录'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function KnowledgeSourcesPage() {
  const providers = useAppStore((s) => s.knowledgeProviders)
  const remoteProviders = useMemo(() => providers.filter((provider) => provider.kind === 'ragflow' || provider.kind === 'remote-rag'), [providers])
  const activeId = useAppStore((s) => s.knowledgeActiveProviderId)
  const setProvider = useAppStore((s) => s.setKnowledgeProvider)
  const sync = useAppStore((s) => s.syncBrainProvider)
  const brainSnapshot = useAppStore((s) => s.brainSnapshot)
  const brainProviders = brainSnapshot?.providers || []
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const loadBrain = useAppStore((s) => s.loadBrain)
  const showToast = useAppStore((s) => s.showToast)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('RAG')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    if (!selectedId || !remoteProviders.some((provider) => provider.id === selectedId)) setSelectedId(remoteProviders.find((provider) => provider.id === activeId)?.id || remoteProviders[0]?.id || null)
  }, [activeId, remoteProviders, selectedId])

  const visibleProviders = useMemo(() => remoteProviders.filter((provider) => {
    const needle = query.trim().toLowerCase()
    return !needle || `${provider.displayName || provider.name || ''} ${providerKindLabel(provider)}`.toLowerCase().includes(needle)
  }), [query, remoteProviders])
  const selected = remoteProviders.find((provider) => provider.id === selectedId) || null
  const catalog = selected ? brainProviders.find((provider) => provider.id === selected.id) : null
  const collections = catalog?.collections?.length ? catalog.collections : selected?.collections || []
  const isRemote = selected?.kind === 'ragflow' || selected?.kind === 'remote-rag'
  const documentCount = collections.reduce((sum, collection) => sum + Number(collection.documentCount || 0), 0)
  const grantedCount = isRemote ? (selected?.collectionIds || []).length : collections.length

  const openConnection = (provider?: KnowledgeProviderItem) => {
    setEditingId(provider?.id || null)
    setName(provider?.displayName || provider?.name || 'RAG')
    setEndpoint(provider?.endpoint || '')
    setApiKey('')
    setAdding(true)
  }

  const saveConnection = async () => {
    if (!endpoint.trim()) return
    const result = await window.api?.knowledgeProviderSave?.({
      id: editingId || undefined,
      kind: selected?.id === editingId ? selected.kind : 'ragflow',
      displayName: name.trim() || 'RAG',
      endpoint: endpoint.trim(),
      apiKey,
      collectionIds: selected?.id === editingId ? selected.collectionIds : [],
    })
    if (result?.ok === false) return showToast(result.error || '知识库连接保存失败')
    setAdding(false); setEndpoint(''); setApiKey('')
    showToast(editingId ? '连接设置已更新' : 'RAG 已添加，可刷新目录并授权知识库')
    await loadKnowledge(); await loadBrain()
    const id = result?.id || editingId
    if (id) { setSelectedId(id); await sync(id) }
  }

  const toggleCollection = async (provider: KnowledgeProviderItem, collectionId: string) => {
    const current = provider.collectionIds || []
    const collectionIds = current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId]
    const result = await window.api?.knowledgeProviderSave?.({ id: provider.id, kind: provider.kind, displayName: provider.displayName, endpoint: provider.endpoint, collectionIds })
    if (result?.ok === false) return showToast(result.error || '权限保存失败')
    showToast('Agent 可读取的知识库范围已更新')
    await loadKnowledge(); await loadBrain()
  }

  const removeSelected = async () => {
    if (!selected || selected.id === 'local-default') return
    if (!window.confirm(`断开“${selected.displayName || selected.name || selected.id}”？Brain 中已收藏的引用会保留，但来源会显示不可用。`)) return
    const result = await window.api?.knowledgeProviderRemove?.(selected.id)
    if (result?.ok === false) return showToast(result.error || '无法断开知识库')
    showToast('已断开外部知识库；历史引用仍然保留')
    setSelectedId(null)
    await loadKnowledge(); await loadBrain()
  }

  return <div className="knowledge-workspace source-management-workspace">
    <main className="knowledge-source-manager">
      <aside className="source-manager-sidebar">
        <header><div><span>远程检索</span><h2>RAG</h2></div><button type="button" onClick={() => openConnection()} aria-label="添加 RAG">＋</button></header>
        <label className="source-manager-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 RAG 服务…" aria-label="搜索 RAG 服务" /></label>
        <div className="source-manager-filters"><button type="button" className="active">全部服务<small>{remoteProviders.length}</small></button></div>
        <div className="source-manager-list">
          {visibleProviders.map((provider) => {
            const providerCatalog = brainProviders.find((item) => item.id === provider.id)
            const active = provider.id === activeId
            return <button type="button" key={provider.id} className={`source-manager-item${provider.id === selected?.id ? ' selected' : ''}`} onClick={() => setSelectedId(provider.id)}>
              <span className="source-manager-mark">{providerMark(provider.kind)}</span>
              <span><strong>{provider.displayName || provider.name || provider.id}</strong><small>{providerKindLabel(provider)} · {providerCatalog?.collections?.length || provider.collections?.length || 0} 个入口</small></span>
              <i className={providerCatalog?.health === 'offline' ? 'offline' : ''} title={providerCatalog?.health === 'offline' ? '连接异常' : '可用'} />
              {active ? <em>默认</em> : null}
            </button>
          })}
          {!visibleProviders.length ? <div className="source-manager-empty"><strong>还没有 RAG 服务</strong><span>添加 RAG 后，可选择允许 Agent 查询的知识库。</span></div> : null}
        </div>
        <footer className="rag-sidebar-note"><span>远程结果默认仅用于当前任务</span></footer>
      </aside>

      <section className="source-manager-detail">
        {selected ? <>
          <header className="source-detail-header">
            <div className="source-detail-identity"><span className="source-manager-mark large">{providerMark(selected.kind)}</span><div><small>{providerKindLabel(selected)}</small><h2>{selected.displayName || selected.name || selected.id}</h2><p>{isRemote ? '按权限查询远程 Collection' : '正文留在原位置，KnowMe 只维护入口与检索能力'}</p></div></div>
            <div className="source-detail-actions">
              {selected.id !== activeId ? <button type="button" onClick={() => void setProvider(selected.id)}>设为默认</button> : <span>当前默认</span>}
              <button type="button" onClick={() => void sync(selected.id)}>刷新目录</button>
              {isRemote ? <button type="button" onClick={() => openConnection(selected)}>编辑连接</button> : null}
            </div>
          </header>

          <div className="source-boundary-banner"><span>只在查询时读取</span><p>不会把整库正文、切片或向量导入 Brain。Brain 只保存目录、授权范围、必要引用和用户确认后的结论。</p></div>

          <div className="source-detail-metrics">
            <div><strong>{collections.length}</strong><span>知识库入口</span></div>
            <div><strong>{grantedCount}</strong><span>{isRemote ? '已授权 Agent' : '已挂载'}</span></div>
            <div><strong>{documentCount || '—'}</strong><span>目录文档数</span></div>
            <div><strong className={catalog?.health === 'offline' ? 'danger' : ''}>{catalog?.health === 'offline' ? '异常' : '可用'}</strong><span>连接状态</span></div>
          </div>

          <section className="source-collections-panel">
            <div className="source-section-head"><div><h3>知识库目录</h3><p>{isRemote ? '勾选后，获得该策略的 Agent 才能按需查询。' : '挂载目录只作为联邦检索入口，不属于本地 Brain。'}</p></div><small>{collections.length} 项</small></div>
            <div className="source-collection-list">
              {collections.map((collection) => {
                const granted = !isRemote || (selected.collectionIds || []).includes(collection.id)
                const collectionName = collection.name || collection.id
                return <label key={collection.id} className={`source-collection-row source-collection-card${granted ? ' granted' : ''}`}>
                  <span className="source-collection-card-head">
                    <span className="source-collection-icon">K</span>
                    <span className="source-collection-permission">{granted ? '可查询' : '未授权'}</span>
                    <input type="checkbox" aria-label={`${collectionName} Agent 查询授权`} checked={granted} disabled={!isRemote} onChange={() => void toggleCollection(selected, collection.id)} />
                  </span>
                  <span className="source-collection-copy"><strong>{collectionName}</strong><small>{collection.description || collection.tags?.join(' · ') || '查询时读取原始来源'}</small></span>
                  <span className="source-collection-card-foot">
                    <span className="source-collection-meta"><strong>{collection.documentCount ?? '—'}</strong><small>份文档</small></span>
                    <span className="source-collection-time"><small>更新于</small><strong>{displayTime(collection.updatedAt)}</strong></span>
                  </span>
                </label>
              })}
              {!collections.length ? <div className="source-collection-empty"><strong>还没有目录信息</strong><span>{isRemote ? '刷新目录后，可在这里选择 Agent 能读取的 Collection。' : '重新挂载或同步来源后显示目录。'}</span><button type="button" onClick={() => void sync(selected.id)}>刷新目录</button></div> : null}
            </div>
          </section>

          <section className="source-connection-panel">
            <div><span>连接</span><strong>{selected.endpoint || (selected.kind === 'gitlab' ? 'GitLab 工作副本' : '本机挂载目录')}</strong></div>
            <div><span>最近查询</span><strong>{displayTime(catalog?.lastQueryAt)}</strong></div>
            <div><span>数据边界</span><strong>目录与引用留在 Brain，正文留在来源</strong></div>
            {selected.id !== 'local-default' ? <button type="button" className="danger" onClick={() => void removeSelected()}>断开知识库</button> : null}
          </section>
        </> : <div className="source-detail-empty"><span>RAG</span><h2>连接 RAG</h2><p>读取当前身份可见的 Dataset，并选择 Agent 可以按需查询的范围。</p><button type="button" onClick={() => openConnection()}>添加 RAG</button></div>}
      </section>
    </main>

    {adding ? <div className="knowledge-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setAdding(false) }}><section className="knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="ragAddTitle"><header className="knowledge-modal-head"><h2 id="ragAddTitle">{editingId ? '编辑 RAG 连接' : '连接 RAG'}</h2><button type="button" className="knowledge-modal-close" aria-label="关闭" onClick={() => setAdding(false)}>×</button></header><div className="knowledge-modal-body"><div className="knowledge-form-row"><label htmlFor="ragName">显示名称</label><input id="ragName" className="knowledge-input" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="knowledge-form-row"><label htmlFor="ragEndpoint">服务地址</label><input id="ragEndpoint" className="knowledge-input" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://rag.example.com" /></div><div className="knowledge-form-row"><label htmlFor="ragKey">RAG API Key</label><input id="ragKey" type="password" className="knowledge-input" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={editingId ? '留空则保留现有密钥' : '仅加密保存在本机'} /></div><p className="brain-boundary-note">只读取当前身份可见的知识库目录。你选择授权前，Agent 不会查询其中内容。</p><div className="knowledge-form-actions"><button type="button" className="knowledge-btn primary" disabled={!endpoint.trim()} onClick={() => void saveConnection()}>{editingId ? '保存连接' : '保存并读取目录'}</button><button type="button" className="knowledge-btn" onClick={() => setAdding(false)}>取消</button></div></div></section></div> : null}
  </div>
}
