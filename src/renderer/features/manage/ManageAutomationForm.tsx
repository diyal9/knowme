import { useEffect, useMemo, useState } from 'react'
import type { FeishuTargetItem, WorkbenchAutomationJob } from '../../../shared/api'
import {
  automationScheduleLabel,
  buildAutomationPipelines,
  normalizeAutomationConnectors,
  type AutomationConnectorOption,
  type AutomationPipelineOption,
} from '../../../domain/automation-modal'
import {
  normalizePushTargets,
  resolveTargetId,
  targetDisplayById,
  type FeishuTarget,
} from '../../../domain/automation-push'
import { useAppStore } from '../../app/store'

export type AutomationFormState = {
  name: string
  workspaceId: string
  prompt: string
  workflowId: string
  domain: string
  backend: string
  connectorId: string
  permissionMode: 'default' | 'full'
  scheduleType: 'daily' | 'interval' | 'once'
  dailyTime: string
  intervalValue: string
  intervalUnit: 'hour' | 'day'
  onceAt: string
  dateStart: string
  dateEnd: string
  pushMiniApp: boolean
  pushBot: boolean
  userLabel: string
  groupLabel: string
}

type Props = {
  job: WorkbenchAutomationJob | null
  onSave: (payload: Record<string, unknown>, id?: string) => Promise<boolean>
  onClose: () => void
}

type TargetOptions = { users: FeishuTarget[]; chats: FeishuTarget[] }

function initialForm(job: WorkbenchAutomationJob | null): AutomationFormState {
  const push = normalizePushTargets(job?.pushTargets)
  return {
    name: job?.name || '',
    workspaceId: job?.workspaceId || '',
    prompt: job?.prompt || '',
    workflowId: job?.workflowId || '',
    domain: job?.domain || '',
    backend: job?.backend || 'local-team',
    connectorId: job?.connectorId || '',
    permissionMode: job?.permissionMode === 'full' ? 'full' : 'default',
    scheduleType: (job?.schedule?.type as AutomationFormState['scheduleType']) || 'daily',
    dailyTime: job?.schedule?.dailyTime || '09:00',
    intervalValue: String(job?.schedule?.intervalValue || 24),
    intervalUnit: job?.schedule?.intervalUnit || 'hour',
    onceAt: job?.schedule?.onceAt || '',
    dateStart: job?.dateRange?.start || '',
    dateEnd: job?.dateRange?.end || '',
    pushMiniApp: push.miniApp === true,
    pushBot: push.bot === true,
    userLabel: targetDisplayById(push.userTargets?.[0]?.id || '', push.userTargets || []),
    groupLabel: targetDisplayById(push.groupTargets?.[0]?.id || '', push.groupTargets || []),
  }
}

