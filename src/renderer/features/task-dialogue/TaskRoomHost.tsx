import { resolveWorkbenchTaskKind } from '../../../domain/workbench-task-room'
import { useAppStore } from '../../app/store'
import { ExpertTaskRoom } from '../expert/ExpertTaskRoom'
import { WorkflowTaskRoom } from '../workflow/WorkflowTaskRoom'
import { PipelineTaskRoom } from '../run/PipelineTaskRoom'

export function TaskRoomHost() {
  const expertRoom = useAppStore((s) => s.expertRoom)
  const run = useAppStore((s) => s.run)
  const kind = resolveWorkbenchTaskKind({ expertRoom: !!expertRoom, lane: run?.lane })
  if (kind === 'expert-chat') return <ExpertTaskRoom />
  if (kind === 'workflow-chat') return <WorkflowTaskRoom />
  if (kind === 'pipeline-review') return <PipelineTaskRoom />
  return null
}
