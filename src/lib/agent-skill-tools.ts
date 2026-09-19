'use strict'

/**
 * agent-skill-tools — list_skills / load_skill / read_skill_resource / run_skill_script
 * OpenAI tool 定义与 validator-friendly handlers。
 */

const { createSkillRuntime } = require('./skill-runtime')
const { validateResourcePage, skillBudgetFailure, MAX_RESOURCE_PAGE_BYTES } = require('./skill-progressive')
const { pageSkillCatalog, validateSkillCatalogPage, MAX_SKILL_PAGE_LIMIT, DEFAULT_SKILL_PAGE_LIMIT } = require('./skill-catalog-page')

const SKILL_TOOL_NAMES = [
  'list_skills',
  'load_skill',
  'read_skill_resource',
  'run_skill_script',
]

const SKILL_READ_CONTRACT = {
  source: 'skill',
  capability: 'skill-runtime',
  risk: 'read',
  sideEffects: false,
  requiresApproval: false,
  scope: 'content-source',
  timeoutMs: 30000,
  idempotencySupported: false,
  rollbackSupported: false,
}

const SKILL_SCRIPT_CONTRACT = {
  source: 'skill',
  capability: 'skill-script',
  risk: 'external',
  sideEffects: true,
  requiresApproval: true,
  scope: 'sandbox',
  timeoutMs: 120000,
  idempotencySupported: false,
  rollbackSupported: false,
}

const LIST_SKILLS_TOOL = {
  type: 'function',
  function: {
    name: 'list_skills',
    description:
      'Search enabled agent skills in bounded L0 metadata pages (default 10, max 30). Use nextCursor to continue the same query; the full catalog stays on the host. Load a selected skill for complete instructions and contracts.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 200, description: 'Optional case-insensitive search over skill id, name and description.' },
        cursor: { type: 'string', maxLength: 256, description: 'Opaque nextCursor from the previous page of this query.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_SKILL_PAGE_LIMIT, default: DEFAULT_SKILL_PAGE_LIMIT },
      },
      additionalProperties: false,
    },
  },
  _knowme: { ...SKILL_READ_CONTRACT, tier: 'L0' },
}

const LOAD_SKILL_TOOL = {
  type: 'function',
  function: {
    name: 'load_skill',
    description: 'Activate a skill by loading its complete SKILL.md instructions (L1) and execution contract. Fails without activation if required instructions cannot fit the budget. Dependencies are metadata, not access grants.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: {
          type: 'string',
          description: 'Skill id from list_skills or slash picker.',
        },
      },
      required: ['skill_id'],
      additionalProperties: false,
    },
  },
  _knowme: { ...SKILL_READ_CONTRACT, tier: 'L1' },
}

const READ_SKILL_RESOURCE_TOOL = {
  type: 'function',
  function: {
    name: 'read_skill_resource',
    description:
      'Read a bounded UTF-8 page from skill references/ or assets/ (L2). Continue with nextOffset until complete before following required resource instructions.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: { type: 'string', description: 'Skill id.' },
        path: {
          type: 'string',
          description: 'Relative path such as references/guide.md or assets/template.txt',
        },
        offset: { type: 'integer', minimum: 0, description: 'Byte offset; use previous pagination.nextOffset.' },
        max_bytes: { type: 'integer', minimum: 4, maximum: MAX_RESOURCE_PAGE_BYTES, description: 'UTF-8 page byte budget (default 12000).' },
      },
      required: ['skill_id', 'path'],
      additionalProperties: false,
    },
  },
  _knowme: { ...SKILL_READ_CONTRACT, tier: 'L2' },
}

const RUN_SKILL_SCRIPT_TOOL = {
  type: 'function',
  function: {
    name: 'run_skill_script',
    description:
      'Execute a script under skill scripts/ (L3) inside sandbox workspace. Requires explicit permissions.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: { type: 'string', description: 'Skill id.' },
        script: {
          type: 'string',
          description: 'Relative path under scripts/, e.g. scripts/run.py',
        },
        args: {
          type: 'object',
          description: 'Optional script arguments. Prefer {"argv":["--input","file"]} for exact ordered CLI arguments; otherwise object keys become --kebab-case flags.',
          properties: {
            argv: {
              type: 'array',
              items: { type: ['string', 'number', 'boolean'] },
              maxItems: 128,
            },
          },
          additionalProperties: true,
        },
        permissions: {
          type: 'object',
          description: 'Run-level permissions flags.',
          properties: {
            network: { type: 'boolean' },
            write: { type: 'boolean' },
            dangerous: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
      required: ['skill_id', 'script'],
      additionalProperties: false,
    },
  },
  _knowme: { ...SKILL_SCRIPT_CONTRACT, tier: 'L3' },
}

function parseToolArguments(raw) {
  if (raw == null || raw === '') return { ok: true, args: {} }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ok: true, args: raw }
  try {
    const parsed = JSON.parse(String(raw))
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, code: 'invalid_args', message: '工具参数必须是 JSON 对象' }
    }
    return { ok: true, args: parsed }
  } catch {
    return { ok: false, code: 'invalid_args', message: '工具参数不是合法 JSON' }
  }
}

