import type { StudioNode } from '../../../domain/studio'
import { useAppStore } from '../../app/store'
import { StudioAgentFields } from './StudioAgentFields'

type Props = {
  node: StudioNode
  simpleMode?: boolean
  hasNextStep?: boolean
  onPatch: (patch: Record<string, unknown>) => void
}

function patchConfig(node: StudioNode, key: string, value: unknown, onPatch: Props['onPatch']) {
  onPatch({ config: { ...(node.config || {}), [key]: value } })
}

export function StudioInspectorFields({ node, simpleMode, hasNextStep, onPatch }: Props) {
  const models = useAppStore((s) => s.assistantModels)
  const skills = useAppStore((s) => s.assistantSkills)
  const knowledgeProviders = useAppStore((s) => s.studioKnowledgeProviders)
  const knowledgeOptions = [
    { id: 'local-default', name: '本地知识库', kind: 'local' },
    { id: 'feishu-default', name: '飞书知识库', kind: 'feishu' },
    { id: 'rag-default', name: 'RAG 知识库', kind: 'rag' },
    ...knowledgeProviders.filter((item) => !['local-default', 'feishu-default', 'rag-default'].includes(item.id)),
  ]

  if (node.kind === 'start' || node.kind === 'end') {
    return (
      <p className="wb-studio-guide">
        {node.kind === 'start'
          ? '从开始节点的输出端口连出到第一个业务节点。'
          : '将最终节点的输出端口连入结束节点。'}
      </p>
    )
  }

  if (node.kind === 'join') {
    return <p className="wb-studio-guide">汇合等待所有入边完成。可从上游多节点连线到此汇合点。</p>
  }

  if (node.kind === 'gate') {
    return (
      <>
        <label className="wb-studio-field">
          <span>确认标题</span>
          <input value={String(node.config?.title || node.approvalNote || '')} onChange={(e) => patchConfig(node, 'title', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>确认说明</span>
          <input value={String(node.config?.note || '')} onChange={(e) => patchConfig(node, 'note', e.target.value, onPatch)} />
        </label>
        <p className="wb-studio-guide">运行到此节点将请求人工批准后继续。</p>
      </>
    )
  }

  if (node.kind === 'condition') {
    const compareRaw = String(node.config?.compare || node.config?.op || 'equal')
    const compare = compareRaw === 'eq' ? 'equal'
      : compareRaw === 'neq' ? 'not_equal'
      : compareRaw
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>左值</span>
          <input value={String(node.config?.left || 'input')} placeholder="input 或 input.field" onChange={(e) => patchConfig(node, 'left', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>比较</span>
          <select value={compare} onChange={(e) => patchConfig(node, 'compare', e.target.value, onPatch)}>
            <option value="equal">等于</option>
            <option value="not_equal">不等于</option>
            <option value="contains">包含</option>
            <option value="blank">为空</option>
          </select>
        </label>
        <label className="wb-studio-field">
          <span>右值</span>
          <input value={String(node.config?.right || '')} onChange={(e) => patchConfig(node, 'right', e.target.value, onPatch)} />
        </label>
        <p className="wb-studio-guide">从「成立 / 不成立」两个输出端口分别连到下游。未选中分支的节点会在运行时跳过。</p>
      </>
    )
  }

  if (node.kind === 'llm') {
    const currentModel = String(node.config?.modelName || node.config?.model || 'auto')
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>模型</span>
          <select value={currentModel} onChange={(e) => patchConfig(node, 'modelName', e.target.value, onPatch)}>
            <option value="auto">Auto</option>
            {models.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="wb-studio-field">
          <span>温度</span>
          <input value={String(node.config?.temperature || '')} placeholder="0.2" onChange={(e) => patchConfig(node, 'temperature', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>Prompt</span>
          <textarea rows={8} value={String(node.config?.prompt || '')} placeholder="系统提示词，可用 {{input}} 变量" onChange={(e) => patchConfig(node, 'prompt', e.target.value, onPatch)} />
        </label>
        <p className="wb-studio-guide">大模型节点直连 LLM Hub，无需绑定专家。</p>
      </>
    )
  }

  if (node.kind === 'knowledge') {
    const currentKnowledge = String(node.config?.knowledgeId || '')
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>知识库</span>
          <select
            value={currentKnowledge}
            onChange={(e) => {
              const provider = knowledgeOptions.find((item) => item.id === e.target.value)
              onPatch({
                config: {
                  ...(node.config || {}),
                  knowledgeId: e.target.value,
                  ...(provider?.name ? { knowledgeName: provider.name } : {}),
                  ...(provider?.kind ? { knowledgeKind: provider.kind } : {}),
                },
              })
            }}
          >
            <option value="">选择知识库…</option>
            {knowledgeOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            ))}
          </select>
        </label>
        <label className="wb-studio-field">
          <span>检索目标</span>
          <textarea rows={3} value={String(node.intent || '')} placeholder="检索目标说明" onChange={(e) => onPatch({ intent: e.target.value })} />
        </label>
        <p className="wb-studio-guide">知识库节点直接检索，无需绑定专家。</p>
      </>
    )
  }

  if (node.kind === 'mcp') {
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>MCP 服务</span>
          <input value={String(node.config?.connectorName || node.config?.connectorId || '')} placeholder="服务标识或连接器名称" onChange={(e) => onPatch({ config: { ...(node.config || {}), connectorName: e.target.value, connectorId: e.target.value } })} />
        </label>
        <label className="wb-studio-field">
          <span>工具名称</span>
          <input value={String(node.config?.toolName || '')} placeholder="例如：search" onChange={(e) => patchConfig(node, 'toolName', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>参数 JSON</span>
          <textarea rows={5} value={String(node.config?.arguments || '{}')} placeholder='{"query":"{{input}}"}' onChange={(e) => patchConfig(node, 'arguments', e.target.value, onPatch)} />
        </label>
        <p className="wb-studio-guide">通过 MCP 服务调用工具，结果会传给下游节点。</p>
      </>
    )
  }

  if (node.kind === 'request') {
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>请求方法</span>
          <select value={String(node.config?.method || 'GET')} onChange={(e) => patchConfig(node, 'method', e.target.value, onPatch)}>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>
        <label className="wb-studio-field">
          <span>URL</span>
          <input value={String(node.config?.url || '')} placeholder="https://api.example.com" onChange={(e) => patchConfig(node, 'url', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>请求头 JSON</span>
          <textarea rows={4} value={String(node.config?.headers || '{}')} placeholder='{"Content-Type":"application/json"}' onChange={(e) => patchConfig(node, 'headers', e.target.value, onPatch)} />
        </label>
        <label className="wb-studio-field">
          <span>请求体</span>
          <textarea rows={5} value={String(node.config?.body || '')} placeholder="可选，支持 {{input}}" onChange={(e) => patchConfig(node, 'body', e.target.value, onPatch)} />
        </label>
        <p className="wb-studio-guide">发起 HTTP 请求；请确认 URL 和敏感信息符合当前环境的安全策略。</p>
      </>
    )
  }

  if (node.kind === 'tool' || node.kind === 'skill') {
    const currentSkill = String(node.config?.skillId || '')
    return (
      <>
        <label className="wb-studio-field">
          <span>节点名称</span>
          <input value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <label className="wb-studio-field">
          <span>技能 / 工具</span>
          <select value={currentSkill} onChange={(e) => patchConfig(node, 'skillId', e.target.value, onPatch)}>
            <option value="">选择技能或工具</option>
            {skills.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            ))}
          </select>
        </label>
        <label className="wb-studio-field">
          <span>目标说明</span>
          <textarea rows={3} value={String(node.intent || node.config?.intent || '')} onChange={(e) => onPatch({ intent: e.target.value })} />
        </label>
        <p className="wb-studio-guide">工具节点按所选技能执行，无需绑定专家。</p>
      </>
    )
  }

  return <StudioAgentFields node={node} simpleMode={simpleMode} hasNextStep={hasNextStep} onPatch={onPatch} />
}
