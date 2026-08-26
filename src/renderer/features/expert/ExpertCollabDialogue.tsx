import { expertCardTitle, expertQuickSub } from '../../../domain/expert-present'
import type { CapabilityItem, ChatMessage } from '../../../shared/api'
import { TaskDialogueLaunch } from '../task-dialogue/TaskDialogueLaunch'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { ContentView } from '../content-view/ContentView'
import { ExpertAvatarMark } from './ExpertAvatarMark'

const QUICK_PROMPTS = [
  { title: '对齐目标', subtitle: '复述目标 · 缺口 · 下一步', prompt: '请先复述你理解的目标、缺口信息与可立即推进的第一步。' },
  { title: '擅长什么', subtitle: '3 类任务 + 示例请求', prompt: '请列出你最适合接手的 3 类任务，并各给一个我可以直接粘贴的示例请求。' },
  { title: '带上材料', subtitle: '需要什么 · 如何处理', prompt: '我有一批材料尚未整理。请告诉我需要哪些文件/数据，以及拿到后会怎么处理。' },
]

function ExpertDialogueMessages({
  expert,
  messages,
  generating,
}: {
  expert: CapabilityItem
  messages: ChatMessage[]
  generating: boolean
}) {
  const name = expertCardTitle(expert)
  return (
    <ol className="wb-expert-dialogue-list" aria-label="协作对话">
      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const isPending = !isUser && message.streaming && !String(message.text || '').trim()
        return (
          <li
            key={message.id}
            className={`wb-expert-dialogue-turn ${isUser ? 'is-user' : 'is-expert'}${message.role === 'error' ? ' is-error' : ''}`}
            data-testid={isUser ? 'expert-user-message' : 'expert-reply-message'}
          >
            {isUser ? null : (
              <ExpertAvatarMark agent={expert} className="wb-expert-dialogue-avatar" size={34} />
            )}
            <article>
              <header><strong>{isUser ? '我' : name}</strong></header>
              {isUser ? (
                <p>{message.text}</p>
              ) : isPending ? (
                <p className="wb-expert-dialogue-pending">正在回复<span aria-hidden="true">…</span></p>
              ) : (
                <ContentView source={message.text} streaming={message.streaming === true} />
              )}
              {message.attachmentName ? <small>附件 · {message.attachmentName}</small> : null}
            </article>
          </li>
        )
      })}
      {generating && !messages.some((message) => message.streaming) ? (
        <li className="wb-expert-dialogue-turn is-expert" data-testid="expert-reply-pending">
          <ExpertAvatarMark agent={expert} className="wb-expert-dialogue-avatar" size={34} />
          <article><header><strong>{name}</strong></header><p className="wb-expert-dialogue-pending">正在回复<span aria-hidden="true">…</span></p></article>
        </li>
      ) : null}
    </ol>
  )
}

export function ExpertCollabDialogue({
  expert,
  messages,
  empty,
  generating = false,
  composer = true,
  onPrompt,
}: {
  expert: CapabilityItem
  messages: import('../../../shared/api').ChatMessage[]
  empty: boolean
  generating?: boolean
  composer?: boolean
  onPrompt: (prompt: string) => void
}) {
  const name = expertCardTitle(expert)
  const role = expert.category || '专家'
  return (
    <TaskDialogueShell
      variant="expert"
      launch={empty}
      label="专家协作对话"
      logTestId="expert-collab-log"
      showComposer={composer}
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
        <ExpertDialogueMessages
          expert={expert}
          messages={messages}
          generating={generating}
        />
      )}
    </TaskDialogueShell>
  )
}