function formatSkillList(items = []) {
  if (!items.length) return '当前没有可用的 enabled 技能。'
  const lines = [`共 ${items.length} 个技能（L0 元数据）：`]
  items.forEach((item, i) => {
    const disable = item.disableModelInvocation ? ' · disable-model-invocation' : ''
    lines.push(`${i + 1}. ${item.id} — ${item.name}${disable}`)
    if (item.description) lines.push(`   ${item.description}`)
  })
  return lines.join('\n')
}

function validateSkillToolCall(name, rawArgs) {
  const toolName = String(name || '').trim()
  if (!SKILL_TOOL_NAMES.includes(toolName)) {
    return { ok: false, code: 'unknown_tool', message: `未注册 skill 工具: ${toolName}` }
  }
  const parsed = parseToolArguments(rawArgs)
  if (!parsed.ok) return parsed

  if (toolName === 'list_skills') {
    const page = validateSkillCatalogPage(parsed.args)
    return page.ok ? { ok: true, name: toolName, args: page.args } : page
  }

  if (toolName === 'load_skill') {
    const skillId = String(parsed.args.skill_id || parsed.args.id || '').trim()
    if (!skillId) {
      return { ok: false, code: 'invalid_args', message: 'load_skill 需要非空 skill_id' }
    }
    return { ok: true, name: toolName, args: { skill_id: skillId } }
  }

  if (toolName === 'read_skill_resource') {
    const skillId = String(parsed.args.skill_id || parsed.args.id || '').trim()
    const relPath = String(parsed.args.path || parsed.args.resource || '').trim()
    if (!skillId || !relPath) {
      return {
        ok: false,
        code: 'invalid_args',
        message: 'read_skill_resource 需要 skill_id 与 path',
      }
    }
    const page = validateResourcePage({ offset: parsed.args.offset, maxBytes: parsed.args.max_bytes })
    if (!page.ok) return page
    return { ok: true, name: toolName, args: { skill_id: skillId, path: relPath, offset: page.offset, max_bytes: page.maxBytes } }
  }

  if (toolName === 'run_skill_script') {
    const skillId = String(parsed.args.skill_id || parsed.args.id || '').trim()
    const script = String(parsed.args.script || parsed.args.script_path || '').trim()
    if (!skillId || !script) {
      return {
        ok: false,
        code: 'invalid_args',
        message: 'run_skill_script 需要 skill_id 与 script',
      }
    }
    const permissions = parsed.args.permissions && typeof parsed.args.permissions === 'object'
      ? parsed.args.permissions
      : {}
    const args = parsed.args.args && typeof parsed.args.args === 'object' ? parsed.args.args : {}
    return {
      ok: true,
      name: toolName,
      args: { skill_id: skillId, script, args, permissions },
    }
  }

  return { ok: false, code: 'unknown_tool', message: `未注册 skill 工具: ${toolName}` }
}

function summarizeSkillToolArgs(name, args = {}) {
  if (name === 'list_skills') return '列出技能 L0'
  if (name === 'load_skill') return String(args.skill_id || '').slice(0, 80)
  if (name === 'read_skill_resource') {
    return `${args.skill_id}:${args.path}`.slice(0, 80)
  }
  if (name === 'run_skill_script') return `${args.skill_id}:${args.script}`.slice(0, 80)
  return ''
}

/**
 * @param {{
 *   capabilitiesRoot: string,
 *   knowledgeDir?: string,
 *   getInstallStore?: Function,
 *   runScript?: Function,
 *   allowedSkillIds?: string[],
 *   fsImpl?: object,
 * }} deps
 */
