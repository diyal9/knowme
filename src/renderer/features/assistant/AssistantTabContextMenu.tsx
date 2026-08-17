import { BUILTIN_ASSISTANT_MODES } from '../../../domain/assistant-modes'
import type { AgentSession } from '../../../shared/api'
import { Icon } from '../../app/Icon'
import { resolveExpertAvatarUrl } from '../../lib/resolve-expert-avatar'

export function ModeAvatarMark({
  modeId,
  size = 18,
  className = '',
}: {
  modeId: string
  size?: number
  className?: string
}) {
  const mode = BUILTIN_ASSISTANT_MODES.find((item) => item.id === modeId)
  const src = mode ? resolveExpertAvatarUrl({ id: mode.id, name: mode.name, avatar: mode.avatar }) : ''
  if (src) {
    return (
      <img
        className={`agent-avatar-photo${className ? ` ${className}` : ''}`}
        src={src}
        alt=""
        width={size}
        height={size}
        decoding="async"
      />
    )
  }
  return <Icon name="chat" />
}

export function AssistantTabContextMenu({
  sessionId,
  sessions,
  style,
  onAction,
}: {
  sessionId: string
  sessions: AgentSession[]
  style: { left: number; top: number }
  onAction: (action: string, sessionId: string) => void
}) {
  const orderedIds = sessions.map((item) => item.id)
  const currentIndex = orderedIds.indexOf(sessionId)
  const leftIds = currentIndex > 0 ? orderedIds.slice(0, currentIndex) : []
  const rightIds = currentIndex >= 0 ? orderedIds.slice(currentIndex + 1) : []
  const otherIds = orderedIds.filter((id) => id !== sessionId)
  const pinned = sessions.find((item) => item.id === sessionId)?.pinned === true

  return (
    <div
      className="agent-pop tab-ctx-pop show"
      data-testid="agent-tab-ctx"
      style={style}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('manage', sessionId)}>
        <Icon name="settingsLine" /><span>管理对话</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('transcript', sessionId)}>
        <Icon name="copy" /><span>复制对话记录</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('rename', sessionId)}>
        <Icon name="edit" /><span>重命名</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('pin', sessionId)}>
        <Icon name="pin" /><span>{pinned ? '取消 Pin' : 'Pin'}</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('fork', sessionId)}>
        <Icon name="fork" /><span>分叉</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => { void onAction('close', sessionId) }}>
        <Icon name="close" /><span>关闭</span>
      </button>
      <div className="agent-pop-sep" />
      <button type="button" className="agent-pop-item" role="menuitem" disabled={!leftIds.length} onClick={() => onAction('close-left', sessionId)}>
        <Icon name="close" /><span>关闭左侧</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" disabled={!rightIds.length} onClick={() => onAction('close-right', sessionId)}>
        <Icon name="close" /><span>关闭右侧</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" disabled={!otherIds.length} onClick={() => onAction('close-others', sessionId)}>
        <Icon name="close" /><span>关闭其他</span>
      </button>
    </div>
  )
}
