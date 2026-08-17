import { useMemo } from 'react'
import { joinTaskTitle, workbenchTaskBackLabel, workbenchTaskModeLabel, workbenchTaskStateLabel } from '../../../domain/workbench-task-room'
import { useAppStore } from '../../app/store'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { useWorkbenchSend } from '../task-dialogue/useWorkbenchSend'
import { ExpertCollabDialogue } from './ExpertCollabDialogue'

export function ExpertTaskRoom() {
  const expertRoom = useAppStore((s) => s.expertRoom)
  const hubItems = useAppStore((s) => s.hubItems)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const closeExpertRoom = useAppStore((s) => s.closeExpertRoom)
  const onPrompt = useWorkbenchSend()
  const expert = useMemo(() => {
    if (!expertRoom) return null
    return hubItems.find((item) => item.id === expertRoom.id) || {
      id: expertRoom.id,
      kind: 'expert' as const,
      name: expertRoom.name,
      description: '安排这位专家协作',
      category: '专家',
      installed: true,
    }
  }, [expertRoom, hubItems])

  if (!expertRoom || !expert) return null

  return (
    <>
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('expert-chat')}
        title={joinTaskTitle(expertRoom.goal, expertRoom.name)}
        state={workbenchTaskStateLabel('expert-chat')}
        onBack={closeExpertRoom}
        backLabel={workbenchTaskBackLabel('expert-chat')}
      />
      <ExpertCollabDialogue
        expert={expert}
        messages={expertRoom.messages}
        empty={!expertRoom.messages.some((item) => item.role === 'user')}
        generating={isGenerating}
        onPrompt={onPrompt}
      />
    </>
  )
}
