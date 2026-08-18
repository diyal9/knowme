/**
 * 助理列生成过程条：接 store 的 assistantStatus / processFeed。
 * 只在生成中挂到对话列表底部，不钉在输入框上；结束后错误只留在气泡里。
 */
import { useAppStore } from '../../app/store'

export function AssistantStreamStatus() {
  const isGenerating = useAppStore((s) => s.isGenerating)
  const status = useAppStore((s) => s.assistantStatus)
  const feed = useAppStore((s) => s.assistantProcessFeed)

  if (!isGenerating) return null
  const line = String(feed || status || '').trim()
  if (!line) return null

  return (
    <div
      className="agent-stream-timing"
      data-testid="assistant-stream-status"
      role="status"
      aria-live="polite"
    >
      {line}
    </div>
  )
}
