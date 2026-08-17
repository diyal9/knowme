import { expertCardTitle, expertQuickSub } from '../../../domain/expert-present'
import { resolveKernelRole } from '../../../domain/dialogue-lanes'
import type { CapabilityItem } from '../../../shared/api'
import { TaskDialogueLaunch } from '../task-dialogue/TaskDialogueLaunch'
import { TaskDialogueMessages } from '../task-dialogue/TaskDialogueMessages'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { ExpertAvatarMark } from './ExpertAvatarMark'

const QUICK_PROMPTS = [
  { title: '对齐目标', subtitle: '复述目标 · 缺口 · 下一步', prompt: '请先复述你理解的目标、缺口信息与可立即推进的第一步。' },
  { title: '擅长什么', subtitle: '3 类任务 + 示例请求', prompt: '请列出你最适合接手的 3 类任务，并各给一个我可以直接粘贴的示例请求。' },
  { title: '带上材料', subtitle: '需要什么 · 如何处理', prompt: '我有一批材料尚未整理。请告诉我需要哪些文件/数据，以及拿到后会怎么处理。' },
]

export function ExpertCollabDialogue({
  expert,
  messages,
  empty,
  generating = false,
  onPrompt,
}: {
  expert: CapabilityItem
  messages: import('../../../shared/api').ChatMessage[]
  empty: boolean
  generating?: boolean
  onPrompt: (prompt: string) => void
}) {
  const name = expertCardTitle(expert)
  const role = expert.category || '专家'
  const modeId = resolveKernelRole({
    agentId: expert.id,
    expertId: expert.id,
    category: expert.category,
    kind: expert.kind,
    name: expert.name,
    description: expert.description,
  })

  return (
    <TaskDialogueShell
      variant="expert"
      launch={empty}
      label="专家协作对话"
      logTestId="expert-collab-log"
    >
      {empty ? (
        <TaskDialogueLaunch
          mark={(
            <ExpertAvatarMark agent={expert} className="agent-collab-mark" imgClassName="agent-collab-photo" size={56} />
          )}
          kicker="专家协作"
          title={name}
          caps={[role, 'ReAct']}
          meta={expertQuickSub(expert) || undefined}
          emptyClass="agent-empty-expert-collab"
          emptyLabel={`${name}协作入口`}
          prompts={QUICK_PROMPTS}
          onPrompt={onPrompt}
        />
      ) : (
        <TaskDialogueMessages
          messages={messages}
          generating={generating}
          modeId={modeId}
          followUps
          onPrompt={onPrompt}
        />
      )}
    </TaskDialogueShell>
  )
}
