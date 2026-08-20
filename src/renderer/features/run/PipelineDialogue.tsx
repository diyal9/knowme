import { buildDaemonProgressCard, daemonProgressRatio } from '../../../domain/agent-daemon-process'
import { projectPipelineTaskAttention } from '../../../domain/pipeline-task-attention'
import { runNextAction, runStatusSummary } from '../../../domain/run-telemetry'
import type { RunState } from '../../app/store-types'
import { useAppStore } from '../../app/store'
import { AgentDaemonProcessFeed } from '../assistant/AgentDaemonProcessFeed'
import { TaskDialogueHitl } from '../task-dialogue/TaskDialogueHitl'
import { TaskDialogueMessages } from '../task-dialogue/TaskDialogueMessages'
import { TaskDialogueRecovery } from '../task-dialogue/TaskDialogueRecovery'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { useWorkbenchSend } from '../task-dialogue/useWorkbenchSend'

export function PipelineDialogue({ run }: { run: RunState }) {
  const hitlDecide = useAppStore((s) => s.hitlDecide)
  const refreshRunTelemetry = useAppStore((s) => s.refreshRunTelemetry)
  const setRunReviewTab = useAppStore((s) => s.setRunReviewTab)
  const rerun = useAppStore((s) => s.rerun)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const onPrompt = useWorkbenchSend()
  const showLaunch = run.phase === 'input'
  const attention = projectPipelineTaskAttention(run)
  const compact = buildDaemonProgressCard(
    runStatusSummary(run),
    daemonProgressRatio(run.graphNodes),
  )
  const completedSteps = run.graphNodes.filter((node) => ['done', 'completed', 'finished', 'success', 'approved'].includes(String(node.status || '').toLowerCase())).length
  const progressLine = run.graphNodes.length
    ? `已完成 ${completedSteps}/${run.graphNodes.length} 步`
    : '正在准备任务计划'
  const card = compact
    ? {
        ...compact,
        currentLabel: run.workflowName || run.brief || compact.currentLabel,
        statusLabel: '',
        progressLine,
        tip: run.phase === 'hitl' && run.gateNode ? runNextAction(run) : '',
      }
    : null

  return (
    <TaskDialogueShell
      variant="pipeline"
      launch={showLaunch}
      label="管线过程"
      testId="pipeline-dialogue"
      logTestId="pipeline-dialogue-log"
      composerExtraClass="is-task-room"
      composerPlaceholder={attention?.composerPlaceholder}
    >
      {showLaunch ? (
        <div className="agent-empty-tips agent-empty-pipeline" aria-label="管线过程入口">
          <p className="agent-collab-meta">运行开始后，进度会出现在这里。完整日志在右侧「过程日志」。</p>
        </div>
      ) : (
        <>
          <TaskDialogueMessages messages={run.dialogueMessages} generating={isGenerating} onPrompt={onPrompt} />
          {card ? (
            <div data-testid="pipeline-progress-card">
              <AgentDaemonProcessFeed
                status={attention?.statusLabel || runStatusSummary(run)}
                transcript={null}
                compact={card}
                isGenerating={false}
                onBackWorkbench={() => undefined}
              />
            </div>
          ) : null}
          {attention ? (
            <TaskDialogueRecovery
              title={attention.title}
              body={attention.body}
              nextAction={attention.nextAction}
              onViewLogs={() => setRunReviewTab('logs')}
              onRefresh={() => void refreshRunTelemetry()}
              onRestart={attention.canRestart ? () => rerun() : undefined}
            />
          ) : null}
          {run.phase === 'hitl' && run.gateNode ? (
            <TaskDialogueHitl
              nextAction={runNextAction(run)}
              gateTitle={run.gateTitle}
              onReject={() => void hitlDecide(false)}
              onAccept={() => void hitlDecide(true)}
            />
          ) : null}
        </>
      )}
    </TaskDialogueShell>
  )
}
