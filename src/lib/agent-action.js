/**
 * Agent Action protocol and dispatcher.
 *
 * Browser: <script src="lib/agent-action.js"> -> window.AgentAction
 * Node: require('./lib/agent-action')
 *
 * This module is intentionally side-effect free. Capability implementations
 * are injected by the caller so the renderer never owns connector/file
 * permissions.
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AgentAction = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const KINDS = new Set([
    'conversation',
    'file',
    'tool',
    'skill',
    'workflow',
    'navigation',
    'clipboard',
  ])
  const EXECUTIONS = new Set(['send', 'fill', 'invoke', 'open', 'copy', 'confirm'])
  const SELECTIONS = new Set(['single', 'multiple'])
  const LEGACY_ACTIONS = new Set(['fill', 'send', 'copy', 'open_link', 'open_knowledge'])
  const READONLY_FILE_TOOLS = new Set(['read_file', 'list_dir', 'grep_files'])
  const STATUS = Object.freeze({
    PENDING: 'pending',
    SUCCESS: 'success',
    ERROR: 'error',
    CANCELLED: 'cancelled',
  })
  const PLACEHOLDER_RE = /在此(?:粘贴|填写|输入|补充)|请(?:粘贴|填写|输入|补充)|待填写|占位|\b(?:TODO|PLACEHOLDER|TBD|FIXME)\b/i
  const SLOT_RE = /\[[^\]]{2,}\]|【[^】]{2,}】|<(?:YOUR_|在此|PASTE_|INSERT_)[^>]*>/i

  function text(value) {
    return String(value == null ? '' : value).trim()
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
  }

  function hasUserInputSlot(value) {
    const source = text(value)
    return Boolean(source && (PLACEHOLDER_RE.test(source) || SLOT_RE.test(source)))
  }

  function inferKind(action, input) {
    if (input?.kind && KINDS.has(String(input.kind))) return String(input.kind)
    if (action === 'copy') return 'clipboard'
    if (action === 'open_link' || action === 'open_knowledge') return 'navigation'
    if (action === 'invoke') return 'tool'
    return 'conversation'
  }

  function inferExecution(action, input) {
    if (input?.execution && EXECUTIONS.has(String(input.execution))) return String(input.execution)
    if (action === 'open_link' || action === 'open_knowledge') return 'open'
    if (action === 'copy') return 'copy'
    if (action === 'fill' || action === 'send') return action
    return 'invoke'
  }

  function defaultActionId(label, index = 0) {
    const slug = text(label)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32)
    return `action-${slug || 'item'}-${index + 1}`
  }

  function normalizeAction(input, context = {}) {
    if (!isObject(input)) return null
    const legacy = text(input.action)
    const execution = inferExecution(legacy, input)
    const payload = text(input.payload)
    const label = text(input.label || input.title)
    if (!label) return null

    const requiresInput = input.requiresInput === true
      || execution === 'fill'
      || hasUserInputSlot(payload)
    const resolvedExecution = execution === 'send' && requiresInput ? 'fill' : execution
    const kind = inferKind(legacy, input)
    const requiresApproval = input.requiresApproval === true
      || resolvedExecution === 'confirm'

    return {
      id: text(input.id || context.actionId) || defaultActionId(label, context.index),
      kind,
      label,
      description: text(input.description),
      execution: resolvedExecution,
      payload,
      args: isObject(input.args) ? { ...input.args } : {},
      requiresInput,
      requiresApproval,
      selection: SELECTIONS.has(String(input.selection)) ? String(input.selection) : 'single',
      source: text(input.source || context.source) || 'model',
      context: {
        ...(isObject(context.context) ? context.context : {}),
        ...(isObject(input.context) ? input.context : {}),
      },
      legacyAction: legacy || undefined,
    }
  }

  function normalizeActions(items, context = {}) {
    if (!Array.isArray(items)) return []
    return items
      .map((item, index) => normalizeAction(item, { ...context, index }))
      .filter(Boolean)
  }

  function validateAction(action) {
    if (!isObject(action)) return { ok: false, code: 'invalid_action', message: '动作不是对象' }
    if (!KINDS.has(text(action.kind))) {
      return { ok: false, code: 'invalid_kind', message: `未支持的动作类型: ${text(action.kind)}` }
    }
    if (!EXECUTIONS.has(text(action.execution))) {
      return { ok: false, code: 'invalid_execution', message: `未支持的执行策略: ${text(action.execution)}` }
    }
    if (!text(action.label)) return { ok: false, code: 'missing_label', message: '动作缺少显示文案' }
    if (!SELECTIONS.has(text(action.selection))) {
      return { ok: false, code: 'invalid_selection', message: '动作选择策略无效' }
    }
    if (['send', 'fill', 'invoke', 'confirm'].includes(text(action.execution))
      && !text(action.payload)
      && !Object.keys(action.args || {}).length) {
      return { ok: false, code: 'missing_payload', message: '动作缺少执行内容' }
    }
    if (
      action.kind === 'navigation'
      && action.execution === 'open'
      && action.legacyAction !== 'open_knowledge'
      && !text(action.payload)
    ) {
      return { ok: false, code: 'missing_target', message: '打开动作缺少目标' }
    }
    if (
      action.kind === 'file'
      && action.execution === 'invoke'
      && !READONLY_FILE_TOOLS.has(text(action.args?.tool))
    ) {
      return { ok: false, code: 'file_tool_not_allowed', message: '文件动作只能调用受限只读工具' }
    }
    return { ok: true, action }
  }

  function resolveExecutionPolicy(input, context = {}) {
    const action = normalizeAction(input, context)
    if (!action) return { ok: false, code: 'invalid_action', message: '无法识别建议动作' }
    const validation = validateAction(action)
    if (!validation.ok) return validation
    if (action.requiresApproval && action.execution !== 'confirm') {
      return {
        ok: true,
        action: { ...action, execution: 'confirm' },
      }
    }
    return { ok: true, action }
  }

  function isAborted(signal) {
    return Boolean(signal && signal.aborted)
  }

  function createFileAction({ tool, label, args = {}, payload = '', source = 'system', context } = {}) {
    return normalizeAction({
      kind: 'file',
      execution: 'invoke',
      label,
      payload,
      args: { ...args, tool: text(tool) },
      source,
      context,
    })
  }

  function createSkillAction({ skillId, label, args = {}, payload = '', source = 'skill', context } = {}) {
    return normalizeAction({
      kind: 'skill',
      execution: 'invoke',
      label,
      payload,
      args: { ...args, skillId: text(skillId) },
      source,
      context,
    })
  }

  function createWorkflowAction({ workflowId, label, args = {}, payload = '', source = 'workflow', context } = {}) {
    return normalizeAction({
      kind: 'workflow',
      execution: 'invoke',
      label,
      payload,
      args: { ...args, workflowId: text(workflowId) },
      source,
      context,
    })
  }

  function createToolAction({ toolName, label, args = {}, payload = '', source = 'system', context } = {}) {
    return normalizeAction({
      kind: 'tool',
      execution: 'invoke',
      label,
      payload,
      args: { ...args, toolName: text(toolName) },
      source,
      context,
    })
  }

  function resultFor(action, status, extra = {}) {
    return {
      ok: status === STATUS.SUCCESS,
      actionId: action.id,
      status,
      ...extra,
    }
  }

  function createActionDispatcher(deps = {}) {
    const executed = new Set()
    const signal = deps.signal

    function executorFor(action) {
      if (action.execution === 'send') return deps.send
      if (action.execution === 'fill') return deps.fill
      if (action.execution === 'copy') return deps.copy
      if (action.execution === 'open') return deps.open
      if (action.execution === 'confirm') return deps.confirm
      if (action.execution === 'invoke') {
        return deps[action.kind] || deps.invoke
      }
      return null
    }

    async function dispatch(input, context = {}) {
      const policy = resolveExecutionPolicy(input, context)
      if (!policy.ok) return { ok: false, status: STATUS.ERROR, code: policy.code, message: policy.message }
      const action = policy.action
      const executionKey = `${text(action.context?.messageId)}:${action.id}`
      if (executed.has(executionKey)) {
        return resultFor(action, 'duplicate', {
          ok: false,
          code: 'already_executed',
          message: '该动作已经执行过',
        })
      }
      if (isAborted(signal)) {
        return resultFor(action, STATUS.CANCELLED, { code: 'cancelled', message: '动作已取消' })
      }

      const executor = executorFor(action)
      if (typeof executor !== 'function') {
        return resultFor(action, STATUS.ERROR, {
          code: 'executor_unavailable',
          message: `动作执行器不可用: ${action.kind}/${action.execution}`,
        })
      }

      executed.add(executionKey)
      deps.onStatus?.(resultFor(action, STATUS.PENDING))
      try {
        const value = await executor(action, { signal, context })
        if (isAborted(signal)) {
          const cancelled = resultFor(action, STATUS.CANCELLED, {
            code: 'cancelled',
            result: value,
            message: '动作已取消',
          })
          deps.onStatus?.(cancelled)
          return cancelled
        }
        const success = resultFor(action, STATUS.SUCCESS, { result: value })
        deps.onStatus?.(success)
        return success
      } catch (error) {
        const failed = resultFor(action, STATUS.ERROR, {
          code: text(error?.code) || 'action_failed',
          message: text(error?.message || error) || '动作执行失败',
        })
        deps.onStatus?.(failed)
        return failed
      }
    }

    return {
      dispatch,
      normalizeAction,
      validateAction,
      resolveExecutionPolicy,
      clearExecuted() {
        executed.clear()
      },
    }
  }

  return {
    KINDS,
    EXECUTIONS,
    SELECTIONS,
    LEGACY_ACTIONS,
    READONLY_FILE_TOOLS,
    STATUS,
    hasUserInputSlot,
    normalizeAction,
    normalizeActions,
    validateAction,
    resolveExecutionPolicy,
    createFileAction,
    createSkillAction,
    createWorkflowAction,
    createToolAction,
    createActionDispatcher,
  }
})
