import { useEffect, useMemo, useState } from 'react'
import { graphNodeStatusClass, type RunGraphNode } from '../../../domain/run-projection'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import type { RunState } from '../../app/store-types'
import { AgentComposer } from '../assistant/AgentComposer'
import { ContentView } from '../content-view/ContentView'
import { TaskDialogueMessages } from '../task-dialogue/TaskDialogueMessages'

function uniqueProcessLines(lines: string[]): string[] {
  const seen = new Set<string>()
  return lines
    .map((line) => String(line || '').trim())
    .filter((line) => {
      if (!line || seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(-20)
}

function extractAbsolutePsdPath(value: string): string {
  const text = String(value || '').trim()
  const match = text.match(/(?:[a-z]:[\\/]|\\\\|\/)[^\r\n]*?\.psd(?=$|[\s"'，,；;])/i)
  return String(match?.[0] || '').trim()
}

function isTechnicalFailure(value: string) {
  const text = String(value || '').trim()
  const normalized = text.replace(/[*_`#>\s]/g, '').toLowerCase()
  return ['processstarted', 'processrestarted'].includes(normalized)
    || /工具调用未成功|未注册工具|请根据报错|traceback|\b(?:error|failed)\b|执行失败|调用失败/i.test(text)
}

function isResultNode(node: RunGraphNode) {
  const result = node.outputLabel.trim()
  if (!result || isTechnicalFailure(result)) return false
  return !['workflow completed', 'terminal completed', 'start ready', 'parallel ready'].includes(result.toLowerCase())
}

function nodeKind(meta: string) {
  if (/gate|确认|人工/i.test(meta)) return '人工确认'
  if (/agent|专家/i.test(meta)) return '专家节点'
  if (/terminal|结束/i.test(meta)) return '结束节点'
  if (/tool|工具|action/i.test(meta)) return '工具节点'
  return '流程节点'
}

function nodeTone(node: RunGraphNode, index: number, failedIndex: number, completedRun: boolean, failedRun: boolean) {
  if (completedRun && !failedRun) return 'done'
  if (failedRun && failedIndex >= 0) {
    if (index === failedIndex) return 'error'
    if (index > failedIndex) return 'pending'
    return 'done'
  }
  return graphNodeStatusClass(node.status)
}

function nodeStatusText(tone: string) {
  if (tone === 'done') return '已完成'
  if (tone === 'active') return '正在执行'
  if (tone === 'error') return '需要处理'
  return '等待执行'
}

function summaryText(value: string, limit = 180) {
  const plain = String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= limit) return plain
  return `${plain.slice(0, limit)}…`
}

function briefSummary(value: string) {
  const parts = String(value || '').split(/\s*补充要求[:：]\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) return parts[0] || '未填写运行目标'
  return `${parts[0]}\n补充要求：${parts.at(-1)}`
}

export function buildWorkflowRecoveryInputs(
  currentInputs: Record<string, string>,
  note: string,
): Record<string, string> {
  const psdPath = extractAbsolutePsdPath(note)
  return {
    ...currentInputs,
    recoveryNote: note,
    ...(psdPath ? { psdPath } : {}),
  }
}

export function WorkflowRoomSurface() {
  const run = useAppStore((s) => s.run)
  if (!run) return null
  return <WorkflowRoomContent run={run} />
}

function WorkflowRoomContent({ run }: { run: RunState }) {
  const rerun = useAppStore((s) => s.rerun)
  const hitlDecide = useAppStore((s) => s.hitlDecide)
  const launchWorkflow = useAppStore((s) => s.launchWorkflow)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const showToast = useAppStore((s) => s.showToast)
  const setComposer = useAppStore((s) => s.setWorkbenchComposer)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const [recovering, setRecovering] = useState(false)
  const [previewNodeId, setPreviewNodeId] = useState('')

  const failedNodes = run.graphNodes.filter((node) => graphNodeStatusClass(node.status) === 'error')
  const failed = failedNodes.length > 0 || ['failed', 'error', 'interrupted'].includes(run.daemonStatus.toLowerCase())
  const complete = run.phase === 'done' && !failed
  const failedNode = failedNodes.find((node) => node.id === run.currentOwner)
    || failedNodes.find((node) => node.id === run.selectedNodeId)
    || failedNodes[0]
    || null
  const failedIndex = failedNode ? run.graphNodes.findIndex((node) => node.id === failedNode.id) : -1
  const projectedNodes = run.graphNodes.map((node, index) => ({
    node,
    index,
    tone: nodeTone(node, index, failedIndex, complete, failed),
  }))
  const reachedNodes = projectedNodes.filter((item) => item.tone !== 'pending')
  const resultNodes = projectedNodes.filter((item) => item.tone === 'done' && isResultNode(item.node))
  const completedCount = projectedNodes.filter((item) => item.tone === 'done').length
  const previewNode = resultNodes.find((item) => item.node.id === previewNodeId)?.node || null
  const processLines = useMemo(() => uniqueProcessLines(run.log), [run.log])
  const failureReason = failedNode?.outputLabel
    || [...processLines].reverse().find((line) => /失败|错误|未通过|中断|error|failed/i.test(line))
    || '执行端没有返回可读的失败原因。补充修正要求后，可以重新运行工作流。'

  useEffect(() => {
    setComposer('')
    setPreviewNodeId('')
  }, [run.slug, setComposer])

  const selectNode = (nodeId: string) => {
    const current = useAppStore.getState().run
    if (current) useAppStore.setState({ run: { ...current, selectedNodeId: nodeId } })
  }

  const openResult = (nodeId: string) => {
    selectNode(nodeId)
    setPreviewNodeId(nodeId)
  }

  const retryWithNote = async (rawNote: string) => {
    const note = rawNote.trim()
    if (!note) {
      showToast('请先填写要补充或调整的要求')
      return
    }
    const card = shelfCards.find((item) => item.id === run.workflowId)
    if (!card) {
      showToast('未找到原工作流，请返回工作流列表后重试')
      return
    }
    setRecovering(true)
    try {
      if (run.workflowRunId) {
        await window.api?.workflowRunComment?.({
          runId: run.workflowRunId,
          body: note,
          contextKind: 'change_request',
          actorId: 'local-user',
          summary: `失败后补充：${note}`,
        }).catch(() => null)
      }
      const baseGoal = briefSummary(run.brief).split('\n补充要求：')[0]
      const started = await launchWorkflow(card, {
        goal: `${baseGoal}\n\n补充要求：${note}`.trim(),
        inputs: buildWorkflowRecoveryInputs(run.launchInputs, note),
      })
      if (started) setComposer('')
    } finally {
      setRecovering(false)
    }
  }

  const composerPlaceholder = failed
    ? '补充修正要求或新的文件路径，发送后重新运行… @ 选文件'
    : run.phase === 'hitl'
      ? '写下修改意见，或确认当前节点继续… @ 选文件'
      : complete
        ? '继续讨论结果，或补充下一轮要求… @ 选文件'
        : '补充要求、材料，或询问当前节点进度… @ 选文件'

  return (
    <article className="wb-workflow-conversation" data-testid="workflow-room" aria-label="工作流对话与推进">
      <header className="wb-workflow-thread-head">
        <div>
          <strong>工作流推进</strong>
          <span>{run.graphNodes.length ? `${completedCount} / ${run.graphNodes.length} 个节点完成` : '等待节点启动'}</span>
        </div>
        <span className={`is-${failed ? 'error' : run.phase === 'hitl' ? 'attention' : complete ? 'done' : 'active'}`}>
          {failed ? '运行失败' : run.phase === 'hitl' ? '等待确认' : complete ? '运行完成' : run.phase === 'input' ? '等待启动' : '运行中'}
        </span>
      </header>

      <div className="wb-workflow-thread-scroll" data-testid="workflow-run-results">
        <ol className="wb-workflow-thread" aria-label="工作流推进记录">
          <li className="is-user">
            <span className="wb-workflow-thread-actor">我</span>
            <article>
              <header><strong>我</strong><span>本次委托</span></header>
              <h2>{briefSummary(run.brief).split('\n')[0]}</h2>
              {briefSummary(run.brief).includes('\n') ? <p>{briefSummary(run.brief).split('\n').slice(1).join('\n')}</p> : null}
            </article>
          </li>

          {reachedNodes.map(({ node, index, tone }) => {
            const result = tone === 'done' && isResultNode(node)
            const output = summaryText(node.outputLabel)
            return (
              <li key={node.id} className={`is-node is-${tone}`}>
                <button type="button" className="wb-workflow-thread-actor" aria-label={`查看节点 ${node.label}`} onClick={() => selectNode(node.id)}>
                  {tone === 'done' ? <Icon name="check" /> : tone === 'error' ? <Icon name="circleX" /> : index + 1}
                </button>
                <article>
                  <header><strong>{node.owner || '工作流'}</strong><span>{nodeKind(node.meta)}</span><em>{nodeStatusText(tone)}</em></header>
                  <h2>{node.label}</h2>
                  {output ? <p>{output}</p> : <p>{nodeStatusText(tone)}</p>}
                  {result ? <button type="button" className="wb-workflow-inline-result" onClick={() => openResult(node.id)}><Icon name="note" />查看节点成果<Icon name="chevronRight" /></button> : null}
                </article>
              </li>
            )
          })}

          {!reachedNodes.length ? (
            <li className="is-system"><span className="wb-workflow-thread-actor"><Icon name="workflow" /></span><article><header><strong>工作流</strong><span>等待调度</span></header><h2>节点尚未开始执行</h2><p>启动后会按照已编排的 DAG 在这里持续更新。</p></article></li>
          ) : null}

          {failed ? (
            <li className="is-action">
              <span className="wb-workflow-thread-actor"><Icon name="circleX" /></span>
              <article className="wb-workflow-thread-action" data-testid="workflow-recovery">
                <header><strong>需要处理</strong><span>{failedNode?.label || '失败节点'}</span></header>
                <h2>本次执行停在当前节点</h2><p>{failureReason}</p>
                <div><button type="button" className="wb-modal-btn" onClick={() => failedNode && selectNode(failedNode.id)}>查看节点属性</button><button type="button" className="wb-modal-btn" onClick={rerun}>直接重新运行</button></div>
              </article>
            </li>
          ) : run.phase === 'hitl' ? (
            <li className="is-action">
              <span className="wb-workflow-thread-actor"><Icon name="users" /></span>
              <article className="wb-workflow-thread-action is-review">
                <header><strong>人工确认</strong><span>工作流节点</span></header>
                <h2>{run.gateTitle || '确认当前节点后继续'}</h2><p>这是该工作流自身编排的确认节点。确认后继续流转，退回时可在下方补充修改意见。</p>
                <div><button type="button" className="wb-modal-btn" onClick={() => hitlDecide(false)}>退回</button><button type="button" className="wb-modal-btn primary" onClick={() => hitlDecide(true)}>确认并继续</button></div>
              </article>
            </li>
          ) : null}

          {run.artifacts.map((artifact) => (
            <li key={artifact.id} className="is-delivery"><span className="wb-workflow-thread-actor"><Icon name="clipboardCheck" /></span><article><header><strong>工作流交付</strong><span>文件</span></header><h2>{artifact.name}</h2><p>由本次工作流运行生成。</p></article></li>
          ))}
        </ol>

        {run.dialogueMessages.length > 1 ? <section className="wb-workflow-dialogue-thread" aria-label="补充讨论"><TaskDialogueMessages messages={run.dialogueMessages} generating={isGenerating} /></section> : null}

        {processLines.length ? (
          <details className="wb-workflow-raw-log">
            <summary><span>技术运行记录</span><em>{processLines.length} 条</em><Icon name="chevronRight" /></summary>
            <div>{processLines.map((line, index) => <p key={`${line}-${index}`}><span>{index + 1}</span>{line}</p>)}</div>
          </details>
        ) : null}
      </div>

      <div className="wb-workflow-composer-dock" aria-label={failed ? '补充后重新运行' : '工作流交互输入'}>
        <AgentComposer surface="workbench" placeholder={composerPlaceholder} onSubmit={failed ? retryWithNote : undefined} />
        {failed && recovering ? <span className="wb-workflow-composer-status" role="status">正在按补充要求重新启动…</span> : null}
      </div>

      {previewNode ? (
        <div className="wb-workflow-preview-backdrop" role="dialog" aria-modal="true" aria-label={`${previewNode.label}结果预览`} onClick={() => setPreviewNodeId('')}>
          <article className="wb-workflow-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <header><div><span><Icon name="note" /></span><div><small>{nodeKind(previewNode.meta)}成果</small><strong>{previewNode.label}</strong></div></div><button type="button" aria-label="关闭结果预览" onClick={() => setPreviewNodeId('')}><Icon name="close" /></button></header>
            <div><ContentView source={previewNode.outputLabel} className="wb-workflow-delivery-content" /></div>
          </article>
        </div>
      ) : null}
    </article>
  )
}
