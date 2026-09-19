import { BackButton } from '../../app/BackButton'
import { useEffect, useState } from 'react'

export function DialogueStatusBar({
  mode,
  title,
  meta,
  state,
  stateTone,
  onBack,
  onTitleChange,
  backLabel = '返回',
}: {
  mode: string
  title?: string
  meta?: string
  state?: string
  stateTone?: string
  onBack: () => void
  onTitleChange?: (title: string) => void | Promise<void>
  backLabel?: string
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title || '')

  useEffect(() => {
    if (!editingTitle) setDraftTitle(title || '')
  }, [editingTitle, title])

  async function commitTitle() {
    const next = draftTitle.trim()
    setEditingTitle(false)
    if (!next || next === String(title || '').trim()) return
    await onTitleChange?.(next)
  }

  return (
    <header className="agent-dialogue-status-bar" aria-label="任务对话状态">
      <span className="agent-dialogue-status-mode" data-mode={mode}>{mode}</span>
      {title ? (editingTitle && onTitleChange ? (
        <input
          className="agent-dialogue-status-title-input"
          value={draftTitle}
          aria-label="编辑协作标题"
          autoFocus
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commitTitle()
            if (event.key === 'Escape') { setDraftTitle(title); setEditingTitle(false) }
          }}
        />
      ) : onTitleChange ? (
        <button type="button" className="agent-dialogue-status-title agent-dialogue-status-title-editable" title="点击修改标题" onClick={() => setEditingTitle(true)}>
          {title}
        </button>
      ) : (
        <span className="agent-dialogue-status-title" title={title}>{title}</span>
      )) : null}
      {meta ? (
        <span className="agent-dialogue-status-meta" id="agentDialogueStatusMeta">{meta}</span>
      ) : (
        <span className="agent-dialogue-status-meta" id="agentDialogueStatusMeta" hidden />
      )}
      {state ? (
        <span
          className={`agent-dialogue-status-state${stateTone ? ` tone-${stateTone}` : ''}`}
          id="agentDialogueStatusState"
          role="status"
          aria-label={`当前协作状态：${state}`}
        >
          {state}
        </span>
      ) : (
        <span className="agent-dialogue-status-state" id="agentDialogueStatusState" hidden />
      )}
      <BackButton label={backLabel} compact onClick={onBack} />
    </header>
  )
}
