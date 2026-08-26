import { useEffect, useMemo, useState } from 'react'
import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { catalogRefIds, draftFromExpertGet } from '../../../domain/hub-expert-editor'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { ExpertAvatarMark } from './ExpertAvatarMark'

type CapabilityGroup = {
  key: 'skills' | 'knowledge' | 'connectors'
  title: string
  icon: string
  stateLabel: string
  refs: string[]
}

function itemName(items: Array<{ id: string; name?: string; displayName?: string }>, id: string) {
  const item = items.find((entry) => entry.id === id)
  return String(item?.displayName || item?.name || id)
}

export function ExpertTaskCapabilities({
  task,
  stageLabel,
  goal,
  onDelete,
}: {
  task: WorkbenchTask | null
  stageLabel: string
  goal: string
  onDelete?: () => void
}) {
  const room = useAppStore((state) => state.expertRoom)
  const hubItems = useAppStore((state) => state.hubItems)
  const [expertBindings, setExpertBindings] = useState({ skills: [] as string[], connectors: [] as string[] })
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; displayName?: string }>>([])

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

  useEffect(() => {
    let active = true
    void window.api?.sourcesList?.().then((result) => {
      if (!active) return
      setKnowledgeItems((result?.sources || []).map((item) => ({
        id: String(item.id || ''),
        displayName: String(item.displayName || ''),
      })).filter((item) => item.id))
    }).catch(() => null)
    return () => { active = false }
  }, [])

  const taskKnowledgeRefs = catalogRefIds(task?.knowledgeRefs)
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
      stateLabel: '已授权',
    },
  ], [connectors, knowledge, skills])

  const total = skills.length + knowledge.length + connectors.length
  const expertId = String(task?.expertId || room?.expertId || room?.id || '')
  const expertItem = hubItems.find((item) => item.id === expertId)
  const expertName = String(task?.expertName || expertItem?.name || room?.name || expertId)
  const expertDescription = String(expertItem?.description || expertItem?.category || '单专家 · 专业协作')
  const outputLabel = (task?.brief?.deliverables || []).map((item) => item.title).filter(Boolean).join('、') || '确认计划后锁定'
  function resolveName(group: CapabilityGroup, id: string) {
    if (group.key === 'knowledge') return itemName(knowledgeItems, id)
    return itemName(hubItems as CapabilityItem[], id)
  }

  return (
    <aside className="wb-expert-capabilities" aria-label="专家工作台" data-testid="expert-task-capabilities">
      <section className="wb-expert-profile-card" aria-label="当前专家">
        <ExpertAvatarMark agent={{ id: expertId, name: expertName }} className="wb-expert-profile-avatar" size={44} />
        <div>
          <h2>{expertName}</h2>
          <p>{expertDescription}</p>
        </div>
        {onDelete ? (
          <button type="button" className="wb-expert-delete-button" aria-label="删除本任务" title="删除任务" onClick={onDelete}>
            <Icon name="trash" />
          </button>
        ) : null}
      </section>
      <section className="wb-expert-contract" aria-label={`本次委托：${stageLabel}`}>
        <dl>
          <div><dt>目标</dt><dd>{goal || '正在澄清'}</dd></div>
          <div><dt>交付</dt><dd>{outputLabel}</dd></div>
        </dl>
      </section>
      <header className="wb-expert-capabilities-head">
        <h3>能力</h3>
        <span className="wb-expert-capability-total">{total || '未配置'}</span>
      </header>
      <div className="wb-expert-capability-groups">
        {groups.map((group) => (
          <section key={group.key} className="wb-expert-capability-group" data-testid={`expert-task-${group.key}`}>
            <header>
              <span className="wb-expert-capability-icon" aria-hidden="true"><Icon name={group.icon} /></span>
              <strong>{group.title}</strong>
              <span>{group.refs.length || (group.key === 'knowledge' ? '默认' : '未配置')}</span>
            </header>
            {group.refs.length ? (
              <ul>
                {group.refs.map((id) => (
                  <li key={id}>
                    <strong title={resolveName(group, id)}>{resolveName(group, id)}</strong>
                    <span>{group.stateLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="wb-expert-capability-empty">
                <span>{group.key === 'knowledge' ? '使用默认知识范围' : '未配置'}</span>
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>
  )
}
