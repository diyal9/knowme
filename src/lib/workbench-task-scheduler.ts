'use strict'

/**
 * 工作台任务定时：计划归一化、下次时间、到期扫描。
 * 仅本机 App 在线时由主进程 tick 调用；不承诺关机后台。
 */

const { parseCronExpr, nextCronRunAt } = require('./cron-next-run')

function validDailyTime(value) {
  const text = String(value || '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : ''
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeSchedule(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const type = ['daily', 'interval', 'once', 'cron'].includes(source.type) ? source.type : 'daily'
  const dailyTime = validDailyTime(source.dailyTime) || '09:00'
  const intervalValue = clampInt(source.intervalValue, 1, 720, 24)
  const intervalUnit = ['hour', 'day'].includes(source.intervalUnit) ? source.intervalUnit : 'hour'
  const onceAt = String(source.onceAt || '').trim()
  const cronExpr = parseCronExpr(source.cronExpr) ? String(source.cronExpr).trim() : ''
  return { type, dailyTime, intervalValue, intervalUnit, onceAt, cronExpr }
}

function scheduleToLabel(schedule = {}) {
  const s = normalizeSchedule(schedule)
  if (s.type === 'once') {
    if (!s.onceAt) return '单次（未设置）'
    const t = new Date(s.onceAt)
    if (!Number.isFinite(t.getTime())) return `单次 ${s.onceAt}`
    return `单次 ${t.toLocaleString()}`
  }
  if (s.type === 'interval') {
    const unit = s.intervalUnit === 'day' ? '天' : '小时'
    return `每 ${s.intervalValue || 1} ${unit}`
  }
  if (s.type === 'cron') return s.cronExpr ? `cron ${s.cronExpr}` : 'cron（未设置）'
  return `每天 ${s.dailyTime || '09:00'}`
}

function computeNextRunAt(schedule = {}, enabled = true, fromDate = new Date()) {
  if (!enabled) return ''
  const s = normalizeSchedule(schedule)
  const now = fromDate instanceof Date ? fromDate : new Date(fromDate)
  if (!Number.isFinite(now.getTime())) return ''

  if (s.type === 'once') {
    if (!s.onceAt) return ''
    const t = new Date(s.onceAt)
    return Number.isFinite(t.getTime()) && t.getTime() > now.getTime() ? t.toISOString() : ''
  }

  if (s.type === 'interval') {
    const unitMs = s.intervalUnit === 'day' ? 24 * 3600 * 1000 : 3600 * 1000
    const ts = now.getTime() + (Math.max(1, Number(s.intervalValue || 1)) * unitMs)
    return new Date(ts).toISOString()
  }

  if (s.type === 'cron') return nextCronRunAt(s.cronExpr, now)

  const [hh, mm] = String(s.dailyTime || '09:00').split(':').map(Number)
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0)
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1)
  return candidate.toISOString()
}

function normalizeTaskScheduleFields(source = {}) {
  const raw = source && typeof source === 'object' ? source : {}
  const schedule = normalizeSchedule(raw.schedule || {})
  const scheduleEnabled = raw.scheduleEnabled === true
  const scheduleParentId = String(raw.scheduleParentId || '').trim().slice(0, 80)
  const scheduleLabel = scheduleEnabled
    ? (String(raw.scheduleLabel || '').trim() || scheduleToLabel(schedule))
    : ''
  let nextRunAt = String(raw.nextRunAt || '').trim()
  if (!scheduleEnabled) {
    nextRunAt = ''
  } else if (!nextRunAt) {
    nextRunAt = computeNextRunAt(schedule, true)
  }
  return {
    schedule,
    scheduleEnabled,
    scheduleLabel,
    nextRunAt,
    lastScheduledAt: String(raw.lastScheduledAt || '').trim().slice(0, 40),
    scheduleParentId,
  }
}

function isScheduleParent(task = {}) {
  return !String(task.scheduleParentId || '').trim()
}

function isDueTask(task = {}, now = new Date()) {
  if (!task || task.scheduleEnabled !== true) return false
  if (!isScheduleParent(task)) return false
  const next = Date.parse(task.nextRunAt || '')
  if (!Number.isFinite(next)) return false
  const ts = now instanceof Date ? now.getTime() : new Date(now).getTime()
  return next <= ts
}

function listDue(tasks = [], now = new Date()) {
  return (Array.isArray(tasks) ? tasks : []).filter(task => isDueTask(task, now))
}

/**
 * 触发后推进父任务计划。once → 关闭启用。
 */
function advanceAfterFire(task = {}, now = new Date()) {
  const current = task && typeof task === 'object' ? task : {}
  const schedule = normalizeSchedule(current.schedule || {})
  const firedAt = now instanceof Date ? now : new Date(now)
  const lastScheduledAt = Number.isFinite(firedAt.getTime()) ? firedAt.toISOString() : new Date().toISOString()

  if (schedule.type === 'once') {
    return {
      ...current,
      schedule,
      scheduleEnabled: false,
      scheduleLabel: '',
      nextRunAt: '',
      lastScheduledAt,
    }
  }

  const nextRunAt = computeNextRunAt(schedule, true, firedAt)
  return {
    ...current,
    schedule,
    scheduleEnabled: true,
    scheduleLabel: scheduleToLabel(schedule),
    nextRunAt,
    lastScheduledAt,
  }
}

module.exports = {
  normalizeSchedule,
  scheduleToLabel,
  computeNextRunAt,
  normalizeTaskScheduleFields,
  isScheduleParent,
  isDueTask,
  listDue,
  advanceAfterFire,
}
