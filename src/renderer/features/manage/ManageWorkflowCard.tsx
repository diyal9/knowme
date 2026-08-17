/**
 * 「我的工作流」维护卡：仅图标按钮触发编辑 / 复制 / 删除（与基线一致，整卡不可点）。
 * 简要流程优先显示专家中文名。
 */
import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'

function ManageBriefFlow({ labels }: { labels: string[] }) {
  if (!labels.length) {
    return (
      <span className="wb-workflow-manage-flow-step" title="按系统默认顺序调度">
        按系统默认顺序调度
      </span>
    )
  }
  return (
    <>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index ? <span className="wb-workflow-manage-flow-sep" aria-hidden="true">→</span> : null}
          <span className="wb-workflow-manage-flow-step" title={label}>{label}</span>
        </span>
      ))}
    </>
  )
}

type Props = {
  card: ShelfCardModel
  /** packageId → 展示名，用于把简要流程里的 office-partner 显示成「办公伙伴」。 */
  expertNames?: Record<string, string>
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
}

function resolveFlowLabels(card: ShelfCardModel, expertNames?: Record<string, string>): string[] {
  return (card.stepLabels || []).map((label) => {
    const key = String(label || '').trim()
    if (!key) return key
    return expertNames?.[key] || key
  }).filter(Boolean)
}

export function ManageWorkflowCard({ card, expertNames, onEdit, onCopy, onDelete }: Props) {
  const metaBits = [
    `${card.stepCount} 步`,
    card.backendLabel,
    card.source === 'forked' ? '复制自共享流程' : '',
  ].filter(Boolean)
  const flowLabels = resolveFlowLabels(card, expertNames)

  return (
    <article
      className="wb-workflow-manage-item"
      data-workflow-id={card.id}
      data-domain={card.domain}
      data-testid={`workflow-card-${card.id}`}
    >
      <div className="wb-workflow-manage-top">
        <span className="wb-shelf-mark" aria-hidden="true">
          <Icon name={card.markIcon} />
        </span>
        <div className="wb-workflow-manage-copy">
          <div className="wb-workflow-manage-title-row">
            <strong>{card.name}</strong>
          </div>
          <span>{card.description || '个人工作流，可在编排中继续完善。'}</span>
          <ul className="wb-workflow-manage-chips" aria-label="能力摘要">
            <li className="wb-workflow-manage-chip" title={card.inputLabel}>
              <span className="k">输入</span>
              <span className="v">{card.inputLabel}</span>
            </li>
            <li className="wb-workflow-manage-chip" title={card.outcomeLabel}>
              <span className="k">产出</span>
              <span className="v">{card.outcomeLabel}</span>
            </li>
          </ul>
          <small>{metaBits.join(' · ')}</small>
        </div>
        <div className="wb-workflow-manage-actions">
          <button type="button" className="wb-shelf-icon-btn" title="复制" aria-label="复制" onClick={onCopy}>
            <Icon name="copy" />
          </button>
          <button
            type="button"
            className="wb-shelf-icon-btn"
            title="编辑"
            aria-label="编辑"
            data-testid={`workflow-edit-${card.id}`}
            onClick={onEdit}
          >
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="wb-shelf-icon-btn is-danger"
            title="删除"
            aria-label="删除"
            data-testid={`workflow-delete-${card.id}`}
            onClick={onDelete}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <div className="wb-workflow-manage-bottom">
        <div className="wb-workflow-manage-flow-label">简要流程</div>
        <div className="wb-workflow-manage-flow" aria-label="简要流程">
          <ManageBriefFlow labels={flowLabels} />
        </div>
      </div>
    </article>
  )
}
