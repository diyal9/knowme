import { useCallback, useEffect, useMemo, useState } from 'react'
import * as AgentIdentity from '@knowme-lib/agent-identity'
import type {
  PersonalAgentGrowthEvent,
  PersonalAgentProfile,
  PersonalAgentProposal,
} from '../../../shared/api'
import type { MemoryPattern } from '../../../shared/api-extended'
import { Icon } from '../../app/Icon'
import { resolveAvatarAssetUrl } from '../../lib/avatar-urls'
import { ASSISTANT_QUICK_COMMANDS, parseConfiguredQuickActions, serializeConfiguredQuickActions, type ConfiguredQuickAction } from '../../../domain/agent-quick-commands'
import '../../styles/personal-agent.css'

type LoadState = 'loading' | 'ready' | 'error'
type AvatarPreset = { id: string; label?: string; src?: string }
type EditableConfigField = 'soul' | 'capabilities' | 'collaboration' | 'drive-rules'
type GrowthTab = 'core' | 'quick' | 'drive' | 'memory'

const listPresetAvatars = (AgentIdentity as unknown as {
  listPresetAvatars: () => AvatarPreset[]
}).listPresetAvatars

const PROPOSAL_LABELS: Record<string, string> = {
  behavior: '行为调整', capability: '能力变化', knowledge: '知识变化',
  permission: '权限变化', 'profile-governance': '伙伴配置',
}

const GROWTH_LABELS: Record<string, string> = {
  profile_updated: '档案更新', proposal_created: '生成提案', proposal_applied: '应用提案',
  proposal_rejected: '忽略提案', memory_applied: '记住偏好', memory_reverted: '撤销记忆',
}

const MEMORY_KIND_LABELS: Record<string, string> = {
  correction: '协作纠正',
  preference: '协作偏好',
  product: '产品使用偏好',
}

function isReviewReadyMemory(item: MemoryPattern) {
  if (item.prompt_state !== 'pending' || item.signal === 'telemetry') return false
  return item.review_ready ?? Number(item.count || 0) >= 3
}

