/**
 * 管理工作流 / 自动化 / 管线面板。编辑带 package id；复制走 fork，不进空白草稿。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AUTOMATION_LIST_HINT, automationRunCapable } from '../../../domain/studio'
import { workbenchHomeExperts } from '../../../domain/workbench-home'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { useKnowMeIcons } from '../../app/useKnowMeIcons'
import { DaemonComposePanel } from './DaemonComposePanel'
import { ManageAutomationModal } from './ManageAutomationModal'
import { ManageWorkflowCard } from './ManageWorkflowCard'
import type { WorkbenchAutomationJob, WorkbenchAutomationTemplate } from '../../../shared/api'

export function ManageSurface() {
  const panel = useAppStore((s) => s.managePanel)
  const loadManage = useAppStore((s) => s.loadManage)
  const loadWorkbench = useAppStore((s) => s.loadWorkbench)
  const loadHubCapabilities = useAppStore((s) => s.loadHubCapabilities)
  const loadWorkbenchModes = useAppStore((s) => s.loadWorkbenchModes)
  const hubItems = useAppStore((s) => s.hubItems)
  const modes = useAppStore((s) => s.modes)
  const automationJobs = useAppStore((s) => s.automationJobs)
  const automationTemplates = useAppStore((s) => s.automationTemplates)
  const shelfCards = useAppStore((s) => s.shelfCards)
  const enterStudio = useAppStore((s) => s.enterStudio)
  const forkWorkflow = useAppStore((s) => s.forkWorkflow)
  const setWorkbenchSurface = useAppStore((s) => s.setWorkbenchSurface)
  const archiveWorkflow = useAppStore((s) => s.archiveWorkflow)
  const openConfirm = useAppStore((s) => s.openConfirm)
  const runAutomationNow = useAppStore((s) => s.runAutomationNow)
  const openDaemonReview = useAppStore((s) => s.openDaemonReview)
  const [editor, setEditor] = useState<WorkbenchAutomationJob | null | undefined>(undefined)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (panel === 'workflows' || panel === 'daemon') {
      void loadWorkbench()
      void loadHubCapabilities()
      void loadWorkbenchModes()
    } else void loadManage()
  }, [loadManage, loadWorkbench, loadHubCapabilities, loadWorkbenchModes, panel])

  useKnowMeIcons(`${panel}:${automationJobs.length}`, surfaceRef)

  const mine = shelfCards.filter((card) => card.provenanceLabel === '我的')
  const expertNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of workbenchHomeExperts(hubItems, modes)) {
      if (item.id) map[item.id] = item.name || item.id
    }
    return map
  }, [hubItems, modes])

  if (panel === 'daemon') return <DaemonComposePanel />

  if (panel === 'workflows') {
    return (
      <div ref={surfaceRef} className="wb-manage-body">
        <section className="wb-manage-panel active" id="wbWorkflowManagePage" data-manage-panel="workflows" aria-label="工作流管理" data-testid="manage-workflows">
          <div className="wb-dashboard">
            <section className="wb-panel wb-workflow-manage" aria-labelledby="wbWorkflowManageTitle">
              <div className="wb-panel-head">
                <div className="wb-workflow-manage-title">
                  <button type="button" className="wb-task-back" onClick={() => setWorkbenchSurface('shelf')} aria-label="返回工作流">
                    <Icon name="chevronLeft" />
                    <span>返回</span>
                  </button>
                  <div>
                    <div className="wb-section-label">我的工作流</div>
                    <h2 className="wb-panel-title" id="wbWorkflowManageTitle">维护你自己的流程</h2>
                  </div>
                </div>
                <button type="button" className="wb-modal-btn primary" data-testid="studio-create-workflow" onClick={() => enterStudio('manage')}>+ 新建工作流</button>
              </div>
              <div className="wb-workflow-manage-list" id="wbWorkflowManageList" aria-label="我的工作流列表">
                {mine.map((card) => (
                  <ManageWorkflowCard
                    key={card.id}
                    card={card}
                    expertNames={expertNames}
                    onEdit={() => enterStudio('manage', card.id)}
                    onCopy={() => void forkWorkflow(card.id)}
                    onDelete={() => openConfirm({
                      title: `删除「${card.name}」？`,
                      body: '删除后它将从工作流中移除，且不可恢复。',
                      confirmLabel: '删除',
                      danger: true,
                      onConfirm: () => archiveWorkflow(card.id),
                    })}
                  />
                ))}
              </div>
              {mine.length === 0 ? (
                <div className="wb-workflow-manage-empty" id="wbWorkflowManageEmpty">
                  <strong>还没有属于你的工作流</strong>
                  <span>从零编排一条，或在此复制已有「我的」流程后再改。</span>
                  <div className="wb-empty-actions">
                    <button type="button" className="wb-shelf-secondary" onClick={() => setWorkbenchSurface('shelf')}>去工作流查看</button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    )
  }

  if (panel === 'automation') {
    return (
      <div ref={surfaceRef} className="wb-manage-body">
      <section className="wb-manage-panel active" id="wbAutomationPage" data-manage-panel="automation" aria-label="自动化中心">
        <div className="wb-dashboard" id="wbAutomationDashboard">
          <section className="wb-panel wb-automation-panel" aria-labelledby="wbAutomationTitle">
            <div className="wb-panel-head">
              <div>
                <div className="wb-section-label">自动化任务</div>
                <h2 className="wb-panel-title" id="wbAutomationTitle">按你的节奏自动推进工作</h2>
              </div>
              <button type="button" className="wb-modal-btn primary" data-testid="automation-create" onClick={() => setEditor(null)}>
                + 添加自动化
              </button>
            </div>
            <div className="wb-automation-hint" data-testid="manage-automation-hint">{AUTOMATION_LIST_HINT}</div>
            <div className="wb-automation-list" id="wbAutomationList" aria-label="自动化任务列表" data-testid="manage-automation-list">
              {automationJobs.length === 0 ? (
                <p className="empty" data-testid="manage-automation-empty">还没有自动化任务。</p>
              ) : automationJobs.map((job) => {
                const runCapable = automationRunCapable(job)
                return (
                  <article key={job.id} className="wb-automation-card" data-automation-id={job.id}>
                    <div className="wb-automation-card-head">
                      <h3>{job.name || job.id}</h3>
                      <span className={`wb-automation-pill${job.enabled === false ? ' paused' : ' active'}`}>
                        {job.enabled === false ? '暂停' : '启用'}
                      </span>
                    </div>
                    <p className="wb-automation-meta">触发：{job.scheduleLabel || '未配置'}</p>
                    {runCapable ? null : (
                      <p className="studio-warn" data-testid={`automation-unbound-${job.id}`}>执行：尚未绑定可执行管线</p>
                    )}
                    <div className="wb-automation-actions">
                      <button type="button" className="wb-modal-btn" onClick={() => setEditor(job)}>编辑</button>
                      <button type="button" className="wb-modal-btn" onClick={() => void runAutomationNow(job.id)}>立即执行</button>
                      <button type="button" className="wb-modal-btn" onClick={() => void openDaemonReview(job.name || job.id)}>详情</button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="wb-section-label">推荐模板</div>
            <div className="wb-automation-template-grid" aria-label="自动化模板">
              {automationTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="wb-automation-template"
                  onClick={() => setEditor(jobFromTemplate(tpl))}
                >
                  <div className="wb-automation-template-head">
                    <span className="wb-automation-template-icon"><Icon name="automation" /></span>
                    <span className="wb-automation-template-title">{tpl.title || tpl.id}</span>
                  </div>
                  <span className="wb-automation-template-desc">{tpl.description || ''}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        {editor !== undefined ? (
          <ManageAutomationModal job={editor} onClose={() => setEditor(undefined)} />
        ) : null}
      </section>
      </div>
    )
  }

  return <DaemonComposePanel />
}

function jobFromTemplate(tpl: WorkbenchAutomationTemplate): WorkbenchAutomationJob {
  return {
    id: '',
    name: tpl.title || tpl.id,
    prompt: tpl.prompt || '',
  }
}
