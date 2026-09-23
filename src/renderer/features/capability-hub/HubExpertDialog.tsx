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
import * as AgenticProfile from '@knowme-lib/expert-agentic-profile'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { HubAgenticFields } from './HubAgenticFields'
import { HubCatalogSummary } from './HubCatalogSummary'
import { HubExpertAvatarRow } from './HubExpertAvatarRow'
import { HubPickerDialog } from './HubPickerDialog'
import { buildKnowledgeSelectionOptions } from '../../../shared/knowledge-selection'

const normalizeAgenticType = (AgenticProfile as any).normalizeAgenticType
const normalizeAgenticConfig = (AgenticProfile as any).normalizeAgenticConfig

function lines(value: string): string[] {
  return [...new Set(value.split(/\r?\n|[；;]/).map((item) => item.trim()).filter(Boolean))]
}

function safeExpertId(name: string, fallback = ''): string {
  const candidate = slugifyExpertId(name).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '')
  return candidate || fallback || `agent-${Date.now().toString(36)}`
}

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
  const openExpertRoom = useAppStore((s) => s.openExpertRoom)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const [name, setName] = useState(() => (
    mode === 'copy' ? `${item?.name || item?.id || '专家'}（我的）` : (item?.name || '')
  ))
  const [expertId, setExpertId] = useState(() => (
    mode === 'tune' && item?.id
      ? item.id
      : safeExpertId(mode === 'copy' ? `${item?.name || '专家'}（我的）` : (item?.name || ''))
  ))
  const [idManual, setIdManual] = useState(mode === 'tune')
  const [persona, setPersona] = useState(String(item?.description || ''))
  const [useCasesText, setUseCasesText] = useState('')
  const [boundariesText, setBoundariesText] = useState('')
  const [inputsText, setInputsText] = useState('')
  const [outputsText, setOutputsText] = useState('')
  const [soul, setSoul] = useState('')
  const [sop, setSop] = useState('')
  const [avatar, setAvatar] = useState(() => String(item?.avatar || ''))
  const [agenticType, setAgenticType] = useState('react')
  const [agenticConfig, setAgenticConfig] = useState<Record<string, unknown>>({})
  const [skills, setSkills] = useState<string[]>(() => catalogRefIds(item?.skills))
  const [connectors, setConnectors] = useState<string[]>(() => catalogRefIds(item?.connectors))
  const [knowledgeRefs, setKnowledgeRefs] = useState<string[]>([])
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; name?: string; category?: string }>>([])
  const [skillItems, setSkillItems] = useState<CapabilityItem[]>(() => hubItems.filter((entry) => entry.kind === 'skill'))
  const [connectorItems, setConnectorItems] = useState<CapabilityItem[]>(() => hubItems.filter((entry) => entry.kind === 'connector'))
  const [picker, setPicker] = useState<HubCatalogFieldSpec | null>(null)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<'name' | 'id' | 'persona' | 'useCases' | 'boundaries' | 'inputs' | 'outputs' | ''>('')
  const nameRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await window.api?.knowledgeProviderList?.()
        const options = buildKnowledgeSelectionOptions(res?.providers || [])
        if (options.length) {
          setKnowledgeItems(options.map((entry) => ({
          id: entry.id,
          name: entry.name,
          category: entry.category,
          })))
          return
        }
        const fallback = await window.api?.sourcesList?.()
        setKnowledgeItems((fallback?.sources || []).map((entry) => ({
          id: String(entry.id || ''),
          name: String(entry.displayName || entry.id || ''),
          category: '外挂知识库',
        })).filter((entry) => entry.id))
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
      }
      setAgenticType(normalizeAgenticType(draft.agenticType))
      setAgenticConfig(normalizeAgenticConfig(draft.agenticType, draft.agenticConfig) as Record<string, unknown>)
      setSkills(draft.skills)
      setConnectors(draft.connectors)
    })
  }, [item?.id, mode])

  useEffect(() => {
    if (idManual || mode === 'tune') return
    setExpertId((current) => safeExpertId(name, current))
  }, [idManual, mode, name])

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
  const createsDraft = mode !== 'tune'
  const title = mode === 'tune' ? '调优专家' : mode === 'copy' ? '复制专家' : '创建专家'
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
    if (createsDraft && !persona.trim()) {
      setInvalid('persona')
      setError('请填写一句话职责')
      return
    }
    const useCases = lines(useCasesText)
    const boundaries = lines(boundariesText)
    const inputs = lines(inputsText)
    const outputs = lines(outputsText)
    const requiredDraftFields: Array<[typeof invalid, string[], string]> = [
      ['useCases', useCases, '请至少填写一个主要场景'],
      ['boundaries', boundaries, '请至少填写一个能力边界'],
      ['inputs', inputs, '请至少填写一个主要输入'],
      ['outputs', outputs, '请至少填写一个预期交付物'],
    ]
    if (createsDraft) {
      const missing = requiredDraftFields.find(([, values]) => values.length === 0)
      if (missing) {
        setInvalid(missing[0])
        setError(missing[2])
        return
      }
    }
    setInvalid('')
    if (createsDraft) {
      const draftResult = await window.api?.agentRegistryDraftSave?.({
        intent: 'create',
        draft: {
          id,
          name: name.trim(),
          description: persona.trim(),
          version: '0.1.0',
          avatar,
          soul: soul.trim(),
          sop: sop.trim(),
          agenticType,
          agenticConfig,
          skills,
          connectors,
          knowledgeRefs,
          useCases,
          boundaries,
          inputs: inputs.map((value) => ({ name: value, required: true })),
          outputs: outputs.map((value) => ({ name: value, required: true })),
        },
      }) as { ok?: boolean; error?: string } | undefined
      if (!draftResult?.ok) {
        setError(draftResult?.error || '专家草稿保存失败')
        return
      }
      const operationsInstall = await window.api?.capabilityInstall?.({
        id: 'agent-operations',
        kind: 'expert',
      }) as { ok?: boolean; error?: string } | undefined
      if (!operationsInstall?.ok) {
        setError(operationsInstall?.error || '草稿已保存，但能力管家尚未就绪，请重试')
        return
      }
      const goal = `完善并验证专家草稿「${name.trim()}」；草稿 ID：${id}。补齐专业定义、能力配置、调试和评估，获得我的明确确认后再预览发布。`
      const roomResult = await window.api?.workbenchTaskCreate?.({
        kind: 'expert',
        title: `调优 ${name.trim()}`,
        goal,
        expertId: 'agent-operations',
        expertName: '能力管家',
        status: 'draft',
        brief: {
          goal,
          materials: [{
            id: 'agent-draft-reference',
            type: 'text',
            title: '待调优专家草稿',
            content: `Agent draft id: ${id}\n名称：${name.trim()}\n职责：${persona.trim()}`,
          }],
          deliverables: [{ id: 'governance-result', title: `${name.trim()}的调优、测试与发布结果`, type: 'answer', required: true }],
        },
        events: [{ type: 'created', summary: `已创建 ${name.trim()} 草稿，进入能力管家协作` }],
      }) as { ok?: boolean; error?: string; task?: { id?: string; status?: string } } | undefined
      if (!roomResult?.ok || !roomResult.task?.id) {
        setError(roomResult?.error || '草稿已保存，但能力管家协作房创建失败，请重试')
        return
      }
      await loadTasks()
      onSaved()
      onClose()
      openExpertRoom({
        id: roomResult.task.id,
        taskId: roomResult.task.id,
        taskStatus: roomResult.task.status || 'draft',
        expertId: 'agent-operations',
          name: '能力管家',
        goal,
      })
      showToast('专家草稿已保存，已进入能力管家协作房')
      return
    }
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
              <h2 id="hubExpertDialogTitle">{title}</h2>
            </div>
            <button type="button" className="hub-icon-btn" aria-label="关闭" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <div className="hub-dialog-body" id="hubExpertDialogBody">
            <section className="hub-expert-section">
              <div className="hub-expert-identity-row">
                <div className={`hub-field${invalid === 'name' ? ' invalid' : ''}`}>
                  <label htmlFor="hubExpertName">名称<span className="hub-req" aria-label="必填">*</span></label>
                  <input
                    ref={nameRef}
                    id="hubExpertName"
                    aria-label="专家名称"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="值班助手"
                  />
                </div>
                <HubExpertAvatarRow value={avatar} onChange={setAvatar} />
              </div>
              {!createsDraft ? (
                <div className={`hub-field${invalid === 'id' ? ' invalid' : ''}`}>
                  <label htmlFor="hubExpertId">ID<span className="hub-req" aria-label="必填">*</span></label>
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
              ) : null}
              <div className={`hub-field${invalid === 'persona' ? ' invalid' : ''}`}>
              <label htmlFor="hubExpertPersona">{createsDraft ? '一句话职责' : '角色设定'}{createsDraft ? <span className="hub-req" aria-label="必填">*</span> : null}</label>
                <textarea id="hubExpertPersona" aria-label="专家 persona" required={createsDraft} value={persona} onChange={(e) => setPersona(e.target.value)} placeholder={createsDraft ? '负责归因客户反馈并提出产品建议' : '描述专家的语气、边界与擅长领域'} />
              </div>
              {createsDraft ? (
                <>
                  <div className="hub-form-grid hub-draft-contract-grid">
                    <div className={`hub-field${invalid === 'useCases' ? ' invalid' : ''}`}>
                      <label htmlFor="hubExpertUseCases">主要场景<span className="hub-req" aria-label="必填">*</span></label>
                      <textarea id="hubExpertUseCases" aria-label="主要场景" required value={useCasesText} onChange={(e) => setUseCasesText(e.target.value)} placeholder={'分析一周客户反馈\n识别高频问题'} />
                    </div>
                    <div className={`hub-field${invalid === 'boundaries' ? ' invalid' : ''}`}>
                      <label htmlFor="hubExpertBoundaries">能力边界<span className="hub-req" aria-label="必填">*</span></label>
                      <textarea id="hubExpertBoundaries" aria-label="能力边界" required value={boundariesText} onChange={(e) => setBoundariesText(e.target.value)} placeholder="不代替负责人做最终决策" />
                    </div>
                  </div>
                  <div className="hub-form-grid hub-draft-contract-grid">
                    <div className={`hub-field${invalid === 'inputs' ? ' invalid' : ''}`}>
                      <label htmlFor="hubExpertInputs">主要输入<span className="hub-req" aria-label="必填">*</span></label>
                      <textarea id="hubExpertInputs" aria-label="主要输入" required value={inputsText} onChange={(e) => setInputsText(e.target.value)} placeholder={'反馈文本与来源\n分析时间范围'} />
                    </div>
                    <div className={`hub-field${invalid === 'outputs' ? ' invalid' : ''}`}>
                      <label htmlFor="hubExpertOutputs">预期交付物<span className="hub-req" aria-label="必填">*</span></label>
                      <textarea id="hubExpertOutputs" aria-label="预期交付物" required value={outputsText} onChange={(e) => setOutputsText(e.target.value)} placeholder={'问题归因报告\n改进建议清单'} />
                    </div>
                  </div>
                </>
              ) : <div className="hub-form-grid">
                <div className="hub-field">
              <label htmlFor="hubExpertSoul">内在准则</label>
                  <textarea id="hubExpertSoul" value={soul} onChange={(e) => setSoul(e.target.value)} placeholder="专家的立场与气质" />
                </div>
                <div className="hub-field">
              <label htmlFor="hubExpertSop">工作流程</label>
                  <textarea id="hubExpertSop" value={sop} onChange={(e) => setSop(e.target.value)} placeholder="默认工作步骤" />
                </div>
              </div>}
            </section>
            {!createsDraft ? <HubAgenticFields
              agenticType={agenticType}
              agenticConfig={agenticConfig}
              onTypeChange={(type, config) => {
                setAgenticType(type)
                setAgenticConfig(config)
              }}
              onConfigChange={setAgenticConfig}
            /> : null}
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
            {!createsDraft ? <span className="hub-dialog-foot-hint" id="hubExpertSummary" aria-live="polite">
              {expertEditorFooterSummary({
                id: idLocked ? String(item?.id || expertId) : expertId,
                name,
                skills: skills.length,
                connectors: connectors.length,
                knowledge: knowledgeRefs.length,
              })}
            </span> : null}
            <div className="hub-dialog-foot-actions">
              <button type="button" className="hub-btn" id="hubExpertCancel" onClick={onClose}>取消</button>
              <button type="button" className="hub-btn primary" id="hubExpertSave" onClick={() => void save()}>{createsDraft ? '保存并调优' : '保存专家'}</button>
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
