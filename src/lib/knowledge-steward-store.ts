'use strict'

const fs = require('fs')
const path = require('path')
const knowledgeOs = require('./knowledge-os')
const steward = require('./knowledge-steward')

const STORE_VERSION = 1

function storePath(userData) {
  return path.join(knowledgeOs.defaultPaths(userData).root, 'steward-tasks.json')
}

function emptyStore() {
  return { version: STORE_VERSION, tasks: [], proposals: [] }
}

function load(userData) {
  const file = storePath(userData)
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return {
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
    }
  } catch {
    return emptyStore()
  }
}

function save(userData, data) {
  const file = storePath(userData)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ ...data, version: STORE_VERSION }, null, 2), 'utf8')
  fs.renameSync(tmp, file)
  return data
}

function createTask(userData, input = {}) {
  const data = load(userData)
  const task = steward.createTask(input)
  data.tasks.unshift(task)
  save(userData, data)
  return task
}

function getTask(userData, taskId) {
  return load(userData).tasks.find(task => task.id === taskId) || null
}

function updateTask(userData, taskId, status, patch = {}) {
  const data = load(userData)
  const index = data.tasks.findIndex(task => task.id === taskId)
  if (index < 0) return { ok: false, error: '整理任务不存在' }
  const result = steward.transitionTask(data.tasks[index], status, patch)
  if (!result.ok) return result
  data.tasks[index] = result.task
  save(userData, data)
  return result
}

function addProposals(userData, taskId, proposals = []) {
  const data = load(userData)
  const task = data.tasks.find(item => item.id === taskId)
  if (!task) return { ok: false, error: '整理任务不存在' }
  const existing = data.proposals.filter(item => item.taskId !== taskId)
  const incoming = steward.dedupeProposals(proposals.map(item => ({ ...item, taskId })))
  data.proposals = [...incoming, ...existing]
  const nextTask = steward.createTask({
    ...task,
    status: incoming.length ? 'review' : 'completed',
    proposalCount: incoming.length,
    updatedAt: new Date().toISOString(),
  })
  data.tasks[data.tasks.indexOf(task)] = nextTask
  save(userData, data)
  return { ok: true, task: nextTask, proposals: incoming }
}

function listProposals(userData, taskId) {
  const data = load(userData)
  return data.proposals.filter(item => !taskId || item.taskId === taskId)
}

function updateProposal(userData, proposalId, patch = {}) {
  const data = load(userData)
  const index = data.proposals.findIndex(item => item.id === proposalId)
  if (index < 0) return { ok: false, error: '整理提案不存在' }
  const current = data.proposals[index]
  const status = ['draft', 'accepted', 'rejected', 'snoozed'].includes(patch.status)
    ? patch.status
    : current.status
  const next = {
    ...current,
    ...patch,
    status,
    updatedAt: new Date().toISOString(),
  }
  data.proposals[index] = next
  save(userData, data)
  return { ok: true, proposal: next }
}

module.exports = {
  STORE_VERSION,
  storePath,
  load,
  save,
  createTask,
  getTask,
  updateTask,
  addProposals,
  listProposals,
  updateProposal,
}
