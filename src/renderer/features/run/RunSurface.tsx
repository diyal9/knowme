import { useEffect, useRef } from 'react'
import { runNextAction, runProgressLabel, runStatusSummary } from '../../../domain/run-telemetry'
import { useAppStore, selectProcessView } from '../../app/store'
import { BackButton } from '../../app/BackButton'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { DaemonReviewPanel } from './DaemonReviewPanel'
import { RunAgentsSection, RunGraphSection } from './RunAgentsGraph'
import { RunInputAgentsPreview } from './RunInputAgentsPreview'

function RunProcessLog({
  processView,
  expanded,
}: {
  processView: NonNullable<ReturnType<typeof selectProcessView>>
  expanded: boolean
}) {
  if (!expanded) return null
  return (
    <section className="wb-runner-log-section" aria-labelledby="wbRunnerLogTitle" data-testid="run-process-log">
      <div className="wb-run-section-title-row">
        <div className="wb-run-section-title" id="wbRunnerLogTitle">过程日志</div>
      </div>
      <div className="wb-runner-log" id="wbRunnerLog">
        {processView.progress.empty ? (
          <p className="wb-run-muted">{processView.progress.emptyLabel}</p>
        ) : (
          <pre>{processView.progress.text}</pre>
        )}
        {processView.logs.empty ? (
          <p className="wb-run-muted">{processView.logs.emptyLabel}</p>
        ) : (
          processView.logs.lines.map((line, i) => <p key={i}>{line}</p>)
        )}
      </div>
    </section>
  )
}

function RunContextPanel({
  run,
  processView,
}: {
  run: NonNullable<ReturnType<typeof useAppStore.getState>['run']>
  processView: NonNullable<ReturnType<typeof selectProcessView>>
}) {
  const progress = runProgressLabel(run.phase, run.progressText)
  const status = runStatusSummary(run)
  const next = runNextAction(run)

  return (
    <div className="wb-task-context" id="wbTaskContextLegacy">
      <section className="wb-run-section wb-run-status-section" aria-labelledby="wbRunStatusTitle">
        <div className="wb-run-status-head">
          <div className="wb-run-section-title" id="wbRunStatusTitle">当前状态</div>
          <strong className="wb-run-progress" id="wbRunProgress">{progress}</strong>
        </div>
        <div className="wb-run-status" id="wbRunStatus" role="status" aria-live="polite" aria-atomic="true">
          {status}
        </div>
        <div className="wb-run-next-label">你现在要做什么</div>
        <div className={`wb-run-next-action${run.phase === 'done' ? ' is-done' : ''}`} id="wbRunNextAction">
          {next}
        </div>
      </section>
      <section className="wb-run-section" aria-labelledby="wbRunGoalTitle">
        <div className="wb-run-section-title" id="wbRunGoalTitle">任务目标</div>
        <div className="wb-run-goal" id="wbRunGoal">{run.brief || '（未填写目标）'}</div>
      </section>
      <RunAgentsSection agents={run.agents} currentOwner={run.currentOwner} />
      <RunGraphSection nodes={run.graphNodes} degraded={run.projectionDegraded} />
      {run.artifacts.length ? (
        <section className="wb-run-section" aria-labelledby="wbRunArtifactsTitle">
          <div className="wb-run-section-title" id="wbRunArtifactsTitle">任务产物</div>
          <div className="wb-run-artifacts" id="wbRunArtifacts" data-testid="run-artifacts">
            {run.artifacts.map((item) => (
              <span key={item.id} className="wb-run-artifact">{item.name}</span>
            ))}
          </div>
        </section>
      ) : null}
      <section className="wb-run-section" aria-labelledby="wbRunTraceTitle">
        <div className="wb-run-section-title" id="wbRunTraceTitle">任务追溯</div>
        <div className="wb-run-trace" id="wbRunTrace" data-testid="wb-run-trace">
          <div className="wb-run-trace-row">
            <span className="wb-run-trace-label">工作流</span>
            <span className="wb-run-trace-value">{run.workflowName}</span>
          </div>
          <div className="wb-run-trace-row">
            <span className="wb-run-trace-label">运行 ID</span>
            <span className="wb-run-trace-value">{run.slug}</span>
          </div>
        </div>
      </section>
      <RunProcessLog processView={processView} expanded={run.showProcess} />
    </div>
  )
}

