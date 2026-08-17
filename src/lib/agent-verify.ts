'use strict'

/**
 * agent-verify — 基于 run.plan 完成度的无副作用判定。
 * 决定 continue / expand / finalize，不执行工具、不写盘。
 */

const agentRun = require('./agent-run')

/**
 * @param {object} plan
 * @param {{ canExpand?: boolean }} [opts]
 * @returns {{
 *   action: 'continue'|'expand'|'finalize',
 *   reason: string,
 *   remaining: number,
 *   blocked: number,
 *   done: number,
 *   partialReport?: string,
 * }}
 */
function evaluatePlanCompletion(plan, opts = {}) {
  const normalized = agentRun.normalizePlan(plan)
  if (!normalized || !normalized.items.length) {
    return {
      action: 'finalize',
      reason: 'no_plan',
      remaining: 0,
      blocked: 0,
      done: 0,
    }
  }
  const items = normalized.items
  const done = items.filter((item) => item.status === 'done').length
  const blocked = items.filter((item) => item.status === 'blocked').length
  const remaining = items.filter((item) => item.status === 'pending' || item.status === 'doing').length
  const canExpand = opts.canExpand === true

  if (remaining === 0 && blocked === 0) {
    return { action: 'finalize', reason: 'plan_complete', remaining, blocked, done }
  }

  if (remaining > 0 && canExpand) {
    return { action: 'expand', reason: 'plan_incomplete', remaining, blocked, done }
  }

  // Within budget (caller still has rounds/tools left): keep looping.
  if (remaining > 0 && opts.budgetExhausted !== true) {
    return {
      action: 'continue',
      reason: 'plan_incomplete_within_budget',
      remaining,
      blocked,
      done,
    }
  }

  // Budget exhausted, only blocked left, or expand unavailable → partial finalize.
  const checklist = agentRun.formatPlanChecklist(normalized)
  const partialReport = [
    '计划尚未全部完成，以下是当前状态：',
    checklist,
    blocked
      ? '存在 blocked 项：请说明阻塞原因与所需用户审批/授权，不要假装已完成。'
      : '仍有未完成项：请明确列出缺口，不要臆造结果。写入仍需用户确认后才会落盘。',
  ].join('\n')
  return {
    action: 'finalize',
    reason: blocked ? 'plan_blocked' : 'plan_incomplete_exhausted',
    remaining,
    blocked,
    done,
    partialReport,
  }
}

function buildPartialFinalizeNote(evaluation) {
  if (!evaluation || evaluation.action !== 'finalize') return ''
  if (evaluation.reason === 'no_plan' || evaluation.reason === 'plan_complete') return ''
  return String(evaluation.partialReport || '').trim()
}

module.exports = {
  evaluatePlanCompletion,
  buildPartialFinalizeNote,
}
