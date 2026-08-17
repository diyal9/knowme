import type { ExecutionTimelineView } from '../../../domain/agent-execution-timeline'

export function AgentExecutionTimeline({ view }: { view: ExecutionTimelineView }) {
  return (
    <details
      className={`agent-execution${view.running ? ' is-running' : ''}`}
      data-execution-timeline="1"
      data-testid="agent-execution-timeline"
      open={view.running}
    >
      <summary className="agent-execution-summary">
        {view.running
          ? <span className="agent-execution-orb" aria-hidden="true" />
          : <span className="agent-execution-check" aria-hidden="true">✓</span>}
        <span className="agent-execution-title">{view.summaryTitle}</span>
        {view.summaryMeta ? <span className="agent-execution-meta">{view.summaryMeta}</span> : null}
      </summary>
      <div className="agent-execution-list" role="log" aria-live="polite">
        {view.rows.map((row) => {
          const statusLabel = row.status === 'pending' ? '进行中' : row.status === 'error' ? '未完成' : '已完成'
          const head = (
            <>
              <span className="agent-trace-mark" aria-hidden="true">{row.status === 'pending' ? '●' : row.status === 'error' ? '!' : '✓'}</span>
              <span className="agent-trace-title">{row.title}</span>
              {row.durationLabel ? <span className="agent-trace-meta">{row.durationLabel}</span> : null}
            </>
          )
          if (row.expandable && row.hint) {
            return (
              <details key={row.id} className={`agent-trace-row ${row.kind} ${row.status}`}>
                <summary aria-label={`${row.title}，${statusLabel}`}>{head}</summary>
                <pre>{row.hint}</pre>
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
