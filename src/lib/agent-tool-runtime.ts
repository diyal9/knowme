'use strict'

/**
 * Agent Tool Runtime
 *
 * Function Calling 只负责产生 tool call；本模块负责把 Agent、Skill 和
 * 工作流的调用统一投影到现有 tool surface / registry / executor。
 * 旧工具名仍然受支持，toolRef 是新的稳定引用格式。
 */

const { resolveToolSurfaceForRun } = require('./tool-surface-builder')

function asToolRef(ref: any) {
  if (typeof ref === 'string') return { id: ref, version: '*', name: ref }
  if (!ref || typeof ref !== 'object') return { id: '', version: '*', name: '' }
  return {
    id: String(ref.id || ref.name || '').trim(),
    version: String(ref.version || '*').trim(),
    name: String(ref.name || '').trim(),
  }
}

function candidatesForRef(ref: any) {
  const normalized = asToolRef(ref)
  const id = normalized.id
  const short = id.split('.').filter(Boolean).at(-1) || id
  return [...new Set([normalized.name, id, short].filter(Boolean))]
}

function findToolName(surface: any, ref: any) {
  const candidates = candidatesForRef(ref)
  for (const name of candidates) {
    if (surface?.isAllowedTool?.(name) || surface?.validateToolCall?.(name, '{}')?.code !== 'unknown_tool') return name
  }
  return candidates[0] || ''
}

function makeReceipt({ runId, toolName, toolRef, result, startedAt }: any) {
  const finishedAt = new Date().toISOString()
  return {
    runId: String(runId || ''),
    toolName,
    toolRef: asToolRef(toolRef),
    status: result?.ok === false ? 'failed' : 'succeeded',
    startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    auditId: result?.auditId || null,
    evidenceRefs: Array.isArray(result?.evidenceRefs) ? result.evidenceRefs : [],
  }
}

async function createAgentToolRuntime(options: any = {}) {
  const resolver = options.resolveToolSurfaceForRun || resolveToolSurfaceForRun
  const resolved = await resolver(options)
  const surface = resolved?.surface
  if (!surface) throw new Error('Tool Runtime 未获得工具面')
  const executor = surface.createToolExecutor({
    ...(options.executorDeps || {}),
    signal: options.signal || options.executorDeps?.signal,
  })

  const execute = async (call: any = {}) => {
    const ref = call.toolRef || call.ref || call.name || ''
    const toolName = findToolName(surface, ref)
    const startedAt = new Date().toISOString()
    if (!toolName) {
      const result = { ok: false, code: 'missing_tool_ref', text: '工具引用为空' }
      return { ...result, receipt: makeReceipt({ runId: options.runId, toolName, toolRef: ref, result, startedAt }) }
    }
    const result = await executor.executeToolCall({
      id: call.id,
      name: toolName,
      arguments: call.arguments ?? call.args ?? {},
    })
    return {
      ...result,
      toolName: result?.toolName || toolName,
      toolRef: asToolRef(ref),
      receipt: makeReceipt({ runId: options.runId, toolName, toolRef: ref, result, startedAt }),
    }
  }

  return {
    mode: resolved.mode || 'v1',
    snapshot: {
      runId: options.runId || null,
      mode: resolved.mode || 'v1',
      tools: typeof surface.getToolRecords === 'function' ? surface.getToolRecords() : surface.getToolDefinitions(),
    },
    surface,
    registry: resolved.registry || null,
    definitions: surface.getToolDefinitions(),
    validate: surface.validateToolCall,
    execute,
    close: resolved.close || (async () => {}),
  }
}

module.exports = {
  asToolRef,
  candidatesForRef,
  findToolName,
  createAgentToolRuntime,
}
