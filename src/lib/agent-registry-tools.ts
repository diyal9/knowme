'use strict'

/** Agent-callable control plane for runtime professional Agent and Skill operations. */

const { parseSkillFrontmatter } = require('./skill-runtime')

const LIST_MANAGEABLE_AGENTS = {
  type: 'function',
  function: {
    name: 'list_manageable_agents',
    description: 'List the Agent objects the current operator is allowed to evaluate or tune. Admins can see system Agents; ordinary users only see their own Agents.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional name, id, or description filter.' } },
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-list', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const GET_AGENT_DEFINITION = {
  type: 'function',
  function: {
    name: 'get_agent_definition',
    description: 'Read the complete current definition and configuration hash for one authorized Agent object.',
    parameters: {
      type: 'object',
      properties: { agent_id: { type: 'string' } },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-definition-read', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const VERIFY_AGENT_DEFINITION = {
  type: 'function',
  function: {
    name: 'verify_agent_definition',
    description: 'Validate a complete professional KnowMe Agent definition without writing any data.',
    parameters: {
      type: 'object',
      properties: {
        definition: { type: 'object', description: 'Complete professional Agent definition.', additionalProperties: true },
      },
      required: ['definition'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-verify', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const PREVIEW_AGENT_CHANGE = {
  type: 'function',
  function: {
    name: 'preview_agent_change',
    description: 'Preview a create, update, retire, restore, or rollback operation. Returns an expiring change token and never writes data.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'retire', 'restore', 'rollback'] },
        agent_id: { type: 'string' },
        definition: { type: 'object', additionalProperties: true },
        revision: { type: 'integer', minimum: 1 },
        successors: { type: 'array', items: { type: 'object', additionalProperties: true } },
        reason: { type: 'string' },
      },
      required: ['action', 'agent_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-preview', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: false, rollbackSupported: false,
  },
}

const COMMIT_AGENT_CHANGE = {
  type: 'function',
  function: {
    name: 'commit_agent_change',
    description: 'Commit the exact Agent change represented by a fresh preview token. Host approval is always required.',
    parameters: {
      type: 'object',
      properties: {
        change_token: { type: 'string', description: 'Opaque token returned by preview_agent_change.' },
      },
      required: ['change_token'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-commit', risk: 'write', sideEffects: true,
    requiresApproval: true, scope: 'user-data', timeoutMs: 60000,
    idempotencySupported: false, rollbackSupported: true,
  },
}

const LIST_AGENT_REVISIONS = {
  type: 'function',
  function: {
    name: 'list_agent_revisions',
    description: 'List immutable runtime revisions for one Agent.',
    parameters: {
      type: 'object',
      properties: { agent_id: { type: 'string' } },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-revisions', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const SKILL_DEFINITION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Stable Skill id using letters, numbers, dots, underscores, or hyphens.' },
    name: { type: 'string' },
    description: { type: 'string', description: 'When the Skill should be used and what outcome it provides.' },
    slash: { type: 'string', description: 'Optional slash command without a leading slash.' },
    instructions: { type: 'string', description: 'Complete Markdown instructions written to SKILL.md.' },
    evaluation_cases: {
      type: 'array',
      description: 'Optional evaluation plan. These cases do not count as passed without real observations.',
      items: { type: 'object', additionalProperties: true },
    },
  },
  required: ['id', 'name', 'description', 'instructions'],
  additionalProperties: true,
}

const LIST_MANAGEABLE_SKILLS = {
  type: 'function',
  function: {
    name: 'list_manageable_skills',
    description: 'List Skills added or installed in KnowMe. User-created custom Skills are editable; bundled or externally installed Skills are read-only evaluation targets.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional name, id, or description filter.' } },
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'skill-governance-list', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const GET_SKILL_DEFINITION = {
  type: 'function',
  function: {
    name: 'get_skill_definition',
    description: 'Read the complete SKILL.md definition for one added or installed Skill and report whether it can be updated in place.',
    parameters: {
      type: 'object',
      properties: { skill_id: { type: 'string' } },
      required: ['skill_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'skill-governance-definition-read', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const VERIFY_SKILL_DEFINITION = {
  type: 'function',
  function: {
    name: 'verify_skill_definition',
    description: 'Validate a proposed KnowMe Skill definition without writing data. Static validation is not evidence that behavioral evaluation cases passed.',
    parameters: {
      type: 'object',
      properties: { definition: SKILL_DEFINITION_SCHEMA },
      required: ['definition'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'skill-governance-verify', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const PUBLISH_SKILL_DEFINITION = {
  type: 'function',
  function: {
    name: 'publish_skill_definition',
    description: 'Create or update a user-owned custom Skill from a verified definition. Requires the user to confirm the exact definition and the host to approve the write.',
    parameters: {
      type: 'object',
      properties: { definition: SKILL_DEFINITION_SCHEMA },
      required: ['definition'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'skill-governance-publish', risk: 'write', sideEffects: true,
    requiresApproval: true, scope: 'user-data', timeoutMs: 60000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const GET_AGENT_DRAFT = {
  type: 'function',
  function: {
    name: 'get_agent_draft',
    description: 'Load the structured draft for the Agent currently being created or tuned.',
    parameters: {
      type: 'object',
      properties: { agent_id: { type: 'string' } },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-draft-read', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const UPDATE_AGENT_DRAFT = {
  type: 'function',
  function: {
    name: 'update_agent_draft',
    description: 'Update a local Agent draft after the user agrees to the proposed definition changes. This does not publish the Agent.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        definition: { type: 'object', additionalProperties: true },
        intent: { type: 'string', enum: ['create', 'update'] },
      },
      required: ['agent_id', 'definition'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-registry-draft-write', risk: 'write', sideEffects: true,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: true,
  },
}

const CHECK_AGENT_EVAL_RUNTIME = {
  type: 'function',
  function: {
    name: 'check_agent_eval_runtime',
    description: 'Check whether the local Python DeepEval runtime is available. Does not install packages or call a judge model.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-evaluation-runtime', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const SETUP_AGENT_EVAL_RUNTIME = {
  type: 'function',
  function: {
    name: 'setup_agent_eval_runtime',
    description: 'Install or upgrade DeepEval in an isolated KnowMe user-data Python environment. Requires a local Python runtime, network access, and explicit host approval; never modifies KnowMe source code.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-evaluation-setup', risk: 'external', sideEffects: true,
    requiresApproval: true, scope: 'user-data', timeoutMs: 900000,
    idempotencySupported: true, rollbackSupported: true,
  },
}

const SAVE_AGENT_EVAL_SUITE = {
  type: 'function',
  function: {
    name: 'save_agent_eval_suite',
    description: 'Save a version-bound Agent evaluation suite with DeepEval-style metrics and representative cases. This does not run the target Agent.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        suite: { type: 'object', description: 'Suite containing id, metrics, and cases.', additionalProperties: true },
      },
      required: ['agent_id', 'suite'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-evaluation-suite', risk: 'write', sideEffects: true,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: true,
  },
}

const RUN_AGENT_EVAL = {
  type: 'function',
  function: {
    name: 'run_agent_eval',
    description: 'Evaluate real target-Agent observations against a saved suite. Deterministic metrics run locally; semantic metrics use the configured DeepEval judge and may consume model tokens. Saves an immutable local report and never uploads it to Confident AI.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        suite_id: { type: 'string' },
        engine: { type: 'string', enum: ['auto', 'native', 'deepeval'] },
        judge_model: { type: 'string', description: 'Optional DeepEval judge model name. Credentials must come from the local runtime environment and are never accepted here.' },
        observations: {
          type: 'array',
          description: 'Real run evidence keyed by case_id; never synthesize these values.',
          items: { type: 'object', additionalProperties: true },
        },
      },
      required: ['agent_id', 'suite_id', 'observations'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-evaluation-run', risk: 'network', sideEffects: true,
    requiresApproval: true, scope: 'user-data', timeoutMs: 240000,
    idempotencySupported: false, rollbackSupported: false,
  },
}

const GET_AGENT_EVAL_REPORT = {
  type: 'function',
  function: {
    name: 'get_agent_eval_report',
    description: 'Read the latest or a specified immutable Agent evaluation report.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        run_id: { type: 'string' },
      },
      required: ['agent_id'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin', capability: 'agent-evaluation-report', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'user-data', timeoutMs: 30000,
    idempotencySupported: true, rollbackSupported: false,
  },
}

const AGENT_EVALUATION_DEFINITIONS = [
  CHECK_AGENT_EVAL_RUNTIME,
  SETUP_AGENT_EVAL_RUNTIME,
  SAVE_AGENT_EVAL_SUITE,
  RUN_AGENT_EVAL,
  GET_AGENT_EVAL_REPORT,
]

const AGENT_LIFECYCLE_DEFINITIONS = [
  LIST_MANAGEABLE_AGENTS,
  GET_AGENT_DEFINITION,
  GET_AGENT_DRAFT,
  UPDATE_AGENT_DRAFT,
  VERIFY_AGENT_DEFINITION,
  PREVIEW_AGENT_CHANGE,
  COMMIT_AGENT_CHANGE,
  LIST_AGENT_REVISIONS,
]

const SKILL_GOVERNANCE_DEFINITIONS = [
  LIST_MANAGEABLE_SKILLS,
  GET_SKILL_DEFINITION,
  VERIFY_SKILL_DEFINITION,
  PUBLISH_SKILL_DEFINITION,
]

const AGENT_REGISTRY_DEFINITIONS = [
  ...AGENT_LIFECYCLE_DEFINITIONS,
  ...AGENT_EVALUATION_DEFINITIONS,
  ...SKILL_GOVERNANCE_DEFINITIONS,
]

function compact(value) {
  return JSON.stringify(value, null, 2).slice(0, 24000)
}

function toolResult(result, extra = {}) {
  return {
    ok: result?.ok === true,
    code: result?.code,
    text: compact(result),
    ...extra,
  }
}

function normalizeSkillDefinition(value = {}) {
  const id = String(value?.id || '').trim()
  return {
    id,
    name: String(value?.name || '').trim(),
    description: String(value?.description || '').trim(),
    slash: String(value?.slash || id).trim().replace(/^\/+/, '') || id,
    instructions: String(value?.instructions || value?.body || '').trim(),
    evaluationCases: Array.isArray(value?.evaluation_cases)
      ? value.evaluation_cases
      : Array.isArray(value?.evaluationCases) ? value.evaluationCases : [],
  }
}

function skillInstructionsFromBody(body, name) {
  const lines = String(body || '').replace(/^\s+/, '').split(/\r?\n/)
  if (lines[0]?.trim() === `# ${String(name || '').trim()}`) lines.shift()
  return lines.join('\n').trim()
}

function verifySkillDefinition(definition = {}) {
  const normalized = normalizeSkillDefinition(definition)
  const issues = []
  const warnings = []
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(normalized.id)) {
    issues.push({ field: 'id', message: 'Skill ID 必须以字母或数字开头，只能包含字母、数字、点、下划线和短横线，最长 64 个字符。' })
  }
  if (!normalized.name) issues.push({ field: 'name', message: '缺少 Skill 名称。' })
  if (!normalized.description) issues.push({ field: 'description', message: '缺少 Skill 使用场景与目标描述。' })
  if (!normalized.instructions) issues.push({ field: 'instructions', message: '缺少完整 Skill 指令。' })
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(normalized.slash)) {
    issues.push({ field: 'slash', message: '调用命令只能包含字母、数字、点、下划线和短横线，最长 64 个字符。' })
  }
  if (normalized.description && normalized.description.length < 12) {
    warnings.push({ field: 'description', message: '描述较短，建议明确何时触发、解决什么问题以及预期结果。' })
  }
  if (normalized.instructions && normalized.instructions.length < 80) {
    warnings.push({ field: 'instructions', message: '指令较短，建议补充步骤、输入输出、边界和失败处理。' })
  }
  if (normalized.evaluationCases.length > 0 && normalized.evaluationCases.length < 4) {
    warnings.push({ field: 'evaluation_cases', message: '评估用例少于 4 个，建议至少覆盖正常、边界、失败与修改场景。' })
  }
  return {
    ok: issues.length === 0,
    code: issues.length ? 'invalid_skill_definition' : 'skill_definition_ready',
    definition: normalized,
    issues,
    warnings,
    evaluationStatus: 'not_run',
  }
}

async function listManageableSkills(hub, query = '') {
  if (!hub?.listCapabilities) return { ok: false, code: 'skill_governance_unavailable', skills: [] }
  const result = await hub.listCapabilities({ kind: 'skill' })
  if (!result?.ok) return { ...result, skills: [] }
  const needle = String(query || '').trim().toLowerCase()
  const skills = (result.items || [])
    .filter(item => item?.installed === true || ['installed', 'enabled', 'disabled'].includes(String(item?.status || '')))
    .filter(item => !needle || [item.id, item.name, item.description].some(value => String(value || '').toLowerCase().includes(needle)))
    .map(item => ({
      id: item.id,
      name: item.name || item.id,
      description: item.description || '',
      source: item.source || 'unknown',
      enabled: item.enabled !== false,
      editable: item.source === 'custom',
    }))
  return { ok: true, skills }
}

function buildAgentRegistryTools(options = {}) {
  const hub = options.hub
  const registry = options.registry || options.hub?.agentRegistry
  const evaluation = options.evaluation || options.hub?.agentEvaluation
  if (!registry && !evaluation && !hub) return null
  const authorizeEvaluationTarget = agentId => {
    if (!registry?.getAgentDefinition) return { ok: true }
    const current = registry.getAgentDefinition({ agentId })
    if (current?.ok || current?.code === 'forbidden_agent_scope') return current
    const draft = registry.getAgentDraft?.({ agentId })
    return draft?.ok ? draft : current
  }
  const definitions = [
    ...(registry ? AGENT_LIFECYCLE_DEFINITIONS : []),
    ...(evaluation ? AGENT_EVALUATION_DEFINITIONS : []),
    ...(hub ? SKILL_GOVERNANCE_DEFINITIONS : []),
  ]
  return {
    definitions,
    handlers: {
      list_manageable_agents: async (args = {}) => {
        const result = registry.listManageableAgents({ query: args.query })
        return toolResult(result, { agents: result?.ok ? result.agents : [] })
      },
      get_agent_definition: async (args = {}) => {
        const agentId = String(args.agent_id || '').trim()
        if (!agentId) return { ok: false, code: 'invalid_args', text: '缺少 agent_id' }
        const result = registry.getAgentDefinition({ agentId })
        return toolResult(result, { agent: result?.ok ? result : null })
      },
      get_agent_draft: async (args = {}) => {
        const agentId = String(args.agent_id || '').trim()
        if (!agentId) return { ok: false, code: 'invalid_args', text: '缺少 agent_id' }
        const result = registry.getAgentDraft({ agentId })
        return toolResult(result, { draft: result?.ok ? result.draft : null })
      },
      update_agent_draft: async (args = {}) => {
        const agentId = String(args.agent_id || '').trim()
        if (!agentId || !args.definition || typeof args.definition !== 'object') {
          return { ok: false, code: 'invalid_args', text: '缺少 agent_id 或完整 definition' }
        }
        const result = registry.saveAgentDraft({
          draft: { ...args.definition, id: agentId },
          intent: args.intent || 'create',
        })
        return toolResult(result, { draft: result?.ok ? result.draft : null })
      },
      verify_agent_definition: async (args = {}) =>
        toolResult(registry.verifyAgentDefinition({ definition: args.definition })),
      preview_agent_change: async (args = {}) => {
        const result = registry.previewAgentChange({
          action: args.action,
          agentId: args.agent_id,
          definition: args.definition,
          revision: args.revision,
          successors: args.successors,
          reason: args.reason,
        })
        return toolResult(result, {
          requiresApproval: result?.ok === true,
          meta: result?.ok ? {
            changeToken: result.changeToken,
            expiresAt: result.expiresAt,
            changedFields: result.changedFields,
          } : null,
        })
      },
      commit_agent_change: async (args = {}) => {
        const token = String(args.change_token || '').trim()
        if (!token) return { ok: false, code: 'invalid_args', text: '缺少 change_token，请先预览变更' }
        const result = registry.commitAgentChange({ changeToken: token })
        return toolResult(result, { requiresApproval: true, change: result?.ok ? result : null })
      },
      list_agent_revisions: async (args = {}) => {
        const agentId = String(args.agent_id || '').trim()
        if (!agentId) return { ok: false, code: 'invalid_args', text: '缺少 agent_id' }
        const result = registry.listAgentRevisions({ agentId })
        return toolResult(result, { revisions: result?.ok ? result.revisions : [] })
      },
      list_manageable_skills: async (args = {}) => {
        const result = await listManageableSkills(hub, args.query)
        return toolResult(result, { skills: result?.ok ? result.skills : [] })
      },
      get_skill_definition: async (args = {}) => {
        const skillId = String(args.skill_id || '').trim()
        if (!skillId) return { ok: false, code: 'invalid_args', text: '缺少 skill_id' }
        const listed = await listManageableSkills(hub)
        const item = listed?.skills?.find(skill => skill.id === skillId)
        if (!item) return { ok: false, code: 'skill_not_found', text: `未找到已添加或安装的 Skill：${skillId}` }
        const runtime = hub?.skillRuntime?.()
        const file = runtime?.readSkillPackageFile?.(skillId, 'SKILL.md', { maxBytes: 512 * 1024 })
        if (!file?.ok) return toolResult(file || { ok: false, code: 'skill_runtime_unavailable' })
        const parsed = parseSkillFrontmatter(file.content)
        if (!parsed?.ok) return toolResult({ ok: false, code: 'skill_parse_failed', error: parsed?.error || 'SKILL.md 解析失败' })
        const definition = normalizeSkillDefinition({
          id: skillId,
          name: parsed.name || item.name,
          description: parsed.description || item.description,
          slash: parsed.slash || skillId,
          instructions: skillInstructionsFromBody(parsed.body, parsed.name || item.name),
        })
        const result = { ok: true, code: 'skill_definition_loaded', skill: item, definition }
        return toolResult(result, { skill: item, definition })
      },
      verify_skill_definition: async (args = {}) => {
        const result = verifySkillDefinition(args.definition)
        return toolResult(result, {
          definition: result.definition,
          issues: result.issues,
          warnings: result.warnings,
          evaluationStatus: result.evaluationStatus,
        })
      },
      publish_skill_definition: async (args = {}) => {
        const verified = verifySkillDefinition(args.definition)
        if (!verified.ok) return toolResult(verified, { issues: verified.issues, warnings: verified.warnings })
        const listed = await listManageableSkills(hub)
        if (!listed?.ok) return toolResult(listed)
        const existing = listed.skills.find(skill => skill.id === verified.definition.id)
        if (existing && !existing.editable) {
          return {
            ok: false,
            code: 'read_only_skill',
            text: '该 Skill 不是用户自建能力，不能原地覆盖；请使用新的 Skill ID 创建可管理副本。',
          }
        }
        const result = await hub.importCapability({
          source: 'custom',
          kind: 'skill',
          id: verified.definition.id,
          name: verified.definition.name,
          description: verified.definition.description,
          slash: verified.definition.slash,
          instructions: verified.definition.instructions,
          trustConfirmed: true,
          riskConfirmed: true,
        })
        return toolResult(result, {
          requiresApproval: true,
          skill: result?.ok ? verified.definition : null,
          warnings: verified.warnings,
          evaluationStatus: 'not_run',
        })
      },
      check_agent_eval_runtime: async () => {
        if (!evaluation) return { ok: false, code: 'agent_evaluation_unavailable', text: 'Agent 评估服务不可用' }
        const result = await evaluation.checkRuntime()
        return toolResult(result, { runtime: result })
      },
      setup_agent_eval_runtime: async () => {
        if (!evaluation) return { ok: false, code: 'agent_evaluation_unavailable', text: 'Agent 评估服务不可用' }
        const result = await evaluation.setupRuntime()
        return toolResult(result, { requiresApproval: true, runtime: result })
      },
      save_agent_eval_suite: async (args = {}) => {
        if (!evaluation) return { ok: false, code: 'agent_evaluation_unavailable', text: 'Agent 评估服务不可用' }
        const agentId = String(args.agent_id || '').trim()
        if (!agentId || !args.suite || typeof args.suite !== 'object') {
          return { ok: false, code: 'invalid_args', text: '缺少 agent_id 或 suite' }
        }
        const access = authorizeEvaluationTarget(agentId)
        if (!access?.ok) return toolResult(access)
        const result = evaluation.saveSuite({ agentId, suite: args.suite })
        return toolResult(result, { suite: result?.ok ? result.suite : null })
      },
      run_agent_eval: async (args = {}) => {
        if (!evaluation) return { ok: false, code: 'agent_evaluation_unavailable', text: 'Agent 评估服务不可用' }
        const agentId = String(args.agent_id || '').trim()
        const access = authorizeEvaluationTarget(agentId)
        if (!access?.ok) return toolResult(access)
        const result = await evaluation.runEvaluation({
          agentId,
          suiteId: args.suite_id,
          engine: args.engine,
          judgeModel: args.judge_model,
          observations: args.observations,
        })
        return toolResult(result, {
          requiresApproval: true,
          report: result?.ok ? result.report : null,
        })
      },
      get_agent_eval_report: async (args = {}) => {
        if (!evaluation) return { ok: false, code: 'agent_evaluation_unavailable', text: 'Agent 评估服务不可用' }
        const agentId = String(args.agent_id || '').trim()
        const access = authorizeEvaluationTarget(agentId)
        if (!access?.ok) return toolResult(access)
        const result = evaluation.getReport({ agentId, runId: args.run_id })
        return toolResult(result, { report: result?.ok ? result.report : null })
      },
    },
  }
}

module.exports = {
  LIST_MANAGEABLE_AGENTS,
  GET_AGENT_DEFINITION,
  GET_AGENT_DRAFT,
  UPDATE_AGENT_DRAFT,
  VERIFY_AGENT_DEFINITION,
  PREVIEW_AGENT_CHANGE,
  COMMIT_AGENT_CHANGE,
  LIST_AGENT_REVISIONS,
  CHECK_AGENT_EVAL_RUNTIME,
  SETUP_AGENT_EVAL_RUNTIME,
  SAVE_AGENT_EVAL_SUITE,
  RUN_AGENT_EVAL,
  GET_AGENT_EVAL_REPORT,
  LIST_MANAGEABLE_SKILLS,
  GET_SKILL_DEFINITION,
  VERIFY_SKILL_DEFINITION,
  PUBLISH_SKILL_DEFINITION,
  AGENT_LIFECYCLE_DEFINITIONS,
  SKILL_GOVERNANCE_DEFINITIONS,
  AGENT_EVALUATION_DEFINITIONS,
  AGENT_REGISTRY_DEFINITIONS,
  buildAgentRegistryTools,
}
