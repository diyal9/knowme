import { useEffect } from 'react'
import {
  workbenchTaskBackLabel,
  workbenchTaskModeLabel,
  workbenchTaskStateLabel,
} from '../../../domain/workbench-task-room'
import { graphNodeStatusClass, type RunGraphNode } from '../../../domain/run-projection'
import { useAppStore } from '../../app/store'
import { DialogueStatusBar } from '../workbench/DialogueStatusBar'
import { Icon } from '../../app/Icon'

function workflowNodeTone(node: RunGraphNode, index: number, failedIndex: number, runFinished: boolean, runFailed: boolean) {
  if (runFinished && !runFailed) return 'done'
  if (runFailed && failedIndex >= 0) {
    if (index === failedIndex) return 'error'
    if (index > failedIndex) return 'pending'
    return 'done'
  }
  return graphNodeStatusClass(node.status)
}

function workflowBriefSummary(value: string) {
  const parts = String(value || '').split(/\s*补充要求[:：]\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) return parts[0] || '未填写运行目标'
  return `${parts[0]}\n补充要求：${parts.at(-1)}`
}

function isVisibleResult(value: string) {
  const text = String(value || '').trim()
  if (!text) return false
  const normalized = text.replace(/[*_`#>\s]/g, '').toLowerCase()
  return !['processstarted', 'processrestarted', 'workflowcompleted', 'terminalcompleted', 'startready', 'parallelready'].includes(normalized)
    && !/工具调用未成功|未注册工具|请根据报错|\b(?:error|failed)\b|执行失败|调用失败/i.test(text)
}

function workflowNodeStatusLabel(tone: string) {
  if (tone === 'done') return '已完成'
  if (tone === 'active') return '执行中'
  if (tone === 'error') return '未通过'
  return '待执行'
}

function nodeTypeLabel(meta: string) {
  if (/gate|确认|人工/i.test(meta)) return '人工确认'
  if (/agent|专家/i.test(meta)) return '专家节点'
  if (/tool|action|工具/i.test(meta)) return '工具节点'
  if (/terminal|结束/i.test(meta)) return '结束节点'
  return '流程节点'
}

export function WorkflowTaskRoom() {
  const run = useAppStore((s) => s.run)
  const returnToShelf = useAppStore((s) => s.returnToShelf)
  const refreshRunTelemetry = useAppStore((s) => s.refreshRunTelemetry)
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

  const failed = run.graphNodes.some((node) => graphNodeStatusClass(node.status) === 'error')
    || ['failed', 'error', 'interrupted'].includes(run.daemonStatus.toLowerCase())
  const runFinished = run.phase === 'done'
  const failedNode = run.graphNodes.find((node) => node.id === run.currentOwner && graphNodeStatusClass(node.status) === 'error')
    || run.graphNodes.find((node) => node.id === run.selectedNodeId && graphNodeStatusClass(node.status) === 'error')
    || run.graphNodes.find((node) => graphNodeStatusClass(node.status) === 'error')
  const failedIndex = failedNode ? run.graphNodes.findIndex((node) => node.id === failedNode.id) : -1
  const nodeTones = run.graphNodes.map((node, index) => workflowNodeTone(node, index, failedIndex, runFinished, failed))
  const completedNodeCount = nodeTones.filter((tone) => tone === 'done').length
  const activeNode = run.graphNodes.find((node, index) => nodeTones[index] === 'active')
  const currentNode = failedNode || activeNode || (runFinished ? run.graphNodes.at(-1) : run.graphNodes[0]) || null
  const selectedNode = run.graphNodes.find((node) => node.id === run.selectedNodeId) || currentNode
  const selectedIndex = selectedNode ? run.graphNodes.findIndex((node) => node.id === selectedNode.id) : -1
  const selectedTone = selectedNode && selectedIndex >= 0 ? nodeTones[selectedIndex] : 'pending'
  const phaseLabel = failed ? '运行失败' : workbenchTaskStateLabel('workflow-chat', run.phase)
  const phaseTone = failed ? 'failed' : run.phase
  const resultCount = run.artifacts.length + run.graphNodes.filter((node, index) => nodeTones[index] === 'done' && isVisibleResult(node.outputLabel)).length

  const selectNode = (nodeId: string) => {
    const current = useAppStore.getState().run
    if (!current) return
    useAppStore.setState({ run: { ...current, selectedNodeId: nodeId } })
  }

  return (
    <div className="wb-workflow-run" data-testid="workflow-run">
      <DialogueStatusBar mode={workbenchTaskModeLabel('workflow-chat')} title={run.workflowName} onBack={returnToShelf} backLabel={workbenchTaskBackLabel('workflow-chat')} />

      <aside className="wb-workflow-properties" data-testid="workflow-run-control-panel" aria-label="工作流属性">
        <header className="wb-workflow-properties-head">
          <span><Icon name="workflow" /></span>
          <div><small>工作流</small><h2>{run.workflowName}</h2></div>
          <em className={`wb-workflow-run-state is-${phaseTone}`}>{phaseLabel}</em>
        </header>

        <section className="wb-workflow-property-section">
          <h3>本次运行</h3>
          <dl className="wb-workflow-property-list">
            <div><dt>目标</dt><dd>{workflowBriefSummary(run.brief)}</dd></div>
            <div><dt>进度</dt><dd><strong>{completedNodeCount} / {run.graphNodes.length || '—'}</strong><progress value={run.graphNodes.length ? completedNodeCount : runFinished ? 1 : 0} max={run.graphNodes.length || 1} aria-label={`已完成 ${completedNodeCount} 个，共 ${run.graphNodes.length} 个节点`} /></dd></div>
            <div><dt>成果</dt><dd>{resultCount} 项</dd></div>
          </dl>
        </section>

        {selectedNode ? (
          <section className={`wb-workflow-selected-property is-${selectedTone}`} aria-labelledby="workflowSelectedNodeTitle">
            <header><span>{selectedIndex + 1}</span><div><small>{run.selectedNodeId ? '选中节点' : '当前节点'}</small><h3 id="workflowSelectedNodeTitle">{selectedNode.label}</h3></div></header>
            <dl>
              <div><dt>类型</dt><dd>{nodeTypeLabel(selectedNode.meta)}</dd></div>
              <div><dt>状态</dt><dd>{workflowNodeStatusLabel(selectedTone)}</dd></div>
              {selectedNode.owner ? <div><dt>执行者</dt><dd>{selectedNode.owner}</dd></div> : null}
              {selectedNode.outputLabel ? <div><dt>节点结果</dt><dd>{selectedNode.outputLabel}</dd></div> : null}
            </dl>
          </section>
        ) : null}

        <section className="wb-workflow-property-nodes">
          <header><h3>流程节点</h3><span>{run.graphNodes.length}</span></header>
          <ol>
            {run.graphNodes.map((node, index) => {
              const tone = nodeTones[index]
              const selected = selectedNode?.id === node.id
              return (
                <li key={node.id}>
                  <button type="button" className={`is-${tone}${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => selectNode(node.id)}>
                    <span>{tone === 'done' ? <Icon name="check" /> : index + 1}</span>
                    <span><strong>{node.label}</strong><small>{nodeTypeLabel(node.meta)}</small></span>
                    <em>{workflowNodeStatusLabel(tone)}</em>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        {runFinished ? <footer className="wb-workflow-properties-actions"><button type="button" className="wb-modal-btn primary" onClick={rerun}><Icon name="refresh" />再运行一次</button></footer> : null}
      </aside>
    </div>
  )
}
