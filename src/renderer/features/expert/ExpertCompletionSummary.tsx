import type { AgentRunArtifact, WorkbenchTask, WorkbenchTaskDeliverable } from '../../../shared/api'
import { expertArtifactKind } from '../../../domain/expert-artifact'
import { ExpertImagePreview, imagePreviewItem } from './ExpertImagePreview'

type ExpertCompletionSummaryProps = {
  task: WorkbenchTask
  artifacts: Record<string, AgentRunArtifact>
  onOpenImage?: (deliverableId: string, imageId: string) => void
  onConfirm?: () => void
  confirming?: boolean
}

function artifactRefsFor(item: WorkbenchTaskDeliverable) {
  return item.artifactRefs?.length ? item.artifactRefs : item.artifactRef ? [item.artifactRef] : []
}

function displayArtifactPath(artifact: AgentRunArtifact | undefined, fallback: string) {
  const source = String(artifact?.targetPath || artifact?.path || artifact?.url || '')
  if (!source) return fallback
  const path = source.replace(/\\/g, '/')
  const outputIndex = path.lastIndexOf('/outputs/')
  if (outputIndex >= 0) return path.slice(outputIndex + 1)
  const parts = path.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || fallback
}

export function ExpertCompletionSummary({ task, artifacts, onOpenImage, onConfirm, confirming = false }: ExpertCompletionSummaryProps) {
  const deliverables = task.deliverables || []
  const changes = deliverables.filter((item) => (
    Number(item.version || 1) > 1 || Boolean(item.previousVersionId) || Boolean(item.comments?.length)
  ))
  const outputs = deliverables.reduce<Array<{ item: WorkbenchTaskDeliverable; ref: string; artifact?: AgentRunArtifact }>>((rows, item) => {
    const refs = artifactRefsFor(item)
    if (refs.length) rows.push(...refs.map((ref) => ({ item, ref, artifact: artifacts[ref] })))
    else rows.push({ item, ref: '' })
    return rows
  }, [])
  const imageOutputs = outputs.flatMap(({ item, ref, artifact }, index) => {
    if (expertArtifactKind(artifact?.type || item.type) !== 'image') return []
    const image = imagePreviewItem({ ...item, deliverableId: `${item.deliverableId || 'image'}:${ref || index + 1}`, artifactRef: ref }, artifact)
    return [{ item, image }]
  })

  return <section className="wb-expert-completion-summary" aria-label="本轮协作总结">
    <header><div><h3>本轮交付</h3><p>共 {deliverables.length} 项成果，等待你的确认</p></div></header>
    <div className="wb-expert-delivery-table-wrap">
      <table className="wb-expert-delivery-table">
        <thead><tr><th scope="col">类别</th><th scope="col">成果</th><th scope="col">说明</th></tr></thead>
        <tbody>
          {changes.map((item) => <tr key={`change-${item.deliverableId}`}>
            <th scope="row">本次变更</th>
            <td><strong>{item.title || '协作成果'}</strong></td>
            <td>{item.comments?.at(-1)?.body || `已更新至第 ${item.version || 1} 版`}</td>
          </tr>)}
          {outputs.map(({ item, ref, artifact }, index) => {
            const title = artifact?.title || item.title || '协作成果'
            const isImage = expertArtifactKind(artifact?.type || item.type) === 'image'
            const image = isImage ? imagePreviewItem({ ...item, deliverableId: `${item.deliverableId || 'image'}:${ref || index + 1}`, artifactRef: ref }, artifact) : null
            return <tr key={`${item.deliverableId}-${ref || index}`}>
              <th scope="row">{isImage ? '图片成果' : '交付成果'}</th>
              <td><strong>{title}</strong></td>
              <td>{isImage && image ? <button type="button" className="wb-expert-open-original" onClick={() => onOpenImage?.(String(item.deliverableId || ''), image.id)}>查看原图</button> : <code>{displayArtifactPath(artifact, ref || '对话交付')}</code>}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
    {imageOutputs.length > 0 ? <section className="wb-expert-summary-images" aria-label="图片交付">
      {imageOutputs.map(({ item, image }) => <div className="wb-expert-summary-image" key={image.id}>
        <strong>{image.title || item.title || '图片成果'}</strong>
        <ExpertImagePreview images={[image]} onOpen={() => onOpenImage?.(String(item.deliverableId || ''), image.id)} />
      </div>)}
    </section> : null}
    {task.executionEvidence?.some((evidence) => evidence.verificationPassed) ? <p className="wb-expert-summary-verification">已通过本轮执行验证</p> : null}
    {task.resultSummary ? <details><summary>结果摘要</summary><p>{task.resultSummary}</p></details> : null}
    {onConfirm ? <footer className="wb-expert-summary-confirmation">
      <span>如需调整，请直接在下方输入修改内容。</span>
      <button type="button" className="wb-modal-btn wb-expert-review-confirm" disabled={confirming} onClick={onConfirm}>{confirming ? '正在处理…' : '确认完成'}</button>
    </footer> : null}
  </section>
}