export function ManageAutomationForm({ job, onSave, onClose }: Props) {
  const deleteAutomation = useAppStore((s) => s.deleteAutomation)
  const showToast = useAppStore((s) => s.showToast)
  const creating = !job?.id
  const initialPush = normalizePushTargets(job?.pushTargets)
  const [form, setForm] = useState<AutomationFormState>(() => initialForm(job))
  const [pipelines, setPipelines] = useState<AutomationPipelineOption[]>([])
  const [connectors, setConnectors] = useState<AutomationConnectorOption[]>([])
  const [targetOptions, setTargetOptions] = useState<TargetOptions>({
    users: initialPush.userTargets || [],
    chats: initialPush.groupTargets || [],
  })

  useEffect(() => {
    setForm(initialForm(job))
  }, [job])

  useEffect(() => {
    void (async () => {
      try {
        const [loadRes, connectorRes] = await Promise.all([
          window.api?.workbenchLoad?.(),
          window.api?.connectorsList?.(),
        ])
        setPipelines(buildAutomationPipelines(
          [
            ...(loadRes?.workflowPackages || []),
            ...(loadRes?.workflows || []),
          ] as Parameters<typeof buildAutomationPipelines>[0],
          {
            daemonOnline: loadRes?.daemon?.online,
            workflowId: form.workflowId,
            backend: form.backend,
          },
        ))
        setConnectors(normalizeAutomationConnectors(connectorRes))
      } catch {
        /* keep empty lists */
      }
    })()
  }, [form.backend, form.workflowId])

  useEffect(() => {
    if (!form.pushMiniApp && !form.pushBot) return
    void (async () => {
      try {
        const tasks: Promise<void>[] = []
        if (form.pushMiniApp) {
          tasks.push((async () => {
            const res = await window.api?.workbenchAutomationFeishuTargets?.({ mode: 'user', limit: 20 })
            if (res?.ok && res.items) {
              setTargetOptions((prev) => ({ ...prev, users: res.items as FeishuTargetItem[] }))
            } else if (res?.error) showToast(res.error)
          })())
        }
        if (form.pushBot) {
          tasks.push((async () => {
            const res = await window.api?.workbenchAutomationFeishuTargets?.({ mode: 'chat', limit: 20 })
            if (res?.ok && res.items) {
              setTargetOptions((prev) => ({ ...prev, chats: res.items as FeishuTargetItem[] }))
            } else if (res?.error) showToast(res.error)
          })())
        }
        await Promise.all(tasks)
      } catch {
        showToast('读取飞书目标失败')
      }
    })()
  }, [form.pushBot, form.pushMiniApp, showToast])

  const userOptions = useMemo(
    () => targetOptions.users.map((item) => (
      <option key={item.id} value={item.name || item.id}>{item.name || item.id}</option>
    )),
    [targetOptions.users],
  )
  const chatOptions = useMemo(
    () => targetOptions.chats.map((item) => (
      <option key={item.id} value={item.name || item.id}>{item.name || item.id}</option>
    )),
    [targetOptions.chats],
  )

  function patchForm(next: Partial<AutomationFormState>) {
    setForm((prev) => ({ ...prev, ...next }))
  }

  function onWorkflowChange(workflowId: string) {
    const picked = pipelines.find((item) => item.id === workflowId)
    patchForm({
      workflowId,
      domain: picked?.domain || form.domain,
      backend: picked?.backend || form.backend,
    })
  }

  async function submit() {
    const userId = resolveTargetId(form.userLabel, targetOptions.users, initialPush.userTargets || [])
    const groupId = resolveTargetId(form.groupLabel, targetOptions.chats, initialPush.groupTargets || [])
    const schedule = {
      type: form.scheduleType,
      dailyTime: form.dailyTime,
      intervalValue: Number(form.intervalValue) || 24,
      intervalUnit: form.intervalUnit,
      onceAt: form.onceAt,
    }
    const ok = await onSave({
      name: form.name,
      workspaceId: form.workspaceId,
      prompt: form.prompt,
      workflowId: form.workflowId,
      domain: form.domain,
      backend: form.backend,
      connectorId: form.connectorId,
      permissionMode: form.permissionMode,
      schedule,
      dateRange: { start: form.dateStart, end: form.dateEnd },
      pushTargets: {
        miniApp: form.pushMiniApp,
        bot: form.pushBot,
        userTargets: userId ? [{ id: userId, name: form.userLabel.trim() || userId }] : [],
        groupTargets: groupId ? [{ id: groupId, name: form.groupLabel.trim() || groupId }] : [],
      },
      scheduleLabel: automationScheduleLabel(schedule),
    }, job?.id)
    if (ok) onClose()
  }

  return (
    <>
      <div className="wb-auto-modal-body" id="wbAutomationModalBody">
        <div className="wb-auto-grid">
        <div className="wb-auto-field full">
          <label htmlFor="wbAutoName">名称</label>
          <input id="wbAutoName" className="wb-auto-input" aria-label="名称" maxLength={60} value={form.name} onChange={(e) => patchForm({ name: e.target.value })} placeholder="例如：每日 AI 新闻推送" />
        </div>
        <div className="wb-auto-field full">
          <label htmlFor="wbAutoWorkspace">工作空间（可选）</label>
          <input id="wbAutoWorkspace" className="wb-auto-input" maxLength={80} value={form.workspaceId} onChange={(e) => patchForm({ workspaceId: e.target.value })} placeholder="例如：my-project / team-space" />
        </div>
        <div className="wb-auto-field full">
          <label htmlFor="wbAutoPrompt">提示词</label>
          <textarea id="wbAutoPrompt" className="wb-auto-textarea" aria-label="提示词" value={form.prompt} onChange={(e) => patchForm({ prompt: e.target.value })} placeholder="描述自动化执行目标、输出结构与约束" />
        </div>
        <div className="wb-auto-field full">
          <label htmlFor="wbAutoWorkflow">执行管线</label>
          <select id="wbAutoWorkflow" className="wb-auto-select" value={form.workflowId} onChange={(e) => onWorkflowChange(e.target.value)}>
            <option value="">不绑定管线（仅保存计划，不可立即执行）</option>
            {pipelines.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <small>绑定后「立即执行」和定时触发都会进入统一运行目录；缺少依赖的管线不会出现在这里。</small>
        </div>
        <div className="wb-auto-field">
          <label htmlFor="wbAutoConnector">连接器</label>
          <select id="wbAutoConnector" className="wb-auto-select" value={form.connectorId} onChange={(e) => patchForm({ connectorId: e.target.value })}>
            <option value="">不绑定连接器（Auto）</option>
            {connectors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.status === 'auth_required' ? '（需授权）' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="wb-auto-field">
          <label htmlFor="wbAutoPermissionMode">执行权限</label>
          <select id="wbAutoPermissionMode" className="wb-auto-select" value={form.permissionMode} onChange={(e) => patchForm({ permissionMode: e.target.value as 'default' | 'full' })}>
            <option value="default">默认权限</option>
            <option value="full">完全访问权限</option>
          </select>
        </div>
      </div>
      <div className="wb-auto-sep" />
      <div className="wb-auto-one-line-grid">
        <div className="wb-auto-field">
          <label htmlFor="wbAutoScheduleType">执行频率与时间</label>
          <div className="wb-auto-frequency-control">
            <select id="wbAutoScheduleType" className="wb-auto-select" value={form.scheduleType} onChange={(e) => patchForm({ scheduleType: e.target.value as AutomationFormState['scheduleType'] })}>
              <option value="daily">周期（每天）</option>
              <option value="interval">按间隔</option>
              <option value="once">单次</option>
            </select>
            {form.scheduleType === 'daily' ? (
              <input id="wbAutoDailyTime" className="wb-auto-input" type="time" value={form.dailyTime} onChange={(e) => patchForm({ dailyTime: e.target.value })} aria-label="每天时间" data-auto-schedule="daily" />
            ) : null}
            {form.scheduleType === 'interval' ? (
              <>
                <input id="wbAutoIntervalValue" className="wb-auto-input" type="number" min={1} max={720} value={form.intervalValue} onChange={(e) => patchForm({ intervalValue: e.target.value })} aria-label="间隔值" data-auto-schedule="interval" />
                <select id="wbAutoIntervalUnit" className="wb-auto-select" value={form.intervalUnit} onChange={(e) => patchForm({ intervalUnit: e.target.value as 'hour' | 'day' })} aria-label="间隔单位" data-auto-schedule="interval">
                  <option value="hour">小时</option>
                  <option value="day">天</option>
                </select>
              </>
            ) : null}
            {form.scheduleType === 'once' ? (
              <input id="wbAutoOnceAt" className="wb-auto-input" type="datetime-local" value={form.onceAt} onChange={(e) => patchForm({ onceAt: e.target.value })} aria-label="单次时间" data-auto-schedule="once" />
            ) : null}
          </div>
        </div>
        <div className="wb-auto-field">
          <label htmlFor="wbAutoStartDate">有效期（可选）</label>
          <div className="wb-auto-date-range" role="group" aria-label="自动化有效期">
            <input id="wbAutoStartDate" className="wb-auto-input" type="date" value={form.dateStart} onChange={(e) => patchForm({ dateStart: e.target.value })} aria-label="有效期开始日" />
            <span className="wb-auto-date-sep" aria-hidden="true">至</span>
            <input id="wbAutoEndDate" className="wb-auto-input" type="date" value={form.dateEnd} onChange={(e) => patchForm({ dateEnd: e.target.value })} aria-label="有效期结束日" />
          </div>
        </div>
      </div>
      <div className="wb-auto-row wb-auto-push-row">
        <span className="wb-auto-inline-label">推送目标</span>
        <label className="wb-auto-radio">
          <input id="wbAutoPushMiniApp" type="checkbox" checked={form.pushMiniApp} onChange={(e) => patchForm({ pushMiniApp: e.target.checked })} />
          推送到飞书个人会话
        </label>
        <label className="wb-auto-radio">
          <input id="wbAutoPushBot" type="checkbox" checked={form.pushBot} onChange={(e) => patchForm({ pushBot: e.target.checked })} />
          推送到飞书群会话
        </label>
      </div>
      {form.pushMiniApp ? (
        <div className="wb-auto-grid" data-auto-target="user">
          <div className="wb-auto-field full">
            <label htmlFor="wbAutoUserTargetInput">发送给谁（可输入检索）</label>
            <input id="wbAutoUserTargetInput" className="wb-auto-input" list="wbAutoUserTargetList" value={form.userLabel} onChange={(e) => patchForm({ userLabel: e.target.value })} placeholder="输入姓名/邮箱并从下拉建议中选择" autoComplete="off" />
            <datalist id="wbAutoUserTargetList">{userOptions}</datalist>
          </div>
        </div>
      ) : null}
      {form.pushBot ? (
        <div className="wb-auto-grid" data-auto-target="group">
          <div className="wb-auto-field full">
            <label htmlFor="wbAutoGroupTargetInput">发送到哪个群（可输入检索）</label>
            <input id="wbAutoGroupTargetInput" className="wb-auto-input" list="wbAutoGroupTargetList" value={form.groupLabel} onChange={(e) => patchForm({ groupLabel: e.target.value })} placeholder="输入群名并从下拉建议中选择" autoComplete="off" />
            <datalist id="wbAutoGroupTargetList">{chatOptions}</datalist>
          </div>
        </div>
      ) : null}
      </div>
      <div className="wb-auto-foot">
        <div className="wb-auto-hint" id="wbAutomationModalHint">
          自动化在本机执行；须绑定可执行管线才会按计划触发。关闭电脑或退出客户端后不会后台运行。
        </div>
        <div className="wb-auto-actions">
          <button type="button" className="wb-auto-chip" id="wbAutomationModalCancel" onClick={onClose}>取消</button>
          {!creating ? (
            <button type="button" className="wb-auto-chip" onClick={() => { void deleteAutomation(job?.id || ''); onClose() }}>删除</button>
          ) : null}
          <button type="button" className="wb-auto-chip primary" id="wbAutomationModalSave" onClick={() => void submit()}>
            {creating ? '确认创建' : '保存修改'}
          </button>
        </div>
      </div>
    </>
  )
}
