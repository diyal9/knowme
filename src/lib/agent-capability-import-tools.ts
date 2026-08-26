'use strict'

/**
 * 智能体运维专员专用工具。
 * 预览只读；提交必须携带用户显式确认，并复用 Capability Hub 的防陈旧快照。
 */

const IMPORT_EXPERT_ID = 'external-capability-importer'

const PREVIEW_EXTERNAL_PROJECT = {
  type: 'function',
  function: {
    name: 'preview_external_project',
    description: 'Scan a local Cursor-style project for skills, experts, MCP connectors, and workflows without writing anything.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the external project root.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'capability-import', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'external', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const DESIGN_EXTERNAL_WORKFLOW_IMPORT = {
  type: 'function',
  function: {
    name: 'design_external_workflow_import',
    description: 'Design a precise KnowMe import package for selected workflows, resolving referenced experts and their required or explicitly requested skills without writing anything.',
    parameters: {
      type: 'object',
      properties: {
        preview_token: { type: 'string', description: 'Opaque token returned by preview_external_project.' },
        workflow_ids: { type: 'array', items: { type: 'string' }, description: 'External workflow ids to package.' },
        additional_skill_ids: { type: 'array', items: { type: 'string' }, description: 'Entry or runtime skills not declared by an expert manifest.' },
        include_optional_skills: { type: 'boolean', description: 'Include optional skills declared by selected experts.' },
        include_connectors: { type: 'boolean', description: 'Include safe project connector definitions and report blocked connectors.' },
        knowledge_mode: { type: 'string', enum: ['none', 'source', 'rag'], description: 'Knowledge handling: source keeps the project bound; rag copies Markdown/text into KnowMe knowledge retrieval.' },
      },
      required: ['preview_token', 'workflow_ids'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'capability-import-plan', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'external', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const IMPORT_EXTERNAL_PROJECT = {
  type: 'function',
  function: {
    name: 'import_external_project',
    description: 'Import the exact previously previewed project snapshot. Call only after the user explicitly confirms the shown preview and trust decision.',
    parameters: {
      type: 'object',
      properties: {
        plan_token: { type: 'string', description: 'Opaque token returned by design_external_workflow_import for a precise package.' },
        preview_token: { type: 'string', description: 'Legacy whole-repository preview token. Prefer plan_token.' },
        trust_confirmed: { type: 'boolean', description: 'Must be true only after explicit user confirmation.' },
      },
      required: ['trust_confirmed'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'capability-import', risk: 'write', sideEffects: true,
    requiresApproval: true, scope: 'user-data', timeoutMs: 60000,
    idempotencySupported: true, rollbackSupported: true,
  },
}

const VERIFY_IMPORTED_WORKFLOW = {
  type: 'function',
  function: {
    name: 'verify_imported_workflow',
    description: 'Verify that an imported KnowMe workflow exists and all referenced experts and skills are installed and enabled.',
    parameters: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'Actual KnowMe workflow id returned by import_external_project.' },
      },
      required: ['workflow_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'capability-import-verify', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

function compact(value) {
  return JSON.stringify(value, null, 2).slice(0, 24000)
}

function buildCapabilityImportTools(options = {}) {
  const hub = options.hub
  if (!hub) return null
  return {
    definitions: [PREVIEW_EXTERNAL_PROJECT, DESIGN_EXTERNAL_WORKFLOW_IMPORT, IMPORT_EXTERNAL_PROJECT, VERIFY_IMPORTED_WORKFLOW],
    handlers: {
      preview_external_project: async (args = {}) => {
        const folderPath = String(args.path || '').trim()
        if (!folderPath) return { ok: false, code: 'invalid_args', text: '缺少外部项目绝对路径' }
        const result = await hub.scanCursorRepositoryForHub({ path: folderPath })
        return {
          ok: result?.ok !== false,
          code: result?.code,
          text: compact(result),
          preview: result,
          meta: result?.ok ? {
            previewToken: result.previewToken,
            counts: result.counts,
            warnings: result.warnings,
          } : null,
        }
      },
      design_external_workflow_import: async (args = {}) => {
        const previewToken = String(args.preview_token || '').trim()
        const workflowIds = Array.isArray(args.workflow_ids) ? args.workflow_ids.map(String).filter(Boolean) : []
        if (!previewToken || !workflowIds.length) {
          return { ok: false, code: 'invalid_args', text: '缺少 preview_token 或 workflow_ids，请先预览并选择目标工作流' }
        }
        const result = await hub.planCursorRepositoryForHub({
          previewToken,
          workflowIds,
          additionalSkillIds: Array.isArray(args.additional_skill_ids) ? args.additional_skill_ids : [],
          includeOptionalSkills: args.include_optional_skills === true,
          includeConnectors: args.include_connectors !== false,
          knowledgeMode: ['rag', 'source'].includes(String(args.knowledge_mode || '').toLowerCase())
            ? String(args.knowledge_mode).toLowerCase()
            : 'none',
        })
        return {
          ok: result?.ok !== false,
          code: result?.code,
          text: compact(result),
          plan: result?.plan || null,
          meta: result?.ok ? { planToken: result.planToken, counts: result.plan?.counts } : null,
        }
      },
      import_external_project: async (args = {}) => {
        const planToken = String(args.plan_token || '').trim()
        const previewToken = String(args.preview_token || '').trim()
        if (!planToken && !previewToken) return { ok: false, code: 'invalid_args', text: '缺少 plan_token，请先预览并设计导入包' }
        if (args.trust_confirmed !== true) {
          return {
            ok: false,
            code: 'trust_required',
            text: '尚未获得用户对当前预览的明确导入确认。请展示能力、专家、连接器、工作流和风险摘要后等待确认。',
            requiresApproval: true,
          }
        }
        const result = await hub.importCursorRepository({
          planToken,
          previewToken: planToken ? '' : previewToken,
          trustConfirmed: true,
          riskConfirmed: true,
        })
        return {
          ok: result?.ok !== false,
          code: result?.code,
          text: compact(result),
          requiresApproval: true,
          meta: result?.ok ? { counts: result.counts, idMaps: result.idMaps } : null,
        }
      },
      verify_imported_workflow: async (args = {}) => {
        const workflowId = String(args.workflow_id || '').trim()
        if (!workflowId) return { ok: false, code: 'invalid_args', text: '缺少 workflow_id' }
        const result = await hub.verifyImportedWorkflow({ workflowId })
        return { ok: result?.ok === true, code: result?.code, text: compact(result), verification: result }
      },
    },
  }
}

module.exports = {
  IMPORT_EXPERT_ID,
  PREVIEW_EXTERNAL_PROJECT,
  DESIGN_EXTERNAL_WORKFLOW_IMPORT,
  IMPORT_EXTERNAL_PROJECT,
  VERIFY_IMPORTED_WORKFLOW,
  buildCapabilityImportTools,
}