export function PersonalAgentGrowthPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LoadState>('loading')
  const [profile, setProfile] = useState<PersonalAgentProfile | null>(null)
  const [events, setEvents] = useState<PersonalAgentGrowthEvent[]>([])
  const [proposals, setProposals] = useState<PersonalAgentProposal[]>([])
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState('other/partner')
  const [soul, setSoul] = useState('')
  const [domainCapabilities, setDomainCapabilities] = useState('')
  const [collaborationPreference, setCollaborationPreference] = useState('')
  const [selfDriveLevel, setSelfDriveLevel] = useState<'guided' | 'balanced' | 'proactive'>('balanced')
  const [selfDriveRules, setSelfDriveRules] = useState('')
  const [quickActions, setQuickActions] = useState<ConfiguredQuickAction[]>([...ASSISTANT_QUICK_COMMANDS])
  const [memoryPatterns, setMemoryPatterns] = useState<MemoryPattern[]>([])
  const [teaching, setTeaching] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<GrowthTab>('core')
  const [editingQuickAction, setEditingQuickAction] = useState<number | null>(null)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [editingField, setEditingField] = useState<EditableConfigField | null>(null)
  const avatarPresets = useMemo(() => listPresetAvatars(), [])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [agent, growth, memory] = await Promise.all([
        window.api?.personalAgentGet?.(),
        window.api?.personalAgentGrowthList?.({ limit: 50 }),
        window.api?.memoryOverview?.(),
      ])
      if (!agent?.ok || !agent.profile) throw new Error(agent?.error || '无法读取个人代理')
      setProfile(agent.profile)
      setDisplayName(agent.profile.identity?.displayName || agent.profile.name || '我的 KnowMe')
      setAvatar(agent.profile.identity?.avatar || 'other/partner')
      setSoul(agent.profile.roleOverlay || '')
      setDomainCapabilities(String(agent.profile.taskPreferences?.domainCapabilities || ''))
      setCollaborationPreference(agent.profile.promptOverlay || '')
      const loadedSelfDrive = String(agent.profile.taskPreferences?.selfDriveLevel || 'balanced')
      setSelfDriveLevel(loadedSelfDrive === 'guided' || loadedSelfDrive === 'proactive' ? loadedSelfDrive : 'balanced')
      setSelfDriveRules(String(agent.profile.taskPreferences?.selfDriveRules || ''))
      const configuredActions = parseConfiguredQuickActions(agent.profile.taskPreferences?.quickActions)
      setQuickActions(configuredActions.length ? configuredActions : [...ASSISTANT_QUICK_COMMANDS])
      setEvents(growth?.events || agent.recentGrowth || [])
      setProposals(growth?.proposals || [])
      setMemoryPatterns((memory?.patterns || []).filter(isReviewReadyMemory))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const pending = useMemo(() => proposals.filter((item) => item.status === 'pending'), [proposals])
  const attentionCount = pending.length + memoryPatterns.length
  const selectedAvatar = avatarPresets.find((item) => item.id === avatar)
  const avatarSrc = resolveAvatarAssetUrl(selectedAvatar?.src || avatar)
  const isDirty = Boolean(profile && (
    displayName !== (profile.identity?.displayName || profile.name || '我的 KnowMe')
    || avatar !== (profile.identity?.avatar || 'other/partner')
    || soul !== (profile.roleOverlay || '')
    || domainCapabilities !== String(profile.taskPreferences?.domainCapabilities || '')
    || collaborationPreference !== (profile.promptOverlay || '')
    || selfDriveLevel !== String(profile.taskPreferences?.selfDriveLevel || 'balanced')
    || selfDriveRules !== String(profile.taskPreferences?.selfDriveRules || '')
    || serializeConfiguredQuickActions(quickActions) !== String(profile.taskPreferences?.quickActions || serializeConfiguredQuickActions([...ASSISTANT_QUICK_COMMANDS]))
  ))

  async function saveProfile() {
    if (!profile || saving) return
    setSaving(true)
    const result = await window.api?.personalAgentSave?.({
      identity: { displayName, avatar }, roleOverlay: soul, promptOverlay: collaborationPreference,
      taskPreferences: {
        ...(profile.taskPreferences || {}),
        domainCapabilities,
        selfDriveLevel,
        selfDriveRules,
        quickActions: serializeConfiguredQuickActions(quickActions),
      },
    })
    setSaving(false)
    if (!result?.ok) {
      setNotice(result?.error || '保存失败')
      return
    }
    setEditingField(null)
    setProfile(result.profile || profile)
    setNotice('伙伴档案已保存')
    void load()
  }

  async function teach() {
    const text = teaching.trim()
    if (!text) return
    const result = await window.api?.personalAgentTeach?.({ text })
    if (!result?.ok) {
      setNotice(result?.error || '教导失败')
      return
    }
    setTeaching('')
    setNotice(result.requiresConfirmation ? '已放入变更确认列表' : '已经记住，可在记录中撤销')
    void load()
  }

  async function reviewProposal(proposalId: string, action: 'apply' | 'reject') {
    const result = await window.api?.personalAgentApplyProposal?.({ proposalId, action, confirmedRisk: action === 'apply' })
    setNotice(result?.ok ? (action === 'apply' ? '变更已应用' : '变更已忽略') : (result?.error || '处理失败'))
    void load()
  }

  async function undo(eventId: string) {
    const result = await window.api?.personalAgentTeach?.({ undoEventId: eventId })
    setNotice(result?.ok ? '已撤销这条记忆' : (result?.error || '撤销失败'))
    void load()
  }

  async function reviewMemoryPattern(id: string, action: 'accepted' | 'dismissed') {
    const result = await window.api?.memoryReviewPattern?.({ id, action })
    setNotice(result?.ok === false ? (result.error || '处理失败') : (action === 'accepted' ? '已记住这项协作偏好' : '不会记住这项推测'))
    void load()
  }

  function renderConfigField(
    field: EditableConfigField,
    label: string,
    value: string,
    placeholder: string,
    setValue: (value: string) => void,
    className = '',
  ) {
    const editing = editingField === field
    return (
      <div className={`personal-field${className ? ` ${className}` : ''}`}>
        <div className="personal-field-head">
          <span>{label}</span>
          <button
            type="button"
            className="personal-field-edit"
            aria-label={editing ? `完成编辑${label}` : `编辑${label}`}
            onClick={() => setEditingField(editing ? null : field)}
          >
            <Icon name={editing ? 'check' : 'edit'} />
          </button>
        </div>
        {editing ? (
          <textarea
            aria-label={label}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <div className={`personal-preview-value${value ? '' : ' is-empty'}`} data-testid={`personal-preview-${field}`}>
            {value || placeholder}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="personal-growth" data-testid="personal-agent-growth">
      <header className="personal-growth-head">
        <div className="personal-growth-heading">
        <span className="personal-growth-eyebrow">智能伙伴 · 个性与成长</span>
          <h1>配置我的 KnowMe</h1>
          <p>定义它是谁、擅长什么、如何与你协作，以及在什么边界内主动推进工作。</p>
        </div>
        <div className="personal-growth-head-actions">
          {notice ? <span className="personal-notice" role="status">{notice}</span> : null}
          <button type="button" className="personal-save" disabled={!isDirty || saving} onClick={() => void saveProfile()}>
            {saving ? '保存中…' : isDirty ? '保存更改' : '已保存'}
          </button>
          <button type="button" className="personal-growth-close" onClick={onClose} aria-label="返回对话">
            <Icon name="close" />
          </button>
        </div>
      </header>

      {state === 'loading' ? (
        <div className="personal-growth-shell personal-growth-skeleton" aria-label="正在读取伙伴档案">
          <div /><div /><div />
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="personal-growth-error">
          <strong>伙伴档案暂时无法读取</strong><span>本地数据没有被修改。</span>
          <button type="button" onClick={() => void load()}>重新读取</button>
        </div>
      ) : null}

      {state === 'ready' && profile ? (
        <main className="personal-growth-shell">
          <aside className="personal-profile-rail" aria-label="伙伴身份与积累">
            <div className="personal-avatar-block">
              <button type="button" className="personal-avatar-button" aria-label="更换伙伴头像" aria-expanded={avatarPickerOpen} onClick={() => setAvatarPickerOpen((open) => !open)}>
                <img src={avatarSrc} alt="" /><span><Icon name="edit" /></span>
              </button>
              <div>
                {editingDisplayName ? (
                  <input
                    className="personal-name-input"
                    aria-label="伙伴名称"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onBlur={() => setEditingDisplayName(false)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setEditingDisplayName(false) } }}
                    maxLength={80}
                    autoFocus
                  />
                ) : (
                  <button type="button" className="personal-name-button" aria-label="编辑伙伴名称" onClick={() => setEditingDisplayName(true)}>
                    {displayName || '我的 KnowMe'}
                  </button>
                )}
                <span>我的长期工作代理</span>
              </div>
            </div>

            {avatarPickerOpen ? (
              <div className="personal-avatar-picker" role="listbox" aria-label="伙伴头像">
                {avatarPresets.map((item) => (
                  <button key={item.id} type="button" role="option" aria-label={item.label || item.id} aria-selected={avatar === item.id} onClick={() => { setAvatar(item.id); setAvatarPickerOpen(false) }}>
                    <img src={resolveAvatarAssetUrl(item.src || item.id)} alt="" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="personal-rail-rule" />
            <div className="personal-rail-section">
              <span className="personal-rail-label">当前积累</span>
              <dl className="personal-facts">
                <div><dt>工作情境</dt><dd>{profile.contexts.length}</dd></div>
                <div><dt>Skill</dt><dd>{profile.skillRefs?.length || 0}</dd></div>
                <div><dt>知识来源</dt><dd>{profile.knowledgeRefs?.length || 0}</dd></div>
                <div><dt>连接器</dt><dd>{profile.connectorRefs?.length || 0}</dd></div>
              </dl>
            </div>
            <div className="personal-rail-rule" />
            <div className="personal-policy-list">
              <div><span>记忆范围</span><strong>{profile.memoryPolicy?.scope === 'global' ? '跨主题' : '当前主题'}</strong></div>
              <div><span>权限变化</span><strong>每次确认</strong></div>
              <div><span>档案位置</span><strong>仅存本机</strong></div>
            </div>
          </aside>

          <div className="personal-growth-content">
            <nav className="personal-tabs" aria-label="KnowMe 配置分类">
              {([['core', '伙伴内核'], ['quick', '快捷操作'], ['drive', '主动边界'], ['memory', '记忆与变更']] as const).map(([id, label]) => (
                <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
              ))}
            </nav>
            <section className="personal-section personal-profile-section">
              <div className="personal-section-head">
                <div><span>伙伴内核</span><h2>定义它如何思考与行动</h2><p>用户行业、岗位和基本情况已移到设置；这里仅配置智能伙伴本身。</p></div>
                <div className="personal-help-anchor">
                  <button
                    type="button"
                    className="personal-help-button"
                    aria-label="KnowMe 配置方法"
                    aria-expanded={helpOpen}
                    aria-controls="personal-help-tooltip"
                    onClick={() => setHelpOpen((open) => !open)}
                  >
                    ?
                  </button>
                  {helpOpen ? (
                    <div id="personal-help-tooltip" className="personal-help-tooltip" role="tooltip">
                      <strong>KnowMe 配置方法</strong>
                      <ol>
                        <li>在“设置 → 个人档案”填写工作领域、岗位和基本情况。</li>
                        <li>在这里配置伙伴的 Soul、领域能力、协作偏好和主动边界。</li>
                        <li>点击字段右上角编辑，完成后点击顶部“保存更改”。</li>
                        <li>能力、知识、连接器和权限变化都会等待确认。</li>
                      </ol>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={`personal-agent-core-grid${activeTab !== 'core' ? ' personal-tab-inactive' : ''}`}>
                <div className="personal-soul-field">{renderConfigField('soul', 'Soul · 核心人格', soul, '定义稳定身份、价值取向与判断原则；不要写用户履历。', setSoul)}</div>
                {renderConfigField('capabilities', '领域能力', domainCapabilities, '例如：会议总结、产品分析、项目推进、办公写作。真实 Skill 和连接器需另行授权。', setDomainCapabilities)}
                {renderConfigField('collaboration', '协作偏好', collaborationPreference, '例如：先给结论；重要结论附依据；不确定时先提问。', setCollaborationPreference)}
              </div>
              <div className={`personal-quick-actions${activeTab !== 'quick' ? ' personal-tab-inactive' : ''}`} data-testid="personal-quick-actions">
                <div className="personal-subsection-head"><span>快捷操作</span><small>默认使用内置提示词；关联 Skill 后仅使用该 Skill。</small></div>
                <div className="personal-quick-action-list">
                  {quickActions.map((action, index) => (
                    <div className="personal-quick-action" key={action.id}>
                      <div className="personal-quick-action-title"><strong>{index + 1}. {action.title || '快捷操作'}</strong><button type="button" className="personal-field-edit" aria-label={`编辑快捷操作${index + 1}`} onClick={() => setEditingQuickAction(editingQuickAction === index ? null : index)}><Icon name={editingQuickAction === index ? 'check' : 'edit'} /></button></div>
                      {editingQuickAction === index ? <>
                        <input aria-label={`快捷操作${index + 1}名称`} value={action.title} onChange={(event) => setQuickActions((items) => items.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="操作名称" />
                        <input aria-label={`快捷操作${index + 1} Skill`} value={action.skillRef || ''} onChange={(event) => { const skillRef = event.target.value.trim(); setQuickActions((items) => items.map((item, i) => i === index ? { ...item, skillRef: skillRef || undefined, prompt: skillRef ? '' : item.prompt } : item)) }} placeholder="关联 Skill（与提示词二选一）" />
                        {!action.skillRef ? <textarea aria-label={`快捷操作${index + 1}指令`} value={action.prompt} onChange={(event) => setQuickActions((items) => items.map((item, i) => i === index ? { ...item, prompt: event.target.value, skillRef: undefined } : item))} placeholder="点击后发送给伙伴的执行指令" /> : <div className="personal-preview-value">已绑定 Skill：{action.skillRef}</div>}
                      </> : <div className="personal-preview-value">{action.skillRef ? `Skill：${action.skillRef}` : (action.prompt || '未设置提示词')}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className={`personal-self-drive${activeTab !== 'drive' ? ' personal-tab-inactive' : ''}`} data-testid="self-drive-config">
                <div className="personal-self-drive-head"><div><span>自我驱动</span><strong>选择主动推进工作的程度</strong></div><small>权限、发送、发布、破坏性操作需确认</small></div>
                <div className="personal-drive-options" role="radiogroup" aria-label="自我驱动程度">
                  {([
                    ['guided', '依指令', '只完成明确交代的步骤，不主动扩展范围。'],
                    ['balanced', '协作推进', '主动补全计划、提示遗漏，并等待关键决定。'],
                    ['proactive', '主动负责', '在授权边界内持续推进，遇到阻塞再请求介入。'],
                  ] as const).map(([id, label, description]) => (
                    <label key={id} className={selfDriveLevel === id ? 'selected' : ''}>
                      <input type="radio" name="self-drive" value={id} checked={selfDriveLevel === id} onChange={() => setSelfDriveLevel(id)} />
                      <strong>{label}</strong><span>{description}</span>
                    </label>
                  ))}
                </div>
                {renderConfigField('drive-rules', '主动边界', selfDriveRules, '例如：可自行整理资料；发布、删除、授权前先询问。', setSelfDriveRules, 'personal-drive-rules')}
              </div>
            </section>

            <section className={`personal-section personal-teach-section${activeTab !== 'memory' ? ' personal-tab-inactive' : ''}`}>
              <div className="personal-section-head compact"><div><span>提交到我的记忆</span><h2>告诉 KnowMe 一条长期协作规则</h2></div></div>
              <div className="personal-teach-composer">
                <textarea value={teaching} onChange={(event) => setTeaching(event.target.value)} placeholder="例如：记住我希望所有方案先写结论，再补充依据。" />
                <div><span>明确偏好会保存到全局“我的记忆”；智能伙伴不维护另一套私有记忆。</span><button type="button" disabled={!teaching.trim()} onClick={() => void teach()}>记住</button></div>
              </div>
            </section>

            <section className={`personal-section personal-attention-section${attentionCount ? ' has-items' : ''}${activeTab !== 'memory' ? ' personal-tab-inactive' : ''}`}>
              <div className="personal-section-head compact"><div><span>变更控制</span><h2>需要你确认</h2><p>能力变更与长期记忆分开处理；工作活动本身不会成为能力或知识。</p></div><b>{attentionCount}</b></div>
              <div className="personal-memory-policy" data-testid="personal-memory-policy">
                <strong>全局记忆准入规则</strong>
                <span>只接收协作偏好与纠正；同一推测至少出现 3 次才进入确认。</span>
                <span>任务名、工作入口和完成记录只保留为本机工作记忆，不改变能力、知识或权限。</span>
              </div>
              {!attentionCount ? <div className="personal-quiet-state"><Icon name="check" /><span>没有等待确认的能力变更或长期记忆</span></div> : null}
              {pending.length ? <div className="personal-review-group-label">能力、知识与权限变更</div> : null}
              {pending.map((item) => (
                <div className="personal-review-row" key={item.id}>
                  <div><span>{PROPOSAL_LABELS[item.kind] || '变更提案'} · 尚未生效</span><strong>{item.summary || item.kind}</strong></div>
                  <div className="personal-row-actions"><button type="button" onClick={() => void reviewProposal(item.id, 'reject')}>忽略</button><button type="button" className="primary" onClick={() => void reviewProposal(item.id, 'apply')}>确认应用</button></div>
                </div>
              ))}
              {memoryPatterns.length ? <div className="personal-review-group-label">长期协作记忆候选</div> : null}
              {memoryPatterns.map((item) => (
                <div className="personal-review-row" key={item.id} data-testid="personal-memory-pattern">
                  <div><span>{MEMORY_KIND_LABELS[item.kind || ''] || '协作偏好'} · 已观察 {item.count || 3} 次 · 尚未生效</span><strong>{item.summary}</strong></div>
                  <div className="personal-row-actions"><button type="button" onClick={() => void reviewMemoryPattern(item.id, 'dismissed')}>不记住</button><button type="button" className="primary" onClick={() => void reviewMemoryPattern(item.id, 'accepted')}>确认记住</button></div>
                </div>
              ))}
            </section>

            <section className={`personal-section personal-log-section${activeTab !== 'memory' ? ' personal-tab-inactive' : ''}`}>
              <details>
                <summary><span><small>审计记录</small><strong>最近的记忆与变更</strong></span><span>{events.length} 条 <Icon name="chevronRight" /></span></summary>
                <div className="personal-log-list">
                  {events.length ? events.map((item) => (
                    <div className="personal-log-row" key={item.id}>
                      <div><strong>{item.summary || GROWTH_LABELS[item.type] || '记录'}</strong><span>{GROWTH_LABELS[item.type] || item.type}</span></div>
                      {item.reversible && item.status !== 'reverted' ? <button type="button" onClick={() => void undo(item.id)}>撤销</button> : null}
                    </div>
                  )) : <div className="personal-quiet-state"><span>第一次教导后，这里会留下可追溯记录。</span></div>}
                </div>
              </details>
            </section>
          </div>
        </main>
      ) : null}
    </section>
  )
}
