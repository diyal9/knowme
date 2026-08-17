import type { PointerEvent, ReactNode } from 'react'
import type { StudioCanvasNode } from '../../../domain/studio-canvas'
import { studioIconForKind } from '../../../domain/studio-canvas'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

type Props = {
  node: StudioCanvasNode
  checkMark?: string
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onPortDown: (nodeId: string, branch?: string, event?: PointerEvent) => void
  onPortUp: (nodeId: string) => void
  onDragStart: (nodeId: string, event: PointerEvent) => void
}

function NodePorts({ node, onPortDown, onPortUp }: Pick<Props, 'node' | 'onPortDown' | 'onPortUp'>) {
  const kind = node.kind
  const ports: ReactNode[] = []
  if (node.canInput !== false && kind !== 'start') {
    ports.push(
      <span
        key="in-left"
        className="wb-studio-port wb-studio-port--in side-left"
        data-studio-port="in"
        data-studio-side="left"
        title="入口 · 左"
        aria-hidden="true"
        onPointerUp={(e) => { e.stopPropagation(); onPortUp(node.id) }}
      />,
      <span
        key="in-top"
        className="wb-studio-port wb-studio-port--in side-top"
        data-studio-port="in"
        data-studio-side="top"
        title="入口 · 上"
        aria-hidden="true"
        onPointerUp={(e) => { e.stopPropagation(); onPortUp(node.id) }}
      />,
    )
  }
  if (node.canOutput !== false && kind !== 'end') {
    if (kind === 'condition') {
      ports.push(
        <span
          key="out-true"
          className="wb-studio-port wb-studio-port--out side-right branch-true"
          data-studio-port="out"
          data-studio-side="right"
          data-studio-branch="true"
          title="成立"
          aria-hidden="true"
          onPointerDown={(e) => { e.stopPropagation(); onPortDown(node.id, 'true', e) }}
        />,
        <span
          key="out-false"
          className="wb-studio-port wb-studio-port--out side-right branch-false"
          data-studio-port="out"
          data-studio-side="right"
          data-studio-branch="false"
          title="不成立"
          aria-hidden="true"
          onPointerDown={(e) => { e.stopPropagation(); onPortDown(node.id, 'false', e) }}
        />,
      )
    } else {
      ports.push(
        <span
          key="out-right"
          className="wb-studio-port wb-studio-port--out side-right"
          data-studio-port="out"
          data-studio-side="right"
          title="出口 · 右"
          aria-hidden="true"
          onPointerDown={(e) => { e.stopPropagation(); onPortDown(node.id, undefined, e) }}
        />,
        <span
          key="out-bottom"
          className="wb-studio-port wb-studio-port--out side-bottom"
          data-studio-port="out"
          data-studio-side="bottom"
          title="出口 · 下"
          aria-hidden="true"
          onPointerDown={(e) => { e.stopPropagation(); onPortDown(node.id, undefined, e) }}
        />,
      )
    }
  }
  return <>{ports}</>
}

export function StudioCanvasNodeCard({
  node,
  checkMark,
  onSelect,
  onRemove,
  onPortDown,
  onPortUp,
  onDragStart,
}: Props) {
  const openContextMenu = useAppStore((s) => s.openContextMenu)
  const hubItems = useAppStore((s) => s.hubItems)
  const kind = node.kind
  const title = node.title || node.name || node.id
  const removable = kind !== 'start' && kind !== 'end'
  const boundExpert = kind === 'agent' && node.agentPackageId
    ? hubItems.find((item) => item.id === node.agentPackageId)
    : undefined

  return (
    <article
      className={`wb-studio-flow-node is-summary kind-${kind}${node.selected ? ' active' : ''}${checkMark ? ` is-check-${checkMark}` : ''}`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      data-studio-node={node.id}
      data-studio-kind={kind}
      role="group"
      aria-pressed={node.selected}
      aria-label={title}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-studio-port]')) return
        onDragStart(node.id, e)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      onContextMenu={(e) => {
        if (!removable) return
        e.preventDefault()
        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [{
            id: 'remove-node',
            label: '删除节点',
            danger: true,
            onClick: () => onRemove(node.id),
          }],
        })
      }}
    >
      <NodePorts node={node} onPortDown={onPortDown} onPortUp={onPortUp} />
      <header className="wb-studio-flow-head">
        {boundExpert ? (
          <ExpertAvatarMark agent={boundExpert} className="wb-studio-flow-icon" size={24} />
        ) : (
          <span className="wb-studio-flow-icon" aria-hidden="true">
            <Icon name={studioIconForKind(kind)} />
          </span>
        )}
        <span className="wb-studio-flow-titles">
          {node.typeLabel ? <em className="wb-studio-flow-type">{node.typeLabel}</em> : null}
          <strong title={title}>{title}</strong>
          {node.subtitle ? <small title={node.subtitle}>{node.subtitle}</small> : null}
        </span>
        {removable ? (
          <span className="wb-studio-flow-node-tools">
            <button
              type="button"
              className="wb-studio-node-action danger"
              data-studio-remove
              title="删除节点"
              aria-label="删除节点"
              onClick={(e) => { e.stopPropagation(); onRemove(node.id) }}
            >
              ×
            </button>
          </span>
        ) : null}
      </header>
      <div className="wb-studio-flow-sections">
        {(node.sections || []).map((section) => (
          <div key={`${node.id}-${section.title || 'section'}`} className="wb-studio-flow-section">
            {section.title ? <div className="wb-studio-flow-section-title">{section.title}</div> : null}
            {(section.rows || []).map((row) => (
              <div
                key={row}
                className={`wb-studio-flow-row${section.tone ? ` tone-${section.tone}` : ''}`}
              >
                {row}
              </div>
            ))}
          </div>
        ))}
      </div>
    </article>
  )
}
