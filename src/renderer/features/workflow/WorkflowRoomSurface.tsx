import { useMemo } from 'react'
import { useAppStore } from '../../app/store'
import { WorkflowSideStack } from './WorkflowSideStack'

export function WorkflowRoomSurface() {
  const run = useAppStore((s) => s.run)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const card = useMemo(
    () => (run ? shelfCards.find((item) => item.id === run.workflowId) : null),
    [run, shelfCards],
  )

  if (!run) return null

  const steps = card?.stepLabels?.length
    ? card.stepLabels
    : run.graphNodes.map((node) => node.label).filter(Boolean)
  const needs = card?.inputLabel ? [card.inputLabel] : []
  const outcomes = card?.outcomeLabel ? [card.outcomeLabel] : []

  return (
    <article className="wb-expert-task-room wb-workflow-task-room" data-testid="workflow-room" aria-label="工作流详情">
      <div className="wb-expert-task-body">
        <WorkflowSideStack
          name={run.workflowName}
          description={card?.description || run.brief || ''}
          needs={needs}
          outcomes={outcomes}
          steps={steps}
        />
      </div>
    </article>
  )
}
