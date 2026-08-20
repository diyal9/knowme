/**
 * 编排属性侧栏：仅在选中画布节点时出现在右侧；字段按节点类型收口。
 */
import type { StudioDraft, StudioNode } from '../../../domain/studio'
import { useAppStore } from '../../app/store'
import { StudioInspectorFields } from './StudioInspectorFields'
import { StudioWorkflowFields } from './StudioWorkflowFields'

type Props = {
  draft: StudioDraft
  selectedNodeId: string
  simpleMode?: boolean
}

const NODE_TITLES: Record<string, string> = {
  start: '开始节点',
  end: '结束节点',
  gate: '人工确认',
  join: '汇合',
  llm: '大模型节点',
  tool: '工具节点',
  knowledge: '知识库节点',
  mcp: 'MCP 节点',
  request: 'HTTP 请求节点',
  condition: '条件判断',
}

function inspectorTitle(selected: StudioNode): string {
  const kind = String(selected.kind || '')
  if (kind === 'agent') return selected.name || '专家节点'
  return NODE_TITLES[kind] || selected.name || '节点属性'
}

export function StudioInspector({ draft, selectedNodeId, simpleMode }: Props) {
  const issues = useAppStore((s) => s.studioIssues)
  const updateStudioNodeFields = useAppStore((s) => s.updateStudioNodeFields)
  const selected = draft.nodes.find((node) => node.id === selectedNodeId)
  if (!selected) return null

  const nodeIndex = draft.nodes.findIndex((node) => node.id === selected.id)
  const hasNextStep = nodeIndex >= 0 && nodeIndex < draft.nodes.length - 1 && draft.graphMode !== 'free'

  return (
    <aside
      className="wb-studio-inspector"
      aria-labelledby="wbStudioInspectorTitle"
      data-testid="studio-inspector"
    >
      <div className="wb-section-label">属性</div>
      <h3 id="wbStudioInspectorTitle">{inspectorTitle(selected)}</h3>
      <div id="wbStudioInspector">
        <StudioWorkflowFields draft={draft} node={selected} />
        <form data-testid="studio-inspector-form" onSubmit={(e) => e.preventDefault()}>
          <StudioInspectorFields
            node={selected}
            simpleMode={simpleMode}
            hasNextStep={hasNextStep}
            onPatch={(patch) => updateStudioNodeFields(selected.id, patch)}
          />
        </form>
        {issues.length ? (
          <ul className="studio-issues">
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.nodeId || issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  )
}
