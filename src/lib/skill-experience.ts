'use strict'

/**
 * skill-experience — 纯函数校验 KnowMe sidecar `metadata.knowme.experience.tasks`。
 * 返回标准化 display-safe tasks 与 field-level issues；无效 task 隔离。
 */

const TASK_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/
const IDENTIFIER_RE = /^[a-z][a-z0-9._-]{0,63}$/i
const TOOL_NAME_RE = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]+)*$/i

const MAX_TITLE = 80
const MAX_SUBTITLE = 120
const MAX_PROMPT = 4000
const MAX_PREFLIGHT_MESSAGE = 500
const MAX_TEMPLATE_VARS = 8
const MAX_SCALAR_STRING = 64
const MAX_TASKS = 32

const VALID_MODES = new Set(['general', 'steward', 'writing', 'coding'])
const VALID_SURFACES = new Set(['empty', 'quick-menu'])
const VALID_ICONS = new Set([
  'chat', 'check', 'list', 'note', 'optimize', 'bookOpen', 'folder', 'pin',
  'edit', 'code', 'send', 'expandText',
])
const VALID_GROUPS = new Set([
  'office-core', 'knowledge-collab', 'knowledge-maintain', 'knowledge-retrieve',
  'writing-docs', 'writing-refine', 'coding-dev', 'coding-sync',
])
const VALID_PREFLIGHT_TYPES = new Set(['connector-auth', 'material'])

