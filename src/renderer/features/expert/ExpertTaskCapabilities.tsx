import { useEffect, useMemo, useState } from 'react'
import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { catalogRefIds, draftFromExpertGet } from '../../../domain/hub-expert-editor'
import { expertDeliverableDisplayTitle } from '../../../domain/expert-present'
import { expertArtifactKind } from '../../../domain/expert-artifact'
import { connectorAuthorizationDisplay } from '../../../domain/capability-display'
import { useCapabilityReferences } from '../capability-hub/useCapabilityReferences'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { ExpertAvatarMark } from './ExpertAvatarMark'
import { buildKnowledgeSelectionOptions, type KnowledgeSelectionOption } from '../../../shared/knowledge-selection'
import { MarqueeText } from '../../components/MarqueeText'

type CapabilityGroup = {
  key: 'skills' | 'knowledge' | 'connectors'
  title: string
  icon: string
  stateLabel: string
  refs: string[]
}

function itemName(items: Array<{ id: string; name?: string; displayName?: string }>, id: string, fallback = '知识库') {
  const item = items.find((entry) => entry.id === id)
  return String(item?.displayName || item?.name || fallback)
}

function deployedToolCount(task: WorkbenchTask | null) {
  const snapshot = task?.assignmentSnapshot && typeof task.assignmentSnapshot === 'object'
    ? task.assignmentSnapshot as { permissions?: Record<string, any> }
    : null
  const permissions = snapshot?.permissions || {}
  const tools = Array.isArray(permissions.tools) ? permissions.tools : []
  const sandbox = permissions.sandbox && typeof permissions.sandbox === 'object' ? permissions.sandbox : {}
  return tools.length + (sandbox.network === true ? 1 : 0) + (sandbox.write === true ? 1 : 0)
}

function parseSopSteps(sop: string) {
  const lines = String(sop || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const steps: string[] = []
  for (const line of lines) {
    const match = line.match(/^\d+[.、)）]\s*(.+)$/)
    if (match) steps.push(match[1].trim())
    else if (steps.length) steps[steps.length - 1] = `${steps[steps.length - 1]} ${line}`
  }
  return steps.length > 1 ? steps : lines
}