export function RunSurface({ taskRoom = false }: { taskRoom?: boolean }) {
  const run = useAppStore((s) => s.run)
  const daemonOnline = useAppStore((s) => s.shelfDaemonOnline)
  const setRunBrief = useAppStore((s) => s.setRunBrief)
  const confirmLaunch = useAppStore((s) => s.confirmLaunch)
  const refreshRunTelemetry = useAppStore((s) => s.refreshRunTelemetry)
  const setRunReviewTab = useAppStore((s) => s.setRunReviewTab)
  const hitlDecide = useAppStore((s) => s.hitlDecide)
  const returnToShelf = useAppStore((s) => s.returnToShelf)
  const rerun = useAppStore((s) => s.rerun)
  const toggleProcessLog = useAppStore((s) => s.toggleProcessLog)
  const processView = selectProcessView(run)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!run || run.phase === 'input' || run.phase === 'done') return
    void refreshRunTelemetry()
    const ms = window.knowme?.perf?.runTelemetryIntervalMs || 1600
    const timer = window.setInterval(() => { void refreshRunTelemetry() }, ms)
    const unsub = window.api?.onWorkbenchDaemonLogEvent?.(() => { void refreshRunTelemetry() })
    return () => {
      window.clearInterval(timer)
      unsub?.()
    }
  }, [run?.slug, run?.phase, refreshRunTelemetry])

  useKnowMeIcons(run?.phase, surfaceRef)

  if (!run) {
    return (
      <div ref={surfaceRef} className="wb-run-shell" data-testid="run-surface">
        <p className="wb-run-empty">从货架选择工作流以进入任务房间。</p>
      </div>
    )
  }

  const outcome = run.phase === 'done' ? '本轮已完成' : run.phase === 'hitl' ? '等待确认' : ''
  const live = run.phase === 'running' || run.phase === 'hitl'

  return (
    <div ref={surfaceRef} className="wb-run-shell" id="wbTaskDashboard" data-testid="run-surface">
      <header className="wb-run-topbar" hidden={taskRoom}>
        <div className="wb-run-topbar-title">
          <div className="wb-run-topbar-identity">
            <strong id="wbStartTitle">{run.workflowName}</strong>
          </div>
          <div className="wb-run-topbar-meta">
            {outcome ? (
              <span className={`wb-run-outcome tone-${run.phase}`} id="wbRunOutcome" role="status" aria-live="polite">{outcome}</span>
            ) : null}
          </div>
        </div>
        <BackButton label={run.lane === 'pipeline' ? '返回管线服务' : '返回工作流'} id="wbRunBack" onClick={returnToShelf} />
      </header>
      <div className="wb-run-body" id="wbRunBody">
        {run.phase === 'input' ? (
          <section className="wb-run-stage" id="wbRunStageInput" data-run-stage="input" data-testid="run-input-stage">
            <div className="wb-run-stage-inner">
              <header className="wb-run-stage-head">
                <span className="wb-run-stage-badge">确认输入</span>
                <h2 id="wbRunInputTitle">填写本次信息</h2>
                <p className="wb-run-stage-hint" id="wbRunInputHint">
                  确认目标与必要材料后即可开始。运行过程中可随时返回流程；也可从「专家协作」或「管线服务」找回进行中的项。
                </p>
              </header>
              <form
                className="wb-run-input-form"
                id="wbRunInputForm"
                onSubmit={(e) => { e.preventDefault(); void confirmLaunch() }}
              >
                <label className="wb-run-field">
                  <span className="wb-run-field-label"><span>本次目标</span></span>
                  <textarea
                    id="wbRunInputBrief"
                    value={run.brief}
                    onChange={(e) => setRunBrief(e.target.value)}
                    placeholder="例如：整理今天的会议纪要并生成待办"
                    maxLength={240}
                    rows={3}
                  />
                </label>
              </form>
              <div className="wb-run-meta" id="wbRunInputMeta">
                <RunInputAgentsPreview agents={run.inputAgents} />
                <div className="wb-run-backend-note" id="wbRunBackendNote">
                  {`执行方式：${daemonOnline === false ? '本机专家团队' : '管线服务'}（系统自动选择）`}
                </div>
              </div>
              <div className="wb-run-input-actions">
                <button type="button" className="wb-modal-btn" id="wbRunInputCancel" onClick={returnToShelf}>取消</button>
                <button type="submit" form="wbRunInputForm" className="wb-modal-btn primary" id="wbRunInputStart" data-testid="run-input-start">开始运行</button>
              </div>
            </div>
          </section>
        ) : null}

        {live ? (
          <section className="wb-run-stage" id="wbRunStageLive" data-run-stage="running" data-testid="run-live-stage">
            <section className="wb-runner is-daemon-review" id="wbRunner" aria-label="工作流运行">
              {!taskRoom ? (
                <>
                  <div className="wb-runner-head">
                    <div className="wb-runner-copy">
                      <div className="wb-runner-title" id="wbRunnerTitle">{run.workflowName}</div>
                      <div className="wb-runner-meta" id="wbRunnerMeta">{runProgressLabel(run.phase, run.progressText)}</div>
                    </div>
                  </div>
                </>
              ) : null}
              <DaemonReviewPanel
                run={run}
                onTabChange={setRunReviewTab}
                onRefresh={() => void refreshRunTelemetry()}
              />
              {!taskRoom && processView ? <RunContextPanel run={run} processView={processView} /> : null}
              {taskRoom ? null : run.phase === 'hitl' ? (
                <div className="wb-runner-actions" id="wbRunnerActions" data-testid="run-hitl-actions">
                  <p>{run.gateTitle ? `需要确认：${run.gateTitle}` : '需要确认后继续（人工门禁）。'}</p>
                  <button type="button" className="wb-modal-btn" onClick={() => void hitlDecide(false)}>拒绝</button>
                  <button type="button" className="wb-modal-btn primary" onClick={() => void hitlDecide(true)}>确认</button>
                </div>
              ) : (
                <div className="wb-runner-actions" id="wbRunnerActions">
                  <button type="button" className="wb-modal-btn" onClick={toggleProcessLog}>
                    {run.showProcess ? '隐藏执行过程' : '查看执行过程'}
                  </button>
                </div>
              )}
            </section>
          </section>
        ) : null}

        {run.phase === 'done' ? (
          <section className="wb-run-stage" id="wbRunStageResult" data-run-stage="result" data-testid="run-result-stage">
            <div className="wb-run-stage-inner">
              <div className="wb-run-result-body" id="wbRunResultBody">
                <DaemonReviewPanel
                  run={run}
                  onTabChange={setRunReviewTab}
                  onRefresh={() => void refreshRunTelemetry()}
                />
                {!taskRoom && processView ? <RunContextPanel run={run} processView={processView} /> : null}
              </div>
              <div className="wb-run-result-actions wb-run-input-actions" id="wbRunResultActions" data-testid="run-footer-actions">
                <p>本轮已结束。</p>
                <BackButton label={run.lane === 'pipeline' ? '返回管线服务' : '返回工作流'} onClick={returnToShelf} />
                <button type="button" className="wb-modal-btn" onClick={() => void rerun()}>再跑一次</button>
                <button type="button" className="wb-modal-btn" onClick={toggleProcessLog}>
                  {run.showProcess ? '隐藏执行过程' : '查看执行过程'}
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
