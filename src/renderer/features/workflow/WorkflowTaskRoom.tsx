import { useEffect } from 'react'
import {
  workbenchTaskBackLabel,
  workbenchTaskModeLabel,
  workbenchTaskStateLabel,
} from '../../../domain/workbench-task-room'
import { graphNodeStatusClass } from '../../../domain/run-projection'
import { useAppStore } from '../../app/store'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { Icon } from '../../app/Icon'

export function WorkflowTaskRoom() {
  const run = useAppStore((s) => s.run)
  const returnToShelf = useAppStore((s) => s.returnToShelf)
  const refreshRunTelemetry = useAppStore((s) => s.refreshRunTelemetry)
  const hitlDecide = useAppStore((s) => s.hitlDecide)
  const rerun = useAppStore((s) => s.rerun)

  useEffect(() => {
    if (!run || run.lane !== 'workflow' || run.phase === 'input') return
    if (run.phase === 'done' && run.graphNodes.length) return
    void refreshRunTelemetry()
    if (run.phase === 'done') return
    const timer = window.setInterval(() => { void refreshRunTelemetry() }, 1600)
    return () => window.clearInterval(timer)
  }, [run?.lane, run?.slug, run?.phase, run?.graphNodes.length, refreshRunTelemetry])

  if (!run || run.lane !== 'workflow') return null
  const needsAttention = run.phase === 'hitl'
  const resultNodes = run.graphNodes.filter((node) => {
    const result = node.outputLabel.trim()
    if (!result) return false
    return !['workflow completed', 'terminal completed', 'start ready', 'parallel ready'].includes(result.toLowerCase())
  })
  const completedNodeCount = run.graphNodes.filter((node) => graphNodeStatusClass(node.status) === 'done').length
  const failedNodeCount = run.graphNodes.filter((node) => graphNodeStatusClass(node.status) === 'error').length
  const activeNode = run.graphNodes.find((node) => graphNodeStatusClass(node.status) === 'active')
  const phaseLabel = failedNodeCount ? '运行失败' : workbenchTaskStateLabel('workflow-chat', run.phase)

  return (
    <div className="wb-workflow-run" data-testid="workflow-run">
      <DialogueStatusBar
        mode={workbenchTaskModeLabel('workflow-chat')}
        title={run.workflowName}
        onBack={returnToShelf}
        backLabel={workbenchTaskBackLabel('workflow-chat')}
      />

      <main className="wb-workflow-run-main" data-testid="workflow-run-control-panel">
          <header className="wb-workflow-run-overview">
            <div className="wb-workflow-run-overview-head">
              <div>
                <h2>{run.workflowName}</h2>
              </div>
              <span className={`wb-workflow-run-state is-${run.phase}`}>{phaseLabel}</span>
            </div>
            <div className="wb-workflow-run-objective">
              <span>本次目标</span>
              <p>{run.brief || '未填写运行目标'}</p>
            </div>
            <div className="wb-workflow-run-facts">
              <div><span>节点进度</span><strong>{completedNodeCount} / {run.graphNodes.length || '—'}</strong></div>
              <div><span>当前处理</span><strong>{run.phase === 'done' ? '全部结束' : activeNode?.label || run.currentOwner || '等待调度'}</strong></div>
              <div><span>交付结果</span><strong>{run.artifacts.length + resultNodes.length} 项</strong></div>
            </div>
            <progress
              className="wb-workflow-run-progress"
              value={run.graphNodes.length ? completedNodeCount : run.phase === 'done' ? 1 : 0}
              max={run.graphNodes.length || 1}
              aria-label={`已完成 ${completedNodeCount} 个，共 ${run.graphNodes.length} 个节点`}
            />
          </header>

          {needsAttention ? (
            <section className="wb-workflow-attention" data-testid="workflow-needs-attention">
              <div>
                <strong>需要我处理</strong>
                <span>{run.gateTitle || '请审阅当前节点的交付，再决定是否继续。'}</span>
              </div>
              <div>
                <button type="button" className="wb-modal-btn" onClick={() => hitlDecide(false)}>退回</button>
                <button type="button" className="wb-modal-btn primary" onClick={() => hitlDecide(true)}>确认并继续</button>
              </div>
            </section>
          ) : null}

          <section className="wb-workflow-run-section" aria-labelledby="workflowRunGraphTitle">
            <header className="wb-workflow-run-section-head">
              <div><span className="wb-workflow-eyebrow">执行路径</span><h3 id="workflowRunGraphTitle">流程节点</h3></div>
              <span>{run.graphNodes.length ? `${completedNodeCount} / ${run.graphNodes.length} 已完成` : '等待节点数据'}</span>
            </header>
            <div className="wb-workflow-graph" aria-label="工作流节点">
              {run.graphNodes.map((node, index) => {
                const tone = graphNodeStatusClass(node.status)
                const selected = run.selectedNodeId === node.id
                return (
                  <div key={node.id} className="wb-workflow-graph-row">
                    <button
                      type="button"
                      className={`wb-workflow-graph-node is-${tone}${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => {
                        const current = useAppStore.getState().run
                        if (current) useAppStore.setState({ run: { ...current, selectedNodeId: selected ? null : node.id } })
                      }}
                    >
                      <span className="wb-workflow-graph-index">{tone === 'done' ? <Icon name="check" /> : index + 1}</span>
                      <span className="wb-workflow-graph-copy">
                        <strong>{node.label}</strong>
                        <span>{node.meta}{node.owner ? ` · ${node.owner}` : ''}</span>
                      </span>
                      <span className="wb-workflow-graph-status">{tone === 'done' ? '已完成' : tone === 'active' ? '执行中' : tone === 'error' ? '未通过' : '待执行'}</span>
                    </button>
                    {selected ? (
                      <div className="wb-workflow-node-detail">
                        <span>{node.outputLabel ? '节点结果' : '节点状态'}</span>
                        <p>{node.outputLabel || (tone === 'active' ? '该节点正在处理，完成后会在这里显示结果。' : tone === 'error' ? '该节点未通过，请根据运行记录调整后重试。' : '该节点尚未产生可查看的结果。')}</p>
                      </div>
                    ) : null}
                    {index < run.graphNodes.length - 1 ? <span className="wb-workflow-graph-edge" aria-hidden="true"><Icon name="chevronRight" /></span> : null}
                  </div>
                )
              })}
              {!run.graphNodes.length ? (
                <div className="wb-workflow-run-empty">
                  <Icon name="workflow" />
                  <div><strong>{run.phase === 'done' ? '尚未恢复到流程节点' : '正在同步流程节点'}</strong><span>{run.phase === 'done' ? '重新读取运行记录，或返回工作流检查节点配置。' : '节点启动后会依次显示在这里。'}</span></div>
                  {run.phase === 'done' ? <button type="button" className="wb-modal-btn" onClick={() => void refreshRunTelemetry()}>重新读取</button> : null}
                </div>
              ) : null}
            </div>
          </section>

          {run.phase === 'done' ? (
            <footer className="wb-workflow-run-footer">
              <button type="button" className="wb-modal-btn primary" onClick={rerun}><Icon name="refresh" />再运行一次</button>
            </footer>
          ) : null}
      </main>
    </div>
  )
}
