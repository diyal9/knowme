import { expertCardTitle } from '../../../domain/expert-present'
import type { CapabilityItem, ChatMessage } from '../../../shared/api'
import type { ExpertWorkbenchRoute } from '../../../domain/expert-workbench-detail'
import { TaskDialogueShell } from '../task-dialogue/TaskDialogueShell'
import { AgentMessageBubble } from '../assistant/AgentMessageBubble'
import { ExpertConversationTimeline, expertTurnElapsedMs, ExpertTurnDivider } from './ExpertConversationTimeline'
import { Fragment, type ReactNode } from 'react'

export function ExpertDialogueMessage({
  expert,
  message,
  interactiveStructuredUi = false,
  onStructuredPick,
  children,
}: {
  expert: CapabilityItem
  message: ChatMessage
  interactiveStructuredUi?: boolean
  onStructuredPick?: (payload: string, needsInput: boolean) => void
  children?: ReactNode
}) {
  const isUser = message.role === 'user'
  const expertName = expertCardTitle(expert)
  return (
    <li className={`agent-virtuoso-row wb-expert-message-row${isUser ? ' is-user' : ''}`} data-testid={isUser ? 'expert-user-message' : 'expert-reply-message'}>
      <AgentMessageBubble
        role={isUser ? 'user' : 'assistant'}
        text={message.text}
        streaming={message.streaming === true}
        thinking={!isUser && Boolean(message.thinking)}
        error={message.role === 'error'}
        message={isUser ? undefined : message}
        interactiveStructuredUi={interactiveStructuredUi}
        onStructuredPick={onStructuredPick}
      >
        {!isUser ? <span className="wb-sr-only">{expertName}</span> : null}
        {message.attachmentName ? <div className="agent-attachment">附件 · {message.attachmentName}</div> : null}
        {children}
      </AgentMessageBubble>
    </li>
  )
}

export function ExpertDialoguePending() {
  return (
    <li className="agent-virtuoso-row wb-expert-message-row" data-testid="expert-reply-pending">
      <AgentMessageBubble role="assistant" streaming thinking message={{ id: 'expert-pending', role: 'assistant', text: '', streaming: true }} />
    </li>
  )
}

export function ExpertDialogueMessages({
  expert,
  messages,
  generating,
  onStructuredPick,
  afterMessages,
  initialOptions = [],
  onInitialOption,
}: {
  expert: CapabilityItem
  messages: ChatMessage[]
  generating: boolean
  onStructuredPick?: (payload: string, needsInput: boolean) => void
  afterMessages?: ReactNode
  initialOptions?: ExpertWorkbenchRoute[]
  onInitialOption?: (option: ExpertWorkbenchRoute) => void
}) {
  const latestAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id
  const firstAssistantId = messages.find((message) => message.role === 'assistant')?.id
  const showInitialOptions = initialOptions.length > 0 && !messages.some((message) => message.role === 'user')
  const turnDividerFor = (message: ChatMessage, index: number) => {
    if (message.role !== 'assistant' || message.streaming) return null
    const userIndex = messages.slice(0, index).map((item) => item.role).lastIndexOf('user')
    if (userIndex < 0) return null
    // The marker opens the assistant response, so it belongs before the first
    // assistant message after this user turn, never at the reply's tail.
    if (messages.slice(userIndex + 1, index).some((item) => item.role === 'assistant')) return null
    return <ExpertTurnDivider elapsedMs={expertTurnElapsedMs(messages[userIndex], message)} />
  }
  return (
    <ExpertConversationTimeline className="wb-expert-dialogue-list" label="协作对话">
      {messages.map((message, index) => (
        <Fragment key={message.id || `message-${index}`}>
          {turnDividerFor(message, index)}
          <ExpertDialogueMessage
            expert={expert}
            message={message}
            interactiveStructuredUi={message.id === latestAssistantId && !generating}
            onStructuredPick={onStructuredPick}
          >
            {showInitialOptions && message.id === firstAssistantId ? (
              <div className="wb-expert-route-choices" aria-label="选择协作路径">
                <p>你想先处理哪类问题？</p>
                <div>
                  {initialOptions.map((option) => (
                    <button key={option.id} type="button" onClick={() => onInitialOption?.(option)}>
                      <strong>{option.label}</strong>
                      {option.description ? <span>{option.description}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </ExpertDialogueMessage>
        </Fragment>
      ))}
      {generating && !messages.some((message) => message.streaming) ? (
        <ExpertDialoguePending />
      ) : null}
      {afterMessages}
    </ExpertConversationTimeline>
  )
}

export function ExpertCollabDialogue({
  expert,
  messages,
  generating = false,
  composer = true,
  bare = false,
  onStructuredPick,
  afterMessages,
  initialOptions = [],
  onInitialOption,
}: {
  expert: CapabilityItem
  messages: import('../../../shared/api').ChatMessage[]
  generating?: boolean
  composer?: boolean
  bare?: boolean
  onStructuredPick?: (payload: string, needsInput: boolean) => void
  afterMessages?: ReactNode
  initialOptions?: ExpertWorkbenchRoute[]
  onInitialOption?: (option: ExpertWorkbenchRoute) => void
}) {
  if (bare) {
    return <ExpertDialogueMessages expert={expert} messages={messages} generating={generating} onStructuredPick={onStructuredPick} afterMessages={afterMessages} initialOptions={initialOptions} onInitialOption={onInitialOption} />
  }
  return (
    <TaskDialogueShell
      variant="expert"
      launch={false}
      label="专家协作对话"
      logTestId="expert-collab-log"
      showComposer={composer}
    >
      <ExpertDialogueMessages
        expert={expert}
        messages={messages}
        generating={generating}
        onStructuredPick={onStructuredPick}
        afterMessages={afterMessages}
        initialOptions={initialOptions}
        onInitialOption={onInitialOption}
      />
    </TaskDialogueShell>
  )
}
