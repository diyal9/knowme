import { useEffect, useMemo, useRef, useState } from 'react'
import type { CapabilityKind } from '../../../shared/api'
import {
  featuredHubItems,
  filterHubItems,
  hubCatalogTitle,
  hubDisplayChips,
  HUB_TAB_COPY,
  hubOriginLabel,
  hubSourceLabel,
  shouldShowHubFeatured,
  type HubCapabilityItem,
} from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'
import { useStickyIcons } from '../../app/useStickyIcons'
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
  { id: 'connector', label: 'MCP 连接器' },
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
  const searchRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState('全部')
  const [installedOnly, setInstalledOnly] = useState(false)
  const [detail, setDetail] = useState<HubCapabilityItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expertOpen, setExpertOpen] = useState<{ mode: 'create' | 'tune' | 'copy'; item?: HubCapabilityItem | null } | null>(null)

  const items = useMemo(
    () => filterHubItems(hubItems, { kind: tab, query, category, installedOnly }) as HubCapabilityItem[],
    [category, hubItems, installedOnly, query, tab],
  )
  const chips = useMemo(() => hubDisplayChips(hubItems, tab), [hubItems, tab])
  const featured = useMemo(() => featuredHubItems(items) as HubCapabilityItem[], [items])
  const mineFilter = tab === 'expert' && category === '我的'
  const showFeatured = shouldShowHubFeatured(featured, { query, installedOnly }) && !mineFilter
  const catalogTitle = hubCatalogTitle(tab, { query, installedOnly, category })
  const copy = HUB_TAB_COPY[tab]

  useStickyIcons(`${tab}:${items.length}:${featured.length}:${category}:${installedOnly}:${loading}`)

  useEffect(() => {
    void loadHub()
    void window.api?.workbenchModeList?.().then((result) => {
      if (!result?.modes) return
      useAppStore.setState({ modes: result.modes, activeModeId: result.activeModeId || '' })
    })
  }, [loadHub])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function patchItem(id: string, patch: Partial<HubCapabilityItem>) {
    useAppStore.setState({
      hubItems: hubItems.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
    setDetail((current) => current?.id === id ? { ...current, ...patch } : current)
  }

  return (
    <div className="hub-app" id="hubApp" data-testid="capability-hub-surface" data-tab={tab === 'expert' ? 'experts' : tab === 'skill' ? 'skills' : 'connectors'}>
      <div className="hub-nav">
        <div className="hub-nav-title">
          <Icon name="capabilityStack" />
          <span>专家库</span>
        </div>
        <nav className="hub-tabs" role="tablist" aria-label="能力类型">
          {HUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hub-tab${tab === t.id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setCategory('全部'); setTab(t.id) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
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
          <label className="hub-filter-toggle">
            <input
              type="checkbox"
              checked={installedOnly}
              onChange={(e) => setInstalledOnly(e.target.checked)}
              aria-label="只看已安装"
            />
            <span className="hub-toggle-track" aria-hidden="true"><span /></span>
            <span>只看已安装</span>
          </label>
          {tab !== 'expert' ? (
            <button type="button" className="hub-add-btn" id="hubBtnAdd" aria-label="添加能力" title="导入技能 / 连接器等能力" onClick={() => setAddOpen(true)}>
              <Icon name="plusLine" />
              <span>添加能力</span>
            </button>
          ) : null}
        </div>
      </header>
      <div className="hub-body">
        <main className="hub-main">
          {showFeatured ? (
            <section className="hub-featured visible" data-testid="hub-featured" aria-label="精选能力">
              <div className="hub-section-head">
                <div>
                  <span className="hub-section-kicker">Curated</span>
                  <h2>为你精选</h2>
                </div>
                <p>{copy.featured}</p>
              </div>
              <div className="hub-featured-row">
                {featured.map((item, index) => (
                  <article
                    key={item.id}
                    className={`hub-featured-card${item.favorite ? ' is-fav' : ''}`}
                    tabIndex={0}
                    style={{ '--index': index } as React.CSSProperties}
                    onClick={() => setDetail(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} />
                    <HubCapabilityIcon item={item} className="hub-featured-icon" />
                    <strong>{item.name || item.id}</strong>
                    <span>{item.description || ''}</span>
                    <div className="hub-featured-meta">{item.category || '精选'} · {hubVersion(item)}</div>
                    <div className="hub-featured-arrow" aria-hidden="true"><Icon name="chevronRight" /></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="hub-catalog" aria-labelledby="hubCatalogTitle">
            <div className="hub-section-head compact">
              <div>
                <span className="hub-section-kicker">Catalog</span>
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
                  <div className="hub-state-actions">
                    {tab === 'expert' ? (
                      <button type="button" className="hub-btn primary" onClick={() => setExpertOpen({ mode: 'create' })}>新建专家</button>
                    ) : (
                      <button type="button" className="hub-btn primary" onClick={() => setAddOpen(true)}>添加能力</button>
                    )}
                  </div>
                </div>
              ) : null}
              {!loading ? items.map((item, index) => {
                const origin = hubOriginLabel(item)
                const sub = [item.category || '未分类', hubSourceLabel(item.source), origin].filter(Boolean).join(' · ')
                return (
                  <article
                    key={item.id}
                    className={`hub-card${item.favorite ? ' is-fav' : ''}`}
                    tabIndex={0}
                    style={{ '--index': index + (mineFilter ? 1 : 0) } as React.CSSProperties}
                    onClick={() => setDetail(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} />
                    <div className="hub-card-head">
                      <HubCapabilityIcon item={item} className="hub-card-icon" />
                      <div className="hub-card-meta">
                        <div className="hub-card-title" role="heading" aria-level={3}>{item.name || item.id}</div>
                        <div className="hub-card-sub">{sub}</div>
                      </div>
                    </div>
                    <div className="hub-card-desc">{item.description || '暂无描述'}</div>
                    <footer className="hub-card-foot">
                      <HubStatusBadges item={item} />
                      <span className="hub-card-version">{hubVersion(item)}</span>
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
          onClose={() => setDetail(null)}
          onChanged={() => { void loadHub() }}
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
