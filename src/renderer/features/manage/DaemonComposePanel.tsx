import { useEffect, useMemo, useState } from 'react'
import {
  DAEMON_MIN_INTENT_CHARS,
  DAEMON_RUN_FILTERS,
  daemonComposeCanAttempt,
  daemonFilterTitle,
  daemonPathLabel,
  daemonRunCards,
  selectableDaemonPaths,
  type DaemonPathItem,
  type DaemonRunFilterId,
} from '../../../domain/daemon-compose'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { useStickyIcons } from '../../app/useStickyIcons'

interface PickedMaterial {
  path: string
  name: string
}

export function DaemonComposePanel() {
  const loadWorkbench = useAppStore((s) => s.loadWorkbench)
  const daemonOnline = useAppStore((s) => s.shelfDaemonOnline)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const showToast = useAppStore((s) => s.showToast)
  const openDaemonTaskSlug = useAppStore((s) => s.openDaemonTaskSlug)
  const [intent, setIntent] = useState('')
  const [pathId, setPathId] = useState('')
  const [pathOpen, setPathOpen] = useState(false)
  const [runFilter, setRunFilter] = useState<DaemonRunFilterId>('all')
  const [query, setQuery] = useState('')
  const [materials, setMaterials] = useState<PickedMaterial[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [overviewTasks, setOverviewTasks] = useState<unknown[]>([])
  const [overviewWorkflows, setOverviewWorkflows] = useState<DaemonPathItem[]>([])

  const offline = daemonOnline === false
  const paths = useMemo(() => {
    const fromOverview = selectableDaemonPaths(overviewWorkflows)
    if (fromOverview.length) return fromOverview
    return selectableDaemonPaths(shelfCards.map((card) => ({ id: card.id, name: card.name, locked: card.blocked })))
  }, [overviewWorkflows, shelfCards])
  const selected = paths.find((item) => item.id === pathId) || paths[0]
  const canSubmit = daemonComposeCanAttempt(!offline, selected, submitting)
  const records = useMemo(
    () => daemonRunCards(overviewTasks, overviewWorkflows, runFilter, query),
    [overviewTasks, overviewWorkflows, runFilter, query],
  )

  async function refreshOverview() {
    await loadWorkbench()
    try {
      const raw = await window.api?.workbenchDaemonOverview?.()
      const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      const daemon = record.daemon && typeof record.daemon === 'object'
        ? record.daemon as Record<string, unknown>
        : record
      const workflows = Array.isArray(daemon.workflows) ? daemon.workflows as DaemonPathItem[] : []
      const tasks = Array.isArray(daemon.tasks) ? daemon.tasks : []
      setOverviewWorkflows(workflows)
      setOverviewTasks(tasks)
    } catch {
      setOverviewWorkflows([])
      setOverviewTasks([])
    }
  }

  useEffect(() => {
    void refreshOverview()
  }, [])

  useEffect(() => {
    if (!pathId && selected?.id) setPathId(selected.id)
  }, [pathId, selected?.id])

  useStickyIcons(`${offline}:${pathId}:${runFilter}:${records.length}`)

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
      await openDaemonTaskSlug(slug)
    } catch {
      showToast('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="wb-manage-body">
      <section className="wb-manage-panel active" id="wbDaemonPage" data-manage-panel="daemon" aria-label="管线服务" data-testid="manage-surface">
        <div className="wb-daemon-console">
          <div className="wb-daemon-home-shell">
            <main className="wb-daemon-compose" id="wbDaemonModeDetail" aria-labelledby="wbDaemonComposeTitle">
              <div className="wb-daemon-compose-panel">
                <p className="wb-daemon-compose-lead" id="wbDaemonComposeTitle">创建管线运行 · 描述目标后按默认流程启动</p>
                <div className="wb-daemon-compose-body">
                  <div className="wb-daemon-compose-field">
                    <span>交付路径</span>
                    <div className={`wb-daemon-path-select${offline || !paths.length ? ' is-disabled' : ''}`}>
                      <button
                        type="button"
                        className="wb-daemon-path-trigger"
                        id="wbDaemonComposePathTrigger"
                        aria-haspopup="listbox"
                        aria-expanded={pathOpen}
                        disabled={offline || !paths.length}
                        onClick={() => setPathOpen((open) => !open)}
                      >
                        <span className="wb-daemon-path-trigger-label">
                          {paths.length ? daemonPathLabel(selected) : '暂无可用路径'}
                        </span>
                        <span className="wb-daemon-path-caret" aria-hidden="true">▾</span>
                      </button>
                      <ul
                        className="wb-daemon-path-menu"
                        id="wbDaemonComposePathMenu"
                        role="listbox"
                        aria-label="交付路径"
                        hidden={!pathOpen}
                      >
                        {paths.map((item) => (
                          <li
                            key={item.id}
                            role="option"
                            className={`wb-daemon-path-option${item.id === selected?.id ? ' is-selected' : ''}${item.locked ? ' is-disabled' : ''}`}
                            aria-selected={item.id === selected?.id}
                            aria-disabled={item.locked ? 'true' : undefined}
                            data-testid={`daemon-path-${item.id}`}
                            onClick={() => {
                              if (item.locked) return
                              setPathId(item.id)
                              setPathOpen(false)
                            }}
                          >
                            {daemonPathLabel(item)}{item.locked ? '（已锁定）' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <label className="wb-daemon-compose-field wb-daemon-compose-field-intent">
                    <span>你想完成什么？</span>
                    <textarea
                      id="wbDaemonComposeIntent"
                      rows={3}
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      placeholder="业务目标、范围、验收标准与约束（建议≥20 字）"
                      disabled={offline}
                    />
                  </label>
                  <div className="wb-daemon-compose-materials">
                    <button
                      type="button"
                      className="wb-daemon-compose-dropzone"
                      disabled={offline}
                      aria-label="点击或拖拽文件到此处上传"
                      onClick={() => void pickMaterials()}
                    >
                      <span className="wb-daemon-compose-dropzone-ico" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 16.2A4.5 4.5 0 0 0 18.2 8h-.3A7 7 0 0 0 5.1 10.3 4 4 0 0 0 6 18h13" />
                          <path d="M12 12v7" />
                          <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
                        </svg>
                      </span>
                      <span className="wb-daemon-compose-dropzone-line">点击或拖拽文件到此处上传</span>
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
                    {submitting ? '创建中…' : '开始开发'}
                  </button>
                </footer>
                {offline ? <p className="wb-daemon-compose-offline">管线服务未连接，连接后即可创建管线运行。</p> : null}
              </div>
            </main>
            <aside className="wb-daemon-task-rail" aria-labelledby="wbDaemonRunsTitle">
              <div className="wb-daemon-task-tools">
                <div className="wb-daemon-linkbar" id="wbDaemonModeStatus" role="status" aria-live="polite">
                  <div className={`wb-daemon-link${offline ? ' is-offline' : ' is-online'}`}>
                    <span className="wb-daemon-pulse" aria-hidden="true" />
                    <div className="wb-daemon-link-copy">
                      <strong>{offline ? '未连接' : '已连接'}</strong>
                      <span className="wb-daemon-link-host">{offline ? '未检测到服务' : '本机'}</span>
                    </div>
                    <button type="button" className="wb-daemon-link-btn icon" title={offline ? '重试连接' : '刷新连接'} aria-label={offline ? '重试连接' : '刷新连接'} onClick={() => void refreshOverview()}>
                      <Icon name="refresh" />
                    </button>
                  </div>
                </div>
                <label className="wb-daemon-task-search">
                  <input
                    type="search"
                    id="wbDaemonTaskSearch"
                    placeholder="搜索任务或需求描述"
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
                    </button>
                  ))}
                </div>
              </div>
              <div className="wb-daemon-rail-head">
                <h3 id="wbDaemonRunsTitle">{daemonFilterTitle(runFilter)}</h3>
                <span className="wb-daemon-rail-hint" id="wbDaemonRunCount">{records.length ? `· ${records.length}` : ''}</span>
              </div>
              <div className="wb-daemon-run-list" id="wbDaemonRunList">
                {records.length ? records.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className={`wb-daemon-task-card tone-${item.tone || item.bucket || 'active'}`}
                    data-task={item.slug}
                    data-testid={`daemon-run-${item.slug}`}
                    onClick={() => void openDaemonTaskSlug(item.slug, { name: item.cardTitle || item.slug })}
                  >
                    <span className="wb-daemon-task-dot" aria-hidden="true" />
                    <span className="wb-daemon-task-copy">
                      <strong className="wb-daemon-task-title">{item.cardTitle || item.intentTitle || item.title || item.slug}</strong>
                      {(item.cardSummary || item.cardBrief) ? <span className="wb-daemon-task-summary">{item.cardSummary || item.cardBrief}</span> : null}
                      <span className="wb-daemon-task-meta">
                        <em>{item.cardMeta || item.statusLabel || ''}</em>
                        <time>{item.relativeTime || ''}</time>
                      </span>
                    </span>
                  </button>
                )) : (
                  <div className="wb-daemon-idle wb-daemon-idle-compact">
                    <strong>{offline ? '服务离线' : (overviewTasks.length ? '无匹配管线运行' : '暂无管线运行')}</strong>
                    <span>{offline ? '连接后再查看运行记录' : '在左侧创建后会出现在这里'}</span>
                  </div>
                )}
              </div>
              <div id="wbDaemonModeList" className="wb-daemon-mode-items" hidden />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
