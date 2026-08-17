/**
 * 流程级名称 / 目标 / 入出参：只在开始/结束节点展示，避免业务节点属性被流程定义撑空。
 * 开始侧重入参，结束侧重出参，符合编排操作习惯。
 */
import type { StudioDraft, StudioNode } from '../../../domain/studio'
import { useAppStore } from '../../app/store'
import { StudioIoFields } from './StudioIoFields'

type Props = {
  draft: StudioDraft
  node?: StudioNode | null
}

export function StudioWorkflowFields({ draft, node }: Props) {
  const updateName = useAppStore((s) => s.updateStudioDraftName)
  const updateGoal = useAppStore((s) => s.updateStudioDraftGoal)
  const kind = node?.kind || ''

  if (kind !== 'start' && kind !== 'end') return null

  const ioMode = kind === 'start' ? 'inputs' : 'outputs'

  return (
    <section className="wb-studio-inspector-block" data-testid="studio-workflow-fields">
      <div className="wb-section-label">流程定义</div>
      <label className="wb-studio-field">
        <span>工作流名称</span>
        <input
          maxLength={160}
          value={draft.name || ''}
          placeholder="例如：需求评审与开发交付"
          onChange={(e) => updateName(e.target.value)}
        />
      </label>
      <label className="wb-studio-field">
        <span>工作流目标</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={draft.goal || ''}
          placeholder="这条工作流最终要交付什么"
          onChange={(e) => updateGoal(e.target.value)}
        />
      </label>
      <StudioIoFields draft={draft} mode={ioMode} />
    </section>
  )
}
