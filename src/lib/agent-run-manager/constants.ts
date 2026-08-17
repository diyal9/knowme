/**
 * agent-run-manager/constants — Run 状态机常量与 clone 工具。
 * 不负责：状态转换逻辑（见 transitions.ts）。
 */
'use strict'

const { createRunId } = require('../agent-run-store')

const RUN_STATUSES = Object.freeze([
  'created',
  'queued',
  'running',
  'waiting',
  'blocked',
  'terminalizing',
  'done',
  'error',
  'cancelled',
  'recovering',
  'interrupted',
])

const TERMINAL_STATUSES = new Set(['done', 'error', 'cancelled'])
const ACTIVE_STATUSES = new Set(['created', 'queued', 'running', 'waiting', 'blocked', 'terminalizing', 'recovering'])

const VALID_TRANSITIONS = Object.freeze({
  created: new Set(['queued', 'cancelled']),
  queued: new Set(['running', 'blocked', 'cancelled']),
  running: new Set(['waiting', 'blocked', 'terminalizing', 'error', 'cancelled']),
  waiting: new Set(['running', 'terminalizing', 'error', 'cancelled', 'recovering']),
  blocked: new Set(['queued', 'running', 'cancelled', 'error']),
  recovering: new Set(['running', 'waiting', 'error', 'cancelled']),
  interrupted: new Set(['recovering', 'error', 'cancelled']),
  terminalizing: new Set(['done', 'error', 'cancelled']),
  done: new Set(),
  error: new Set(),
  cancelled: new Set(),
})

const CANCEL_BUDGET_MS = 3000

function defaultIdGen() {
  return createRunId()
}

function cloneRun(record) {
  return JSON.parse(JSON.stringify(record))
}

module.exports = {
  RUN_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  VALID_TRANSITIONS,
  CANCEL_BUDGET_MS,
  defaultIdGen,
  cloneRun,
}
