import {
  workbenchTaskBackLabel,
  workbenchTaskModeLabel,
} from '../../../domain/workbench-task-room'
import { useAppStore } from '../../app/store'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { PipelineDialogue } from './PipelineDialogue'

export function PipelineTaskRoom() {
  const run = useAppStore((s) => s.run)
  const returnToShelf = useAppStore((s) => s.returnToShelf)
  if (!run || run.lane !== 'pipeline') return null

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('pipeline-review')}
        title={run.workflowName || run.brief || '管线任务'}
        onBack={returnToShelf}
        backLabel={workbenchTaskBackLabel('pipeline-review')}
      />
      <PipelineDialogue run={run} />
    </>
  )
}
