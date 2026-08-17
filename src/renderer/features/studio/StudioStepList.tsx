import { STUDIO_END_ID, STUDIO_START_ID, studioStepListNodes, type StudioDraft } from '../../../domain/studio'

type Props = {
  draft: StudioDraft
  selectedNodeId: string
  onSelectNode: (id: string) => void
  onRemoveNode: (id: string) => void
}

function relationLabel(value?: string) {
  if (value === 'parallel') return '同时执行'
  if (value === 'approval') return '执行前确认'
  return '接着执行'
}

function stepLabel(kind: string, name?: string, id?: string) {
  if (kind === 'start' || id === STUDIO_START_ID) return name || '开始'
  if (kind === 'end' || id === STUDIO_END_ID) return name || '结束'
  return name || id || '步骤'
}

export function StudioStepList({ draft, selectedNodeId, onSelectNode, onRemoveNode }: Props) {
  const nodes = studioStepListNodes(draft)

  if (!nodes.length) {
    return (
      <div className="wb-studio-graph" id="wbStudioGraph" data-testid="studio-step-list">
        <div className="wb-studio-empty">
          <strong>先加入一位专家</strong>
          <span>推荐步骤：1）左侧加入专家；2）点击步骤填写目标；3）保存并测试。</span>
        </div>
      </div>
    )
  }

  return (
    <div className="wb-studio-graph" id="wbStudioGraph" data-testid="studio-step-list">
      {nodes.map((node, index) => {
        const system = node.kind === 'start' || node.kind === 'end'
          || node.id === STUDIO_START_ID || node.id === STUDIO_END_ID
        const label = stepLabel(node.kind, node.name, node.id)
        return (
          <div key={node.id} className="wb-studio-node-wrap" data-studio-position={index}>
            <article
              className={`wb-studio-node${node.id === selectedNodeId ? ' active' : ''}`}
              tabIndex={0}
              role="button"
              aria-pressed={node.id === selectedNodeId}
              aria-label={`第 ${index + 1} 步 ${label}`}
              data-studio-node={node.id}
              data-studio-kind={node.kind}
              onClick={() => onSelectNode(node.id)}
            >
              <div className="wb-studio-node-main">
                <span className="wb-studio-node-order">{index + 1}</span>
                <span className="wb-studio-node-copy">
                  <strong>{label}</strong>
                  <small>{system ? (node.kind === 'start' ? '入参与流程目标' : '出参与交付结果') : (node.intent || node.kind)}</small>
                </span>
                {system ? null : (
                  <span className="wb-studio-node-tools">
                    <button
                      type="button"
                      className="wb-studio-node-action danger"
                      data-studio-remove
                      title="移除"
                      aria-label={`移除${label}`}
                      onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id) }}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </article>
            {index < nodes.length - 1 ? (
              <div className="wb-studio-relation-chip">{relationLabel(node.relation)}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
