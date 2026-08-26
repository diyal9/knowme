import { useEffect, useMemo, useRef, useState } from 'react'
import '../../styles/capability-hub.css'
import type { CapabilityKind } from '../../../shared/api'
import {
  featuredHubItems,
  filterHubItems,
  hubCatalogTitle,
  hubDisplayChips,
  HUB_TAB_COPY,
  hubOriginLabel,
  hubSourceLabel,
  isCapabilityInstalled,
  isExpertCatalogEntry,
  isUserCreatedExpert,
  myExpertOriginLabel,
  shouldShowHubFeatured,
  type HubCapabilityItem,
} from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { useAppStore } from '../../app/store'
import { HubAddDialog } from './HubAddDialog'
import { HubCapabilityIcon } from './HubCapabilityIcon'
import { HubDetailDrawer } from './HubDetailDrawer'
import { HubExpertDialog } from './HubExpertDialog'
import { HubFavoriteButton } from './HubFavoriteButton'
import { HubStatusBadges } from './HubStatusBadges'

const HUB_TABS: { id: CapabilityKind; label: string }[] = [
  { id: 'expert', label: '专家' },
  { id: 'skill', label: '技能' },
  { id: 'connector', label: '连接器' },
]

function hubVersion(item: HubCapabilityItem): string {
  const version = String(item.version || '').trim()
  return version ? `v${version}` : 'v0.1.0'
}

