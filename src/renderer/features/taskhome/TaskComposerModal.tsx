import { useEffect, useMemo, useState } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'
import { useAppStore } from '../../app/store'

type ScheduleType = 'daily' | 'interval' | 'once'

function providerStatus(kind: string, enabled = true) {
  if (!enabled) return '未启用'
  return kind === 'local' || kind === 'qmd-local' ? '本地知识' : '远程知识'
}

export function TaskComposerModal({
  experts,
  onClose,
}: {
  experts: CapabilityItem[]
  onClose: () => void
}) {
  const showToast = useAppStore((s) => s.showToast)
  const openExpertRoom = useAppStore((s) => s.openExpertRoom)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const loadStudioKnowledgeProviders = useAppStore((s) => s.loadStudioKnowledgeProviders)
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const providers = useAppStore((s) => s.studioKnowledgeProviders)
  const knowledgeWiki = useAppStore((s) => s.knowledgeWiki)
  const knowledgeOkf = useAppStore((s) => s.knowledgeOkf)
  const [expertId, setExpertId] = useState(String(experts[0]?.id || ''))
  const [goal, setGoal] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [knowledgeRefs, setKnowledgeRefs] = useState<string[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily')
  const [dailyTime, setDailyTime] = useState('09:00')
  const [intervalValue, setIntervalValue] = useState(24)
  const [intervalUnit, setIntervalUnit] = useState<'hour' | 'day'>('hour')
  const [onceAt, setOnceAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selected = experts.find((item) => item.id === expertId) || experts[0]
  const knowledgeOptions = useMemo(() => {
    if (providers.length) {
      return providers.map((item) => ({
        id: item.id,
        title: item.name || item.id,
        status: providerStatus(item.kind || ''),
      }))
    }
    return [...knowledgeWiki, ...knowledgeOkf].map((item) => ({
      id: item.path,
      title: item.title || '我的知识',
      status: '本地知识',
    }))
  }, [knowledgeOkf, knowledgeWiki, providers])

  useEffect(() => {
    void loadStudioKnowledgeProviders()
    void loadKnowledge()
  }, [loadKnowledge, loadStudioKnowledgeProviders])

  function toggleKnowledge(id: string) {
    setKnowledgeRefs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  async function submit() {
    const expert = selected
    const trimmed = goal.trim()
    if (!expert?.id) {
      showToast('请选择一位专家')
      return
    }
    if (!trimmed) {
      showToast('请填写协作目标')
      return
    }
    if (scheduleEnabled && scheduleType === 'once' && !onceAt) {
      showToast('请选择单次执行时间')
      return
    }
    setSubmitting(true)
    const expertName = expert.name || expert.id
    try {
      await window.api?.workbenchTaskCreate?.({
        title: trimmed.slice(0, 60),
        goal: trimmed,
        expertId: expert.id,
        expertName,
        knowledgeRefs,
        status: 'draft',
        scheduleEnabled,
        schedule: scheduleEnabled
          ? { type: scheduleType, dailyTime, intervalValue, intervalUnit, onceAt }
          : undefined,
      })
      await loadTasks()
      openExpertRoom({ id: expert.id, name: expertName, goal: trimmed })
      onClose()
    } catch {
      showToast('无法开始专家对话，任务已保留为草稿')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="wb-modal-mask"
      id="wbTaskComposer"
      data-testid="task-composer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wbTaskComposerTitle"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="wb-modal wb-task-composer-modal">
        <div className="wb-modal-head">
          <strong id="wbTaskComposerTitle" className="wb-modal-title">安排专家协作</strong>
          <button type="button" className="wb-modal-close" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className="wb-modal-body">
          <div className="wb-studio-field">
            <span>选择专家</span>
            <div className={`wb-task-expert-picker${menuOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="wb-task-expert-trigger"
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="wb-task-expert-trigger-body">
                  {selected ? (
                    <>
                      <ExpertAvatarMark agent={selected} className="wb-task-expert-mark" size={28} />
                      <span className="wb-task-expert-copy">
                        <strong>{selected.name || selected.id}</strong>
                        <small>{selected.category || selected.description || '专业 Agent'}</small>
                      </span>
                    </>
                  ) : (
                    <span className="wb-task-expert-placeholder">选择一位专家</span>
                  )}
                </span>
                <span className="wb-task-expert-chevron" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="wb-task-expert-menu" role="listbox">
                  {experts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`wb-task-expert-option${item.id === selected?.id ? ' is-selected' : ''}`}
                      role="option"
                      aria-selected={item.id === selected?.id}
                      onClick={() => { setExpertId(item.id); setMenuOpen(false) }}
                    >
                      <ExpertAvatarMark agent={item} className="wb-task-expert-mark" size={28} />
                      <span className="wb-task-expert-copy">
                        <strong>{item.name || item.id}</strong>
                        <small>{item.category || item.description || '专业 Agent'}</small>
                      </span>
                      {item.id === selected?.id ? <span className="wb-task-expert-check" aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <label className="wb-studio-field">
            <span>协作目标</span>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="描述你希望这位专家完成什么"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </label>
          <div className="wb-studio-field wb-task-knowledge-field">
            <span>知识库</span>
            <div className="wb-task-knowledge-list">
              {knowledgeOptions.length === 0 ? (
                <span className="wb-task-knowledge-hint">还没有可选知识库，可先直接对话，之后在设置中添加。</span>
              ) : knowledgeOptions.map((item) => (
                <label key={item.id} className="wb-task-knowledge-option">
                  <input
                    type="checkbox"
                    checked={knowledgeRefs.includes(item.id)}
                    onChange={() => toggleKnowledge(item.id)}
                  />
                  <span className="wb-task-knowledge-meta">
                    <strong>{item.title}</strong>
                    <small>{item.status}</small>
                  </span>
                </label>
              ))}
            </div>
            <small className="wb-task-knowledge-hint">不选则沿用默认知识库；勾选后仅在所选范围内检索。</small>
          </div>
          <div className="wb-studio-field wb-task-composer-schedule">
            <label className="wb-task-schedule-toggle">
              <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
              <span className="wb-task-schedule-toggle-copy">
                <strong>定时执行</strong>
                <small>到期会新建一次协作并尝试自动开工；需本机 App 在线，不会无人值守代发消息</small>
              </span>
            </label>
            {scheduleEnabled ? (
              <div className="wb-task-composer-schedule-fields">
                <div className="wb-task-composer-freq">
                  <select className="wb-task-composer-select" aria-label="执行频率" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ScheduleType)}>
                    <option value="daily">每天</option>
                    <option value="interval">按间隔</option>
                    <option value="once">单次</option>
                  </select>
                  {scheduleType === 'daily' ? (
                    <input className="wb-task-composer-input" type="time" aria-label="每天时间" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} />
                  ) : null}
                  {scheduleType === 'interval' ? (
                    <>
                      <input className="wb-task-composer-input" type="number" min={1} max={720} aria-label="间隔值" value={intervalValue} onChange={(e) => setIntervalValue(Number(e.target.value) || 1)} />
                      <select className="wb-task-composer-select" aria-label="间隔单位" value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as 'hour' | 'day')}>
                        <option value="hour">小时</option>
                        <option value="day">天</option>
                      </select>
                    </>
                  ) : null}
                  {scheduleType === 'once' ? (
                    <input className="wb-task-composer-input" type="datetime-local" aria-label="单次时间" value={onceAt} onChange={(e) => setOnceAt(e.target.value)} />
                  ) : null}
                </div>
                <small className="wb-task-composer-schedule-note">计划仅保存在本机；关闭或退出 KnowMe 后不会触发</small>
              </div>
            ) : null}
          </div>
        </div>
        <div className="wb-modal-actions wb-task-composer-actions">
          <button type="button" className="wb-modal-btn primary" disabled={submitting} onClick={() => void submit()}>
            {submitting ? '正在打开对话…' : '创建并开始'}
          </button>
        </div>
      </div>
    </div>
  )
}
