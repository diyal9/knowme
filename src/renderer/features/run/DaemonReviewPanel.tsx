import { artifactEmptyCopy, projectReviewSurface, REVIEW_TAB_IDS, REVIEW_TAB_LABELS, stepVisualLabel, type ReviewTabId } from '../../../domain/daemon-review-tabs'
import { graphNodeStatusClass } from '../../../domain/run-projection'
import { projectPipelineTaskAttention } from '../../../domain/pipeline-task-attention'
import { workbenchTaskStateLabel, workbenchTaskStateTone } from '../../../domain/workbench-task-room'
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
      <ol className="wb-daemon-review-steps">
        {steps.map((step) => {
          const status = graphNodeStatusClass(step.status)
          return (
            <li key={step.id} className={`wb-daemon-review-step status-${status}`}>
              <span className="wb-daemon-review-step-mark" aria-hidden="true" />
              <article className="wb-daemon-review-step-card">
                <span className="wb-daemon-review-step-head">
                  <strong>{step.label}</strong>
                </span>
                <span className="wb-daemon-review-step-body">
                  <small>{step.meta}</small>
                  {step.outputLabel ? <small className="wb-daemon-review-step-output">{step.outputLabel}</small> : null}
                </span>
              </article>
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
        <article key={item.id} className="wb-daemon-review-artifact" role="listitem">
          <span className="wb-daemon-review-artifact-icon" aria-hidden="true"><Icon name="file" /></span>
          <span className="wb-daemon-review-artifact-copy">
            <strong className="wb-daemon-review-artifact-name">{item.name}</strong>
            {item.path ? <small className="wb-daemon-review-artifact-meta">{item.path}</small> : null}
          </span>
        </article>
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
          <li key={file.id} className="wb-daemon-review-change">
            <span className={`wb-daemon-review-change-status is-${String(file.status || 'changed').toLowerCase()}`}>{file.status}</span>
            <span className="wb-daemon-review-change-path">{file.path}</span>
          </li>
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
          <header className="wb-daemon-review-event-head">
            <strong>{event.type}</strong>
            {event.at ? <time>{event.at}</time> : null}
          </header>
          <div className="wb-daemon-review-event-body">{event.message || '无详细信息'}</div>
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
      <section className="wb-daemon-review-logs-block" data-logs-block="progress" aria-labelledby="wbDaemonProgressTitle">
        <header className="wb-daemon-review-logs-head">
          <span className="wb-daemon-review-logs-file" aria-hidden="true"><Icon name="file" /></span>
          <strong id="wbDaemonProgressTitle">过程摘要</strong>
        </header>
        <div className="wb-daemon-review-logs-body" data-logs-pane="progress">
          {surface.process.progress.empty ? (
            <p className="wb-daemon-review-logs-empty">{surface.process.progress.emptyLabel}</p>
          ) : (
            <pre className="wb-daemon-review-logs-pre">{surface.process.progress.text}</pre>
          )}
        </div>
      </section>
      <section className="wb-daemon-review-logs-block" data-logs-block="logs" aria-labelledby="wbDaemonLogsTitle">
        <header className="wb-daemon-review-logs-head">
          <span className="wb-daemon-review-logs-file" aria-hidden="true"><Icon name="file" /></span>
          <strong id="wbDaemonLogsTitle">运行日志</strong>
        </header>
        <div className="wb-daemon-review-logs-body" data-logs-pane="lines">
          {surface.process.logs.empty ? (
            <p className="wb-daemon-review-logs-empty">{surface.process.logs.emptyLabel}</p>
          ) : (
            <div className="wb-daemon-review-log-lines">
              {surface.process.logs.lines.map((line, index) => <div className="wb-daemon-review-log-line" key={index}>{line}</div>)}
            </div>
          )}
        </div>
      </section>
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
  const attention = projectPipelineTaskAttention(run)
  const statusLabel = attention?.statusLabel || workbenchTaskStateLabel('pipeline-review', run.phase)
  const statusTone = attention?.statusTone || workbenchTaskStateTone(run.phase) || 'muted'
  return (
    <div className="wb-daemon-review" id="wbDaemonReview" data-testid="daemon-review">
      <div className="wb-daemon-review-identity" id="wbDaemonReviewIdentity">
        <span className="wb-daemon-review-identity-copy">
          <strong id="wbDaemonReviewWorkflowName">{run.workflowName || run.brief || '管线任务'}</strong>
        </span>
        <span className={`wb-daemon-review-state tone-${statusTone}`} data-testid="daemon-review-status">{statusLabel}</span>
      </div>
      <nav className="wb-daemon-review-tabs" id="wbDaemonReviewTabs" role="tablist" aria-label="审阅分区">
        {REVIEW_TAB_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="wb-daemon-review-tab"
            role="tab"
            id={`wbDaemonReviewTab-${tab}`}
            aria-controls="wbDaemonReviewBody"
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
      <div className="wb-daemon-review-body" id="wbDaemonReviewBody" role="tabpanel" aria-labelledby={`wbDaemonReviewTab-${activeTab}`} data-testid={`daemon-review-${activeTab}`}>
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
