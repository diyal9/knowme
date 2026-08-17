import { buildDaemonProgressCard, daemonProgressRatio } from '../../../domain/agent-daemon-process'
import { runNextAction, runStatusSummary } from '../../../domain/run-telemetry'
import type { RunState } from '../../app/store-types'
import { useAppStore } from '../../app/store'
import { AgentDaemonProcessFeed } from '../assistant/AgentDaemonProcessFeed'
import { TaskDialogueHitl } from '../task-dialogue/TaskDialogueHitl'
import { TaskDialogueMessages } from '../task-dialogue/TaskDialogueMessages'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { useWorkbenchSend } from '../task-dialogue/useWorkbenchSend'

export function PipelineDialogue({ run }: { run: RunState }) {
  const hitlDecide = useAppStore((s) => s.hitlDecide)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const onPrompt = useWorkbenchSend()
  const showLaunch = run.phase === 'input'
  const compact = buildDaemonProgressCard(
    runStatusSummary(run),
    daemonProgressRatio(run.graphNodes),
  )
  const card = compact
    ? { ...compact, currentLabel: run.workflowName || compact.currentLabel }
    : null

  return (
    <TaskDialogueShell
      variant="pipeline"
      launch={showLaunch}
      label="管线过程"
      testId="pipeline-dialogue"
      logTestId="pipeline-dialogue-log"
      composerExtraClass="is-task-room"
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
                status={runStatusSummary(run)}
                transcript={null}
                compact={card}
                isGenerating={false}
                onBackWorkbench={() => undefined}
              />
            </div>
          ) : null}
          {run.phase === 'hitl' ? (
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
