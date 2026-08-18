/**
 * 助理模式头像标记 + Session Tab 右键菜单。
 * 右键只操作本条会话；不负责 ⋯ 菜单与历史弹出。
 */
import { BUILTIN_ASSISTANT_MODES } from '../../../domain/assistant-modes'
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
  style,
  onAction,
}: {
  sessionId: string
  style: { left: number; top: number }
  onAction: (action: string, sessionId: string) => void
}) {
  return (
    <div
      className="agent-pop tab-ctx-pop show"
      data-testid="agent-tab-ctx"
      style={style}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('rename', sessionId)}>
        <Icon name="edit" /><span>重命名</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => onAction('transcript', sessionId)}>
        <Icon name="copy" /><span>复制对话记录</span>
      </button>
      <button type="button" className="agent-pop-item" role="menuitem" onClick={() => { void onAction('close', sessionId) }}>
        <Icon name="close" /><span>关闭</span>
      </button>
    </div>
  )
}
