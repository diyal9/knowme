'use strict'

/**
 * agent-plan-tools — update_plan 工具定义与 handler 工厂。
 * 副作用（改 session）由调用方通过 getSession/setSession 注入。
 */

const agentRun = require('./agent-run')

const UPDATE_PLAN_TOOL = {
  type: 'function',
  function: {
    name: 'update_plan',
    description:
      'Create or update the structured execution plan checklist for this run. Use early for multi-step work; mark items doing/done/blocked with short evidence. Prefer 3–7 items. Writing files still requires user approval via artifacts — do not claim disk writes are applied.',
    parameters: {
      type: 'object',
      properties: {
        replace: {
          type: 'array',
          description: 'Replace the entire plan with these items (title required; optional id/status/evidence).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'doing', 'done', 'blocked'] },
              evidence: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
        upsert: {
          type: 'array',
          description: 'Upsert one or more plan items by id (or create with new id).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'doing', 'done', 'blocked'] },
              evidence: { type: 'string' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
        set_status: {
          type: 'object',
          description: 'Update a single item status by id.',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'doing', 'done', 'blocked'] },
            evidence: { type: 'string' },
          },
          required: ['id', 'status'],
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  _knowme: { source: 'plan', requiresApproval: false },
}

/**
 * @param {{ getSession: () => object, setSession: (session: object) => void }} deps
 */
function buildPlanTools(deps = {}) {
  const getSession = typeof deps.getSession === 'function' ? deps.getSession : () => null
  const setSession = typeof deps.setSession === 'function' ? deps.setSession : () => {}

  async function handleUpdatePlan(args = {}) {
    let session = getSession()
    if (!session) {
      return { ok: false, text: '当前没有活动 Session，无法更新计划。', message: 'no session' }
    }
    if (Array.isArray(args.replace)) {
      session = agentRun.replacePlan(session, args.replace)
    }
    if (Array.isArray(args.upsert) && args.upsert.length) {
      session = agentRun.upsertPlanItems(session, args.upsert)
    }
    if (args.set_status && typeof args.set_status === 'object') {
      session = agentRun.setPlanItemStatus(
        session,
        args.set_status.id,
        args.set_status.status,
        args.set_status.evidence,
      )
    }
    if (!Array.isArray(args.replace) && !(Array.isArray(args.upsert) && args.upsert.length) && !args.set_status) {
      return {
        ok: false,
        text: 'update_plan 需要 replace、upsert 或 set_status 之一。',
        message: 'invalid_args',
        code: 'invalid_args',
      }
    }
    setSession(session)
    const checklist = agentRun.formatPlanChecklist(session.run?.plan) || '（计划为空）'
    const remaining = agentRun.countPlanRemaining(session.run?.plan)
    return {
      ok: true,
      text: `${checklist}\n\n剩余未完成：${remaining}`,
      preview: checklist.slice(0, 400),
      meta: {
        remaining,
        itemCount: session.run?.plan?.items?.length || 0,
        version: session.run?.plan?.version || 0,
      },
    }
  }

  return {
    definitions: [UPDATE_PLAN_TOOL],
    handlers: {
      update_plan: handleUpdatePlan,
    },
  }
}

module.exports = {
  UPDATE_PLAN_TOOL,
  buildPlanTools,
}
