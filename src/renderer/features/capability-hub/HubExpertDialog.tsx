import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CapabilityItem, CapabilityKind } from '../../../shared/api'
import { isUserCreatedExpert, type HubCapabilityItem } from '../../../domain/capability-hub'
import { buildExpertCatalogFields, type HubCatalogFieldSpec } from '../../../domain/hub-catalog-fields'
import {
  catalogRefIds,
  draftFromExpertGet,
  expertEditorFooterSummary,
  slugifyExpertId,
} from '../../../domain/hub-expert-editor'
import * as AgentIdentity from '@knowme-lib/agent-identity'
import * as AgenticProfile from '@knowme-lib/expert-agentic-profile'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { HubAgenticFields } from './HubAgenticFields'
import { HubCatalogSummary } from './HubCatalogSummary'
import { HubExpertAvatarRow } from './HubExpertAvatarRow'
import { HubPickerDialog } from './HubPickerDialog'

const identityAvatarKey = (AgentIdentity as any).identityAvatarKey
const normalizeAgenticType = (AgenticProfile as any).normalizeAgenticType
const normalizeAgenticConfig = (AgenticProfile as any).normalizeAgenticConfig

type Props = {
  onClose: () => void
  onSaved: () => void
  mode?: 'create' | 'tune' | 'copy'
  item?: HubCapabilityItem | null
}

