'use strict'

/**
 * agent-skill-tools — list_skills / load_skill / read_skill_resource / run_skill_script
 * OpenAI tool 定义与 validator-friendly handlers。
 */

const { createSkillRuntime } = require('./skill-runtime')

const SKILL_TOOL_NAMES = [
  'list_skills',
  'load_skill',
  'read_skill_resource',
  'run_skill_script',
]

const LIST_SKILLS_TOOL = {
  type: 'function',
  function: {
    name: 'list_skills',
    description:
      'List enabled agent skills (L0 metadata only: id, name, description). Does not include SKILL.md body or scripts.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  _knowme: { source: 'skill', tier: 'L0' },
}

const LOAD_SKILL_TOOL = {
  type: 'function',
  function: {
    name: 'load_skill',
    description: 'Load SKILL.md body (L1) for a skill id. Content may be truncated to budget.',
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
  _knowme: { source: 'skill', tier: 'L1' },
}

const READ_SKILL_RESOURCE_TOOL = {
  type: 'function',
  function: {
    name: 'read_skill_resource',
    description:
      'Read a single file from skill references/ or assets/ (L2). Path must be relative within those folders.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: { type: 'string', description: 'Skill id.' },
        path: {
          type: 'string',
          description: 'Relative path such as references/guide.md or assets/template.txt',
        },
      },
      required: ['skill_id', 'path'],
      additionalProperties: false,
    },
  },
  _knowme: { source: 'skill', tier: 'L2' },
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
          description: 'Optional arguments passed to the script runner.',
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
  _knowme: { source: 'skill', tier: 'L3', requiresApproval: true },
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
    return { ok: true, name: toolName, args: {} }
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
    return { ok: true, name: toolName, args: { skill_id: skillId, path: relPath } }
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
  const runtime = createSkillRuntime(deps)
  const allowedSkillIds = Array.isArray(deps.allowedSkillIds) ? deps.allowedSkillIds : null

  function filterOptions() {
    return allowedSkillIds ? { allowedIds: allowedSkillIds } : {}
  }

  async function handleListSkills() {
    const items = runtime.listSkillsL0(filterOptions())
    const text = formatSkillList(items)
    return { ok: true, text, preview: text.slice(0, 400), skills: items }
  }

  async function handleLoadSkill(args = {}) {
    const result = runtime.loadSkillL1(args.skill_id, filterOptions())
    if (!result.ok) {
      return { ok: false, text: result.message, code: result.code, message: result.message }
    }
    const header = `# ${result.name} (${result.id})${result.truncated ? ' [truncated]' : ''}\n\n`
    return {
      ok: true,
      text: header + result.body,
      preview: result.body.slice(0, 400),
      truncated: result.truncated,
      meta: { id: result.id, source: result.source },
    }
  }

  async function handleReadSkillResource(args = {}) {
    const result = runtime.readSkillResource(args.skill_id, args.path, filterOptions())
    if (!result.ok) {
      return { ok: false, text: result.message, code: result.code, message: result.message }
    }
    return {
      ok: true,
      text: result.content,
      preview: result.content.slice(0, 400),
      meta: { id: result.id, path: result.path },
    }
  }

  async function handleRunSkillScript(args = {}) {
    const result = await runtime.runSkillScript(
      args.skill_id,
      args.script,
      args.args,
      args.permissions,
      filterOptions(),
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
  LIST_SKILLS_TOOL,
  LOAD_SKILL_TOOL,
  READ_SKILL_RESOURCE_TOOL,
  RUN_SKILL_SCRIPT_TOOL,
}
