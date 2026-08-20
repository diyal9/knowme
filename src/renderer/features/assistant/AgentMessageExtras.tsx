import type { ChatMessage } from '../../../shared/api'
import { buildGroundingMetaView, formatGroundingSourceLine } from '../../../domain/agent-grounding-meta'

export function AgentGroundingMeta({ message }: { message: ChatMessage }) {
  const view = buildGroundingMetaView(message.groundingStatus)
  if (!view || message.streaming) return null
  return (
    <div className={`agent-grounding-meta ${view.className}`} role="status">
      <span className="agent-grounding-badge">{view.badge}</span>
      {view.violationText ? <p className="agent-grounding-note">{view.violationText}</p> : null}
      {view.sources.length ? (
        <details className="agent-grounding-sources">
          <summary>{`查看来源（${view.sources.length}）`}</summary>
          <ul>
            {view.sources.slice(0, 5).map((source, index) => (
              <li key={`${source.tool}-${index}`}>
                <span className="agent-grounding-source-name">{formatGroundingSourceLine(source).split(' · ')[0]}</span>
                {' · '}
                {formatGroundingSourceLine(source).split(' · ')[1]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export function AgentStructuredUi({
  message,
  onPick,
}: {
  message: ChatMessage
  onPick: (payload: string, needsInput: boolean) => void
}) {
  const bars = message.structuredUi || []
  if (!bars.length || message.streaming) return null
  const chosenIndex = message.suggestionChosenIndex ?? -1
  return (
    <div className="agent-structured-ui" data-structured-ui="1">
      {bars.map((bar, barIndex) => {
        const decided = chosenIndex >= 0
        return (
          <div
            key={`${bar.title}-${barIndex}`}
            className={`agent-suggest structured-choice${decided ? ' is-decided' : ''}`}
            role="group"
            aria-label={`${bar.title || '结构化选择'}，${decided ? '已选择' : '选择一项'}`}
          >
            <div className="agent-suggest-head">
              <div className="agent-suggest-title">{bar.title || '结构化选择'}</div>
              <span>{decided ? '已选择' : '选择一项'}</span>
            </div>
            <div className="agent-suggest-list">
              {bar.items.map((item, index) => {
                const selected = decided && index === chosenIndex
                const needsInput = item.action === 'fill' || /补充|填写|输入|说明|描述|背景|上下文|澄清|手动/.test(`${item.label} ${item.description || ''} ${item.payload || ''}`)
                return (
                  <button
                    key={`${item.id || item.label}-${index}`}
                    type="button"
                    className={`agent-suggest-item${selected ? ' is-selected' : ''}`}
                    disabled={decided}
                    onClick={() => onPick(item.payload || item.label, needsInput)}
                  >
                    <span className="sug-choice" aria-hidden="true">{index + 1}</span>
                    <span className="sug-copy">
                      <strong>{item.label}</strong>
                      {item.description ? <span className="sug-desc">{item.description}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AgentFollowUps({
  body,
  userInput,
  onPick,
}: {
  body: string
  userInput?: string
  onPick: (prompt: string) => void
}) {
  // 底部建议必须来自模型明确声明的 structuredUi；不再根据正文关键词推测操作。
  void body
  void userInput
  void onPick
  return null
}
