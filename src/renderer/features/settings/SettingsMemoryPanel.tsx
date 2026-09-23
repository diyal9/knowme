import { useCallback, useEffect, useState } from 'react'
import type { PersonalAgentProfile } from '../../../shared/api'
import { SettingsToggle } from './SettingsToggle'

type Props = { flash: (msg: string, kind?: 'ok' | 'err') => void }
type MemoryScope = 'preferences' | 'goals' | 'projects' | 'relationships'
type BrainScope = 'global' | 'project' | 'organization'

const MEMORY_SCOPE_LABEL: Record<MemoryScope, string> = { preferences: '偏好与纠正', goals: '目标与关注', projects: '项目与决策', relationships: '人物与关系' }
const BRAIN_SCOPE_LABEL: Record<BrainScope, string> = { global: '关于我的协作理解', project: '当前项目与工作状态', organization: '组织知识与授权来源' }

export function SettingsMemoryPanel({ flash }: Props) {
  const [learning, setLearning] = useState(true)
  const [memoryScopes, setMemoryScopes] = useState<MemoryScope[]>(['preferences', 'goals', 'projects'])
  const [brainScopes, setBrainScopes] = useState<BrainScope[]>(['global', 'project'])
  const [confirmGrowth, setConfirmGrowth] = useState(true)
  const [protectSensitive, setProtectSensitive] = useState(true)
  const [retention, setRetention] = useState('archive')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [overview, personal] = await Promise.all([window.api?.memoryOverview?.(), window.api?.personalAgentGet?.()])
      setLearning(overview?.config?.learningEnabled !== false)
      const profile = personal?.profile as PersonalAgentProfile | undefined
      const memoryPolicy = profile?.memoryPolicy || {}; const knowledgePolicy = profile?.knowledgePolicy || {}
      if (Array.isArray(memoryPolicy.scopes)) setMemoryScopes(memoryPolicy.scopes as MemoryScope[])
      if (Array.isArray(knowledgePolicy.brainScopes)) setBrainScopes(knowledgePolicy.brainScopes as BrainScope[])
      if (typeof memoryPolicy.confirmGrowth === 'boolean') setConfirmGrowth(memoryPolicy.confirmGrowth)
      if (typeof memoryPolicy.protectSensitive === 'boolean') setProtectSensitive(memoryPolicy.protectSensitive)
      if (typeof memoryPolicy.projectRetention === 'string') setRetention(memoryPolicy.projectRetention)
    } catch { /* keep safe defaults */ }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  const toggle = <T extends string>(list: T[], item: T, setter: (next: T[]) => void) => setter(list.includes(item) ? list.filter((value) => value !== item) : [...list, item])
  const savePolicy = async () => {
    setSaving(true)
    try {
      await window.api?.memorySetLearning?.(learning)
      const result = await window.api?.personalAgentSave?.({ summary: '调整协作记忆与隐私设置', patch: { memoryPolicy: { scopes: memoryScopes, confirmGrowth, protectSensitive, projectRetention: retention }, knowledgePolicy: { brainScopes, allowPersonalMemory: brainScopes.includes('global'), allowRemoteQuery: brainScopes.includes('organization'), allowPromotionProposal: true, allowDirectWrite: false } } })
      if (result?.ok === false) flash(result.error || '保存失败', 'err'); else flash('设置已保存')
    } catch { flash('保存失败', 'err') } finally { setSaving(false) }
  }
  const clearMemory = async () => {
    try {
      const result = await window.api?.memoryClear?.() as { ok?: boolean; error?: string } | undefined
      if (!result?.ok) flash(result?.error || '清除失败', 'err'); else flash('协作记忆已清除')
    } catch (error) {
      flash(error instanceof Error ? error.message : '清除失败', 'err')
    }
  }

  return <div className="memory-center memory-privacy-center">
    <section className="memory-hero"><div><span className="memory-eyebrow">记忆与隐私</span><h2>控制协作记忆如何工作</h2><p>协作记忆的具体内容在伙伴设置中管理；这里仅控制学习、读取和保存规则。</p></div></section>
    <section className="memory-learning memory-policy-card"><div className="memory-section-head"><div><h3>自动学习</h3><p>控制伙伴是否可以从协作中发现记忆候选。</p></div></div><SettingsToggle checked={learning} onChange={setLearning} label="允许从对话中发现记忆建议" sub="候选会先进入伙伴设置的“待确认”，不会直接成为长期记忆。" /><SettingsToggle checked={confirmGrowth} onChange={setConfirmGrowth} label="长期协作记忆逐条确认" sub="你的偏好、约束和工作理解必须由你确认后才会生效。" /><SettingsToggle checked={protectSensitive} onChange={setProtectSensitive} label="敏感内容禁止学习" sub="敏感内容不会被加入协作记忆，也不会发送给远程知识源。" /><div className="memory-policy-options"><strong>允许形成记忆的内容</strong><div>{(Object.keys(MEMORY_SCOPE_LABEL) as MemoryScope[]).map((scope) => <label key={scope}><input type="checkbox" checked={memoryScopes.includes(scope)} onChange={() => toggle(memoryScopes, scope, setMemoryScopes)} />{MEMORY_SCOPE_LABEL[scope]}</label>)}</div></div></section>
    <section className="memory-learning memory-policy-card"><div className="memory-section-head"><div><h3>读取范围</h3><p>控制伙伴在回答时可以使用哪些协作上下文。</p></div></div><div className="memory-policy-options brain-scope-options">{(Object.keys(BRAIN_SCOPE_LABEL) as BrainScope[]).map((scope) => <label key={scope}><input type="checkbox" checked={brainScopes.includes(scope)} onChange={() => toggle(brainScopes, scope, setBrainScopes)} /><span><strong>{BRAIN_SCOPE_LABEL[scope]}</strong><small>{scope === 'organization' ? '包含按需查询的外挂知识库入口' : scope === 'project' ? '用于跨任务保持当前项目连续性' : '用于调整伙伴的回复风格与内容深度'}</small></span></label>)}</div><div className="memory-policy-retention"><label htmlFor="projectRetention">项目结束后的保留方式</label><select id="projectRetention" value={retention} onChange={(event) => setRetention(event.target.value)}><option value="archive">归档，仍可检索</option><option value="review">结束时逐项确认</option><option value="forget">结束后失效</option></select></div><div className="memory-policy-save"><span>设置会影响后续协作。</span><button type="button" className="settings-btn primary" disabled={saving} onClick={() => void savePolicy()}>{saving ? '保存中…' : '保存设置'}</button></div></section>
    <section className="memory-data-actions"><span>所有协作记忆均保存在本机。</span><button type="button" className="settings-btn" onClick={() => window.api?.openMemoryDir?.()}>打开记忆目录</button><button type="button" className="settings-btn danger" onClick={() => void clearMemory()}>清除全部记忆</button></section>
  </div>
}
