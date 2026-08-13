'use strict'

const fs = require('fs')
const path = require('path')
const {
  normalizeTaskScheduleFields,
} = require('./workbench-task-scheduler')

const VERSION = 1
const TITLE_MAX = 160
const GOAL_MAX = 2000
const SUMMARY_MAX = 280
const LIST_MAX = 200
const KNOWLEDGE_REFS_MAX = 16
const STATUSES = Object.freeze(['draft', 'running', 'review', 'done', 'failed', 'cancelled'])
const EXEC_KINDS = Object.freeze(['session', 'run', 'daemon', 'none'])

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

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function pickStatus(value) {
  const status = text(value, 20).toLowerCase()
  return STATUSES.includes(status) ? status : 'draft'
}

function normalizeExecRef(raw) {
  if (!raw || typeof raw !== 'object') return { kind: 'none', id: '' }
  const kind = text(raw.kind, 20).toLowerCase()
  return {
    kind: EXEC_KINDS.includes(kind) ? kind : 'none',
    id: text(raw.id, 160),
  }
}

function normalizeKnowledgeRefs(raw) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(raw) ? raw : []) {
    const item = typeof value === 'string'
      ? { id: value }
      : (value && typeof value === 'object' ? value : null)
    const itemId = text(item?.id, 80)
    if (!itemId || seen.has(itemId)) continue
    seen.add(itemId)
    out.push({ id: itemId })
    if (out.length >= KNOWLEDGE_REFS_MAX) break
  }
  return out
}

function normalizeTaskRef(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = text(raw.id, 80)
  return id ? { id } : null
}

function genId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeTask(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const createdAt = text(source.createdAt, 40) || nowIso()
  const scheduleFields = normalizeTaskScheduleFields(source)
  return {
    id: text(source.id, 80) || genId(),
    title: text(source.title, TITLE_MAX) || text(source.goal, TITLE_MAX) || '未命名任务',
    expertId: text(source.expertId, 160),
    expertName: text(source.expertName, TITLE_MAX),
    workflowId: text(source.workflowId, 160),
    workflowName: text(source.workflowName, TITLE_MAX),
    goal: text(source.goal, GOAL_MAX),
    resultSummary: text(source.resultSummary, SUMMARY_MAX),
    status: pickStatus(source.status),
    execRef: normalizeExecRef(source.execRef),
    taskRef: normalizeTaskRef(source.taskRef),
    knowledgeRefs: normalizeKnowledgeRefs(source.knowledgeRefs),
    pinned: Boolean(source.pinned),
    ...scheduleFields,
    createdAt,
    updatedAt: text(source.updatedAt, 40) || createdAt,
  }
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return String(b.updatedAt).localeCompare(String(a.updatedAt))
  })
}

function createStore(file) {
  function loadAll() {
    const raw = readJson(file)
    const list = raw && raw.version === VERSION && Array.isArray(raw.tasks) ? raw.tasks : []
    return list.map(normalizeTask)
  }

  function persist(tasks) {
    const trimmed = sortTasks(tasks).slice(0, LIST_MAX)
    writeJson(file, { version: VERSION, tasks: trimmed, updatedAt: nowIso() })
    return trimmed
  }

  function list() {
    return { ok: true, tasks: sortTasks(loadAll()) }
  }

  function get(id) {
    const key = text(id, 80)
    const task = loadAll().find(item => item.id === key)
    return task ? { ok: true, task } : { ok: false, error: '任务不存在' }
  }

  function create(input = {}) {
    const task = normalizeTask({ ...input, id: '', createdAt: nowIso(), updatedAt: nowIso() })
    if (!task.goal && !task.title) return { ok: false, error: '任务目标不能为空' }
    const tasks = loadAll()
    tasks.push(task)
    persist(tasks)
    return { ok: true, task }
  }

  function update(id, patch = {}) {
    const key = text(id, 80)
    const tasks = loadAll()
    const index = tasks.findIndex(item => item.id === key)
    if (index === -1) return { ok: false, error: '任务不存在' }
    const merged = normalizeTask({ ...tasks[index], ...(patch || {}), id: key, updatedAt: nowIso() })
    tasks[index] = merged
    persist(tasks)
    return { ok: true, task: merged }
  }

  function archive(id) {
    const key = text(id, 80)
    const tasks = loadAll().filter(item => item.id !== key)
    persist(tasks)
    return { ok: true }
  }

  return { list, get, create, update, archive }
}

module.exports = {
  VERSION,
  STATUSES,
  EXEC_KINDS,
  KNOWLEDGE_REFS_MAX,
  SUMMARY_MAX,
  normalizeTask,
  normalizeKnowledgeRefs,
  normalizeTaskRef,
  normalizeExecRef,
  createStore,
}
