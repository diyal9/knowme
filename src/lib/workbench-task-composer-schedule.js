'use strict'

/**
 * 专家任务 Composer 定时：DOM 读写、字段同步与用户可见边界文案。
 * 主进程 tick / nextRunAt 见 workbench-task-scheduler.js。
 */
;(function initWorkbenchTaskComposerSchedule(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchTaskComposerSchedule = api
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function createWorkbenchTaskComposerSchedule() {
  const DEFAULT_SCHEDULE = Object.freeze({
    type: 'daily',
    dailyTime: '09:00',
    intervalValue: 24,
    intervalUnit: 'hour',
    onceAt: '',
  })

  /** 用户可见边界文案（对齐 defer-task-schedule-with-automation） */
  const COPY = Object.freeze({
    toggleTitle: '定时执行',
    toggleHint: '到期会新建一次协作并尝试自动开工；需本机 App 在线，不会无人值守代发消息',
    fieldsNote: '计划仅保存在本机；关闭或退出 KnowMe 后不会触发',
    automationListHint:
      '侧栏自动化绑定可执行管线后才会按计划触发；未绑定的计划仅为草稿，不会后台自动运行',
    scheduleDueStarted: '计划已触发，已打开协作（需本机在线，不会代发消息）',
    onlineSuffix: '需 App 在线',
  })

  function formatNextRunAt(nextRunAt) {
    const t = Date.parse(nextRunAt || '')
    if (!Number.isFinite(t)) return ''
    try {
      return new Date(t).toLocaleString()
    } catch {
      return String(nextRunAt || '')
    }
  }

  /**
   * 任务卡片 clock 标记 tooltip。
   * @param {{ scheduleEnabled?: boolean, scheduleLabel?: string, nextRunAt?: string }} task
   */
  function buildTaskScheduleTooltip(task = {}) {
    if (task.scheduleEnabled !== true) return ''
    const label = String(task.scheduleLabel || '').trim()
    const parts = []
    if (label) parts.push(`已设定时：${label}`)
    else parts.push('已设定时')
    const next = formatNextRunAt(task.nextRunAt)
    if (next) parts.push(`下次 ${next}`)
    parts.push(COPY.onlineSuffix)
    parts.push('到期新建协作，非无人值守')
    return parts.join(' · ')
  }

  function syncTaskComposerScheduleFields(mask) {
    if (!mask || typeof mask.querySelector !== 'function') return
    const enabled = !!mask.querySelector('#wbTaskComposerScheduleEnabled')?.checked
    const fields = mask.querySelector('#wbTaskComposerScheduleFields')
    if (fields) fields.hidden = !enabled
    const type = String(mask.querySelector('#wbTaskComposerScheduleType')?.value || 'daily')
    mask.querySelectorAll('[data-composer-schedule]').forEach(row => {
      row.hidden = !enabled || row.getAttribute('data-composer-schedule') !== type
    })
    const note = mask.querySelector('#wbTaskComposerScheduleNote')
    if (note) note.hidden = !enabled
  }

  function resetTaskComposerSchedule(mask) {
    if (!mask || typeof mask.querySelector !== 'function') return
    const enabled = mask.querySelector('#wbTaskComposerScheduleEnabled')
    if (enabled) enabled.checked = false
    const type = mask.querySelector('#wbTaskComposerScheduleType')
    if (type) type.value = 'daily'
    const daily = mask.querySelector('#wbTaskComposerDailyTime')
    if (daily) daily.value = '09:00'
    const intervalValue = mask.querySelector('#wbTaskComposerIntervalValue')
    if (intervalValue) intervalValue.value = '24'
    const intervalUnit = mask.querySelector('#wbTaskComposerIntervalUnit')
    if (intervalUnit) intervalUnit.value = 'hour'
    const onceAt = mask.querySelector('#wbTaskComposerOnceAt')
    if (onceAt) onceAt.value = ''
    syncTaskComposerScheduleFields(mask)
  }

  function readTaskComposerSchedule(mask) {
    if (!mask || typeof mask.querySelector !== 'function') {
      return { scheduleEnabled: false, schedule: { ...DEFAULT_SCHEDULE } }
    }
    const enabled = !!mask.querySelector('#wbTaskComposerScheduleEnabled')?.checked
    if (!enabled) {
      return { scheduleEnabled: false, schedule: { ...DEFAULT_SCHEDULE } }
    }
    const type = String(mask.querySelector('#wbTaskComposerScheduleType')?.value || 'daily')
    const schedule = {
      type: ['daily', 'interval', 'once'].includes(type) ? type : 'daily',
      dailyTime: String(mask.querySelector('#wbTaskComposerDailyTime')?.value || '09:00').trim() || '09:00',
      intervalValue: Number(mask.querySelector('#wbTaskComposerIntervalValue')?.value || 24),
      intervalUnit: String(mask.querySelector('#wbTaskComposerIntervalUnit')?.value || 'hour'),
      onceAt: String(mask.querySelector('#wbTaskComposerOnceAt')?.value || '').trim(),
    }
    if (schedule.type === 'once' && !schedule.onceAt) {
      return { error: '请填写单次执行时间' }
    }
    return { scheduleEnabled: true, schedule }
  }

  return {
    DEFAULT_SCHEDULE,
    COPY,
    buildTaskScheduleTooltip,
    syncTaskComposerScheduleFields,
    resetTaskComposerSchedule,
    readTaskComposerSchedule,
  }
})
