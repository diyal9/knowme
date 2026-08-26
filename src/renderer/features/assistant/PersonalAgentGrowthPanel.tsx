import { useCallback, useEffect, useMemo, useState } from 'react'
import * as AgentIdentity from '@knowme-lib/agent-identity'
import type {
  CapabilityItem,
  KnowledgeEntry,
  PersonalAgentGrowthEvent,
  PersonalAgentProfile,
  PersonalAgentProposal,
  WorkbenchTask,
} from '../../../shared/api'
import type { MemoryOverview, MemoryPattern } from '../../../shared/api-extended'
import { buildPersonalGrowthSnapshot } from '../../../domain/personal-growth'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { resolveAvatarAssetUrl } from '../../lib/avatar-urls'
import { PersonalGrowthTab } from './PersonalGrowthTab'
import '../../styles/personal-agent.css'

type LoadState = 'loading' | 'ready' | 'error'
type AvatarPreset = { id: string; label?: string; src?: string }
type EditableConfigField = 'soul' | 'capabilities' | 'collaboration' | 'drive-rules'
export type GrowthTab = 'core' | 'drive' | 'memory' | 'growth'

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

export function PersonalAgentGrowthPanel({
  onClose,
  initialTab = 'core',
}: {
  onClose: () => void
  initialTab?: GrowthTab
}) {
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
  const [memoryPatterns, setMemoryPatterns] = useState<MemoryPattern[]>([])
  const [memoryOverview, setMemoryOverview] = useState<MemoryOverview | null>(null)
  const [growthTasks, setGrowthTasks] = useState<WorkbenchTask[]>([])
  const [growthKnowledge, setGrowthKnowledge] = useState<KnowledgeEntry[]>([])
  const [growthCapabilities, setGrowthCapabilities] = useState<CapabilityItem[]>([])
  const [teaching, setTeaching] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<GrowthTab>(initialTab)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [editingField, setEditingField] = useState<EditableConfigField | null>(null)
  const avatarPresets = useMemo(() => listPresetAvatars(), [])

  const load = useCallback(async () => {
    setState('loading')
    try {
      const [agent, growth, memory, taskResult, knowledgeResult, capabilityResult] = await Promise.all([
        window.api?.personalAgentGet?.(),
        window.api?.personalAgentGrowthList?.({ limit: 50 }),
        window.api?.memoryOverview?.(),
        window.api?.workbenchTaskList?.(),
        window.api?.knowledgeOsList?.(),
        window.api?.capabilityList?.(),
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
      setEvents(growth?.events || agent.recentGrowth || [])
      setProposals(growth?.proposals || [])
      setMemoryPatterns((memory?.patterns || []).filter(isReviewReadyMemory))
      setMemoryOverview(memory || null)
      setGrowthTasks(taskResult?.items || [])
      setGrowthKnowledge([...(knowledgeResult?.wiki || []), ...(knowledgeResult?.okf || [])])
      setGrowthCapabilities(capabilityResult?.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  const pending = useMemo(() => proposals.filter((item) => item.status === 'pending'), [proposals])
  const attentionCount = pending.length + memoryPatterns.length
  const growthSnapshot = useMemo(() => buildPersonalGrowthSnapshot({
    profile,
    growthEvents: events,
    memory: memoryOverview,
    tasks: growthTasks,
    knowledge: growthKnowledge,
    capabilities: growthCapabilities,
  }), [events, growthCapabilities, growthKnowledge, growthTasks, memoryOverview, profile])
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

  function openGrowthAction(action: 'assistant' | 'workbench' | 'knowledge' | 'skill' | 'connector') {
    if (action === 'assistant') {
      setActiveTab('memory')
      return
    }
    if (action === 'workbench') {
      useAppStore.getState().openWorkbenchRail()
      return
    }
    if (action === 'knowledge') {
      useAppStore.getState().setRoute('knowledge')
      return
    }
    useAppStore.getState().setHubTab(action)
    useAppStore.getState().setRoute('capabilities')
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
          <span className="personal-growth-eyebrow">伙伴设置</span>
          <h1>塑造我的 KnowMe</h1>
          <p>让它越来越懂你</p>
        </div>
        <div className="personal-growth-head-actions">
          {notice ? <span className="personal-notice" role="status">{notice}</span> : null}
          {isDirty || saving ? (
            <button type="button" className="personal-save" disabled={saving} onClick={() => void saveProfile()}>
              {saving ? '保存中…' : '保存更改'}
            </button>
          ) : !notice ? (
            <span className="personal-save-state"><Icon name="check" />已保存</span>
          ) : null}
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
          <aside className="personal-profile-rail" aria-label="伙伴身份与成长">
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
                <span>长期工作伙伴</span>
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
              <span className="personal-rail-label">懂你进度</span>
              <dl className="personal-facts">
                {growthSnapshot.dimensions.map((item) => (
                  <div key={item.id}>
                    <dt>{item.label}</dt>
                    <dd>Lv.{item.level}</dd>
                    <span aria-label={`${item.label}进度 ${item.progress}%`}><i style={{ width: `${item.progress}%` }} /></span>
                  </div>
                ))}
              </dl>
              <button type="button" className="personal-growth-center-link" onClick={() => setActiveTab('growth')}>
                <span>查看成长详情</span><Icon name="chevronRight" />
              </button>
            </div>
            <div className="personal-rail-rule" />
            <div className="personal-policy-list">
              <div><span>记忆范围</span><strong>{profile.memoryPolicy?.scope === 'global' ? '跨主题' : '当前主题'}</strong></div>
              <div><span>关键操作</span><strong>始终确认</strong></div>
              <div><span>数据位置</span><strong>仅存本机</strong></div>
            </div>
          </aside>

          <div className="personal-growth-content">
            <nav className="personal-tabs" aria-label="伙伴设置分类">
              {([['core', '伙伴内核'], ['drive', '主动边界'], ['memory', '记忆与变更'], ['growth', '成长']] as const).map(([id, label]) => (
                <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
              ))}
            </nav>
            <section className={`personal-section personal-profile-section${activeTab !== 'core' && activeTab !== 'drive' ? ' personal-tab-inactive' : ''}`}>
              <div className="personal-section-head">
                {activeTab === 'drive' ? (
                  <div><span>主动边界</span><h2>它可以主动到哪一步</h2><p>选择推进方式，明确必须由你确认的事项。</p></div>
                ) : (
                  <div><span>伙伴内核</span><h2>它如何思考与协作</h2><p>设定它的人格、工作重点和协作方式。</p></div>
                )}
              </div>
              <div className={`personal-agent-core-grid${activeTab !== 'core' ? ' personal-tab-inactive' : ''}`}>
                <div className="personal-soul-field">{renderConfigField('soul', '核心人格', soul, '例如：理性、可靠、主动澄清，对重要判断保持审慎。', setSoul)}</div>
                {renderConfigField('capabilities', '工作侧重', domainCapabilities, '例如：产品分析、会议总结和项目推进。这里只描述工作重点，不会自动获得 Skill。', setDomainCapabilities)}
                {renderConfigField('collaboration', '协作方式', collaborationPreference, '例如：先给结论；重要结论附依据；不确定时先提问。', setCollaborationPreference)}
              </div>
              <div className={`personal-self-drive${activeTab !== 'drive' ? ' personal-tab-inactive' : ''}`} data-testid="self-drive-config">
                <div className="personal-self-drive-head"><strong>推进方式</strong><small>发送、发布、授权和破坏性操作始终确认</small></div>
                <div className="personal-drive-options" role="radiogroup" aria-label="自我驱动程度">
                  {([
                    ['guided', '按指令', '只执行明确指令，不主动延伸。'],
                    ['balanced', '协作推进', '主动补全步骤、提醒遗漏，关键决定等你确认。'],
                    ['proactive', '主动推进', '在授权范围内持续推进，遇到边界或阻塞再询问。'],
                  ] as const).map(([id, label, description]) => (
                    <label key={id} className={selfDriveLevel === id ? 'selected' : ''}>
                      <input type="radio" name="self-drive" value={id} checked={selfDriveLevel === id} onChange={() => setSelfDriveLevel(id)} />
                      <strong>{label}</strong><span>{description}</span>
                    </label>
                  ))}
                </div>
                {renderConfigField('drive-rules', '补充边界', selfDriveRules, '例如：可自行整理资料；对外发送、删除或授权前先询问。', setSelfDriveRules, 'personal-drive-rules')}
              </div>
            </section>

            <section className={`personal-section personal-teach-section${activeTab !== 'memory' ? ' personal-tab-inactive' : ''}`}>
              <div className="personal-section-head"><div><span>记忆与变更</span><h2>决定它长期记住什么</h2><p>规则可直接提交；推测和变更需要确认。</p></div></div>
              <label className="personal-composer-label" htmlFor="personal-teaching">新增长期规则</label>
              <div className="personal-teach-composer">
                <textarea id="personal-teaching" value={teaching} onChange={(event) => setTeaching(event.target.value)} placeholder="例如：所有方案先写结论，再补充依据。" />
                <div><span>保存到“我的记忆”，可随时撤销。</span><button type="button" disabled={!teaching.trim()} onClick={() => void teach()}>记住</button></div>
              </div>
            </section>

            <section className={`personal-section personal-attention-section${attentionCount ? ' has-items' : ''}${activeTab !== 'memory' ? ' personal-tab-inactive' : ''}`}>
              <div className="personal-section-head compact"><div><span>变更控制</span><h2>等待确认</h2><p>只有你确认后，记忆、能力或权限才会改变。</p></div><b>{attentionCount}</b></div>
              <div className="personal-memory-policy" data-testid="personal-memory-policy">
                <strong>保护规则</strong>
                <span>同一协作习惯至少出现 3 次，才会请你确认。</span>
                <span>任务记录不会自动改变记忆、能力或权限。</span>
              </div>
              {!attentionCount ? <div className="personal-quiet-state"><Icon name="check" /><span>目前没有待确认内容</span></div> : null}
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
                <summary><span><small>历史记录</small><strong>最近的记忆与变更</strong></span><span>{events.length} 条 <Icon name="chevronRight" /></span></summary>
                <div className="personal-log-list">
                  {events.length ? events.map((item) => (
                    <div className="personal-log-row" key={item.id}>
                      <div><strong>{item.summary || GROWTH_LABELS[item.type] || '记录'}</strong><span>{GROWTH_LABELS[item.type] || item.type}</span></div>
                      {item.reversible && item.status !== 'reverted' ? <button type="button" onClick={() => void undo(item.id)}>撤销</button> : null}
                    </div>
                  )) : <div className="personal-quiet-state"><span>产生记忆或变更后，这里会保留记录。</span></div>}
                </div>
              </details>
            </section>

            {activeTab === 'growth' ? <PersonalGrowthTab snapshot={growthSnapshot} onAction={openGrowthAction} /> : null}
          </div>
        </main>
      ) : null}
    </section>
  )
}
