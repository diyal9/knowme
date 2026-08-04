'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_TEMPLATES = [
  {
    id: 'daily-ai-news',
    title: '每日 AI 新闻推送',
    description: '关注当天 AI 领域动态，提炼 3-5 条关键信息与行动建议。',
    prompt: '关注当天 AI 领域的重要动态，侧重 AI coding 与具身智能方向。筛选 3-5 条有价值的信息，简要说明事件内容及值得关注的原因。',
    schedule: { type: 'daily', dailyTime: '09:00' },
  },
  {
    id: 'daily-work-brief',
    title: '每日工作简报',
    description: '汇总今日进展、风险和待跟进项，生成可直接发送的简报。',
    prompt: '汇总今日工作进展、风险与阻塞项，并输出可直接发送的简报。包含：完成事项、进行中事项、风险与下一步。',
    schedule: { type: 'daily', dailyTime: '18:30' },
  },
  {
    id: 'pre-meeting-brief',
    title: '会前准备提醒',
    description: '会议前自动整理相关材料、议题与待确认问题。',
    prompt: '基于会议主题整理会前 brief：会议目标、关键议题、所需材料、待确认问题和建议决策点。',
    schedule: { type: 'interval', intervalValue: 1, intervalUnit: 'day' },
  },
  {
    id: 'post-meeting-minutes',
    title: '会后纪要整理',
    description: '提取会议结论、待办、负责人和截止时间。',
    prompt: '将会议记录整理为结构化纪要：结论、待办、负责人、截止时间、风险与追踪建议。',
    schedule: { type: 'interval', intervalValue: 1, intervalUnit: 'day' },
  },
  {
    id: 'pr-task-digest',
    title: 'PR / 任务变更摘要',
    description: '汇总代码与任务变更，突出风险点与优先关注项。',
    prompt: '汇总今天 PR 与任务系统的重要变更，提炼风险点、阻塞点和需要优先关注的事项。',
    schedule: { type: 'daily', dailyTime: '17:30' },
  },
  {
    id: 'daily-todo-review',
    title: '每日待办回顾与明日计划',
    description: '回顾完成情况，生成明日优先级与执行建议。',
    prompt: '回顾今日待办完成情况，输出明日优先级排序、关键依赖和执行建议（控制在 5 条以内）。',
    schedule: { type: 'daily', dailyTime: '21:00' },
  },
  {
    id: 'weekly-goal-review',
    title: '每周目标回顾与下周计划',
    description: '复盘本周目标达成，提前整理下周推进重点。',
    prompt: '按「目标完成度、关键成果、阻塞风险、经验复盘、下周优先级」结构输出周度复盘，控制在 6 条核心要点内。',
    schedule: { type: 'daily', dailyTime: '19:00' },
  },
  {
    id: 'risk-blocker-alert',
    title: '风险与阻塞预警',
    description: '扫描在途事项，提前提示延期风险与协同阻塞。',
    prompt: '汇总当前进行中的任务，识别延期风险、依赖阻塞与决策缺口，按「风险等级、影响范围、建议动作」输出预警清单。',
    schedule: { type: 'interval', intervalValue: 1, intervalUnit: 'day' },
  },
]

function nowIso() {
  return new Date().toISOString()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function normalizeJob(item = {}) {
  const schedule = normalizeSchedule(item.schedule || {})
  const dateRange = normalizeDateRange(item.dateRange || {})
  const mode = item.permissionMode === 'full' ? 'full' : 'default'
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || '').trim() || '未命名自动化',
    workspaceId: String(item.workspaceId || '').trim(),
    prompt: String(item.prompt || '').trim(),
    connectorId: String(item.connectorId || '').trim(),
    templateId: String(item.templateId || '').trim(),
    enabled: item.enabled !== false,
    schedule,
    dateRange,
    scheduleLabel: String(item.scheduleLabel || scheduleToLabel(schedule)),
    lastStatus: String(item.lastStatus || 'idle'),
    lastRunAt: String(item.lastRunAt || ''),
    nextRunAt: String(item.nextRunAt || nextRunAt(schedule, dateRange, item.enabled !== false)),
    permissionMode: mode,
    pushTargets: normalizePushTargets(item.pushTargets || {}),
    createdAt: String(item.createdAt || nowIso()),
    updatedAt: String(item.updatedAt || nowIso()),
  }
}

function normalizePushTargets(targets = {}) {
  const userTargets = Array.isArray(targets.userTargets)
    ? targets.userTargets
      .map(item => ({
        id: String(item && item.id || '').trim(),
        name: String(item && item.name || '').trim(),
      }))
      .filter(item => item.id)
    : []
  const groupTargets = Array.isArray(targets.groupTargets)
    ? targets.groupTargets
      .map(item => ({
        id: String(item && item.id || '').trim(),
        name: String(item && item.name || '').trim(),
      }))
      .filter(item => item.id)
    : []
  return {
    miniApp: targets.miniApp === true,
    bot: targets.bot === true,
    userTargets,
    groupTargets,
  }
}

function normalizeDateRange(input = {}) {
  const start = String(input.start || '').trim()
  const end = String(input.end || '').trim()
  return { start, end }
}