const UNSAFE_KEY_RE = /(?:^|_)(?:skip|bypass|no)[_-]?approval|approval(?:skip|bypass)|unsafe(?:write|exec)|eval|script(?:url|path)?|secret|password|api[_-]?key|token|credential/i
const UNSAFE_VALUE_RE = /\$\{|{{|\beval\s*\(|\bFunction\s*\(|require\s*\(|javascript:|data:text\/html|https?:\/\//i
const SECRET_KEY_RE = /(?:secret|password|api[_-]?key|token|credential|auth(?:code|token))/i

function issue(code, message, path = '') {
  return { code, message, path }
}

function isUnsafeKey(key) {
  return UNSAFE_KEY_RE.test(String(key || ''))
}

function containsUnsafeExpression(value) {
  return UNSAFE_VALUE_RE.test(String(value || ''))
}

function normalizeStringList(values, allowlist, fieldPath, issues, { required = false } = {}) {
  const raw = Array.isArray(values) ? values : (required ? [] : [])
  const out = []
  const seen = new Set()
  for (let i = 0; i < raw.length; i += 1) {
    const item = String(raw[i] || '').trim()
    if (!item) {
      issues.push(issue('invalid_task_field', `${fieldPath} 项不能为空`, `${fieldPath}[${i}]`))
      continue
    }
    if (!allowlist.has(item)) {
      issues.push(issue('invalid_task_field', `${fieldPath} 不在 allowlist: ${item}`, `${fieldPath}[${i}]`))
      continue
    }
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  if (required && !out.length) {
    issues.push(issue('invalid_task_field', `${fieldPath} 至少一项`, fieldPath))
  }
  return out
}

function normalizeRequiredTools(values, fieldPath, issues) {
  const raw = Array.isArray(values) ? values : []
  const out = []
  const seen = new Set()
  for (let i = 0; i < raw.length; i += 1) {
    const item = String(raw[i] || '').trim()
    if (!item) {
      issues.push(issue('invalid_task_field', 'requiredTools 项不能为空', `${fieldPath}[${i}]`))
      continue
    }
    if (!TOOL_NAME_RE.test(item)) {
      issues.push(issue('invalid_task_field', `requiredTools 标识符无效: ${item}`, `${fieldPath}[${i}]`))
      continue
    }
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function normalizeTemplateVars(raw, fieldPath, issues) {
  if (raw == null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(issue('invalid_task_field', 'templateVars 必须是对象', fieldPath))
    return {}
  }
  const keys = Object.keys(raw)
  if (keys.length > MAX_TEMPLATE_VARS) {
    issues.push(issue('invalid_task_field', `templateVars 最多 ${MAX_TEMPLATE_VARS} 项`, fieldPath))
    return {}
  }
  const out = {}
  for (const key of keys) {
    const keyPath = `${fieldPath}.${key}`
    if (!IDENTIFIER_RE.test(key)) {
      issues.push(issue('invalid_task_field', `templateVars 键无效: ${key}`, keyPath))
      continue
    }
    if (isUnsafeKey(key) || SECRET_KEY_RE.test(key)) {
      issues.push(issue('unsafe_task_field', `templateVars 含不安全键: ${key}`, keyPath))
      continue
    }
    const value = raw[key]
    if (value == null || typeof value === 'object') {
      issues.push(issue('invalid_task_field', 'templateVars 仅允许标量', keyPath))
      continue
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || trimmed.length > MAX_SCALAR_STRING) {
        issues.push(issue('invalid_task_field', `templateVars.${key} 字符串长度无效`, keyPath))
        continue
      }
      if (containsUnsafeExpression(trimmed)) {
        issues.push(issue('unsafe_task_field', `templateVars.${key} 含脚本或 URL`, keyPath))
        continue
      }
      out[key] = trimmed
      continue
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        issues.push(issue('invalid_task_field', `templateVars.${key} 必须是有限数字`, keyPath))
        continue
      }
      out[key] = value
      continue
    }
    if (typeof value === 'boolean') {
      out[key] = value
      continue
    }
    issues.push(issue('invalid_task_field', 'templateVars 仅允许 string/number/boolean', keyPath))
  }
  return out
}

function normalizePreflight(raw, fieldPath, issues) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(issue('invalid_task_field', 'preflight 必须是对象', fieldPath))
    return null
  }
  for (const key of Object.keys(raw)) {
    if (isUnsafeKey(key)) {
      issues.push(issue('unsafe_task_field', `preflight 含不安全字段: ${key}`, `${fieldPath}.${key}`))
      return null
    }
  }
  const type = String(raw.type || '').trim()
  if (!VALID_PREFLIGHT_TYPES.has(type)) {
    issues.push(issue('invalid_task_field', `preflight.type 无效: ${type || '(empty)'}`, `${fieldPath}.type`))
    return null
  }
  const message = String(raw.message || '').trim()
  if (!message || message.length > MAX_PREFLIGHT_MESSAGE) {
    issues.push(issue('invalid_task_field', 'preflight.message 长度无效', `${fieldPath}.message`))
    return null
  }
  if (containsUnsafeExpression(message)) {
    issues.push(issue('unsafe_task_field', 'preflight.message 含脚本或 URL', `${fieldPath}.message`))
    return null
  }
  const out = { type, message }
  if (type === 'connector-auth') {
    const connector = String(raw.connector || '').trim()
    if (!connector || !IDENTIFIER_RE.test(connector)) {
      issues.push(issue('invalid_task_field', 'preflight.connector 无效', `${fieldPath}.connector`))
      return null
    }
    out.connector = connector
  }
  return out
}

function normalizeExperienceTask(raw, index, context = {}) {
  const issues = []
  const basePath = `metadata.knowme.experience.tasks[${index}]`
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      issues: [issue('invalid_task', 'task 必须是对象', basePath)],
    }
  }

  for (const key of Object.keys(raw)) {
    if (isUnsafeKey(key)) {
      return {
        ok: false,
        issues: [issue('unsafe_task_field', `task 含不安全字段: ${key}`, `${basePath}.${key}`)],
      }
    }
  }

  const id = String(raw.id || '').trim()
  if (!id || !TASK_ID_RE.test(id)) {
    issues.push(issue('invalid_task_field', 'task.id 无效', `${basePath}.id`))
  }

  const title = String(raw.title || '').trim()
  if (!title || title.length > MAX_TITLE) {
    issues.push(issue('invalid_task_field', 'task.title 长度无效', `${basePath}.title`))
  }

  const subtitle = String(raw.subtitle || '').trim()
  if (subtitle.length > MAX_SUBTITLE) {
    issues.push(issue('invalid_task_field', 'task.subtitle 过长', `${basePath}.subtitle`))
  }

  const icon = String(raw.icon || '').trim()
  if (icon && !VALID_ICONS.has(icon)) {
    issues.push(issue('invalid_task_field', `task.icon 不在 allowlist: ${icon}`, `${basePath}.icon`))
  }

  const group = String(raw.group || '').trim()
  if (group && !VALID_GROUPS.has(group)) {
    issues.push(issue('invalid_task_field', `task.group 不在 allowlist: ${group}`, `${basePath}.group`))
  }

  const modes = normalizeStringList(raw.modes, VALID_MODES, `${basePath}.modes`, issues, { required: true })
  const surfaces = normalizeStringList(raw.surfaces, VALID_SURFACES, `${basePath}.surfaces`, issues, { required: true })

  const prompt = String(raw.prompt || '').trim()
  if (!prompt || prompt.length > MAX_PROMPT) {
    issues.push(issue('invalid_task_field', 'task.prompt 长度无效', `${basePath}.prompt`))
  } else if (containsUnsafeExpression(prompt)) {
    issues.push(issue('unsafe_task_field', 'task.prompt 含脚本或 URL', `${basePath}.prompt`))
  }

  const preflight = normalizePreflight(raw.preflight, `${basePath}.preflight`, issues)
  const requiredTools = normalizeRequiredTools(raw.requiredTools, `${basePath}.requiredTools`, issues)
  const templateVars = normalizeTemplateVars(raw.templateVars, `${basePath}.templateVars`, issues)

  if (issues.length) {
    return { ok: false, issues }
  }

  const task = {
    id,
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(icon ? { icon } : {}),
    ...(group ? { group } : {}),
    modes,
    surfaces,
    prompt,
    ...(preflight ? { preflight } : {}),
    ...(requiredTools.length ? { requiredTools } : {}),
    ...(Object.keys(templateVars).length ? { templateVars } : {}),
    skillId: String(context.skillId || '').trim() || undefined,
  }
  return { ok: true, task, issues: [] }
}

/**
 * @param {object|null|undefined} experience
 * @param {{ skillId?: string }} [context]
 * @returns {{ tasks: object[], issues: object[] }}
 */
function validateExperienceExtension(experience, context = {}) {
  const issues = []
  if (experience == null) return { tasks: [], issues }
  if (typeof experience !== 'object' || Array.isArray(experience)) {
    return {
      tasks: [],
      issues: [issue('invalid_experience', 'experience 必须是对象', 'metadata.knowme.experience')],
    }
  }

  for (const key of Object.keys(experience)) {
    if (key !== 'tasks' && isUnsafeKey(key)) {
      issues.push(issue('unsafe_experience_field', `experience 含不安全字段: ${key}`, `metadata.knowme.experience.${key}`))
    }
  }

  const rawTasks = Array.isArray(experience.tasks) ? experience.tasks : []
  if (rawTasks.length > MAX_TASKS) {
    issues.push(issue('invalid_experience', `tasks 最多 ${MAX_TASKS} 项`, 'metadata.knowme.experience.tasks'))
    return { tasks: [], issues }
  }

  const tasks = []
  const seenIds = new Set()
  for (let i = 0; i < rawTasks.length; i += 1) {
    const result = normalizeExperienceTask(rawTasks[i], i, context)
    if (!result.ok) {
      issues.push(...result.issues)
      continue
    }
    if (seenIds.has(result.task.id)) {
      issues.push(issue('duplicate_task_id', `重复 task.id: ${result.task.id}`, `metadata.knowme.experience.tasks[${i}].id`))
      continue
    }
    seenIds.add(result.task.id)
    tasks.push(result.task)
  }
  return { tasks, issues }
}

/**
 * 构建 display-safe task DTO（不含 sidecar 路径、正文或脚本）。
 */
function toDisplaySafeTask(task, meta = {}) {
  return {
    id: task.id,
    title: task.title,
    ...(task.subtitle ? { subtitle: task.subtitle } : {}),
    ...(task.icon ? { icon: task.icon } : {}),
    ...(task.group ? { group: task.group } : {}),
    modes: [...task.modes],
    surfaces: [...task.surfaces],
    prompt: task.prompt,
    ...(task.preflight ? { preflight: { ...task.preflight } } : {}),
    ...(task.requiredTools?.length ? { requiredTools: [...task.requiredTools] } : {}),
    ...(task.templateVars && Object.keys(task.templateVars).length ? { templateVars: { ...task.templateVars } } : {}),
    skillId: meta.skillId || task.skillId,
    source: meta.source || 'managed',
    ...(meta.ownerPackId ? { ownerPackId: meta.ownerPackId } : {}),
  }
}

function computeTasksRevision(parts = []) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex').slice(0, 16)
}

module.exports = {
  TASK_ID_RE,
  VALID_MODES,
  VALID_SURFACES,
  VALID_ICONS,
  VALID_GROUPS,
  VALID_PREFLIGHT_TYPES,
  validateExperienceExtension,
  toDisplaySafeTask,
  computeTasksRevision,
}
