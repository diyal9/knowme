import type { ReactNode } from 'react'
import { AgentComposer } from '../assistant/AgentComposer'

export type TaskDialoguePrompt = { title: string; subtitle: string; prompt: string }

export function TaskDialogueLaunch({
  mark,
  kicker,
  title,
  caps,
  meta,
  emptyClass,
  emptyLabel,
  prompts,
  composerExtraClass,
  onPrompt,
}: {
  mark: ReactNode
  kicker: string
  title: string
  caps: string[]
  meta?: string
  emptyClass: string
  emptyLabel: string
  prompts: TaskDialoguePrompt[]
  composerExtraClass?: string
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className={`agent-empty-tips ${emptyClass}`} aria-label={emptyLabel}>
      <div className="agent-collab-head">
        {mark}
        <div className="agent-collab-copy">
          <span className="agent-collab-kicker">{kicker}</span>
          <strong>{title}</strong>
          <div className="agent-collab-caps">
            {caps.filter(Boolean).map((cap) => <span key={cap}>{cap}</span>)}
          </div>
          {meta ? (
            <div className="agent-collab-meta"><span>{meta}</span></div>
          ) : null}
        </div>
      </div>
      <div className="agent-home-composer-mount" data-agent-composer-mount="">
        <div className="agent-col-foot">
          <AgentComposer extraClass={composerExtraClass} surface="workbench" />
        </div>
      </div>
      <div className="agent-collab-section"><span>一起开始</span></div>
      <div className="agent-collab-actions">
        {prompts.map((item) => (
          <button
            key={item.title}
            type="button"
            className="agent-collab-act"
            onClick={() => onPrompt(item.prompt)}
          >
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
