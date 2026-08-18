'use strict'

/**
 * Team/Workspace 预算计量与熔断。单 run 预算之上的聚合守卫。
 */

function createWorkspaceBudget(opts = {}) {
  const maxCostUsd = Number.isFinite(opts.maxCostUsd) ? opts.maxCostUsd : 20
  const maxWallMs = Number.isFinite(opts.maxWallMs) ? opts.maxWallMs : 30 * 60 * 1000
  const exemptPriorities = new Set(opts.exemptPriorities || ['p0', 'critical'])
  /** @type {Map<string, { costUsd: number, wallMs: number, success: number, fail: number, timeout: number, recoveryMs: number }>} */
  const buckets = new Map()

  function keyOf(scope = {}) {
    return String(scope.workspaceId || scope.teamId || 'default')
  }

  function bucket(scope) {
    const id = keyOf(scope)
    if (!buckets.has(id)) {
      buckets.set(id, { costUsd: 0, wallMs: 0, success: 0, fail: 0, timeout: 0, recoveryMs: 0 })
    }
    return buckets.get(id)
  }

  function check(scope = {}) {
    if (exemptPriorities.has(String(scope.priority || '').toLowerCase())) {
      return { ok: true, exempt: true }
    }
    const row = bucket(scope)
    if (row.costUsd >= maxCostUsd) {
      return { ok: false, code: 'workspace_budget_cost', message: '工作区成本预算已用尽', row }
    }
    if (row.wallMs >= maxWallMs) {
      return { ok: false, code: 'workspace_budget_wall', message: '工作区时长预算已用尽', row }
    }
    return { ok: true, row }
  }

  function record(scope = {}, sample = {}) {
    const row = bucket(scope)
    row.costUsd += Number(sample.costUsd) || 0
    row.wallMs += Number(sample.wallMs) || 0
    if (sample.ok === false) row.fail += 1
    else row.success += 1
    if (sample.timeout) row.timeout += 1
    if (Number(sample.recoveryMs) > 0) row.recoveryMs += Number(sample.recoveryMs)
    return row
  }

  function slo(scope = {}) {
    const row = bucket(scope)
    const total = row.success + row.fail
    return {
      workspaceId: keyOf(scope),
      successRate: total ? row.success / total : 1,
      timeoutRate: total ? row.timeout / total : 0,
      recoveryDelayMs: row.fail ? row.recoveryMs / Math.max(1, row.fail) : 0,
      costUsd: row.costUsd,
      wallMs: row.wallMs,
    }
  }

  return { check, record, slo, buckets }
}

module.exports = { createWorkspaceBudget }
