/**
 * 助理过程进度。单步一行；多步可展开。外层一张过程卡，内部不再套盒。
 * 不负责气泡正文。
 */
import type { ExecutionTimelineView } from '../../../domain/agent-execution-timeline'
import { useEffect, useState } from 'react'

function ExecutionMark({ running }: { running: boolean }) {
  return running
    ? <span className="agent-execution-orb" aria-hidden="true" />
    : <span className="agent-execution-check" aria-hidden="true">✓</span>
}

export function AgentExecutionTimeline({ view }: { view: ExecutionTimelineView }) {
  // Keep live progress visible, then get out of the way once a successful
  // reply is complete. Errors stay open so the user can inspect the details.
  const hasError = view.rows.some((row) => row.status === 'error')
  const [open, setOpen] = useState(view.running || hasError)
  useEffect(() => {
    if (view.running) setOpen(true)
    else if (!hasError) setOpen(false)
  }, [hasError, view.running])

  if (view.compact) {
    return (
      <div
        className={`agent-execution is-compact${view.running ? ' is-running' : ''}`}
        data-execution-timeline="1"
        data-testid="agent-execution-timeline"
      >
        <ExecutionMark running={view.running} />
        <span className="agent-execution-title">{view.summaryTitle}</span>
        {view.summaryMeta ? <span className="agent-execution-meta">{view.summaryMeta}</span> : null}
      </div>
    )
  }

  return (
    <details
      className={`agent-execution${view.running ? ' is-running' : ''}`}
      data-execution-timeline="1"
      data-testid="agent-execution-timeline"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="agent-execution-summary">
        <ExecutionMark running={view.running} />
        <span className="agent-execution-title">{view.summaryTitle}</span>
        {view.summaryMeta ? <span className="agent-execution-meta">{view.summaryMeta}</span> : null}
      </summary>
      <div className="agent-execution-list" role="log" aria-live="polite">
        {view.rows.map((row) => {
          const statusLabel = row.status === 'pending'
            ? '进行中'
            : row.status === 'error'
              ? (row.kind === 'tool' ? '工具调用失败' : '处理未完成')
              : '已完成'
          const head = (
            <>
              <span className="agent-trace-mark" aria-hidden="true">{row.status === 'pending' ? '●' : row.status === 'error' ? '!' : '✓'}</span>
              <span className="agent-trace-title">{row.title}</span>
              {row.durationLabel ? <span className="agent-trace-meta">{row.durationLabel}</span> : null}
            </>
          )
          if (row.expandable) {
            return (
              <details key={row.id} className={`agent-trace-row ${row.kind} ${row.status}`}>
                <summary aria-label={`${row.title}，${statusLabel}`}>{head}</summary>
                {row.errorCode || row.errorMessage ? (
                  <dl className="agent-trace-error-details">
                    {row.errorCode ? <div><dt>错误码</dt><dd><code>{row.errorCode}</code></dd></div> : null}
                    {row.errorMessage ? <div><dt>错误信息</dt><dd>{row.errorMessage}</dd></div> : null}
                    {row.hint ? <div><dt>补充信息</dt><dd>{row.hint}</dd></div> : null}
                  </dl>
                ) : row.hint ? <pre>{row.hint}</pre> : null}
              </details>
            )
          }
          return (
            <div
              key={row.id}
              className={`agent-trace-row ${row.kind} ${row.status}`}
              aria-label={`${row.title}，${statusLabel}`}
            >
              {head}
              {row.hint ? <span className="agent-trace-hint">{row.hint}</span> : null}
            </div>
          )
        })}
      </div>
    </details>
  )
}