export function ExpertTaskCapabilities({
  task,
  stageLabel,
  goal,
  goalConfirmed = false,
  status,
  sop,
  expert,
  onOpenDeliverable,
  onDelete,
}: {
  task: WorkbenchTask | null
  stageLabel: string
  goal: string
  goalConfirmed?: boolean
  status?: { title: string; waiting?: boolean; canCancel?: boolean; onCancel?: () => void }
  sop: string
  expert?: CapabilityItem
  onOpenDeliverable?: (deliverableId: string) => void
  onDelete?: () => void
}) {
  const room = useAppStore((state) => state.expertRoom)
  const hubItems = useAppStore((state) => state.hubItems)
  const referenceItems = useCapabilityReferences()
  const [expertBindings, setExpertBindings] = useState({ skills: [] as string[], connectors: [] as string[] })
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeSelectionOption[]>([])
  const [connectorStates, setConnectorStates] = useState<Record<string, string>>({})
  const [skillStates, setSkillStates] = useState<Record<string, string>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [authorizing, setAuthorizing] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [authQr, setAuthQr] = useState('')
  const [sopOpen, setSopOpen] = useState(false)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)
  const [knowledgeMenuOpen, setKnowledgeMenuOpen] = useState(false)

  useEffect(() => {
    if (!sopOpen && !capabilitiesOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSopOpen(false)
      setCapabilitiesOpen(false)
      setKnowledgeMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [capabilitiesOpen, sopOpen])

  useEffect(() => {
    const expertId = String(task?.expertId || room?.expertId || room?.id || '')
    if (!expertId) return
    let active = true
    void window.api?.expertGet?.(expertId).then((payload) => {
      const draft = draftFromExpertGet(payload, task?.expertName || '')
      if (!active || !draft) return
      setExpertBindings({ skills: draft.skills, connectors: draft.connectors })
    }).catch(() => null)
    return () => { active = false }
  }, [room?.expertId, room?.id, task?.expertId, task?.expertName])

  const connectorSignature = (room?.connectors?.length ? room.connectors : expertBindings.connectors).join('|')
  useEffect(() => {
    const ids = connectorSignature.split('|').map((id) => id.trim()).filter(Boolean)
    if (!ids.length || !window.api?.connectorsStatus) {
      setConnectorStates({})
      return undefined
    }
    let active = true
    void Promise.all(ids.map(async (id) => {
      try {
        const result = await window.api?.connectorsStatus?.(id)
        const { label } = connectorAuthorizationDisplay(result)
        return [id, label] as const
      } catch {
        return [id, '状态未知'] as const
      }
    })).then((entries) => {
      if (active) setConnectorStates(Object.fromEntries(entries))
    })
    return () => { active = false }
  }, [connectorSignature])

  useEffect(() => {
    let active = true
    void Promise.all([
      Promise.resolve(window.api?.knowledgeProviderList?.()).catch(() => null),
      Promise.resolve(window.api?.sourcesList?.()).catch(() => null),
    ]).then(([result, fallback]) => {
      if (!active) return
      const options = buildKnowledgeSelectionOptions(result?.providers || [])
      const legacy = (fallback?.sources || []).map((item) => ({
        id: String(item.id || ''),
        displayName: String(item.displayName || item.id || ''),
        name: String(item.displayName || item.id || ''),
        category: '外挂知识库' as const,
      })).filter((item) => item.id)
      const merged = [...options, ...legacy.filter((item) => !options.some((option) => option.id === item.id))]
      setKnowledgeItems(merged)
    }).catch(() => null)
    return () => { active = false }
  }, [])

  const taskKnowledgeRefs = useMemo(() => catalogRefIds(task?.knowledgeRefs), [task?.knowledgeRefs])
  const skills = room?.skills?.length ? room.skills : expertBindings.skills
  const connectors = room?.connectors?.length ? room.connectors : expertBindings.connectors
  const knowledge = room?.knowledgeRefs?.length ? room.knowledgeRefs : taskKnowledgeRefs
  const groups = useMemo<CapabilityGroup[]>(() => [
    {
      key: 'skills',
      title: '技能',
      icon: 'code',
      refs: skills,
      stateLabel: '已启用',
    },
    {
      key: 'knowledge',
      title: '知识库',
      icon: 'bookOpen',
      refs: knowledge,
      stateLabel: '可检索',
    },
    {
      key: 'connectors',
      title: '连接器',
      icon: 'link',
      refs: connectors,
      stateLabel: '已绑定',
    },
  ], [connectors, knowledge, skills])

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current }
      groups.forEach((group) => {
        if (!(group.key in next)) next[group.key] = group.refs.length <= 1
      })
      return next
    })
  }, [groups])

  const total = skills.length + knowledge.length + connectors.length
  const expertId = String(task?.expertId || room?.expertId || room?.id || '')
  const expertItem = hubItems.find((item) => item.id === expertId)
  const expertName = String(task?.expertName || expertItem?.name || room?.name || expertId)
  const expertDescription = String(expertItem?.description || expertItem?.category || '单专家 · 专业协作')
  const taskNumber = String(task?.id || '').trim().replace(/^task-/, '')
  const goalLabel = String(goal || '').trim() || '正在澄清'
  const taskDeliverables = task?.deliverables || []
  const acceptedDeliverables = taskDeliverables.filter((item) => (
    item.acceptanceStatus === 'accepted' && item.evidenceStatus !== 'blocked'
      && Boolean(item.artifactRef || item.artifactRefs?.length)
  ))
  const outputSource = task?.brief?.deliverables?.length
    ? task.brief.deliverables
    : acceptedDeliverables.length ? acceptedDeliverables : taskDeliverables
  const outputLabels = [...new Set(
    outputSource.map((item) => expertDeliverableDisplayTitle(item.title)).filter(Boolean),
  )]
  const outputLabel = outputLabels.join('、') || '确认计划后锁定'
  const fileDeliverables = (task?.deliverables || []).filter((item) => (
    item.acceptanceStatus === 'accepted' && item.evidenceStatus !== 'blocked'
      && Boolean(item.artifactRef || item.artifactRefs?.length)
      && expertArtifactKind(item.type) !== 'answer'
  ))
  const deployedCount = deployedToolCount(task)
  const deliverableState = (value: string) => value === 'accepted' ? '已接受' : value === 'changes_requested' ? '待修改' : value === 'revising' ? '修改中' : '待验收'

  useEffect(() => {
    if (!skills.length || !window.api?.skillCheck) {
      setSkillStates({})
      return undefined
    }
    let active = true
    setSkillStates(Object.fromEntries(skills.map((id) => [id, '检查中…'])))
    void Promise.all(skills.map(async (id) => {
      try {
        const result = await window.api?.skillCheck?.({ skillId: id })
        return [id, result?.ok === true && result.status === 'available' ? '可用' : result?.message || '不可用'] as const
      } catch (error) {
        return [id, error instanceof Error ? error.message : '检查失败'] as const
      }
    })).then((entries) => {
      if (active) setSkillStates(Object.fromEntries(entries))
    })
    return () => { active = false }
  }, [skills.join('|')])

  function resolveName(group: CapabilityGroup, id: string) {
     if (group.key === 'knowledge') return itemName(knowledgeItems, id)
    return itemName(referenceItems.filter(item => item.kind === (group.key === 'skills' ? 'skill' : 'connector')), id, `${group.title} ${group.refs.indexOf(id) + 1}`)
  }
  function stateLabel(group: CapabilityGroup, id: string) {
    if (group.key === 'connectors') return connectorStates[id] || group.stateLabel
    if (group.key === 'skills') return skillStates[id] || (deployedCount ? '已部署' : '检查中…')
    return group.stateLabel
  }
  async function authorizeConnector(id: string) {
    if (id !== 'feishu' || !window.api?.connectorsFeishuAuthStart) return
    setAuthorizing(id)
    try {
      const auth = await window.api.connectorsFeishuAuthStart({ force: true, full: true })
      if (auth?.verificationUrl) {
        setAuthUrl(String(auth.verificationUrl))
        setAuthQr(String(auth.qrDataUrl || ''))
        const opened = await window.api?.openExternal?.(auth.verificationUrl)
        if (!opened?.ok) useAppStore.getState().showToast?.('授权链接已生成，请在设置中打开')
        return
      }
      const result = await window.api?.connectorsStatus?.(id)
      const { label } = connectorAuthorizationDisplay(result)
      setConnectorStates((current) => ({ ...current, [id]: label }))
    } catch {
      setConnectorStates((current) => ({ ...current, [id]: '授权失败' }))
      useAppStore.getState().showToast?.('授权未启动，请稍后重试')
    } finally {
      setAuthorizing('')
    }
  }

  async function checkAuthorization() {
    if (!window.api?.connectorsStatus) return
    try {
      const result = await window.api.connectorsStatus('feishu')
      const { label, ready } = connectorAuthorizationDisplay(result)
      setConnectorStates((current) => ({ ...current, feishu: label }))
      if (ready) {
        setAuthUrl('')
        setAuthQr('')
      }
    } catch {
      setConnectorStates((current) => ({ ...current, feishu: '状态未知' }))
      useAppStore.getState().showToast?.('暂时无法检测授权状态')
    }
  }

  function toggleKnowledge(id: string) {
    const current = useAppStore.getState().expertRoom
    if (!current) return
    const next = current.knowledgeRefs?.includes(id)
      ? current.knowledgeRefs.filter((item) => item !== id)
      : [...(current.knowledgeRefs || []), id]
    useAppStore.setState({ expertRoom: { ...current, knowledgeRefs: next } })
  }

  return (
    <aside className="wb-expert-capabilities" aria-label="专家工作台" data-testid="expert-task-capabilities">
      <section className="wb-expert-expert-card" aria-label="专家信息">
      <section className="wb-expert-profile-card" aria-label="当前专家">
        <ExpertAvatarMark agent={expert || expertItem || { id: expertId, name: expertName }} className="wb-expert-profile-avatar" size={44} />
        <div>
          <h2>{expertName}</h2>
          <MarqueeText className="wb-expert-profile-description" title={expertDescription}>{expertDescription}</MarqueeText>
        </div>
      </section>
      <div className="wb-expert-capability-links">
        <button type="button" className="wb-expert-capability-launcher" onClick={() => { setSopOpen(false); setCapabilitiesOpen(true) }} aria-haspopup="dialog" aria-expanded={capabilitiesOpen}>
          <span className="wb-expert-capability-launcher-icon"><Icon name="capabilityStack" /></span>
          <span><strong>能力</strong><small>{total ? `${total} 项已配置` : '使用默认能力'}</small></span>
          <Icon name="chevronRight" />
        </button>
      {capabilitiesOpen ? (
        <div className="wb-expert-capability-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCapabilitiesOpen(false); setKnowledgeMenuOpen(false) } }}>
          <section className="wb-expert-capability-modal" role="dialog" aria-modal="true" aria-labelledby="expertCapabilitiesTitle">
            <header>
              <div><span className="wb-detail-section-kicker">本次协作</span><h2 id="expertCapabilitiesTitle">能力配置</h2></div>
              <button type="button" className="wb-expert-sop-close" aria-label="关闭能力配置" autoFocus onClick={() => { setCapabilitiesOpen(false); setKnowledgeMenuOpen(false) }}>×</button>
            </header>
            <div className="wb-expert-capability-groups">
        {groups.map((group) => (
          <section key={group.key} className="wb-expert-capability-group" data-testid={`expert-task-${group.key}`}>
            <div className={`wb-expert-property-row${group.key === 'knowledge' ? ' has-knowledge-action' : ''}`}>
              <button type="button" className="wb-expert-property-toggle" aria-expanded={expandedGroups[group.key] === true} onClick={() => setExpandedGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}>
                <span className="wb-expert-capability-icon" aria-hidden="true"><Icon name={group.icon} /></span>
                <strong>{group.title}{group.refs.length > 0 ? ` · ${group.refs.length}` : ''}</strong>
                <span className={`wb-expert-property-chevron${expandedGroups[group.key] ? ' is-open' : ''}`} aria-hidden="true" />
              </button>
              {group.key === 'knowledge' && expandedGroups[group.key] ? (
                <button type="button" className="wb-expert-knowledge-add-icon" onClick={() => setKnowledgeMenuOpen((value) => !value)} aria-expanded={knowledgeMenuOpen} aria-label={knowledgeMenuOpen ? '收起知识库选择' : '选择知识库'} title={knowledgeMenuOpen ? '收起知识库选择' : '选择知识库'}>
                  <Icon name={knowledgeMenuOpen ? 'close' : 'plus'} />
                </button>
              ) : null}
            </div>
             {expandedGroups[group.key] && group.key === 'knowledge' ? (
               <div className="wb-expert-knowledge-picker">
                 <div className="wb-expert-selected-knowledge">
                   {group.refs.length ? group.refs.map((id) => (
                     <button key={id} type="button" className="wb-expert-knowledge-chip" onClick={() => toggleKnowledge(id)} title="移除知识库">
                       <span>{resolveName(group, id)}</span><b aria-hidden="true">×</b>
                     </button>
                   )) : <span className="wb-expert-capability-empty-text">使用默认 Brain 知识</span>}
                 </div>
                 {knowledgeMenuOpen ? (
                   <div className="wb-expert-knowledge-options" role="listbox" aria-label="选择本次协作知识库">
                     {knowledgeItems.length ? knowledgeItems.map((item) => (
                       <button key={item.id} type="button" className={group.refs.includes(item.id) ? 'is-selected' : ''} aria-pressed={group.refs.includes(item.id)} onClick={() => toggleKnowledge(item.id)}>
                         <span>{item.name}</span><small>{item.category}</small>
                       </button>
                     )) : <span>暂无可选外挂知识库</span>}
                   </div>
                 ) : null}
               </div>
             ) : expandedGroups[group.key] && group.refs.length ? (
              <ul>
                {group.refs.map((id) => (
                  <li key={id}>
                    <strong title={resolveName(group, id)}>{resolveName(group, id)}</strong>
                    <span>{stateLabel(group, id)}</span>
                    {group.key === 'connectors' && ['需授权', '需补齐权限'].includes(connectorStates[id]) ? (
                      <button type="button" className="wb-expert-inline-action" disabled={authorizing === id} onClick={() => void authorizeConnector(id)}>
                        {authorizing === id ? '授权中…' : connectorStates[id] === '需补齐权限' ? '补齐全部权限' : '授权全部能力'}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : expandedGroups[group.key] ? (
              <div className="wb-expert-capability-empty">
                <span>{group.key === 'knowledge' ? '使用默认知识范围' : '未配置'}</span>
              </div>
            ) : null}
          </section>
        ))}
            {authUrl ? (
              <div className="wb-expert-auth-panel" data-testid="expert-inline-feishu-auth">
                <strong>飞书授权已启动</strong>
                <p>已打开完整权限授权页，完成后点击检测；本次会保留已有权限并补齐日程、待办等能力。</p>
                <div>
                  <button type="button" className="wb-expert-inline-action" onClick={() => void window.api?.openExternal?.(authUrl)}>重新打开授权页</button>
                  <button type="button" className="wb-expert-inline-action" onClick={() => void checkAuthorization()}>我已完成，重新检测</button>
                </div>
                {authQr ? <img src={authQr} alt="飞书授权二维码" /> : null}
              </div>
            ) : null}
            </div>
            <footer><button type="button" className="wb-modal-btn primary" onClick={() => setCapabilitiesOpen(false)}>知道了</button></footer>
          </section>
        </div>
      ) : null}
      <section className="wb-expert-sop-section" data-testid="expert-task-outputs">
        <button type="button" className="wb-expert-capability-launcher wb-expert-sop-launcher" onClick={() => { setCapabilitiesOpen(false); setSopOpen(true) }} disabled={!sop} aria-haspopup="dialog" aria-expanded={sopOpen}>
          <span className="wb-expert-capability-launcher-icon"><Icon name="bookOpen" /></span>
          <span><strong>SOP</strong><small>{sop ? '工作规范' : '未配置'}</small></span>
          <Icon name="chevronRight" />
        </button>
      </section>
      </div>
      </section>
      <section className="wb-expert-contract" aria-label={`本次委托：${stageLabel}`}>
        <div className="wb-expert-contract-heading">
          <span className="wb-detail-section-kicker">本次委托</span>
          {onDelete ? (
            <button type="button" className="wb-expert-delete-button" aria-label="删除本任务" title="删除任务" onClick={onDelete}>
              <Icon name="trash" />
            </button>
          ) : null}
        </div>
        <dl>
          <div><dt>No.</dt><dd className="wb-expert-task-number" title={task?.id || undefined}><MarqueeText title={task?.id || undefined}>{taskNumber || '创建后生成'}</MarqueeText></dd></div>
          <div><dt>目标</dt><dd className={`wb-expert-task-goal${goalConfirmed ? ' is-confirmed' : ''}`} data-testid="expert-task-goal" aria-live={goalConfirmed ? 'polite' : undefined} title={goalLabel}>{goalLabel}</dd></div>
          <div><dt>交付</dt><dd title={outputLabel}>{outputLabel}</dd></div>
        </dl>
      </section>
      {status ? (
        <section className={`wb-expert-sidebar-status${status.waiting ? ' is-waiting' : ''}`} aria-label={`当前协作状态：${status.title}`} data-testid="expert-primary-status">
          <span aria-hidden="true" />
          <strong>{status.title}</strong>
          {status.canCancel && status.onCancel ? <button type="button" className="wb-expert-runtime-cancel" onClick={status.onCancel}>取消任务</button> : null}
        </section>
      ) : null}
      <section className={`wb-expert-sidebar-deliverables${fileDeliverables.length ? '' : ' is-empty'}`} aria-labelledby="expertDeliverablesTitle">
        <header>
          {fileDeliverables.length
            ? <h3 id="expertDeliverablesTitle">成果物</h3>
            : <span id="expertDeliverablesTitle" className="wb-detail-section-kicker">成果物</span>}
        </header>
        {fileDeliverables.length ? (
          <ul>
            {fileDeliverables.map((item) => (
              <li key={`${item.deliverableId}-${item.version}`}>
                <button type="button" onClick={() => onOpenDeliverable?.(String(item.deliverableId))} disabled={!onOpenDeliverable}>
                  <span className="wb-expert-sidebar-file-icon"><Icon name="file" /></span>
                  <span><strong>{expertDeliverableDisplayTitle(item.title)}</strong><small>第 {item.version || 1} 版 · {deliverableState(item.acceptanceStatus || 'pending')}</small></span>
                  <Icon name="chevronRight" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {sopOpen ? (
        <div className="wb-expert-sop-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSopOpen(false) }}>
          <section className="wb-expert-sop-modal" role="dialog" aria-modal="true" aria-labelledby="expertSopTitle">
            <header>
              <div>
                <span className="wb-detail-section-kicker">专家工作规范</span>
                <h2 id="expertSopTitle">{expertName} SOP</h2>
              </div>
              <button type="button" className="wb-expert-sop-close" aria-label="关闭 SOP" autoFocus onClick={() => setSopOpen(false)}>×</button>
            </header>
            <div className="wb-expert-sop-modal-body">
              <ol className="wb-expert-sop-steps">
                {parseSopSteps(sop).map((step, index) => (
                  <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  )
}