export function HubExpertDialog({ onClose, onSaved, mode = 'create', item = null }: Props) {
  const hubItems = useAppStore((s) => s.hubItems)
  const showToast = useAppStore((s) => s.showToast)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const [name, setName] = useState(() => (
    mode === 'copy' ? `${item?.name || item?.id || '专家'}（我的）` : (item?.name || '')
  ))
  const [expertId, setExpertId] = useState(() => (
    mode === 'tune' && item?.id ? item.id : slugifyExpertId(mode === 'copy' ? `${item?.name || '专家'}（我的）` : (item?.name || ''))
  ))
  const [idManual, setIdManual] = useState(mode === 'tune')
  const [persona, setPersona] = useState(String(item?.description || ''))
  const [soul, setSoul] = useState('')
  const [sop, setSop] = useState('')
  const [avatar, setAvatar] = useState(() => String(item?.avatar || ''))
  const [avatarManual, setAvatarManual] = useState(mode !== 'create')
  const [agenticType, setAgenticType] = useState('react')
  const [agenticConfig, setAgenticConfig] = useState<Record<string, unknown>>({})
  const [skills, setSkills] = useState<string[]>(() => catalogRefIds(item?.skills))
  const [connectors, setConnectors] = useState<string[]>(() => catalogRefIds(item?.connectors))
  const [knowledgeRefs, setKnowledgeRefs] = useState<string[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; name?: string }>>([])
  const [skillItems, setSkillItems] = useState<CapabilityItem[]>(() => hubItems.filter((entry) => entry.kind === 'skill'))
  const [connectorItems, setConnectorItems] = useState<CapabilityItem[]>(() => hubItems.filter((entry) => entry.kind === 'connector'))
  const [picker, setPicker] = useState<HubCatalogFieldSpec | null>(null)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'name' | 'id' | ''>('')
  const nameRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.api?.sourcesList?.()
        const sources = (res?.sources || []).map((entry) => ({
          id: String(entry.id || ''),
          name: String(entry.displayName || entry.id || ''),
        })).filter((entry) => entry.id)
        setKnowledgeItems(sources)
      } catch {
        setKnowledgeItems([])
      }
    })()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [skillsResult, connectorsResult] = await Promise.allSettled([
        window.api?.capabilityList?.({ kind: 'skill' }),
        window.api?.capabilityList?.({ kind: 'connector' }),
      ])
      if (cancelled) return
      if (skillsResult.status === 'fulfilled') {
        const next = (skillsResult.value?.items || []).filter((entry) => entry.kind === 'skill')
        if (next.length) setSkillItems(next)
      }
      if (connectorsResult.status === 'fulfilled') {
        const next = (connectorsResult.value?.items || []).filter((entry) => entry.kind === 'connector')
        if (next.length) setConnectorItems(next)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!item?.id || mode === 'create') return
    void window.api?.expertGet?.(item.id).then((payload) => {
      const draft = draftFromExpertGet(payload, item.name || '')
      if (!draft) return
      if (mode === 'tune') {
        setName(draft.name)
        setExpertId(item.id)
      }
      setPersona(draft.description)
      setSoul(draft.soul)
      setSop(draft.sop)
      if (draft.avatar) {
        setAvatar(draft.avatar)
        setAvatarManual(true)
      }
      setAgenticType(normalizeAgenticType(draft.agenticType))
      setAgenticConfig(normalizeAgenticConfig(draft.agenticType, draft.agenticConfig) as Record<string, unknown>)
      setSkills(draft.skills)
      setConnectors(draft.connectors)
    })
  }, [item?.id, mode])

  useEffect(() => {
    if (idManual || mode === 'tune') return
    setExpertId(slugifyExpertId(name))
  }, [idManual, mode, name])

  useEffect(() => {
    if (avatarManual) return
    setAvatar(identityAvatarKey({
      name,
      description: persona,
      skills,
    }))
  }, [avatarManual, name, persona, skills])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !picker) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, picker])

  const catalogFields = useMemo(() => buildExpertCatalogFields({
    skills: skillItems,
    connectors: connectorItems,
    knowledgeRefs: knowledgeItems,
    selectedSkills: skills,
    selectedConnectors: connectors,
    selectedKnowledge: knowledgeRefs,
  }), [connectorItems, connectors, knowledgeItems, knowledgeRefs, skillItems, skills])

  const canDelete = mode === 'tune' && !!item && isUserCreatedExpert(item)
  const title = mode === 'tune' ? '调优专家' : mode === 'copy' ? '复制为自建专家' : '添加自己的专家'
  const idLocked = mode === 'tune'

  async function save() {
    if (!name.trim()) {
      setInvalid('name')
      setError('请填写名称')
      nameRef.current?.focus()
      return
    }
    const id = String(idLocked ? item?.id || expertId : expertId).trim()
    if (!id) {
      setInvalid('id')
      setError('请填写专家 ID')
      idRef.current?.focus()
      return
    }
    setInvalid('')
    const result = await window.api?.expertSave?.({
      id,
      name: name.trim(),
      description: persona.trim(),
      persona: persona.trim(),
      soul: soul.trim(),
      sop: sop.trim(),
      avatar,
      agenticType,
      agenticConfig,
      skills,
      connectors,
      knowledgeRefs,
    }) as { ok?: boolean; error?: string } | undefined
    if (result?.ok === false) {
      setError(result.error || '保存失败')
      return
    }
    onSaved()
    onClose()
  }

  async function remove() {
    await window.api?.expertDelete?.({ id: item?.id || expertId })
    onSaved()
    onClose()
  }

  function applyPicker(ids: string[]) {
    if (!picker) return
    if (picker.key === 'skills') setSkills(ids)
    if (picker.key === 'connectors') setConnectors(ids)
    if (picker.key === 'knowledgeRefs') setKnowledgeRefs(ids)
    setPicker(null)
    showToast(`已更新 ${picker.title}`)
  }

  function goEmptyAction(field: HubCatalogFieldSpec) {
    const tab = field.emptyAction?.tab
    if (tab === 'sources') {
      window.api?.openSettings?.('sources')
      showToast('在内容源添加后来此窗口点选择')
      return
    }
    if (tab === 'skill' || tab === 'connector') {
      setHubTab(tab as CapabilityKind)
      showToast('安装完成后回到此窗口点选择')
    }
  }

  const dialog = (
    <>
      <div className="hub-dialog-mask" data-testid="hub-expert-dialog" role="dialog" aria-modal="true" aria-labelledby="hubExpertDialogTitle">
        <div className="hub-dialog hub-expert-dialog">
          <div className="hub-dialog-head">
            <div>
            <span className="hub-section-kicker">专家</span>
              <h2 id="hubExpertDialogTitle">{title}</h2>
        <p id="hubExpertDialogDesc">配置人格、技能、知识库范围与工具，保存后可在工作台编排中使用。</p>
            </div>
            <button type="button" className="hub-icon-btn" aria-label="关闭" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <div className="hub-dialog-body" id="hubExpertDialogBody">
            <section className="hub-expert-section">
              <header className="hub-expert-section-head">
                <div>
                  <h3>基础信息</h3>
                  <p>名称、身份与头像会用于工作台编排。</p>
                </div>
              </header>
              <div className="hub-form-grid">
                <div className={`hub-field${invalid === 'name' ? ' invalid' : ''}`}>
                  <label htmlFor="hubExpertName">名称<span className="hub-req">必填</span></label>
                  <input
                    ref={nameRef}
                    id="hubExpertName"
                    aria-label="专家名称"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：值班助手"
                  />
                </div>
                <div className={`hub-field${invalid === 'id' ? ' invalid' : ''}`}>
                  <label htmlFor="hubExpertId">ID<span className="hub-req">必填</span></label>
                  <input
                    ref={idRef}
                    id="hubExpertId"
                    aria-label="专家 ID"
                    value={idLocked ? (item?.id || expertId) : expertId}
                    readOnly={idLocked}
                    onChange={(e) => {
                      setIdManual(true)
                      setExpertId(e.target.value)
                    }}
                    placeholder="duty-assistant"
                  />
                </div>
              </div>
              <div className="hub-field">
              <label htmlFor="hubExpertPersona">角色设定</label>
                <textarea id="hubExpertPersona" aria-label="专家 persona" value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="描述专家的语气、边界与擅长领域" />
              </div>
              <div className="hub-form-grid">
                <div className="hub-field">
              <label htmlFor="hubExpertSoul">内在准则</label>
                  <textarea id="hubExpertSoul" value={soul} onChange={(e) => setSoul(e.target.value)} placeholder="专家的立场与气质" />
                </div>
                <div className="hub-field">
              <label htmlFor="hubExpertSop">工作流程</label>
                  <textarea id="hubExpertSop" value={sop} onChange={(e) => setSop(e.target.value)} placeholder="默认工作步骤" />
                </div>
              </div>
              <HubExpertAvatarRow
                value={avatar}
                onChange={(id) => {
                  setAvatarManual(true)
                  setAvatar(id)
                }}
              />
            </section>
            <HubAgenticFields
              agenticType={agenticType}
              agenticConfig={agenticConfig}
              onTypeChange={(type, config) => {
                setAgenticType(type)
                setAgenticConfig(config)
              }}
              onConfigChange={setAgenticConfig}
            />
            {catalogFields.map((field) => (
              <HubCatalogSummary
                key={field.name}
                field={field}
                onOpen={() => setPicker(field)}
                onEmptyAction={() => goEmptyAction(field)}
              />
            ))}
            {error ? <p className="empty">{error}</p> : null}
          </div>
          <div className="hub-dialog-foot">
            <button type="button" className="hub-btn danger" hidden={!canDelete} onClick={() => void remove()}>删除专家</button>
            <span className="hub-dialog-foot-hint" id="hubExpertSummary" aria-live="polite">
              {expertEditorFooterSummary({
                id: idLocked ? String(item?.id || expertId) : expertId,
                name,
                skills: skills.length,
                connectors: connectors.length,
                knowledge: knowledgeRefs.length,
              })}
            </span>
            <div className="hub-dialog-foot-actions">
              <button type="button" className="hub-btn" id="hubExpertCancel" onClick={onClose}>取消</button>
              <button type="button" className="hub-btn primary" id="hubExpertSave" onClick={() => void save()}>保存专家</button>
            </div>
          </div>
        </div>
      </div>
      {picker ? (
        <HubPickerDialog spec={picker} onClose={() => setPicker(null)} onApply={applyPicker} />
      ) : null}
    </>
  )

  return createPortal(dialog, document.body)
}
