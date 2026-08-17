import { useMemo, useRef } from 'react'
import { useAppStore } from '../../app/store'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { ExpertSideStack } from './ExpertSideStack'

export function ExpertRoomSurface() {
  const room = useAppStore((s) => s.expertRoom)
  const hubItems = useAppStore((s) => s.hubItems)
  const setExpertRoomGoal = useAppStore((s) => s.setExpertRoomGoal)
  const expert = useMemo(() => {
    if (!room) return null
    return hubItems.find((item) => item.id === room.id) || {
      id: room.id,
      kind: 'expert' as const,
      name: room.name,
      description: '安排这位专家协作',
      category: '专家',
      installed: true,
    }
  }, [hubItems, room])

  const surfaceRef = useRef<HTMLElement>(null)
  useKnowMeIcons(room?.id, surfaceRef)

  if (!room || !expert) return null

  return (
    <article ref={surfaceRef} className="wb-expert-task-room" id="wbExpertTaskRoom" data-testid="expert-room" aria-label="专家任务详情">
      <header className="wb-expert-task-head" hidden>
        <div className="wb-expert-task-head-title">
          <strong id="wbExpertTaskTitle">{room.goal.trim() || room.name}</strong>
          <span className="wb-expert-task-status" id="wbExpertTaskStatus">协作中</span>
        </div>
      </header>
      <div className="wb-expert-task-body" id="wbExpertTaskBody">
        <ExpertSideStack
          expert={expert}
          goal={room.goal}
          onGoalChange={setExpertRoomGoal}
        />
      </div>
    </article>
  )
}
