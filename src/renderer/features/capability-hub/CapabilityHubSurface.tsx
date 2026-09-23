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
  connectorType,
  isCapabilityInstalled,
  isExpertCatalogEntry,
  isExpertAvailableForNewTask,
  isExpertQualificationLimited,
  isExpertRuntimeLimited,
  isUserCreatedExpert,
  myExpertOriginLabel,
  shouldShowHubFeatured,
  type HubCapabilityItem,
} from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { useAppStore } from '../../app/store'
import { HubCapabilityIcon } from './HubCapabilityIcon'
import { HubDetailDrawer } from './HubDetailDrawer'
import { HubExpertDialog } from './HubExpertDialog'
import { HubFavoriteButton } from './HubFavoriteButton'
import { HubStatusBadges } from './HubStatusBadges'

const CAPABILITY_GOVERNANCE_EXPERT = {
  id: 'agent-operations',
  name: '能力管家',
} as const

const HUB_TABS: { id: CapabilityKind; label: string }[] = [
  { id: 'expert', label: '专家' },
  { id: 'skill', label: '技能' },
  { id: 'connector', label: '连接器' },
]

export function CapabilityHubSurface() {
  const tab = useAppStore((s) => s.hubTab)
  const query = useAppStore((s) => s.hubQuery)
  const hubItems = useAppStore((s) => s.hubItems) as HubCapabilityItem[]
  const loading = useAppStore((s) => s.hubLoading)
  const setTab = useAppStore((s) => s.setHubTab)
  const setQuery = useAppStore((s) => s.setHubQuery)
  const loadHub = useAppStore((s) => s.loadHubCapabilities)
  const loadModes = useAppStore((s) => s.loadWorkbenchModes)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const openExpertRoom = useAppStore((s) => s.openExpertRoom)
  const showToast = useAppStore((s) => s.showToast)
  const setRoute = useAppStore((s) => s.setRoute)
  const setWorkbenchSurface = useAppStore((s) => s.setWorkbenchSurface)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(() => Boolean(query))
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
  const myExpertsFilter = tab === 'expert' && sourceFilter === '我的'
  const mySkillsFilter = tab === 'skill' && installedOnly
  const myConnectorsFilter = tab === 'connector' && installedOnly
  const myCatalogFilter = mySkillsFilter || myConnectorsFilter
  const mineFilter = myExpertsFilter || myCatalogFilter
  const featured = useMemo(() => featuredHubItems(items) as HubCapabilityItem[], [items])
  const visibleFeatured = featuredExpanded ? featured : featured.slice(0, 3)
  const showFeatured = shouldShowHubFeatured(featured, { query, installedOnly }) && !mineFilter
    && category === '全部' && sourceFilter === '全部来源'
  const catalogTitle = mySkillsFilter
    ? '我的技能'
    : myConnectorsFilter
      ? '我的连接器'
      : hubCatalogTitle(tab, { query, installedOnly, category, sourceFilter })
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
        setSearchOpen(true)
        return
      }
      if (event.key === 'Escape' && searchOpen && document.activeElement === searchRef.current) {
        event.preventDefault()
        setQuery('')
        setSearchOpen(false)
        searchTriggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [searchOpen, setQuery])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

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
    if (!isExpertAvailableForNewTask(item)) {
      const successor = item.lifecycle?.successors?.[0]
      showToast(successor ? `该专家已合并，请改用 ${successor.id}` : '该专家仅保留用于历史任务查看')
      return
    }
    if (isExpertQualificationLimited(item)) {
      showToast('该专家的能力合同尚未就绪，请先修复受限 Skill 或执行依赖')
      return
    }
    if (isExpertRuntimeLimited(item)) {
      showToast('该专家当前不可执行，请先完成必要 Skill 或连接器的安装与授权')
      return
    }
    window.sessionStorage.setItem('knowme.workbench-expert-id', item.id)
    setDetail(null)
    setWorkbenchSurface('taskhome')
    setRoute('workbench')
  }

  async function openSkillGovernanceRoom(item?: HubCapabilityItem | null) {
    const targetName = String(item?.name || item?.id || '').trim()
    const targetId = String(item?.id || '').trim()
    const creating = !targetId
    const install = await window.api?.capabilityInstall?.({
      id: CAPABILITY_GOVERNANCE_EXPERT.id,
      kind: 'expert',
    }) as { ok?: boolean; error?: string } | undefined
    if (!install?.ok) {
      showToast(install?.error || `${CAPABILITY_GOVERNANCE_EXPERT.name}尚未就绪，请重试`)
      return
    }

    const goal = creating
      ? '创建一个新的 KnowMe Skill。先与我澄清使用场景、触发方式、输入输出、执行步骤、能力边界和评估标准；形成可检查的定义与测试用例，获得我的明确确认后再发布。'
      : `评估并优化已安装 Skill「${targetName || targetId}」（Skill ID：${targetId}）。先读取现有定义，区分静态校验与真实行为评估，展示修改和测试结论，获得我的明确确认后再更新。`
    const title = creating ? '创建新的 Skill' : `优化 ${targetName || targetId}`
    const task = await window.api?.workbenchTaskCreate?.({
      kind: 'expert',
      title,
      goal,
      expertId: CAPABILITY_GOVERNANCE_EXPERT.id,
      expertName: CAPABILITY_GOVERNANCE_EXPERT.name,
      status: 'draft',
      brief: {
        goal,
        materials: creating ? [] : [{
          id: 'skill-reference',
          type: 'text',
          title: '待管理 Skill',
          content: `Skill ID: ${targetId}\n名称：${targetName || targetId}\n来源：${item?.source || 'unknown'}`,
        }],
        deliverables: [{
          id: 'governance-result',
          title: creating ? 'Skill 定义、评估与发布结果' : `${targetName || targetId}的优化与评估结果`,
          type: 'answer',
          required: true,
        }],
      },
      events: [{
        type: 'created',
        summary: creating
          ? `已进入${CAPABILITY_GOVERNANCE_EXPERT.name}协作，开始创建 Skill`
          : `已进入${CAPABILITY_GOVERNANCE_EXPERT.name}协作，管理 Skill ${targetId}`,
      }],
    }) as { ok?: boolean; error?: string; task?: { id?: string; status?: string } } | undefined
    if (!task?.ok || !task.task?.id) {
      showToast(task?.error || `${CAPABILITY_GOVERNANCE_EXPERT.name}协作房创建失败，请重试`)
      return
    }

    await loadTasks()
    setDetail(null)
    openExpertRoom({
      id: task.task.id,
      taskId: task.task.id,
      taskStatus: task.task.status || 'draft',
      expertId: CAPABILITY_GOVERNANCE_EXPERT.id,
      name: CAPABILITY_GOVERNANCE_EXPERT.name,
      goal,
    })
    showToast(creating ? '已进入 Skill 创建协作' : '已进入 Skill 优化与评估协作')
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
              onClick={() => { setCategory('全部'); setSourceFilter('全部来源'); setInstalledOnly(false); setTab(t.id) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="hub-commandbar">
          <button
            ref={searchTriggerRef}
            type="button"
            className="hub-icon-btn hub-search-trigger"
            aria-label={searchOpen ? '收起搜索' : '展开搜索'}
            aria-expanded={searchOpen}
            aria-controls="hubSearchPanel"
            title="搜索（Ctrl K）"
            onClick={() => {
              if (searchOpen) setQuery('')
              setSearchOpen((value) => !value)
            }}
          >
            <Icon name="searchLine" />
          </button>
          <div className="hub-command-actions">
            <button
              type="button"
              className={`hub-my-experts-btn${mineFilter ? ' active' : ''}`}
              aria-pressed={mineFilter}
              onClick={() => {
                setCategory('全部')
                if (tab === 'expert') {
                  setMineOrigin('all')
                  setSourceFilter(myExpertsFilter ? '全部来源' : '我的')
                } else {
                  setSourceFilter('全部来源')
                  setInstalledOnly((value) => !value)
                }
              }}
            >
              <Icon name={tab === 'expert' ? 'users' : tab === 'skill' ? 'optimize' : 'network'} />
              <span>{tab === 'expert' ? '我的专家' : tab === 'skill' ? '我的技能' : '我的连接器'}</span>
            </button>
          </div>
          {searchOpen ? (
            <div id="hubSearchPanel" className="hub-search-panel" role="search" aria-label="能力搜索">
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
            </div>
          ) : null}
        </div>
      </div>
      <header className="hub-header">
        {mineFilter ? (
          <div className="hub-mine-context">
            <div className="hub-mine-context-copy">
              <strong>{myExpertsFilter ? '你拥有的私人 Agent' : mySkillsFilter ? '你添加的技能' : '你添加的连接器'}</strong>
              <span>{myExpertsFilter
                ? '包括从专家库添加的官方专家，以及你自己创建的专家；只有你能管理和使用。'
                : mySkillsFilter
                  ? '包括从技能库添加或安装的技能，以及你自己创建的技能；打开详情即可管理。'
                  : '集中查看已安装的连接器；打开连接器详情即可配置、测试和管理授权。'}</span>
            </div>
            {myExpertsFilter ? (
              <div className="hub-filter-row hub-mine-origin-row">
                <span className="hub-filter-label">来源</span>
                <div className="hub-chips" role="group" aria-label="我的专家来源">
                  {([['all', '全部'], ['catalog', '专家库添加'], ['created', '我创建的']] as const).map(([id, label]) => (
                    <button key={id} type="button" className={`hub-chip${mineOrigin === id ? ' active' : ''}`} aria-pressed={mineOrigin === id} onClick={() => setMineOrigin(id)}>{label}</button>
                  ))}
                </div>
              </div>
            ) : null}
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
                    <div className="hub-card-head">
                      <HubCapabilityIcon item={item} className="hub-card-icon" />
                      <div className="hub-card-meta">
                        <div className="hub-card-title-line">
                          <div className="hub-card-title">{item.name || item.id}</div>
                          {item.kind === 'connector' ? <span className={`hub-card-type hub-card-type-${connectorType(item)}`}>{connectorType(item).toUpperCase()}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="hub-card-desc">{item.description || '暂无描述'}</div>
                    <footer className="hub-card-foot">
                      <HubStatusBadges item={item} omitInstallState={false} omitCategory compact />
                      <div className="hub-card-foot-actions">
                        <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} />
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
              {!loading && myExpertsFilter ? (
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
              {!loading && mySkillsFilter ? (
                <article
                  className="hub-card hub-card-create"
                  id="hubCreateSkillCard"
                  tabIndex={0}
                  role="button"
                  aria-label="新建技能"
                  onClick={() => void openSkillGovernanceRoom()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void openSkillGovernanceRoom()
                    }
                  }}
                >
                  <div className="hub-card-create-inner">
                    <span className="hub-card-create-icon" aria-hidden="true"><Icon name="plusLine" /></span>
                    <strong>新建技能</strong>
                  </div>
                </article>
              ) : null}
              {!loading && items.length === 0 && !myExpertsFilter && !mySkillsFilter ? (
                <div className="hub-state">
                  <div className="hub-state-icon"><Icon name={mySkillsFilter ? 'optimize' : myConnectorsFilter ? 'network' : query || installedOnly || category !== '全部' ? 'searchLine' : 'users'} /></div>
                  <strong>{mySkillsFilter ? '还没有添加技能' : myConnectorsFilter ? '还没有添加连接器' : query || installedOnly || category !== '全部' ? '没有找到匹配能力' : `还没有${HUB_TABS.find((t) => t.id === tab)?.label}`}</strong>
                  <p>{mySkillsFilter ? '从技能库安装的技能会显示在这里。' : myConnectorsFilter ? '从连接器库安装的连接器会显示在这里。' : copy.empty}</p>
                  {tab === 'expert' ? (
                    <div className="hub-state-actions">
                      <button type="button" className="hub-btn primary" onClick={() => setExpertOpen({ mode: 'create' })}>新建专家</button>
                    </div>
                  ) : myCatalogFilter ? (
                    <div className="hub-state-actions">
                      <button type="button" className="hub-btn primary" onClick={() => setInstalledOnly(false)}>浏览{tab === 'skill' ? '技能' : '连接器'}</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!loading ? items.map((item, index) => {
                const origin = hubOriginLabel(item)
                const sub = [item.category || '未分类', myExpertsFilter ? myExpertOriginLabel(item) : hubSourceLabel(item.source), origin].filter(Boolean).join(' · ')
                const cardActionLabel = myExpertsFilter ? '打开我的专家' : mySkillsFilter ? '管理我的技能' : myConnectorsFilter ? '管理我的连接器' : '查看详情'
                return (
                  <article
                    key={item.id}
                    className={`hub-card hub-card-${item.kind}${item.favorite ? ' is-fav' : ''}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${cardActionLabel}：${item.name || item.id}`}
                    style={{ '--index': index + (myExpertsFilter || mySkillsFilter ? 1 : 0) } as React.CSSProperties}
                    onClick={() => setDetail(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    <div className="hub-card-head">
                      <HubCapabilityIcon item={item} className="hub-card-icon" />
                      <div className="hub-card-meta">
                        <div className="hub-card-title-line">
                          <div className="hub-card-title" role="heading" aria-level={3}>{item.name || item.id}</div>
                          {item.kind === 'connector' ? <span className={`hub-card-type hub-card-type-${connectorType(item)}`}>{connectorType(item).toUpperCase()}</span> : null}
                        </div>
                        <div className="hub-card-sub">{sub}</div>
                      </div>
                    </div>
                    <div className="hub-card-desc">{item.description || '暂无描述'}</div>
                    <footer className="hub-card-foot">
                      <HubStatusBadges item={item} omitCategory={item.kind === 'connector'} compact />
                      <div className="hub-card-foot-actions">
                        <HubFavoriteButton item={item} onToggled={(favorite) => patchItem(item.id, { favorite })} />
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
          isMine={myExpertsFilter}
          onClose={() => setDetail(null)}
          onChanged={() => Promise.all([loadHub(), loadModes()]).then(() => undefined)}
          onOpenWorkbench={openExpertInWorkbench}
          onManageSkill={(item) => void openSkillGovernanceRoom(item)}
          onEditExpert={(item, mode) => {
            setDetail(null)
            setExpertOpen({ mode, item })
          }}
        />
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
