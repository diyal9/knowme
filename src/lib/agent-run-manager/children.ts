/**
 * agent-run-manager/children — 子 Run 创建、等待与批量取消。
 * 不负责：根 Run 生命周期（见 lifecycle.ts）。
 */
'use strict'

const { BUS_VERSION } = require('../agent-message-bus')
const { TERMINAL_STATUSES } = require('./constants')
const t = require('./transitions')
const lifecycle = require('./lifecycle')

function createChildRun(mgr, parentRunId, spec = {}) {
  const parent = lifecycle.getRun(mgr, parentRunId)
  if (!parent.ok) return parent

  const depth = (parent.run.depth || 0) + 1
  if (depth > mgr.maxDepth) {
    return { ok: false, code: 'orchestration_depth_exceeded', message: '编排深度超限' }
  }

  const parentEnvelope = parent.run.governanceEnvelope || {}
  const parentOrchestration = parentEnvelope.orchestration
    || parentEnvelope.permissions?.orchestration
    || parent.run.permissions?.orchestration
    || {}
  const allowedSubExperts = parentOrchestration.allowedSubExperts || parentOrchestration.allowedExperts
  if (Array.isArray(allowedSubExperts) && allowedSubExperts.length && !allowedSubExperts.includes(spec.expertId)) {
    return { ok: false, code: 'scope_denied', message: `子专家未授权: ${spec.expertId}` }
  }
  if (mgr.authorizeChild) {
    const authorization = mgr.authorizeChild(spec, parent.run)
    if (authorization !== true && authorization?.ok !== true) {
      return {
        ok: false,
        code: authorization?.code || 'unknown_agent',
        message: authorization?.message || `未知或不可用 Agent: ${spec.expertId || spec.agentPackageId || ''}`,
      }
    }
  }

  if (mgr.scheduler) {
    const gate = mgr.scheduler.canLaunch(parentRunId, depth)
    if (!gate.ok) return gate
  }

  const childSpec = {
    ...spec,
    runId: spec.runId || spec.subRunId || mgr.idGen(),
    parentRunId: String(parentRunId),
    rootRunId: parent.run.rootRunId || String(parentRunId),
    depth,
    joinStrategy: spec.joinStrategy || parent.run.joinStrategy,
    permissions: spec.permissions || parent.run.permissions,
    governanceEnvelope: spec.governanceEnvelope || parentEnvelope,
    budget: spec.budget || parent.run.budget,
  }
  const created = lifecycle.createRun(mgr, { ...childSpec, autoLaunch: spec.autoLaunch !== false })
  if (!created.ok) return created

  const parentRun = mgr.runs.get(String(parentRunId))
  if (parentRun) {
    parentRun.childRunIds = [...(parentRun.childRunIds || []), created.runId]
    t.persistRun(mgr, parentRun, 'run.child.spawned', { childRunId: created.runId })
  }

  if (mgr.messageBus) {
    mgr.messageBus.publish({
      version: BUS_VERSION,
      runId: created.runId,
      parentRunId: String(parentRunId),
      rootRunId: childSpec.rootRunId,
      targetRunId: created.runId,
      type: 'task.assign',
      payload: {
        targetAgentPackageId: spec.agentPackageId || spec.expertId || null,
        prompt: spec.prompt || '',
        handoffContext: spec.handoff || spec.handoffContext || {},
        inputSchemaRef: spec.inputSchemaRef || null,
        correlationId: spec.correlationId || created.runId,
      },
    })
  }

  return created
}

async function createAndLaunchChild(mgr, spec = {}) {
  const parentRunId = String(spec.parentRunId || '')
  if (!parentRunId) return { ok: false, code: 'invalid_args', text: '缺少 parentRunId' }
  const created = createChildRun(mgr, parentRunId, spec)
  if (!created.ok) return { ...created, text: created.message || created.code }
  return {
    ok: true,
    launched: true,
    runId: created.runId,
    subRunId: created.runId,
    status: 'queued',
    text: `子 Run ${created.runId} 已进入执行队列`,
    meta: {
      subRunId: created.runId,
      expertId: spec.expertId || null,
      builderId: spec.builderId || spec.backend || 'knowme-local',
      status: 'queued',
    },
  }
}

function awaitRun(mgr, runId, timeoutMs = 60000) {
  const id = String(runId || '')
  const current = lifecycle.getRunStatus(mgr, id)
  if (!current.ok || TERMINAL_STATUSES.has(current.status)) return Promise.resolve(current)
  const timeout = Math.max(100, Math.min(Number(timeoutMs) || 60000, 30 * 60 * 1000))
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const list = mgr.waiters.get(id) || []
      mgr.waiters.set(id, list.filter(item => item.timer !== timer))
      mgr.metrics.gauge('waiter_count', t.waiterCount(mgr))
      resolve({ ok: false, code: 'subrun_timeout', text: `子 Run ${id} 等待超时`, runId: id })
    }, timeout)
    const list = mgr.waiters.get(id) || []
    list.push({ timer, resolve })
    mgr.waiters.set(id, list)
    mgr.metrics.gauge('waiter_count', t.waiterCount(mgr))
  })
}

async function cancelAllChildren(mgr, parentRunId, reason = 'parent_cancelled') {
  const hit = lifecycle.getRun(mgr, parentRunId)
  if (!hit.ok) return hit
  const startedAt = mgr.now()
  const cancelled = []
  for (const childRunId of hit.run.childRunIds || []) {
    const result = await lifecycle.cancelRun(mgr, childRunId, reason)
    if (result.ok) cancelled.push(childRunId)
  }
  const elapsedMs = mgr.now() - startedAt
  return { ok: true, cancelled, elapsedMs, withinBudget: elapsedMs <= mgr.cancelBudgetMs }
}

module.exports = {
  createChildRun,
  createAndLaunchChild,
  awaitRun,
  cancelAllChildren,
}
