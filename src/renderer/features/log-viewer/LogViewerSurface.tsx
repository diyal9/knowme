import { useState } from 'react'
import type { LogGroupItem } from '../../../domain/log-viewer-grouping'
import './log-viewer.css'
import { useLogViewer } from './useLogViewer'

export function LogViewerSurface() {
  const v = useLogViewer()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="log-root" data-testid="log-viewer-surface">
      <header className="log-header">
        <div className="log-title">KnowMe · 日志中心</div>
        <div className="log-spacer" />
        <input
          type="search"
          placeholder="搜索 event / message"
          value={v.search}
          onChange={(e) => v.setSearch(e.target.value)}
          aria-label="搜索"
        />
        <select value={v.level} onChange={(e) => v.setLevel(e.target.value)} aria-label="级别">
          <option value="">全部级别</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input type="date" value={v.date} onChange={(e) => v.setDate(e.target.value)} aria-label="日期" />
        <button type="button" onClick={() => void v.reload()} disabled={v.loading}>
          {v.loading ? '加载中…' : '刷新'}
        </button>
        <button type="button" className="ghost" onClick={() => window.api?.openLogsDir?.()}>
          打开目录
        </button>
        <button type="button" className="danger" onClick={() => void v.clear()}>
          清空
        </button>
      </header>

      <div className="log-overview">
        <div className="log-stat"><div className="log-stat-label">总条数</div><div className="log-stat-value">{v.counts.total || 0}</div></div>
        <div className="log-stat"><div className="log-stat-label">LLM</div><div className="log-stat-value">{(v.counts.llm || 0) + (v.counts['system-prompt'] || 0)}</div></div>
        <div className="log-stat"><div className="log-stat-label">系统</div><div className="log-stat-value">{v.counts.system || 0}</div></div>
        <div className="log-stat"><div className="log-stat-label">WARN+</div><div className="log-stat-value">{v.warnPlus}</div></div>
        <div className="log-stat"><div className="log-stat-label">耗时</div><div className="log-stat-value">{v.lastLoadMs}ms</div></div>
        <label className="log-group-toggle">
          <input type="checkbox" checked={v.groupRuns} onChange={(e) => v.setGroupRuns(e.target.checked)} />
          合并同 run
        </label>
      </div>

      <div className="log-tabs" role="tablist">
        {v.categoryOrder.map((cat) => (
          <button
            key={cat || 'all'}
            type="button"
            role="tab"
            className={`log-tab${v.category === cat ? ' active' : ''}`}
            onClick={() => v.setCategory(cat)}
          >
            {v.categoryLabels[cat] || cat}
            <span className="count">{cat === '' ? (v.counts.total || 0) : (v.counts[cat] || 0)}</span>
          </button>
        ))}
      </div>

      {v.error ? <div className="log-health error">监控状态：异常 · {v.error}</div> : (
        <div className="log-health">监控状态：正常 · 最近加载 {v.lastLoadMs}ms</div>
      )}

      <div className="log-list" data-testid="log-list">
        {!v.grouped.length ? (
          <p className="log-empty">暂无日志</p>
        ) : (
          (v.grouped as LogGroupItem[]).map((item, index) => {
            if (item.type === 'group') {
              const id = `group-${item.summary.runId || index}`
              const open = openId === id
              return (
                <div key={id} className={`log-run-group${item.summary.errorCount ? ' has-error' : ''}`}>
                  <button type="button" className="log-run-head" onClick={() => setOpenId(open ? null : id)}>
                    <span className="lvl">{item.summary.level}</span>
                    <span className="run-title">{item.summary.title}</span>
                    <span className="run-meta">{item.summary.count} 条</span>
                    <span className="ts">{v.fmtTime(item.summary.startTs)}</span>
                  </button>
                  {open ? (
                    <div className="log-run-body">
                      {item.entries.map((entry, ei) => (
                        <LogEntryRow key={`${entry.ts}-${ei}`} entry={entry} fmtTime={v.fmtTime} labels={v.categoryLabels} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            }
            return (
              <LogEntryRow
                key={`${item.entry.ts}-${index}`}
                entry={item.entry}
                fmtTime={v.fmtTime}
                labels={v.categoryLabels}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function LogEntryRow({
  entry,
  fmtTime,
  labels,
}: {
  entry: { ts?: string; level?: string; category?: string; event?: string; msg?: string; message?: string; meta?: Record<string, unknown> }
  fmtTime: (iso?: string) => string
  labels: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const msg = entry.msg || entry.message || ''
  return (
    <div className="log-entry">
      <button type="button" className="log-entry-head" onClick={() => setOpen(!open)}>
        <span className={`lvl ${entry.level || ''}`}>{entry.level}</span>
        <span className="cat">{labels[entry.category || ''] || entry.category}</span>
        <span className="ev">{entry.event}</span>
        <span className="msg">{msg}</span>
        <span className="ts">{fmtTime(entry.ts)}</span>
      </button>
      {open ? (
        <pre className="log-entry-body">{JSON.stringify(entry.meta ?? entry, null, 2)}</pre>
      ) : null}
    </div>
  )
}