export function CapabilityHubSurface() {
  const tab = useAppStore((s) => s.hubTab)
  const query = useAppStore((s) => s.hubQuery)
  const hubItems = useAppStore((s) => s.hubItems) as HubCapabilityItem[]
  const loading = useAppStore((s) => s.hubLoading)
  const setTab = useAppStore((s) => s.setHubTab)
  const setQuery = useAppStore((s) => s.setHubQuery)
  const loadHub = useAppStore((s) => s.loadHubCapabilities)
  const loadModes = useAppStore((s) => s.loadWorkbenchModes)
  const showToast = useAppStore((s) => s.showToast)
  const setRoute = useAppStore((s) => s.setRoute)
  const setWorkbenchSurface = useAppStore((s) => s.setWorkbenchSurface)
  const searchRef = useRef<HTMLInputElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState('全部')
  const [sourceFilter, setSourceFilter] = useState(() => {
    const target = window.sessionStorage.getItem('knowme.capability-view')
    if (target === 'my-experts') {
      window.sessionStorage.removeItem('knowme.capability-view')
      return '我的'
    }
    return '全部来源'
  })
  const [installedOnly, setInstalledOnly] = useState(false)
  const [mineOrigin, setMineOrigin] = useState<'all' | 'catalog' | 'created'>('all')
  const [detail, setDetail] = useState<HubCapabilityItem | null>(null)
  const [featuredExpanded, setFeaturedExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [expertOpen, setExpertOpen] = useState<{ mode: 'create' | 'tune' | 'copy'; item?: HubCapabilityItem | null } | null>(null)

  const items = useMemo(() => {
    const scoped = tab === 'expert' && sourceFilter !== '我的'
      ? hubItems.filter((item) => isExpertCatalogEntry(item as HubCapabilityItem))
      : hubItems
    const filtered = filterHubItems(scoped, { kind: tab, query, category, sourceFilter, installedOnly }) as HubCapabilityItem[]
    if (tab !== 'expert' || sourceFilter !== '我的' || mineOrigin === 'all') return filtered
    return filtered.filter((item) => mineOrigin === 'created' ? isUserCreatedExpert(item) : !isUserCreatedExpert(item))
  }, [category, hubItems, installedOnly, mineOrigin, query, sourceFilter, tab])
  const chips = useMemo(() => hubDisplayChips(hubItems, tab), [hubItems, tab])
  const featured = useMemo(() => featuredHubItems(items) as HubCapabilityItem[], [items])
  const visibleFeatured = featuredExpanded ? featured : featured.slice(0, 3)
  const mineFilter = tab === 'expert' && sourceFilter === '我的'
  const showFeatured = shouldShowHubFeatured(featured, { query, installedOnly }) && !mineFilter
    && category === '全部' && sourceFilter === '全部来源'
  const catalogTitle = hubCatalogTitle(tab, { query, installedOnly, category, sourceFilter })
  const copy = HUB_TAB_COPY[tab]
  useKnowMeIcons(`${tab}:${items.length}:${featured.length}:${category}:${sourceFilter}:${installedOnly}:${loading}`, surfaceRef)

  useEffect(() => {
    void loadHub()
    void window.api?.workbenchModeList?.().then((result) => {
      if (!result?.modes) return
      useAppStore.setState({ modes: result.modes, activeModeId: result.activeModeId || '' })
    })
  }, [loadHub])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isSearchShortcut = (event.ctrlKey || event.metaKey)
        && (event.key.toLowerCase() === 'k' || event.code === 'KeyK')
      if (isSearchShortcut) {
        event.preventDefault()
        event.stopPropagation()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    setFeaturedExpanded(false)
  }, [category, installedOnly, query, sourceFilter, tab])

  useEffect(() => {
    setDetail((current) => {
      if (!current) return null
      return hubItems.find((item) => item.id === current.id && item.kind === current.kind) || current
    })
  }, [hubItems])

  function patchItem(id: string, patch: Partial<HubCapabilityItem>) {
    useAppStore.setState({
      hubItems: hubItems.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
    setDetail((current) => current?.id === id ? { ...current, ...patch } : current)
  }

  function openExpertInWorkbench(item: HubCapabilityItem) {
    window.sessionStorage.setItem('knowme.workbench-expert-id', item.id)
    setDetail(null)
    setWorkbenchSurface('taskhome')
    setRoute('workbench')
  }

  return (
    <div ref={surfaceRef} className="hub-app" id="hubApp" data-testid="capability-hub-surface" data-tab={tab === 'expert' ? 'experts' : tab === 'skill' ? 'skills' : 'connectors'}>
      <div className="hub-nav">
        <div className="hub-nav-title">
          <Icon name="capabilityStack" />
<span>能力中心</span>
        </div>
        <nav className="hub-tabs" role="tablist" aria-label="能力类型">
          {HUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hub-tab${tab === t.id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setCategory('全部'); setSourceFilter('全部来源'); setTab(t.id) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="hub-icon-btn hub-nav-add-btn"
          id="hubBtnAdd"
          aria-label="添加能力"
          title="添加能力"
          data-tooltip="添加能力"
          onClick={() => setAddOpen(true)}
        >
          <Icon name="component" />
        </button>
      </div>
      <header className="hub-header">
        <div className="hub-commandbar">
          <div className="hub-search-wrap">
            <Icon name="searchLine" />
            <input
              ref={searchRef}
              className="hub-search"
              type="search"
              placeholder="搜索名称、描述或标签"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="搜索能力"
            />
            <kbd>Ctrl K</kbd>
          </div>
          {!(tab === 'expert' && mineFilter) ? <label className="hub-filter-toggle">
            <input
              type="checkbox"
              checked={installedOnly}
              onChange={(e) => setInstalledOnly(e.target.checked)}
              aria-label={tab === 'expert' ? '只看已添加' : '只看已安装'}
            />
            <span className="hub-toggle-track" aria-hidden="true"><span /></span>
            <span>{tab === 'expert' ? '只看已添加' : '只看已安装'}</span>
          </label> : null}
          <div className="hub-command-actions">
            {tab === 'expert' ? (
              <button
                type="button"
                className={`hub-my-experts-btn${mineFilter ? ' active' : ''}`}
                aria-pressed={mineFilter}
                onClick={() => {
                  setCategory('全部')
                  setMineOrigin('all')
                  setSourceFilter(mineFilter ? '全部来源' : '我的')
                }}
              >
                <Icon name="users" />
                <span>我的专家</span>
              </button>
            ) : null}
          </div>
        </div>
        {mineFilter ? (
          <div className="hub-mine-context">
            <div className="hub-mine-context-copy">
              <strong>你拥有的私人 Agent</strong>
              <span>包括从专家库添加的官方专家，以及你自己创建的专家；只有你能管理和使用。</span>
            </div>
            <div className="hub-filter-row hub-mine-origin-row">
              <span className="hub-filter-label">来源</span>
              <div className="hub-chips" role="group" aria-label="我的专家来源">
                {([['all', '全部'], ['catalog', '专家库添加'], ['created', '我创建的']] as const).map(([id, label]) => (
                  <button key={id} type="button" className={`hub-chip${mineOrigin === id ? ' active' : ''}`} aria-pressed={mineOrigin === id} onClick={() => setMineOrigin(id)}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div className="hub-filter-row hub-category-row">
          <span className="hub-filter-label">{tab === 'expert' ? '专业领域' : '分类'}</span>
          <div className="hub-chips" data-testid="hub-chips" role="group" aria-label="分类筛选">
            {chips.map((chip) => {
              const active = category === chip
              return (
                <button
                  key={chip}
                  type="button"
                  className={`hub-chip${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setCategory(chip)}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </div>
      </header>
      <div className="hub-body">
        <main className="hub-main">
          {showFeatured ? (
            <section className="hub-featured visible" data-testid="hub-featured" aria-label="精选能力">
              <div className="hub-section-head">
                <div>
                  <h2>{tab === 'expert' ? '精选推荐' : '为你精选'}</h2>
                </div>
                <div className="hub-section-head-actions">
                  <p>{copy.featured}</p>
                  {featured.length > 3 ? (
                    <button
                      type="button"
                      className="hub-section-toggle"
                      aria-expanded={featuredExpanded}
                      onClick={() => setFeaturedExpanded((expanded) => !expanded)}
                    >
                      {featuredExpanded ? '收起推荐' : `展开更多（${featured.length - 3}）`}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="hub-featured-row">
                {visibleFeatured.map((item, index) => (
                  <article
                    key={item.id}
                    className={`hub-card hub-card-featured hub-card-${item.kind}${item.favorite ? ' is-fav' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`查看精选推荐：${item.name || item.id}`}
                    style={{ '--index': index } as React.CSSProperties}
                    onClick={() => setDetail(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    {item.kind !== 'expert' ? <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} /> : null}
                    <div className="hub-card-head">
                      <HubCapabilityIcon item={item} className="hub-card-icon" />
                      <div className="hub-card-meta">
                        <div className="hub-card-title">{item.name || item.id}</div>
                      </div>
                    </div>
                    <div className="hub-card-desc">{item.description || '暂无描述'}</div>
                    <footer className="hub-card-foot">
                      <HubStatusBadges item={item} omitInstallState={false} omitCategory compact />
                      <div className="hub-card-foot-actions">
                        {item.kind === 'expert' ? <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} /> : <span className="hub-card-version">{hubVersion(item)}</span>}
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="hub-catalog" aria-labelledby="hubCatalogTitle">
            <div className="hub-section-head compact">
              <div>
                <h2 id="hubCatalogTitle">{catalogTitle}</h2>
              </div>
              <span className="hub-result-count">{loading ? '加载中' : `${items.length} 个结果`}</span>
            </div>
            <div className="hub-grid" id="hubGrid">
              {loading ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="hub-skeleton" aria-hidden="true" style={{ '--index': index } as React.CSSProperties} />
              )) : null}
              {!loading && mineFilter ? (
                <article
                  className="hub-card hub-card-create"
                  id="hubCreateExpertCard"
                  tabIndex={0}
                  role="button"
                  aria-label="创建专家"
                  onClick={() => setExpertOpen({ mode: 'create' })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpertOpen({ mode: 'create' })
                    }
                  }}
                >
                  <div className="hub-card-create-inner">
                    <span className="hub-card-create-icon" aria-hidden="true"><Icon name="plusLine" /></span>
                    <strong>创建专家</strong>
                  </div>
                </article>
              ) : null}
              {!loading && items.length === 0 && !mineFilter ? (
                <div className="hub-state">
                  <div className="hub-state-icon"><Icon name={query || installedOnly || category !== '全部' ? 'searchLine' : 'users'} /></div>
                  <strong>{query || installedOnly || category !== '全部' ? '没有找到匹配能力' : `还没有${HUB_TABS.find((t) => t.id === tab)?.label}`}</strong>
                  <p>{copy.empty}</p>
                  {tab === 'expert' ? (
                    <div className="hub-state-actions">
                      <button type="button" className="hub-btn primary" onClick={() => setExpertOpen({ mode: 'create' })}>新建专家</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!loading ? items.map((item, index) => {
                const origin = hubOriginLabel(item)
                const sub = [item.category || '未分类', mineFilter ? myExpertOriginLabel(item) : hubSourceLabel(item.source), origin].filter(Boolean).join(' · ')
                const installed = isCapabilityInstalled(item)
                const actionLabel = item.kind === 'expert'
                  ? (mineFilter ? '打开我的专家' : '查看详情')
                  : item.kind === 'skill'
                      ? (installed ? '管理技能' : '查看并安装')
                    : (installed ? '管理连接器' : '查看并安装')

                function openCardAction(event: React.MouseEvent<HTMLButtonElement>) {
                  event.stopPropagation()
                  setDetail(item)
                }
                return (
                  <article
                    key={item.id}
                    className={`hub-card hub-card-${item.kind}${item.favorite ? ' is-fav' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${mineFilter ? '打开我的专家' : '查看详情'}：${item.name || item.id}`}
                    style={{ '--index': index + (mineFilter ? 1 : 0) } as React.CSSProperties}
                    onClick={() => setDetail(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    {item.kind !== 'expert' ? <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} /> : null}
                    <div className="hub-card-head">
                      <HubCapabilityIcon item={item} className="hub-card-icon" />
                      <div className="hub-card-meta">
                        <div className="hub-card-title" role="heading" aria-level={3}>{item.name || item.id}</div>
                        <div className="hub-card-sub">{sub}</div>
                      </div>
                    </div>
                    <div className="hub-card-desc">{item.description || '暂无描述'}</div>
                    <footer className="hub-card-foot">
                      <HubStatusBadges item={item} compact />
                      <div className="hub-card-foot-actions">
                        {item.kind === 'expert' ? <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} /> : <span className="hub-card-version">{hubVersion(item)}</span>}
                        {item.kind !== 'expert' ? <button
                          type="button"
                          className="hub-card-action"
                          aria-label={`${actionLabel}：${item.name || item.id}`}
                          onClick={openCardAction}
                        >
                          {actionLabel}
                          <Icon name="chevronRight" />
                        </button> : null}
                      </div>
                    </footer>
                  </article>
                )
              }) : null}
            </div>
          </section>
        </main>
      </div>
      {detail ? (
        <HubDetailDrawer
          item={detail}
          isMine={mineFilter}
          onClose={() => setDetail(null)}
          onChanged={() => Promise.all([loadHub(), loadModes()]).then(() => undefined)}
          onOpenWorkbench={openExpertInWorkbench}
          onManageSkill={() => {
            setDetail(null)
            setTab('expert')
            setSourceFilter('我的')
            setMineOrigin('all')
            showToast('选择一位我的专家，在专家主页中管理技能装备')
          }}
          onEditExpert={(item, mode) => {
            setDetail(null)
            setExpertOpen({ mode, item })
          }}
        />
      ) : null}
      {addOpen ? (
        <HubAddDialog onClose={() => setAddOpen(false)} onImported={() => void loadHub()} />
      ) : null}
      {expertOpen ? (
        <HubExpertDialog
          mode={expertOpen.mode}
          item={expertOpen.item}
          onClose={() => setExpertOpen(null)}
          onSaved={() => void loadHub()}
        />
      ) : null}
    </div>
  )
}