function buildSkillTools(deps = {}) {
  const runtime = deps.runtime || createSkillRuntime(deps)
  const allowedSkillIds = Array.isArray(deps.allowedSkillIds) ? deps.allowedSkillIds : null

  function filterOptions(skillId) {
    const current = typeof deps.getAllowedSkillIds === 'function' ? deps.getAllowedSkillIds() : allowedSkillIds
    const id = String(skillId || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const denied = id && typeof deps.isSkillAllowed === 'function' && !deps.isSkillAllowed(id)
    return {
      ...(Array.isArray(current) ? { allowedIds: current } : {}),
      ...(denied ? { allowedIds: [] } : {}),
      invocation: 'model',
      explicitUserSkillIds: Array.isArray(deps.explicitUserSkillIds) ? deps.explicitUserSkillIds.slice() : [],
      taskId: String(deps.taskId || ''),
    }
  }

  async function handleListSkills(args = {}) {
    const items = runtime.listSkillsL0(filterOptions()).filter(item =>
      typeof deps.isSkillAllowed !== 'function' || deps.isSkillAllowed(item.id))
    const page = pageSkillCatalog(items, args)
    if (!page.ok) return { ...page, text: page.message }
    const text = `匹配 ${page.total} 个技能；本页 ${page.skills.length} 个。nextCursor: ${page.nextCursor || 'null（已结束）'}\n`
      + (page.skills.length ? formatSkillList(page.skills) : '没有匹配的技能。')
    return { ...page, text, preview: text.slice(0, 400), meta: { total: page.total, nextCursor: page.nextCursor } }
  }

  async function handleLoadSkill(args = {}) {
    const result = runtime.loadSkillL1(args.skill_id, filterOptions(args.skill_id))
    if (!result.ok) {
      return { ...result, text: result.message }
    }
    const header = `# ${result.name} (${result.id})\n\n`
    const { activation, groundingContract, executionContract, dependencies } = result
    const text = header + result.body + '\n\n<skill_execution_contract>\n'
      + JSON.stringify({ activation, groundingContract, executionContract, dependencies })
      + '\n</skill_execution_contract>'
    if (text.length > result.maxChars) {
      const failure = skillBudgetFailure(result.id, text.length, result.maxChars)
      return { ...failure, text: failure.message }
    }
    return {
      ok: true,
      text,
      preview: result.body.slice(0, 400),
      truncated: false,
      activation, groundingContract, executionContract, dependencies,
      meta: { id: result.id, source: result.source },
    }
  }

  async function handleReadSkillResource(args = {}) {
    const result = runtime.readSkillResource(args.skill_id, args.path, { ...filterOptions(args.skill_id), offset: args.offset, maxBytes: args.max_bytes })
    if (!result.ok) {
      return { ok: false, text: result.message, code: result.code, message: result.message }
    }
    return {
      ok: true,
      text: result.content + (result.pagination?.complete === false
        ? `\n\n[资源尚未读完；继续 read_skill_resource，offset=${result.pagination.nextOffset}]` : ''),
      preview: result.content.slice(0, 400),
      pagination: result.pagination,
      meta: { id: result.id, path: result.path, pagination: result.pagination },
    }
  }

  async function handleRunSkillScript(args = {}) {
    const result = await runtime.runSkillScript(
      args.skill_id,
      args.script,
      args.args,
      args.permissions,
      { ...filterOptions(args.skill_id), runScript: deps.runScript },
    )
    if (!result.ok) {
      return {
        ok: false,
        text: result.message || result.text || '脚本执行失败',
        code: result.code || 'tool_failed',
        message: result.message || result.text,
        needsPermission: result.needsPermission,
      }
    }
    const text = String(result.text || result.stdout || result.output || JSON.stringify(result))
    return {
      ok: true,
      text,
      preview: text.slice(0, 400),
      meta: result.meta || {},
    }
  }

  return {
    definitions: [LIST_SKILLS_TOOL, LOAD_SKILL_TOOL, READ_SKILL_RESOURCE_TOOL, RUN_SKILL_SCRIPT_TOOL],
    handlers: {
      list_skills: handleListSkills,
      load_skill: handleLoadSkill,
      read_skill_resource: handleReadSkillResource,
      run_skill_script: handleRunSkillScript,
    },
    validateSkillToolCall,
    summarizeSkillToolArgs,
    runtime,
  }
}

module.exports = {
  buildSkillTools,
  validateSkillToolCall,
  summarizeSkillToolArgs,
  SKILL_TOOL_NAMES,
  SKILL_TOOL_DEFINITIONS: [LIST_SKILLS_TOOL, LOAD_SKILL_TOOL, READ_SKILL_RESOURCE_TOOL, RUN_SKILL_SCRIPT_TOOL],
  LIST_SKILLS_TOOL,
  LOAD_SKILL_TOOL,
  READ_SKILL_RESOURCE_TOOL,
  RUN_SKILL_SCRIPT_TOOL,
}
