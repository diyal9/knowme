import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DAEMON_MIN_INTENT_CHARS,
  DAEMON_RUN_FILTERS,
  daemonComposeCanAttempt,
  daemonPathLabel,
  daemonPathTags,
  daemonRunCards,
  groupDaemonPaths,
  selectableDaemonPaths,
  type DaemonPathItem,
  type DaemonRunFilterId,
} from '../../../domain/daemon-compose'
import { daemonOverviewCacheIsFresh } from '../../../domain/daemon-overview-cache'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { LinkWebview } from '../link-preview/LinkPreviewSurface'

interface PickedMaterial {
  path: string
  name: string
}

export function DaemonComposePanel() {
  const loadWorkbench = useAppStore((s) => s.loadWorkbench)
  const daemonOnline = useAppStore((s) => s.shelfDaemonOnline)
  const showToast = useAppStore((s) => s.showToast)
  const openDaemonTaskSlug = useAppStore((s) => s.openDaemonTaskSlug)
  const openLinkPreview = useAppStore((s) => s.openLinkPreview)
  const linkTitleCache = useAppStore((s) => s.linkTitleCache)
  const activeLinkPreview = useAppStore((s) => s.linkPreview)
  const cacheLinkTitle = useAppStore((s) => s.cacheLinkTitle)
  const daemonOverviewCache = useAppStore((s) => s.daemonOverviewCache)
  const setDaemonOverviewCache = useAppStore((s) => s.setDaemonOverviewCache)
  const cacheAtMountRef = useRef(daemonOverviewCache)
  const cacheAtMount = cacheAtMountRef.current
  const [intent, setIntent] = useState('')
  const [pathId, setPathId] = useState('')
  const [pathOpen, setPathOpen] = useState(false)
  const [runFilter, setRunFilter] = useState<DaemonRunFilterId>('all')
  const [query, setQuery] = useState('')
  const [materials, setMaterials] = useState<PickedMaterial[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [overviewReady, setOverviewReady] = useState(Boolean(cacheAtMount))
  const [overviewTasks, setOverviewTasks] = useState<unknown[]>(() => cacheAtMount?.tasks || [])
  const [overviewWorkflows, setOverviewWorkflows] = useState<DaemonPathItem[]>(() => cacheAtMount?.workflows || [])
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pathSelectRef = useRef<HTMLDivElement>(null)

  const offline = daemonOnline === false
  const connectionPending = daemonOnline == null && !overviewReady
  const paths = useMemo(() => selectableDaemonPaths(overviewWorkflows), [overviewWorkflows])
  const pathGroups = useMemo(() => groupDaemonPaths(paths), [paths])
  const selected = paths.find((item) => item.id === pathId) || paths[0]
  const hasLaunchInput = intent.trim().length >= DAEMON_MIN_INTENT_CHARS || materials.length > 0
  const canSubmit = daemonComposeCanAttempt(!offline, selected, submitting) && hasLaunchInput
  const records = useMemo(
    () => daemonRunCards(overviewTasks, overviewWorkflows, runFilter, query),
    [overviewTasks, overviewWorkflows, runFilter, query],
  )
  const titleResolverUrl = useMemo(() => {
    if (activeLinkPreview) return ''
    return records.find((item) => (
      item.sourceUrl &&
      /^飞书/.test(item.sourceLabel || '') &&
      !item.sourceTitle &&
      !linkTitleCache[item.sourceUrl]
    ))?.sourceUrl || ''
  }, [activeLinkPreview, linkTitleCache, records])

  const refreshOverview = useCallback(async (options: { showIndicator?: boolean; refreshConnection?: boolean } = {}) => {
    const showIndicator = options.showIndicator !== false
    if (showIndicator) setRefreshing(true)
    try {
      if (options.refreshConnection) await loadWorkbench()
      const raw = await window.api?.workbenchDaemonOverview?.()
      const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      const daemon = record.daemon && typeof record.daemon === 'object'
        ? record.daemon as Record<string, unknown>
        : record
      const workflows = Array.isArray(daemon.workflows) ? daemon.workflows as DaemonPathItem[] : []
      const tasks = Array.isArray(daemon.tasks) ? daemon.tasks : []
      setOverviewWorkflows(workflows)
      setOverviewTasks(tasks)
      setDaemonOverviewCache({ workflows, tasks, loadedAt: Date.now() })
    } catch {
      // 保留最近一次成功快照，连接抖动时不把页面清空。
    } finally {
      setOverviewReady(true)
      if (showIndicator) setRefreshing(false)
    }
  }, [loadWorkbench, setDaemonOverviewCache])

  useEffect(() => {
    if (daemonOverviewCacheIsFresh(cacheAtMount)) return
    void refreshOverview({ showIndicator: !cacheAtMount })
  }, [cacheAtMount, refreshOverview])

  useEffect(() => {
    if (!titleResolverUrl) return
    let cancelled = false
    void window.api?.resolveLinkTitle?.(titleResolverUrl).then((result) => {
      if (!cancelled && result?.ok && result.title) cacheLinkTitle(titleResolverUrl, result.title)
    }).catch(() => { /* CLI/网页元数据不可用时继续由隐藏 webview 解析 */ })
    return () => { cancelled = true }
  }, [cacheLinkTitle, titleResolverUrl])

  useEffect(() => {
    if (!paths.length) {
      if (pathId) setPathId('')
      return
    }
    if (!paths.some((item) => item.id === pathId)) setPathId(paths[0].id)
  }, [pathId, paths])

  useEffect(() => {
    if (!pathOpen) return
    function closeOnOutsidePress(event: PointerEvent) {
      if (!pathSelectRef.current?.contains(event.target as Node)) setPathOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [pathOpen])

  useKnowMeIcons(`${offline}:${pathId}:${runFilter}:${records.length}`, surfaceRef)

  async function pickMaterials() {
    const result = await window.api?.workbenchPickFiles?.({ title: '选择补充材料' })
    if (!result || result.ok === false) {
      showToast(String(result?.error || '选择文件失败'))
      return
    }
    if (result.canceled) return
    setMaterials((current) => [...current, ...(result.files || [])])
  }

  async function submit() {
    if (!selected) return
    if (intent.trim().length < DAEMON_MIN_INTENT_CHARS && materials.length === 0) {
      showToast(`请填写不少于 ${DAEMON_MIN_INTENT_CHARS} 字的需求说明，或上传至少 1 个附件后再创建任务。`)
      return
    }
    setSubmitting(true)
    try {
      const result = await window.api?.workbenchLaunchStart?.({
        intent: {
          resourceType: 'pipeline',
          resourceId: selected.id,
          brief: intent.trim(),
          materials: materials.map((file) => file.path),
        },
        allowRelaunch: false,
      })
      const record = result && typeof result === 'object' ? result as Record<string, unknown> : {}
      if (record.ok === false) {
        showToast(String(record.error || '创建失败'))
        return
      }
      const intentRecord = record.intent && typeof record.intent === 'object'
        ? record.intent as Record<string, unknown>
        : {}
      const slug = String(intentRecord.slug || record.slug || selected.id)
      if (daemonOverviewCache) {
        setDaemonOverviewCache({ ...daemonOverviewCache, loadedAt: 0 })
      }
      await openDaemonTaskSlug(slug)
    } catch {
      showToast('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function openTaskSource(href: string, label: string, title = '') {
    if (openLinkPreview(href, title || label, { presentation: 'overlay', resolveTitle: true })) return
    const result = await window.api?.openExternal?.(href)
    if (result && result.ok === false) showToast(String(result.message || '无法打开链接'))
  }

  return (
    <div ref={surfaceRef} className="wb-manage-body">
      <section className="wb-manage-panel active" id="wbDaemonPage" data-manage-panel="daemon" aria-label="管线服务" data-testid="manage-surface">
        <div className="wb-daemon-console">
          <div className="wb-daemon-home-shell">
            <main className="wb-daemon-compose" id="wbDaemonModeDetail" aria-labelledby="wbDaemonComposeTitle">
              <div className="wb-daemon-compose-panel">
                <header className="wb-daemon-compose-header">
                  <div>
                    <h1 id="wbDaemonComposeTitle">创建开发任务</h1>
                    <p className="wb-daemon-compose-lead">选择交付路径，补充目标与材料，管线会按流程持续推进。</p>
                  </div>
                  <span className={`wb-daemon-compose-status${offline ? ' is-offline' : connectionPending ? ' is-loading' : ' is-live'}`} role="status" aria-live="polite">
                    <span className="wb-daemon-health-signal" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    {connectionPending ? '正在连接' : offline ? '服务离线' : '运行正常'}
                  </span>
                </header>
                <div className="wb-daemon-compose-body">
                  <div className="wb-daemon-compose-field">
                    <span>交付路径</span>
                    <div ref={pathSelectRef} className={`wb-daemon-path-select${pathOpen ? ' is-open' : ''}${offline || !paths.length ? ' is-disabled' : ''}`}>
                      <button
                        type="button"
                        className="wb-daemon-path-trigger"
                        id="wbDaemonComposePathTrigger"
                        aria-haspopup="listbox"
                        aria-expanded={pathOpen}
                        disabled={offline || !paths.length}
                        onClick={() => setPathOpen((open) => !open)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setPathOpen(false)
                        }}
                      >
                        <span className="wb-daemon-path-trigger-icon" aria-hidden="true">
                          <Icon name="workflow" />
                        </span>
                        <span className="wb-daemon-path-trigger-copy">
                          <span className="wb-daemon-path-trigger-label">
                            {paths.length ? daemonPathLabel(selected) : (!overviewReady ? '正在读取交付路径…' : '暂无可用路径')}
                          </span>
                          {!overviewReady ? (
                            <span className="wb-daemon-loading-dots" aria-hidden="true"><i /><i /><i /></span>
                          ) : null}
                          {paths.length ? <small>点击切换交付路径</small> : null}
                        </span>
                        <span className="wb-daemon-path-trigger-action" aria-hidden="true">
                          <span>{pathOpen ? '收起' : '选择'}</span>
                          <span className="wb-daemon-path-caret">▾</span>
                        </span>
                      </button>
                      <ul
                        className="wb-daemon-path-menu"
                        id="wbDaemonComposePathMenu"
                        role="listbox"
                        aria-label="交付路径"
                        hidden={!pathOpen}
                      >
                        {pathGroups.map((group) => (
                          <li key={group.id} role="presentation" className="wb-daemon-path-group">
                            <div className="wb-daemon-path-group-title">
                              <span>{group.label}</span>
                              <small>{group.items.length}</small>
                            </div>
                            <ul role="group" aria-label={group.label}>
                              {group.items.map((item) => {
                                const tags = daemonPathTags(item)
                                return (
                                  <li
                                    key={item.id}
                                    role="option"
                                    tabIndex={item.locked ? -1 : 0}
                                    className={`wb-daemon-path-option${item.id === selected?.id ? ' is-selected' : ''}${item.locked ? ' is-disabled' : ''}`}
                                    aria-selected={item.id === selected?.id}
                                    aria-disabled={item.locked ? 'true' : undefined}
                                    data-testid={`daemon-path-${item.id}`}
                                    onClick={() => {
                                      if (item.locked) return
                                      setPathId(item.id)
                                      setPathOpen(false)
                                    }}
                                    onKeyDown={(event) => {
                                      if (item.locked || (event.key !== 'Enter' && event.key !== ' ')) return
                                      event.preventDefault()
                                      setPathId(item.id)
                                      setPathOpen(false)
                                    }}
                                  >
                                    <span className="wb-daemon-path-option-name" title={daemonPathLabel(item)}>{daemonPathLabel(item)}</span>
                                    {tags.length ? (
                                      <span className="wb-daemon-path-option-tags" aria-label={`标签：${tags.join('、')}`}>
                                        {tags.map((tag) => <small key={tag}>{tag}</small>)}
                                      </span>
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <label className="wb-daemon-compose-field wb-daemon-compose-field-intent">
                    <span className="wb-daemon-compose-field-heading">
                      <span>你想完成什么？</span>
                      <small className={intent.length > 0 && intent.trim().length < DAEMON_MIN_INTENT_CHARS && !materials.length ? 'is-warning' : ''}>
                        {intent.trim().length}/{DAEMON_MIN_INTENT_CHARS} 字
                      </small>
                    </span>
                    <textarea
                      id="wbDaemonComposeIntent"
                      rows={3}
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      placeholder="业务目标、范围、验收标准与约束（建议≥20 字）"
                      disabled={offline}
                      aria-describedby="wbDaemonComposeIntentHint"
                    />
                    <small className="wb-daemon-compose-field-help" id="wbDaemonComposeIntentHint">
                      至少填写 {DAEMON_MIN_INTENT_CHARS} 字，或添加一份补充材料。
                    </small>
                  </label>
                  <div className="wb-daemon-compose-materials">
                    <button
                      type="button"
                      className="wb-daemon-compose-dropzone"
                      disabled={offline}
                      aria-label="选择本地补充材料"
                      onClick={() => void pickMaterials()}
                    >
                      <span className="wb-daemon-compose-dropzone-ico" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 16.2A4.5 4.5 0 0 0 18.2 8h-.3A7 7 0 0 0 5.1 10.3 4 4 0 0 0 6 18h13" />
                          <path d="M12 12v7" />
                          <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
                        </svg>
                      </span>
                      <span className="wb-daemon-compose-dropzone-line">选择本地补充材料</span>
                      <small>需求文档、参考资料或现有产物</small>
                    </button>
                    {materials.length ? (
                      <ul className="wb-daemon-compose-files">
                        {materials.map((file, index) => (
                          <li key={`${file.path}-${index}`}>
                            <span title={file.path}>{file.name}</span>
                            <button type="button" onClick={() => setMaterials((items) => items.filter((_, i) => i !== index))} aria-label="移除材料">移除</button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <footer className="wb-daemon-compose-foot">
                  <button
                    type="button"
                    className="wb-daemon-compose-btn primary"
                    data-testid="daemon-compose-submit"
                    disabled={!canSubmit}
                    onClick={() => void submit()}
                  >
                    {submitting ? '正在创建运行…' : '创建并开始运行'}
                  </button>
                </footer>
                {offline ? <p className="wb-daemon-compose-offline">管线服务未连接，连接后即可创建管线运行。</p> : null}
              </div>
            </main>
            <aside className="wb-daemon-task-rail" aria-labelledby="wbDaemonRunsTitle">
              <header className="wb-daemon-rail-title">
                <div>
                  <h2 id="wbDaemonRunsTitle">最近运行</h2>
                </div>
                <div className="wb-daemon-linkbar" id="wbDaemonModeStatus" role="status" aria-live="polite">
                  <div className={`wb-daemon-link${offline ? ' is-offline' : ' is-online'}`}>
                    <span className="wb-daemon-pulse" aria-hidden="true" />
                    <div className="wb-daemon-link-copy">
                      <strong>{connectionPending ? '正在连接' : offline ? '服务离线' : '本机已连接'}</strong>
                    </div>
                    <button type="button" className={`wb-daemon-link-btn icon${refreshing ? ' is-loading' : ''}`} title={offline ? '重试连接' : '刷新连接'} aria-label={offline ? '重试连接' : '刷新连接'} disabled={refreshing} onClick={() => void refreshOverview({ refreshConnection: true })}>
                      <Icon name="refresh" />
                    </button>
                  </div>
                </div>
              </header>
              <div className="wb-daemon-run-browser">
                <div className="wb-daemon-task-tools">
                  <label className="wb-daemon-task-search">
                    <Icon name="searchLine" />
                    <input
                      type="search"
                      id="wbDaemonTaskSearch"
                      placeholder="搜索任务主题或交付路径"
                      autoComplete="off"
                      aria-label="搜索管线任务"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <div className="wb-daemon-run-filters" id="wbDaemonRunFilters" role="tablist" aria-label="管线任务筛选">
                    {DAEMON_RUN_FILTERS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`wb-daemon-run-filter${runFilter === item.id ? ' active' : ''}`}
                        role="tab"
                        aria-selected={runFilter === item.id}
                        title={item.title}
                        aria-label={item.title}
                        onClick={() => setRunFilter(item.id)}
                      >
                        <Icon name={item.icon} />
                        <span>{item.title}</span>
                        {runFilter === item.id ? (
                          <small className="wb-daemon-run-filter-count" aria-label={`${records.length} 条`}>
                            {`（${records.length}）`}
                          </small>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wb-daemon-run-list" id="wbDaemonRunList">
                  {!overviewReady ? (
                    <div className="wb-daemon-overview-loading" data-testid="daemon-overview-loading" role="status" aria-label="正在读取最近运行">
                      {[0, 1].map((item) => (
                        <article className="wb-daemon-run-skeleton" key={item} aria-hidden="true">
                          <span className="wb-daemon-skeleton-dot" />
                          <span className="wb-daemon-skeleton-copy">
                            <i className="is-title" />
                            <i className="is-meta" />
                            <i className="is-foot" />
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : records.length ? records.map((item) => {
                    const sourceTitle = (item.sourceUrl && linkTitleCache[item.sourceUrl]) || item.sourceTitle || ''
                    return (
                    <article key={item.slug} className={`wb-daemon-task-card tone-${item.tone || item.bucket || 'active'}`} data-task={item.slug}>
                      <button
                        type="button"
                        className="wb-daemon-task-open"
                        data-testid={`daemon-run-${item.slug}`}
                        onClick={() => void openDaemonTaskSlug(item.slug, { name: item.cardTitle || item.slug })}
                      >
                        <span className="wb-daemon-task-dot" aria-hidden="true" />
                        <span className="wb-daemon-task-copy">
                          <span className="wb-daemon-task-heading">
                            <strong className="wb-daemon-task-title">{item.cardTitle || item.intentTitle || item.title || item.slug}</strong>
                            <time className="wb-daemon-task-time" dateTime={item.updatedAt || undefined}>{item.relativeTime || '时间未记录'}</time>
                          </span>
                          {(item.cardSummary || item.cardBrief) ? <span className="wb-daemon-task-summary">{item.cardSummary || item.cardBrief}</span> : null}
                          <span className="wb-daemon-task-meta">
                            <em title={item.pathName}>{item.pathName || '管线服务路径'}</em>
                            <span className="wb-daemon-task-state">{item.statusLabel || '状态未知'}</span>
                          </span>
                        </span>
                      </button>
                      {item.sourceUrl ? (
                        <button
                          type="button"
                          className="wb-daemon-task-source"
                          data-testid={`daemon-run-source-${item.slug}`}
                          title={item.sourceUrl}
                          onClick={() => void openTaskSource(item.sourceUrl || '', item.sourceLabel || '相关链接', sourceTitle)}
                        >
                          <Icon name="file" />
                          <span className="wb-daemon-task-source-copy">
                            <strong>{sourceTitle || item.sourceLabel || '相关链接'}</strong>
                            <small>{sourceTitle ? (item.sourceLabel || '相关链接') : '点击查看文档'}</small>
                          </span>
                          <Icon name="externalLink" />
                        </button>
                      ) : null}
                    </article>
                    )
                  }) : (
                    <div className="wb-daemon-idle wb-daemon-idle-compact">
                      <strong>{offline ? '服务离线' : (overviewTasks.length ? '无匹配管线运行' : '暂无管线运行')}</strong>
                      <span>{offline ? '连接后再查看运行记录' : '在左侧创建后会出现在这里'}</span>
                      {!offline && overviewTasks.length && (query || runFilter !== 'all') ? (
                        <button type="button" onClick={() => { setQuery(''); setRunFilter('all') }}>清除筛选</button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              {titleResolverUrl ? (
                <LinkWebview
                  key={titleResolverUrl}
                  src={titleResolverUrl}
                  titleOnly
                  onTitle={(title) => cacheLinkTitle(titleResolverUrl, title)}
                />
              ) : null}
              <div id="wbDaemonModeList" className="wb-daemon-mode-items" hidden />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
