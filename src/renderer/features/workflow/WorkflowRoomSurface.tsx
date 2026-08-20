import { graphNodeStatusClass } from '../../../domain/run-projection'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { ContentView } from '../content-view/ContentView'

export function WorkflowRoomSurface() {
  const run = useAppStore((s) => s.run)

  if (!run) return null

  const resultNodes = run.graphNodes.filter((node) => {
    const result = node.outputLabel.trim()
    if (!result) return false
    return !['workflow completed', 'terminal completed', 'start ready', 'parallel ready'].includes(result.toLowerCase())
  })
  const selectedResult = resultNodes.find((node) => node.id === run.selectedNodeId) || resultNodes[0] || null
  const activeNode = run.graphNodes.find((node) => graphNodeStatusClass(node.status) === 'active')
  const deliveryCount = run.artifacts.length + resultNodes.length

  const selectResult = (nodeId: string) => {
    const current = useAppStore.getState().run
    if (current) useAppStore.setState({ run: { ...current, selectedNodeId: nodeId } })
  }

  return (
    <article className="wb-expert-task-room wb-workflow-task-room is-delivery" data-testid="workflow-room" aria-label="交付与预览">
      <div className="wb-expert-task-body">
        <section className="wb-workflow-delivery" data-testid="workflow-run-results" aria-labelledby="workflowDeliveryTitle">
          <header className="wb-workflow-delivery-head">
            <div>
              <h2 id="workflowDeliveryTitle">交付与预览</h2>
            </div>
            <span>{deliveryCount ? `${deliveryCount} 项` : run.phase === 'done' ? '无交付' : '生成中'}</span>
          </header>

          {run.artifacts.length ? (
            <section className="wb-workflow-delivery-files" aria-labelledby="workflowDeliveryFilesTitle">
              <header><strong id="workflowDeliveryFilesTitle">交付文件</strong><span>{run.artifacts.length}</span></header>
              <div>
                {run.artifacts.map((artifact) => (
                  <article key={artifact.id}>
                    <span><Icon name="clipboardCheck" /></span>
                    <div><small>交付物</small><strong>{artifact.name}</strong></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {resultNodes.length ? (
            <>
              <nav className="wb-workflow-delivery-nav" aria-label="节点交付结果">
                {resultNodes.map((node, index) => (
                  <button
                    key={node.id}
                    type="button"
                    className={selectedResult?.id === node.id ? 'is-active' : ''}
                    aria-pressed={selectedResult?.id === node.id}
                    onClick={() => selectResult(node.id)}
                  >
                    <span>{index + 1}</span>
                    <span><strong>{node.label}</strong><small>节点结果</small></span>
                  </button>
                ))}
              </nav>
              {selectedResult ? (
                <article className="wb-workflow-delivery-preview" aria-label={`${selectedResult.label}结果预览`}>
                  <header>
                    <div><span><Icon name="note" /></span><div><small>结果预览</small><strong>{selectedResult.label}</strong></div></div>
                    <span>已生成</span>
                  </header>
                  <div className="wb-workflow-delivery-document">
                    <ContentView source={selectedResult.outputLabel} className="wb-workflow-delivery-content" />
                  </div>
                </article>
              ) : null}
            </>
          ) : (
            <div className="wb-workflow-delivery-empty">
              <Icon name={run.phase === 'done' ? 'note' : 'workflow'} />
              <div>
                <strong>{run.phase === 'done' ? '本次运行没有可预览的交付' : '正在等待节点交付'}</strong>
                <span>{run.phase === 'done' ? '请检查节点输出配置，或调整目标后再次运行。' : activeNode ? `「${activeNode.label}」完成后，结果会显示在这里。` : '工作流开始产出后会自动更新。'}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </article>
  )
}
