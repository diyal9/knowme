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
  const flowLabels = resolveFlowLabels(card, expertNames)

  return (
    <article
      className="wb-workflow-manage-item wb-shelf-card"
      data-workflow-id={card.id}
      data-domain={card.domain}
      data-testid={`workflow-card-${card.id}`}
    >
      <div className="wb-shelf-card-top wb-workflow-manage-top">
        <span className="wb-shelf-mark" aria-hidden="true">
          <Icon name={card.markIcon} />
        </span>
        <div className="wb-shelf-card-copy wb-workflow-manage-copy">
          <div className="wb-shelf-title-row wb-workflow-manage-title-row">
            <h3>{card.name}</h3>
            <div className="wb-workflow-manage-actions" aria-label="工作流操作">
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
          <p className="wb-shelf-outcome">{card.description || '个人工作流，可在编排中继续完善。'}</p>
          <div className="wb-shelf-delivery" title={card.outcomeLabel}>
            <span><Icon name="clipboardCheck" /> 交付</span>
            <strong>{card.outcomeLabel}</strong>
          </div>
        </div>
      </div>
      <div className="wb-shelf-card-bottom wb-workflow-manage-bottom">
        <div className="wb-shelf-brief">
          <div className="wb-shelf-brief-label">
            <span>协作路径</span>
            <span>{card.stepCount} 个节点</span>
          </div>
          <div className="wb-shelf-brief-flow" aria-label="简要流程">
            <ManageBriefFlow labels={flowLabels} />
          </div>
        </div>
      </div>
    </article>
  )
}
