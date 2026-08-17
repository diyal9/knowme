import { artifactEmptyCopy, projectReviewSurface, REVIEW_TAB_IDS, REVIEW_TAB_LABELS, stepVisualLabel, type ReviewTabId } from '../../../domain/daemon-review-tabs'
import { graphNodeStatusClass } from '../../../domain/run-projection'
import type { RunState } from '../../app/store-types'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'

function ReviewSteps({ run }: { run: RunState }) {
  const surface = projectReviewSurface({
    graphNodes: run.graphNodes,
    artifacts: run.artifacts,
    progressText: run.progressText,
    logsText: run.processLogsText,
    status: run.daemonStatus || run.phase,
    activeTab: 'steps',
  })
  const steps = surface.steps.filter((step) => !(step.degradedPlaceholder || step.id === 'degraded-info'))
  if (!steps.length) {
    return (
      <div className="wb-daemon-review-empty">
        <p>{run.projectionDegradedReason || '暂无步骤记录，任务计划生成后将显示在这里。'}</p>
      </div>
    )
  }
  const done = steps.filter((step) => graphNodeStatusClass(step.status) === 'done').length
  const ratio = steps.length ? Math.round((done / steps.length) * 100) : 0
  return (
    <>
      <div className="wb-daemon-review-progress">
        <div className="wb-daemon-review-progress-head">
          <strong>{`已完成 ${done}/${steps.length} 步 · ${ratio}%`}</strong>
        </div>
        <div className="wb-daemon-review-progress-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(ratio, 4)}%` }} />
        </div>
      </div>
      <ol className="wb-daemon-review-steps is-zigzag">
        {steps.map((step, index) => {
          const status = graphNodeStatusClass(step.status)
          return (
            <li key={step.id} className={`wb-daemon-review-step status-${status}${index % 2 === 0 ? ' is-zig-left' : ' is-zig-right'}`}>
              <button type="button" className="wb-daemon-review-step-card">
                <span className="wb-daemon-review-step-head">
                  <strong>{step.label}</strong>
                </span>
                <span className="wb-daemon-review-step-body">
                  <small>{step.meta}</small>
                  {step.outputLabel ? <small className="wb-daemon-review-step-output">{step.outputLabel}</small> : null}
                </span>
              </button>
              <span className="wb-daemon-review-step-mark" aria-hidden="true" />
            </li>
          )
        })}
      </ol>
    </>
  )
}

function ReviewArtifacts({ run }: { run: RunState }) {
  const surface = projectReviewSurface({
    graphNodes: run.graphNodes,
    artifacts: run.artifacts,
    status: run.daemonStatus || run.phase,
    activeTab: 'artifacts',
  })
  if (!surface.artifacts.length) {
    const empty = artifactEmptyCopy(run.daemonStatus || run.phase)
    return (
      <div className="wb-daemon-review-empty is-artifacts" role="status">
        <strong>{empty.title}</strong>
        <p>{empty.body}</p>
      </div>
    )
  }
  return (
    <div className="wb-daemon-review-artifacts" role="list">
      {surface.artifacts.map((item) => (
        <div key={item.id} className="wb-daemon-review-artifact" role="listitem">
          <strong>{item.name}</strong>
          {item.path ? <small>{item.path}</small> : null}
        </div>
      ))}
    </div>
  )
}

function ReviewChanges({ run }: { run: RunState }) {
  if (run.reviewChanges.empty) {
    return <div className="wb-daemon-review-empty"><p>暂无文件变更记录。</p></div>
  }
  return (
    <div className="wb-daemon-review-changes">
      {run.reviewChanges.summary ? <p>{run.reviewChanges.summary}</p> : null}
      <ul>
        {run.reviewChanges.files.map((file) => (
          <li key={file.id}>{file.status} · {file.path}</li>
        ))}
      </ul>
    </div>
  )
}

function ReviewEvents({ run }: { run: RunState }) {
  if (!run.reviewEvents.length) {
    return <div className="wb-daemon-review-empty"><p>暂无事件记录。</p></div>
  }
  return (
    <div className="wb-daemon-review-events">
      {run.reviewEvents.map((event) => (
        <article key={event.id} className="wb-daemon-review-event">
          <strong>{event.type}</strong>
          <p>{event.message || '（无详情）'}</p>
          {event.at ? <small>{event.at}</small> : null}
        </article>
      ))}
    </div>
  )
}

function ReviewLogs({ run }: { run: RunState }) {
  const surface = projectReviewSurface({
    progressText: run.progressText,
    logsText: run.processLogsText,
    status: run.daemonStatus || run.phase,
    activeTab: 'logs',
  })
  return (
    <div className="wb-daemon-review-logs">
      {surface.process.progress.empty ? (
        <p className="wb-run-muted">{surface.process.progress.emptyLabel}</p>
      ) : (
        <pre>{surface.process.progress.text}</pre>
      )}
      {surface.process.logs.empty ? (
        <p className="wb-run-muted">{surface.process.logs.emptyLabel}</p>
      ) : (
        surface.process.logs.lines.map((line, index) => <p key={index}>{line}</p>)
      )}
    </div>
  )
}

export function DaemonReviewPanel({
  run,
  onTabChange,
  onRefresh,
}: {
  run: RunState
  onTabChange: (tab: ReviewTabId) => void
  onRefresh: () => void
}) {
  const activeTab = run.reviewTab
  const openWorkspaceModal = useAppStore((s) => s.openWorkspaceModal)
  return (
    <div className="wb-daemon-review" id="wbDaemonReview" data-testid="daemon-review">
      <div className="wb-daemon-review-identity" id="wbDaemonReviewIdentity">
        <span className="wb-daemon-review-identity-label">工作流</span>
        <strong id="wbDaemonReviewWorkflowName">{run.workflowName}</strong>
      </div>
      <nav className="wb-daemon-review-tabs" id="wbDaemonReviewTabs" role="tablist" aria-label="审阅分区">
        {REVIEW_TAB_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="wb-daemon-review-tab"
            role="tab"
            data-review-tab={tab}
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
          >
            {REVIEW_TAB_LABELS[tab]}
          </button>
        ))}
        <button
          type="button"
          className="wb-daemon-review-refresh"
          id="wbDaemonReviewWorkspace"
          title="代码工作区"
          aria-label="代码工作区"
          onClick={() => openWorkspaceModal(run.slug)}
        >
          <Icon name="code" />
        </button>
        <button
          type="button"
          className="wb-daemon-review-refresh"
          id="wbDaemonReviewRefresh"
          title="刷新"
          aria-label="刷新"
          onClick={onRefresh}
        >
          <Icon name="refresh" />
        </button>
      </nav>
      <div className="wb-daemon-review-body" id="wbDaemonReviewBody" data-testid={`daemon-review-${activeTab}`}>
        {activeTab === 'steps' ? <ReviewSteps run={run} /> : null}
        {activeTab === 'artifacts' ? <ReviewArtifacts run={run} /> : null}
        {activeTab === 'changes' ? <ReviewChanges run={run} /> : null}
        {activeTab === 'events' ? <ReviewEvents run={run} /> : null}
        {activeTab === 'logs' ? <ReviewLogs run={run} /> : null}
      </div>
    </div>
  )
}

export { stepVisualLabel }
