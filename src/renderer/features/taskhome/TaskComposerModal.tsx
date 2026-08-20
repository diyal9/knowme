/**
 * 专家委托单：目标与材料确认后由主进程一次性预检并开工。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'
import { useAppStore } from '../../app/store'
import { parseExpertWorkbenchDetail, type ExpertWorkbenchDetail } from '../../../domain/expert-workbench-detail'

function providerStatus(kind: string, enabled = true) {
  if (!enabled) return '未启用'
  return kind === 'local' || kind === 'qmd-local' ? '本地知识' : '远程知识'
}

interface TaskMaterialFile {
  name: string
  content: string
}

export function TaskComposerModal({
  experts,
  initialExpertId,
  expertDetail,
  lockExpert = false,
  onClose,
}: {
  experts: CapabilityItem[]
  initialExpertId?: string
  expertDetail?: ExpertWorkbenchDetail
  lockExpert?: boolean
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
  const [expertId, setExpertId] = useState(String(initialExpertId || experts[0]?.id || ''))
  const [goal, setGoal] = useState('')
  const [materials, setMaterials] = useState('')
  const [materialFiles, setMaterialFiles] = useState<TaskMaterialFile[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [knowledgeRefs, setKnowledgeRefs] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [activeDetail, setActiveDetail] = useState<ExpertWorkbenchDetail | undefined>(expertDetail)
  const goalRef = useRef<HTMLTextAreaElement>(null)
  const materialsRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDetailsElement>(null)

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

  useEffect(() => {
    if (!selected) return
    if (expertDetail?.id === selected.id) {
      setActiveDetail(expertDetail)
      return
    }
    let active = true
    setActiveDetail(parseExpertWorkbenchDetail(null, selected))
    void window.api?.expertGet?.(selected.id).then((result) => {
      if (active) setActiveDetail(parseExpertWorkbenchDetail(result, selected))
    }).catch(() => null)
    return () => { active = false }
  }, [expertDetail, selected])

  function toggleKnowledge(id: string) {
    setKnowledgeRefs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  async function addMaterialFiles(files: FileList | null) {
    if (!files?.length) return
    const remaining = Math.max(0, 6 - materialFiles.length)
    if (!remaining) {
      showToast('本次最多添加 6 个文字材料')
      return
    }
    const picked = await Promise.all(Array.from(files).slice(0, remaining).map(async (file) => ({
      name: file.name,
      content: (await file.text()).slice(0, 8000),
    })))
    setMaterialFiles((current) => [...current, ...picked])
    if (files.length > remaining) showToast('本次最多添加 6 个文字材料')
  }

  async function submit() {
    const expert = selected
    const trimmed = goal.trim()
    if (!expert?.id) {
      showToast('请选择一位专家')
      return
    }
    if (!trimmed) {
      showToast('请填写任务目标')
      return
    }
    const materialText = materials.trim()
    if (activeDetail?.requiresMaterials && !materialText && materialFiles.length === 0) {
      showToast('这位专家需要任务材料才能开始')
      return
    }
    setSubmitting(true)
    const expertName = expert.name || expert.id
    try {
      const result = await window.api?.expertTaskCreateStart?.({
        title: trimmed.slice(0, 60),
        expertId: expert.id,
        expertName,
        knowledgeRefs,
        brief: {
          goal: trimmed,
          materials: [
            ...(materialText ? [{ id: 'provided-context', type: 'text', title: '用户提供的材料', content: materialText }] : []),
            ...materialFiles.map((file, index) => ({
              id: `uploaded-text-${index + 1}`,
              type: 'text',
              title: file.name,
              content: file.content,
            })),
          ],
          requiresMaterials: activeDetail?.requiresMaterials === true,
          deliverables: (activeDetail?.outputs?.length ? activeDetail.outputs : [{ id: 'primary', label: '任务交付物' }])
            .map((item) => ({ id: item.id, title: item.label, type: 'document', required: true })),
        },
      })
      if (!result?.ok || !result.task?.id) throw new Error(result?.error || '创建失败')
      await loadTasks()
      openExpertRoom({ id: result.task.id, name: expertName, goal: trimmed })
      onClose()
    } catch {
      showToast('任务未能开工，请在任务列表中重试')
    } finally {
      setSubmitting(false)
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && goal.trim() && !submitting) {
      event.preventDefault()
      void submit()
    }
  }

  const outputs = activeDetail?.outputs?.length ? activeDetail.outputs : [{ id: 'primary', label: '任务交付物' }]
  const materialsReady = !activeDetail?.requiresMaterials || Boolean(materials.trim() || materialFiles.length)
  const canSubmit = Boolean(selected?.id && goal.trim() && materialsReady && !submitting)

  return (
    <div
      className="wb-modal-mask is-task-composer"
      id="wbTaskComposer"
      data-testid="task-composer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wbTaskComposerTitle"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="wb-modal wb-task-composer-modal">
        <div className="wb-modal-head">
          <div className="wb-task-composer-heading">
            <strong id="wbTaskComposerTitle" className="wb-modal-title">发起专家任务</strong>
          </div>
          <button type="button" className="wb-modal-close" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className="wb-modal-body">
          <section className="wb-task-assignee" aria-label={lockExpert ? '负责专家' : '选择专家'}>
            <span className="wb-task-section-label">{lockExpert ? '负责专家' : '选择专家'}</span>
            {lockExpert ? (
              <div className="wb-task-expert-trigger is-locked">
                <span className="wb-task-expert-trigger-body">
                  {selected ? <ExpertAvatarMark agent={selected} className="wb-task-expert-mark" size={40} /> : null}
                  <span className="wb-task-expert-copy">
                    <strong>{selected?.name || selected?.id}</strong>
                    <small>{selected?.category || '本任务只由这一位专家负责'}</small>
                  </span>
                </span>
              </div>
            ) : (
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
                        <ExpertAvatarMark agent={selected} className="wb-task-expert-mark" size={40} />
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
            )}
          </section>
          <label className="wb-studio-field wb-task-goal-field">
            <span>交付目标 <em>必填</em></span>
            <textarea
              ref={goalRef}
              rows={3}
              maxLength={2000}
              placeholder="例如：根据这份调研材料，写一份可供评审的产品需求文档"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              autoFocus
            />
          </label>
          <section className="wb-studio-field wb-task-material-field">
            <span>任务材料 {activeDetail?.requiresMaterials ? <em>必填</em> : <small>可选</small>}</span>
            <div className="wb-task-material-tools" aria-label="添加任务材料">
              <button type="button" onClick={() => fileRef.current?.click()}>＋ 添加文件</button>
              <button type="button" onClick={() => materialsRef.current?.focus()}>粘贴内容</button>
              <button type="button" onClick={() => { if (settingsRef.current) settingsRef.current.open = true; settingsRef.current?.scrollIntoView({ block: 'nearest' }) }}>从知识库选择</button>
            </div>
            <input
              ref={fileRef}
              className="wb-task-material-input"
              type="file"
              multiple
              accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.html,.css,.yaml,.yml,.xml,.log"
              onChange={(event) => { void addMaterialFiles(event.target.files); event.currentTarget.value = '' }}
            />
            {materialFiles.length ? (
              <div className="wb-task-material-files" aria-label="已添加材料">
                {materialFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`}>
                    {file.name}
                    <button type="button" aria-label={`移除 ${file.name}`} onClick={() => setMaterialFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                  </span>
                ))}
              </div>
            ) : null}
            <textarea
              ref={materialsRef}
              rows={3}
              maxLength={8000}
              placeholder="粘贴必要背景、已有内容、数据或参考说明"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
          </section>
          <section className="wb-task-output-preview" aria-label="将交付">
            <header><span>将交付</span><small>{outputs.length} 项</small></header>
            <div>{outputs.map((item) => <strong key={item.id}><i aria-hidden="true">✓</i>{item.label}</strong>)}</div>
          </section>
          <details ref={settingsRef} className="wb-task-more-settings">
            <summary>更多设置 <span>{knowledgeRefs.length ? `已选 ${knowledgeRefs.length} 个知识范围` : '使用专家默认知识'}</span></summary>
            <div className="wb-studio-field wb-task-knowledge-field">
              <span>知识范围</span>
              <div className="wb-task-knowledge-list">
                {knowledgeOptions.length === 0 ? (
                  <span className="wb-task-knowledge-hint">还没有可选知识库，将按专家默认配置执行。</span>
                ) : knowledgeOptions.map((item) => (
                  <label key={item.id} className="wb-task-knowledge-option">
                    <input type="checkbox" checked={knowledgeRefs.includes(item.id)} onChange={() => toggleKnowledge(item.id)} />
                    <span className="wb-task-knowledge-meta"><strong>{item.title}</strong><small>{item.status}</small></span>
                  </label>
                ))}
              </div>
              <small className="wb-task-knowledge-hint">只有你明确勾选的知识范围会随本次委托交给专家。</small>
            </div>
          </details>
        </div>
        <div className="wb-modal-actions wb-task-composer-actions">
          <span>{!goal.trim() ? '填写交付目标后即可开始' : !materialsReady ? '这位专家需要任务材料' : '信息不足时，专家会向你提问'}</span>
          <button type="button" className="wb-modal-btn primary" disabled={!canSubmit} onClick={() => void submit()} title="Ctrl/⌘ + Enter">
            {submitting ? '正在预检…' : '开始任务'}
          </button>
        </div>
      </div>
    </div>
  )
}
