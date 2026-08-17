import { useMemo, useState } from 'react'
import { workbenchHomeExperts } from '../../../domain/workbench-home'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { TaskQuickCard } from '../taskhome/TaskQuickCard'

type Props = {
  onClose: () => void
}

export function StudioExpertPicker({ onClose }: Props) {
  const hubItems = useAppStore((s) => s.hubItems)
  const modes = useAppStore((s) => s.modes)
  const addStudioAgent = useAppStore((s) => s.addStudioAgent)
  const setRoute = useAppStore((s) => s.setRoute)
  const setHubTab = useAppStore((s) => s.setHubTab)
  const experts = useMemo(() => workbenchHomeExperts(hubItems, modes), [hubItems, modes])
  const [selected, setSelected] = useState<string[]>([])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  function confirm() {
    const chosen = experts.filter((item) => selected.includes(item.id))
    for (const expert of chosen) {
      addStudioAgent({ id: expert.id, name: expert.name, description: expert.description })
    }
    onClose()
  }

  return (
    <div
      className="wb-modal-mask is-studio-expert-picker"
      data-testid="studio-expert-picker"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="wb-modal wb-studio-expert-picker" role="dialog" aria-modal="true" aria-labelledby="wbStudioExpertPickerTitle">
        <div className="wb-modal-head">
          <h2 id="wbStudioExpertPickerTitle">选择专家</h2>
          <div className="wb-studio-expert-picker-head-actions">
            <button
              type="button"
              className="wb-studio-expert-picker-library"
              title="打开专家库，添加专家到工作台"
              onClick={() => {
                setHubTab('expert')
                setRoute('capabilities')
                onClose()
              }}
            >
              <Icon name="capabilityStack" />
              <span>专家库</span>
            </button>
            <button type="button" className="wb-modal-close" aria-label="关闭" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="wb-modal-body">
          <div className="wb-studio-expert-picker-grid" id="wbStudioExpertPickerGrid">
            {experts.length === 0 ? (
              <p className="empty">还没有添加到工作台的专家。到专家库选择专家并「添加到工作台」。</p>
            ) : experts.map((item, index) => (
              <div key={item.id} data-studio-expert-pick={item.id}>
                <TaskQuickCard
                  item={item}
                  index={index}
                  selected={selected.includes(item.id)}
                  onOpen={() => toggle(item.id)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="wb-modal-foot">
          <button type="button" className="wb-modal-btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="wb-modal-btn primary"
            data-testid="studio-expert-picker-confirm"
            disabled={!selected.length}
            onClick={confirm}
          >
            添加到画布
          </button>
        </div>
      </div>
    </div>
  )
}
