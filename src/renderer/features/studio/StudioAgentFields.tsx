/**
 * 专家节点属性：技能落 profile.skillRefs；可设与下一节点的串联关系。
 */
import { useMemo, useState } from 'react'
import type { StudioNode } from '../../../domain/studio'
import { workbenchHomeExperts } from '../../../domain/workbench-home'
import { useAppStore } from '../../app/store'

type Props = {
  node: StudioNode
  simpleMode?: boolean
  hasNextStep?: boolean
  onPatch: (patch: Record<string, unknown>) => void
}

function skillIdsOf(node: StudioNode): string[] {
  const refs = Array.isArray(node.profile?.skillRefs) ? node.profile?.skillRefs as unknown[] : []
  if (refs.length) {
    return refs.map((item) => {
      if (item && typeof item === 'object') return String((item as { id?: string }).id || '')
      return String(item || '')
    }).filter(Boolean)
  }
  // 兼容重构期误写入的 config.skillIds
  const fromConfig = node.config?.skillIds
  if (Array.isArray(fromConfig)) return fromConfig.map((id) => String(id)).filter(Boolean)
  return []
}

function withSkillRefs(node: StudioNode, ids: string[]): Record<string, unknown> {
  const profile = { ...(node.profile && typeof node.profile === 'object' ? node.profile : {}) }
  profile.skillRefs = ids.map((id) => ({ id, version: 'latest' }))
  const config = { ...(node.config || {}) }
  delete config.skillIds
  return { profile, config }
}

function skillShortName(item: { id: string; name?: string }): string {
  const fullName = String(item.name || item.id || '技能').replace(/\s+/g, '').trim()
  return Array.from(fullName).slice(0, 6).join('') || '技能'
}

export function StudioAgentFields({ node, simpleMode, hasNextStep, onPatch }: Props) {
  const hubItems = useAppStore((s) => s.hubItems)
  const modes = useAppStore((s) => s.modes)
  const skills = useAppStore((s) => s.assistantSkills)
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const experts = useMemo(() => workbenchHomeExperts(hubItems, modes), [hubItems, modes])
  const selectedSkills = skillIdsOf(node)
  const [filter, setFilter] = useState('')

  function toggleSkill(id: string) {
    const next = selectedSkills.includes(id)
      ? selectedSkills.filter((item) => item !== id)
      : [...selectedSkills, id]
    onPatch(withSkillRefs(node, next))
  }

  const visibleSkills = skills.filter((item) => {
    if (!filter.trim()) return true
    const hay = `${item.id} ${item.name || ''} ${item.description || ''}`.toLowerCase()
    return hay.includes(filter.trim().toLowerCase()) || selectedSkills.includes(item.id)
  })

  const skillGroup = (
    <div className="wb-studio-skill-group">
      <div className="wb-studio-io-head">
        <span>本步骤技能</span>
        <span className="wb-studio-skill-count">已选 {selectedSkills.length}/{skills.length}</span>
      </div>
      {skills.length === 0 ? (
        <p className="wb-studio-skill-empty">
          还没有可用技能。
          <button
            type="button"
            className="wb-flow-library-action"
            onClick={() => { setHubTab('skill'); setRoute('capabilities') }}
          >
            去专家库添加
          </button>
        </p>
      ) : (
        <>
          {skills.length > 8 ? (
            <input
              className="wb-studio-skill-filter"
              placeholder="搜索技能"
              aria-label="搜索技能"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          ) : null}
          <div className="wb-studio-skill-list">
            {visibleSkills.map((item) => (
              <label key={item.id} className="wb-studio-skill-option" title={item.name || item.id}>
                <input
                  type="checkbox"
                  aria-label={item.name || item.id}
                  checked={selectedSkills.includes(item.id)}
                  onChange={() => toggleSkill(item.id)}
                />
                <span>{skillShortName(item)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const tune = (
    <div className="wb-studio-inspector-actions">
      <button
        type="button"
        className="wb-flow-library-action"
        disabled={!node.agentPackageId}
        onClick={() => { setHubTab('expert'); setRoute('capabilities') }}
      >
        去专家库调优
      </button>
    </div>
  )

  const relationField = (
    <label className="wb-studio-field">
      <span>进入下一步前</span>
      <select
        value={node.relation || 'serial'}
        onChange={(e) => onPatch({ relation: e.target.value })}
      >
        <option value="serial">顺序执行</option>
        <option value="parallel">同时执行</option>
        <option value="approval">执行前确认</option>
      </select>
    </label>
  )

  return (
    <>
      {simpleMode ? <p className="wb-studio-guide">选择执行专家并填写目标即可运行。</p> : null}
      <label className="wb-studio-field">
        <span>执行专家</span>
        <select
          value={node.agentPackageId || ''}
          onChange={(e) => {
            const expert = experts.find((item) => item.id === e.target.value)
            onPatch({ agentPackageId: e.target.value, name: expert?.name || node.name })
          }}
        >
          <option value="">选择执行专家…</option>
          {experts.map((item) => (
            <option key={item.id} value={item.id}>{item.name || item.id}</option>
          ))}
        </select>
      </label>
      <label className="wb-studio-field">
        <span>本步骤目标</span>
        <textarea rows={4} maxLength={1200} value={String(node.intent || '')} placeholder="这位专家在当前工作流中要完成什么" onChange={(e) => onPatch({ intent: e.target.value })} />
      </label>
      <details className="wb-studio-advanced">
        <summary>更多设置</summary>
        <div className="wb-studio-advanced-body">
          <label className="wb-studio-field">
            <span>步骤名称</span>
            <input maxLength={120} value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
          </label>
          <label className="wb-studio-field">
            <span>步骤角色</span>
            <input maxLength={200} value={node.role || ''} placeholder="可选：本流程中的职责称呼" onChange={(e) => onPatch({ role: e.target.value })} />
          </label>
          <label className="wb-studio-field">
            <span>本步骤输入</span>
            <textarea rows={2} maxLength={500} value={node.inputSpec || ''} placeholder="例如：需求文档、上下文资料" onChange={(e) => onPatch({ inputSpec: e.target.value })} />
          </label>
          <label className="wb-studio-field">
            <span>本步骤输出</span>
            <textarea rows={2} maxLength={500} value={node.outputSpec || ''} placeholder="例如：阶段产物、结论报告" onChange={(e) => onPatch({ outputSpec: e.target.value })} />
          </label>
          {hasNextStep ? relationField : null}
          {hasNextStep && node.relation === 'approval' ? (
            <label className="wb-studio-field">
              <span>确认说明</span>
              <input
                maxLength={240}
                value={node.approvalNote || ''}
                placeholder="可选：请负责人确认后再继续"
                onChange={(e) => onPatch({ approvalNote: e.target.value })}
              />
            </label>
          ) : null}
          {skillGroup}
          {tune}
        </div>
      </details>
    </>
  )
}
