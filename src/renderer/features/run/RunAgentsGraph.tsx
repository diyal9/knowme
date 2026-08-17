import type { RunGraphNode } from '../../../domain/run-projection'
import { graphNodeStatusClass } from '../../../domain/run-projection'

export function RunAgentsSection({
  agents,
  currentOwner,
}: {
  agents: { id: string; name: string; role?: string }[]
  currentOwner: string
}) {
  return (
    <section className="wb-run-section wb-run-agents-section" aria-labelledby="wbRunAgentsTitle">
      <div className="wb-run-section-title-row">
        <div className="wb-run-section-title" id="wbRunAgentsTitle">参与专家</div>
      </div>
      <div className="wb-run-agents" id="wbRunAgents" data-testid="run-agents">
        {agents.length ? agents.map((agent) => {
          const label = agent.name || agent.id
          const active = currentOwner && (label === currentOwner || agent.id === currentOwner)
          return (
            <span key={agent.id || label} className={`wb-run-agent${active ? ' is-active' : ''}`}>
              {label}{active ? ' · 当前' : ''}
            </span>
          )
        }) : (
          <span className="wb-run-muted">等待流程加载参与角色…</span>
        )}
      </div>
    </section>
  )
}

export function RunGraphSection({
  nodes,
  degraded,
}: {
  nodes: RunGraphNode[]
  degraded: boolean
}) {
  if (degraded) return null
  return (
    <section className="wb-run-section" aria-labelledby="wbRunGraphTitle">
      <div className="wb-run-section-title" id="wbRunGraphTitle">执行节点</div>
      <div className="wb-run-graph" id="wbRunGraph" data-testid="run-graph">
        {nodes.length ? nodes.map((node) => {
          const status = graphNodeStatusClass(node.status)
          return (
            <div
              key={node.id}
              className={`wb-graph-node ${status}${node.degraded || node.degradedPlaceholder ? ' degraded' : ''}`}
            >
              <span className="wb-graph-marker" aria-hidden="true" />
              <span className="wb-graph-copy">
                <strong>{node.label}</strong>
                <small>{node.meta}</small>
                {node.handoff ? <small className="wb-graph-handoff">交接 · {node.handoff}</small> : null}
              </span>
            </div>
          )
        }) : (
          <span className="wb-run-muted">等待流程加载执行节点…</span>
        )}
      </div>
    </section>
  )
}
