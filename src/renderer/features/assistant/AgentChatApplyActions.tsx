/** 助理气泡「应用到文件」菜单（CSS 已有 .agent-apply-*）。 */
import { useState } from 'react'
import { useAppStore } from '../../app/store'

export function AgentChatApplyActions({ text }: { text: string }) {
  const applyAssistantText = useAppStore((s) => s.applyAssistantText)
  const target = useAppStore((s) => s.assistantApplyTarget)
  const [open, setOpen] = useState(false)
  const body = String(text || '').trim()
  if (!body) return null

  return (
    <div className="agent-chat-actions" data-testid="agent-chat-actions">
      <div className={`agent-apply-wrap${open ? ' open' : ''}`}>
        <button
          type="button"
          className="agent-chat-act subtle"
          data-testid="agent-apply-menu"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          应用到文件{target?.path ? ` · ${target.path.split(/[/\\]/).pop()}` : ''}
        </button>
        <div className="agent-apply-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void applyAssistantText('insert', body)
            }}
          >
            插入光标
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void applyAssistantText('append', body)
            }}
          >
            追加文末
          </button>
          <button
            type="button"
            className="warn"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void applyAssistantText('replace', body)
            }}
          >
            替换全文…
          </button>
        </div>
      </div>
    </div>
  )
}
