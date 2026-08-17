import type { RunState } from '../../app/store-types'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { TaskDialogueLaunch } from '../task-dialogue/TaskDialogueLaunch'
import { TaskDialogueMessages } from '../task-dialogue/TaskDialogueMessages'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { useWorkbenchSend } from '../task-dialogue/useWorkbenchSend'

const QUICK_PROMPTS = [
  { title: '对齐目标', subtitle: '复述目标 · 缺口 · 下一步', prompt: '请先复述你理解的目标、缺口信息与可立即推进的第一步。' },
  { title: '带上材料', subtitle: '需要什么 · 如何处理', prompt: '我有一批材料尚未整理。请告诉我需要哪些文件/数据，以及拿到后会怎么处理。' },
  { title: '跟进进度', subtitle: '卡在哪 · 要我补什么', prompt: '请根据当前运行进度，说明卡在哪一步、需要我补充什么。' },
]

export function WorkflowDialogue({ run }: { run: RunState }) {
  const onPrompt = useWorkbenchSend()
  const isGenerating = useAppStore((s) => s.isGenerating)
  const messages = run.dialogueMessages
  const showLaunch = messages.length === 0

  return (
    <TaskDialogueShell
      variant="workflow"
      launch={showLaunch}
      label="工作流对话"
      testId="workflow-dialogue"
      logTestId="run-dialogue-log"
      composerExtraClass="is-task-room"
    >
      {showLaunch ? (
        <TaskDialogueLaunch
          mark={<span className="agent-collab-mark" aria-hidden="true"><Icon name="workbench" /></span>}
          kicker="工作流对话"
          title={run.workflowName}
          caps={['工作流', 'ReAct', ...run.inputAgents.slice(0, 2)]}
          meta="把补充要求和材料发给工作流，运行过程会出现在这里。"
          emptyClass="agent-empty-workflow"
          emptyLabel="工作流对话"
          prompts={QUICK_PROMPTS}
          composerExtraClass="is-task-room"
          onPrompt={onPrompt}
        />
      ) : (
        <TaskDialogueMessages messages={messages} generating={isGenerating} onPrompt={onPrompt} />
      )}
    </TaskDialogueShell>
  )
}
