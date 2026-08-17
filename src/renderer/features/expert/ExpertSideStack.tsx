import { useEffect, useMemo, useRef, useState } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import {
  buildExpertCatalogFields,
  hubCatalogSelectedChips,
  type HubCatalogFieldSpec,
} from '../../../domain/hub-catalog-fields'
import { catalogRefIds, draftFromExpertGet } from '../../../domain/hub-expert-editor'
import { expertCardTitle, expertSourceBadge } from '../../../domain/expert-present'
import { useAppStore } from '../../app/store'
import { HubPickerDialog } from '../capability-hub/HubPickerDialog'
import { ExpertAvatarMark } from './ExpertAvatarMark'

const PANEL_TITLE: Record<HubCatalogFieldSpec['key'], string> = {
  connectors: '连接器',
  skills: '技能',
  knowledgeRefs: '知识',
}

export function ExpertSideStack({
  expert,
  goal,
  onGoalChange,
}: {
  expert: CapabilityItem
  goal: string
  onGoalChange: (value: string) => void
}) {
  const room = useAppStore((s) => s.expertRoom)
  const hubItems = useAppStore((s) => s.hubItems)
  const patchExpertRoomBindings = useAppStore((s) => s.patchExpertRoomBindings)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const setRoute = useAppStore((s) => s.setRoute)
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; name?: string }>>([])
  const [picker, setPicker] = useState<HubCatalogFieldSpec | null>(null)
  const seeded = useRef('')

  const name = expertCardTitle(expert)
  const badge = expertSourceBadge(expert)
  const role = expert.category || '专家'

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
    if (!expert.id || seeded.current === expert.id) return
    seeded.current = expert.id
    void window.api?.expertGet?.(expert.id).then((payload) => {
      const draft = draftFromExpertGet(payload, expert.name || '')
      if (!draft || useAppStore.getState().expertRoom?.id !== expert.id) return
      patchExpertRoomBindings({
        skills: catalogRefIds(draft.skills),
        connectors: catalogRefIds(draft.connectors),
      })
    }).catch(() => null)
  }, [expert.id, expert.name, patchExpertRoomBindings])

  const fields = useMemo(() => buildExpertCatalogFields({
    skills: hubItems.filter((item) => item.kind === 'skill'),
    connectors: hubItems.filter((item) => item.kind === 'connector'),
    knowledgeRefs: knowledgeItems,
    selectedSkills: room?.skills || [],
    selectedConnectors: room?.connectors || [],
    selectedKnowledge: room?.knowledgeRefs || [],
  }), [hubItems, knowledgeItems, room?.connectors, room?.knowledgeRefs, room?.skills])

  function applyPicker(ids: string[]) {
    if (!picker) return
    if (picker.key === 'skills') patchExpertRoomBindings({ skills: ids })
    if (picker.key === 'connectors') patchExpertRoomBindings({ connectors: ids })
    if (picker.key === 'knowledgeRefs') patchExpertRoomBindings({ knowledgeRefs: ids })
    setPicker(null)
  }

  function goEmpty(field: HubCatalogFieldSpec) {
    const tab = field.emptyAction?.tab
    if (tab === 'sources') {
      useAppStore.getState().openSettingsSurface('sources')
      return
    }
    if (tab === 'skill' || tab === 'connector') {
      setHubTab(tab === 'connector' ? 'connector' : 'skill')
      setRoute('capabilities')
    }
  }

  return (
    <div className="wb-side-stack">
      <section className="wb-side-panel wb-side-expert">
        <ExpertAvatarMark agent={expert} className="wb-side-avatar" size={48} />
        <div className="wb-side-expert-copy">
          <div className="wb-side-expert-name">
            <strong>{name}</strong>
            <span className="wb-side-badge">{badge}</span>
          </div>
          <div className="wb-side-caps" aria-label="专业能力">
            <span className="wb-side-cap">{role}</span>
            <span className="wb-side-cap">ReAct</span>
          </div>
        </div>
      </section>
      <section className="wb-side-panel">
        <div className="wb-side-panel-head"><strong>任务</strong></div>
        <label className="wb-run-field">
          <textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="描述希望这位专家完成的事"
            aria-label="协作目标"
          />
        </label>
      </section>
      {fields.map((field) => (
        <BindingPanel
          key={field.key}
          field={field}
          onManage={() => {
            if (!field.items.length) {
              goEmpty(field)
              return
            }
            setPicker(field)
          }}
          onEmpty={() => goEmpty(field)}
        />
      ))}
      <p className="wb-side-hint">技能/连接器调整仅影响本次协作，不改写专家包。</p>
      {picker ? (
        <HubPickerDialog spec={picker} onClose={() => setPicker(null)} onApply={applyPicker} />
      ) : null}
    </div>
  )
}

function BindingPanel({
  field,
  onManage,
  onEmpty,
}: {
  field: HubCatalogFieldSpec
  onManage: () => void
  onEmpty: () => void
}) {
  const chips = hubCatalogSelectedChips(field.items, field.selected)
  const title = PANEL_TITLE[field.key]
  const countLabel = field.key === 'knowledgeRefs' && !field.selected.length ? '默认' : String(field.selected.length)
  return (
    <section className="wb-side-panel" data-side-section={field.key} data-testid={`expert-side-${field.key}`}>
      <div className="wb-side-panel-head">
        <strong>{title}</strong>
        <span>{countLabel}</span>
        <button
          type="button"
          className="wb-side-manage"
          title={`管理本次协作${title}`}
          data-testid={`expert-side-manage-${field.key}`}
          onClick={onManage}
        >
          管理
        </button>
      </div>
      <div className="wb-side-icons" aria-label={title}>
        {field.items.length === 0 ? (
          <button type="button" className="wb-side-empty" onClick={onEmpty}>{field.emptyAction?.label || field.emptyLabel}</button>
        ) : chips.empty ? (
          <span className="wb-side-empty">{field.key === 'knowledgeRefs' ? '默认知识范围，点击管理调整' : '点击管理添加'}</span>
        ) : (
          chips.chips.map((chip) => (
            <span key={chip.id} className="wb-side-chip is-ready" title={chip.name}>
              {chip.name}
            </span>
          ))
        )}
      </div>
    </section>
  )
}
