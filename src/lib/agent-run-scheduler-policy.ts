'use strict'

const DEFAULT_MAX_PARALLEL = 1
const DEFAULT_MAX_DEPTH = 2
const DEFAULT_MAX_CHILDREN = 2
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_BACKOFF_MS = 500
const DEFAULT_MAX_BACKOFF_MS = 30_000
const DEFAULT_WALL_BUDGET_MS = 30 * 60 * 1000
const DEFAULT_MAX_TOOL_CALLS = 200

const RETRIABLE_CODES = new Set([
  'network',
  'timeout',
  'tool_unavailable',
  'service_unavailable',
  'rate_limited',
])

const NON_RETRIABLE_CODES = new Set([
  'scope_denied',
  'orchestration_depth_exceeded',
  'parallel_cap_exceeded',
  'bus_unauthorized',
  'tool_not_allowed',
])

const QUEUES = ['ready', 'waiting', 'blocked', 'retry']

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = {
  DEFAULT_MAX_PARALLEL,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_CHILDREN,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
  DEFAULT_WALL_BUDGET_MS,
  DEFAULT_MAX_TOOL_CALLS,
  RETRIABLE_CODES,
  NON_RETRIABLE_CODES,
  QUEUES,
  sleepMs,
}
