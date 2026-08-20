import { useState } from 'react'
import * as AgenticProfile from '@knowme-lib/expert-agentic-profile'

const agenticTypeOptions = (AgenticProfile as any).agenticTypeOptions as () => Array<{
  id: string
  label: string
  hint: string
}>
const normalizeAgenticConfig = (AgenticProfile as any).normalizeAgenticConfig as (...args: any[]) => Record<string, unknown>
const normalizeAgenticType = (AgenticProfile as any).normalizeAgenticType as (type: string) => string

type Props = {
  agenticType: string
  agenticConfig: Record<string, unknown>
  onTypeChange: (type: string, config: Record<string, unknown>) => void
  onConfigChange: (config: Record<string, unknown>) => void
}

function asConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
  return normalizeAgenticConfig(type, config) as Record<string, unknown>
}

function Flag({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: string
}) {
  return (
    <label className="hub-flag">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="hub-check-box" aria-hidden="true" />
      <span className="hub-flag-text">{children}</span>
    </label>
  )
}

export function HubAgenticFields({ agenticType, agenticConfig, onTypeChange, onConfigChange }: Props) {
  const [open, setOpen] = useState(false)
  const type = normalizeAgenticType(agenticType)
  const options = agenticTypeOptions() as Array<{ id: string; label: string; hint: string }>
  const current = options.find((item) => item.id === type) || options[2]
  const cfg = asConfig(type, agenticConfig)

  function patch(next: Record<string, unknown>) {
    onConfigChange(asConfig(type, { ...cfg, ...next }))
  }

  return (
    <section className="hub-expert-section">
      <header className="hub-expert-section-head">
        <div>
      <h3>智能体类型</h3>
          <p>决定专家如何思考、用工具和推进任务。</p>
        </div>
      </header>
      <div className={`hub-field hub-select${open ? ' open' : ''}`}>
        <input id="hubExpertAgenticType" type="hidden" value={type} readOnly />
        <button
          type="button"
          className="hub-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="AgenticType"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{current?.label || type}</span>
          <span className="hub-select-caret" aria-hidden="true" />
        </button>
        <div className="hub-select-menu" hidden={!open} role="listbox">
          {options.map((option, index) => (
            <div key={option.id}>
              {index > 0 ? <div className="hub-select-sep" /> : null}
              <button
                type="button"
                role="option"
                aria-selected={option.id === type}
                className={`hub-select-option${option.id === type ? ' selected' : ''}`}
                onClick={() => {
                  onTypeChange(option.id, asConfig(option.id, cfg))
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </div>
          ))}
        </div>
        <small>{current?.hint}</small>
      </div>
      {type === 'react' ? (
        <div className="hub-flag-row">
          <Flag checked={cfg.enableTools !== false} onChange={(value) => patch({ enableTools: value })}>允许使用工具</Flag>
          <Flag checked={cfg.enableReflection !== false} onChange={(value) => patch({ enableReflection: value })}>允许反思修订</Flag>
        </div>
      ) : null}
      {type === 'planning' ? (
        <div className="hub-flag-row">
          <Flag checked={cfg.planFirst !== false} onChange={(value) => patch({ planFirst: value })}>复杂任务先给路线图</Flag>
          <Flag checked={cfg.requirePlanConfirmation === true} onChange={(value) => patch({ requirePlanConfirmation: value })}>计划需用户确认后再执行</Flag>
        </div>
      ) : null}
      {type === 'reflection' ? (
        <div className="hub-form-grid">
          <div className="hub-field">
            <label htmlFor="hubExpertReflectRounds">自检轮数</label>
            <input
              id="hubExpertReflectRounds"
              type="number"
              min={1}
              max={5}
              value={Number(cfg.maxReflectionRounds || 2)}
              onChange={(e) => patch({ maxReflectionRounds: Number(e.target.value) })}
            />
          </div>
          <div className="hub-field">
            <label htmlFor="hubExpertChecklist">验收清单</label>
            <input
              id="hubExpertChecklist"
              value={String(cfg.acceptanceChecklist || '')}
              onChange={(e) => patch({ acceptanceChecklist: e.target.value })}
              placeholder="交付前必须核对的要点"
            />
          </div>
        </div>
      ) : null}
      {type === 'tool_use' ? (
        <div className="hub-field">
          <label htmlFor="hubExpertToolHint">优先通道提示</label>
          <input
            id="hubExpertToolHint"
            value={String(cfg.requiredConnectorHint || '')}
            onChange={(e) => patch({ requiredConnectorHint: e.target.value })}
            placeholder="例如：优先查飞书文档"
          />
        </div>
      ) : null}
      {type === 'multi_agent' ? (
        <div className="hub-field">
          <label htmlFor="hubExpertDelegation">委派条件</label>
          <textarea
            id="hubExpertDelegation"
            value={String(cfg.delegationHints || '')}
            onChange={(e) => patch({ delegationHints: e.target.value })}
            placeholder="什么情况下把工作交给其他专家"
          />
        </div>
      ) : null}
    </section>
  )
}