function normalizeSchedule(input = {}) {
  const type = ['daily', 'interval', 'once'].includes(input.type) ? input.type : 'daily'
  const dailyTime = validDailyTime(input.dailyTime) || '09:00'
  const intervalValue = clampInt(input.intervalValue, 1, 720, 24)
  const intervalUnit = ['hour', 'day'].includes(input.intervalUnit) ? input.intervalUnit : 'hour'
  const onceAt = String(input.onceAt || '').trim()
  return { type, dailyTime, intervalValue, intervalUnit, onceAt }
}

function validDailyTime(value) {
  const text = String(value || '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : ''
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function scheduleToLabel(schedule = {}) {
  if (schedule.type === 'once') {
    return schedule.onceAt ? `单次 ${schedule.onceAt}` : '单次（未设置）'
  }
  if (schedule.type === 'interval') {
    const unit = schedule.intervalUnit === 'day' ? '天' : '小时'
    return `每 ${schedule.intervalValue || 1} ${unit}`
  }
  return `每天 ${schedule.dailyTime || '09:00'}`
}

function nextRunAt(schedule = {}, dateRange = {}, enabled = true) {
  if (!enabled) return ''
  const now = new Date()
  if (schedule.type === 'once') {
    if (!schedule.onceAt) return ''
    const t = new Date(schedule.onceAt)
    return Number.isFinite(t.getTime()) && t.getTime() > now.getTime() ? t.toISOString() : ''
  }
  if (schedule.type === 'interval') {
    const unitMs = schedule.intervalUnit === 'day' ? 24 * 3600 * 1000 : 3600 * 1000
    const ts = now.getTime() + (Math.max(1, Number(schedule.intervalValue || 1)) * unitMs)
    return new Date(ts).toISOString()
  }
  const [hh, mm] = String(schedule.dailyTime || '09:00').split(':').map(Number)
  const candidate = new Date(now)
  candidate.setSeconds(0, 0)
  candidate.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0)
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1)
  if (dateRange.end) {
    const end = new Date(`${dateRange.end}T23:59:59`)
    if (Number.isFinite(end.getTime()) && candidate.getTime() > end.getTime()) return ''
  }
  return candidate.toISOString()
}

function makeId() {
  return `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function createStore(file) {
  function load() {
    const raw = readJson(file)
    const jobs = Array.isArray(raw && raw.jobs) ? raw.jobs.map(normalizeJob).filter(j => j.id) : []
    return { jobs }
  }

  function save(state) {
    writeJson(file, { jobs: Array.isArray(state.jobs) ? state.jobs : [] })
  }

  function list() {
    const state = load()
    return {
      ok: true,
      jobs: state.jobs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
      templates: DEFAULT_TEMPLATES.map(item => ({
        ...item,
        scheduleHint: scheduleToLabel(normalizeSchedule(item.schedule || {})),
      })),
    }
  }

  function create(payload = {}) {
    const state = load()
    const name = String(payload.name || '').trim()
    const prompt = String(payload.prompt || '').trim()
    if (!name) return { ok: false, error: '请填写自动化名称' }
    if (!prompt) return { ok: false, error: '请填写提示词' }
    const job = normalizeJob({
      id: makeId(),
      name,
      workspaceId: payload.workspaceId,
      prompt,
      connectorId: payload.connectorId,
      templateId: payload.templateId,
      enabled: payload.enabled !== false,
      schedule: payload.schedule,
      dateRange: payload.dateRange,
      permissionMode: payload.permissionMode,
      pushTargets: payload.pushTargets,
      lastStatus: 'idle',
      scheduleLabel: payload.scheduleLabel,
      nextRunAt: payload.nextRunAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    state.jobs.unshift(job)
    save(state)
    return { ok: true, job }
  }

  function update(id, patch = {}) {
    const state = load()
    const index = state.jobs.findIndex(item => item.id === id)
    if (index < 0) return { ok: false, error: '自动化不存在' }
    const current = state.jobs[index]
    const nextName = patch.name == null ? current.name : String(patch.name || '').trim()
    const nextPrompt = patch.prompt == null ? current.prompt : String(patch.prompt || '').trim()
    if (!nextName) return { ok: false, error: '请填写自动化名称' }
    if (!nextPrompt) return { ok: false, error: '请填写提示词' }
    const next = normalizeJob({
      ...current,
      ...patch,
      name: nextName,
      prompt: nextPrompt,
      id: current.id,
      updatedAt: nowIso(),
    })
    state.jobs[index] = next
    save(state)
    return { ok: true, job: next }
  }

  function remove(id) {
    const state = load()
    const next = state.jobs.filter(item => item.id !== id)
    if (next.length === state.jobs.length) return { ok: false, error: '自动化不存在' }
    save({ jobs: next })
    return { ok: true }
  }

  function toggle(id, enabled) {
    return update(id, { enabled: enabled === true })
  }

  function runNow(id) {
    const state = load()
    const index = state.jobs.findIndex(item => item.id === id)
    if (index < 0) return { ok: false, error: '自动化不存在' }
    const current = state.jobs[index]
    const next = normalizeJob({
      ...current,
      lastStatus: 'queued',
      lastRunAt: nowIso(),
      updatedAt: nowIso(),
    })
    state.jobs[index] = next
    save(state)
    return { ok: true, job: next, message: '已加入执行队列（调度器开发中）' }
  }

  return { list, create, update, remove, toggle, runNow }
}

module.exports = { createStore, DEFAULT_TEMPLATES }
