import { useEffect, useState } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import { parseExpertWorkbenchDetail, type ExpertWorkbenchDetail } from '../../../domain/expert-workbench-detail'
import { useAppStore } from '../../app/store'
import { ExpertAvatarMark } from './ExpertAvatarMark'
import { WorkbenchDetailHeaderAction } from '../workbench/WorkbenchDetailHeaderAction'

export function ExpertDetailSurface({
  expert,
  onBack,
  onStart,
  backLabel = '返回专家协作',
  contextLabel = '单专家 · 专业节点',
  startLabel = '发起协作',
  common,
  onToggleCommon,
  onEdit,
  onRemove,
}: {
  expert: CapabilityItem
  onBack: () => void
  onStart: (detail: ExpertWorkbenchDetail) => void
  backLabel?: string
  contextLabel?: string
  startLabel?: string
  common?: boolean
  onToggleCommon?: () => void
  onEdit?: () => void
  onRemove?: () => void
}) {
  const [detail, setDetail] = useState(() => parseExpertWorkbenchDetail(null, expert))
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const setHubQuery = useAppStore((s) => s.setHubQuery)

  useEffect(() => {
    let active = true
    void window.api?.expertGet?.(expert.id).then((result) => {
      if (active) setDetail(parseExpertWorkbenchDetail(result, expert))
    }).catch(() => null)
    return () => { active = false }
  }, [expert])

  function manage() {
    setHubTab('expert')
    setHubQuery(expert.id)
    setRoute('capabilities')
  }

  return (
    <article className="wb-expert-detail" data-testid="expert-detail" aria-labelledby="wbExpertDetailTitle">
      <WorkbenchDetailHeaderAction label={backLabel} onBack={onBack} />
      <header className="wb-expert-detail-hero">
        <ExpertAvatarMark agent={expert} className="wb-expert-detail-avatar" size={52} />
        <div className="wb-expert-detail-intro">
          <span className="wb-detail-eyebrow">{contextLabel}</span>
          <h1 id="wbExpertDetailTitle">{detail.name}</h1>
          <p>{detail.description}</p>
          <div className="wb-expert-detail-actions">
            <button type="button" className="wb-modal-btn primary" onClick={() => onStart(detail)}>{startLabel}</button>
            {onToggleCommon ? (
              <button type="button" className="wb-modal-btn" onClick={onToggleCommon}>{common ? '从工作台撤回' : '设为常用专家'}</button>
            ) : null}
            {onEdit ? <button type="button" className="wb-modal-btn" onClick={onEdit}>编辑专家</button> : null}
            {!onToggleCommon && !onEdit ? <button type="button" className="wb-modal-btn" onClick={manage}>前往能力中心管理</button> : null}
            {onRemove ? <button type="button" className="wb-detail-link is-danger" onClick={onRemove}>从我的专家移除</button> : null}
          </div>
        </div>
      </header>
      <div className="wb-expert-detail-grid">
        {onToggleCommon ? (
          <section className="wb-detail-section is-wide wb-personal-expert-status">
            <span className="wb-detail-section-kicker">工作台协作</span>
            <strong>{common ? '已设为常用专家' : '已收在我的专家'}</strong>
            <p>{common ? '智能伙伴可以读取这位专家的用途与能力边界，在转接协作时优先推荐。' : '这位专家仍属于你，但不在工作台常用列表中。'}</p>
          </section>
        ) : null}
        <section className="wb-detail-section is-wide">
          <span className="wb-detail-section-kicker">适合交给这位专家</span>
          <ul className="wb-detail-use-cases">{detail.useCases.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="wb-detail-section">
          <span className="wb-detail-section-kicker">本次需要</span>
          <ul>{detail.inputs.map((item) => <li key={item.id}>{item.label}{item.required ? ' · 必需' : ''}</li>)}</ul>
        </section>
        <section className="wb-detail-section">
          <span className="wb-detail-section-kicker">可以交付</span>
          <ul>{detail.outputs.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
        </section>
        <section className="wb-detail-section">
          <span className="wb-detail-section-kicker">能力边界</span>
          <ul>{detail.boundaries.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="wb-detail-section">
          <span className="wb-detail-section-kicker">可用能力</span>
          <div className="wb-detail-token-row">
            {[...detail.skills, ...detail.connectors].map((item) => <span key={item}>{item}</span>)}
            {!detail.skills.length && !detail.connectors.length ? <small>按专家默认配置执行</small> : null}
          </div>
        </section>
      </div>
    </article>
  )
}
