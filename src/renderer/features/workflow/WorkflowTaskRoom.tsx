import {
  joinTaskTitle,
  workbenchTaskBackLabel,
  workbenchTaskModeLabel,
  workbenchTaskStateLabel,
} from '../../../domain/workbench-task-room'
import { useAppStore } from '../../app/store'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { WorkflowDialogue } from './WorkflowDialogue'

export function WorkflowTaskRoom() {
  const run = useAppStore((s) => s.run)
  const returnToShelf = useAppStore((s) => s.returnToShelf)
  if (!run || run.lane !== 'workflow') return null

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('workflow-chat')}
        title={joinTaskTitle(run.workflowName, run.brief)}
        state={workbenchTaskStateLabel('workflow-chat', run.phase)}
        onBack={returnToShelf}
        backLabel={workbenchTaskBackLabel('workflow-chat')}
      />
      <WorkflowDialogue run={run} />
    </>
  )
}
