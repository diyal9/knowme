'use strict'

/**
 * agent-stream — OpenAI 兼容 SSE 增量累积（纯函数，可单测）。
 *
 * 支持 delta.content、reasoning 提示（仅 hasReasoning，不暴露全文）、
 * finish_reason、usage、按 index 合并碎片化 tool_calls。
 */

const MAX_SSE_LINE_CHARS = 256 * 1024
const MAX_CONTENT_CHARS = 1024 * 1024
const MAX_TOOL_ARGUMENT_CHARS = 256 * 1024
const MAX_TOTAL_TOOL_ARGUMENT_CHARS = 1024 * 1024
const MAX_TOOL_CALLS = 32

function streamLimitError(section) {
  const error = new Error(`模型流式响应的${section}超过安全上限`)
  error.code = 'stream_limit_exceeded'
  return error
}

function createStreamAccumulator() {
  return {
    content: '',
    hasReasoning: false,
    finishReason: null,
    usage: null,
    /** @type {Record<number, { id: string, name: string, arguments: string }>} */
    toolCalls: {},
    _buffer: '',
  }
}

function mergeToolCallDelta(toolCalls, fragments) {
  if (!Array.isArray(fragments)) return
  for (const frag of fragments) {
    const index = Number.isFinite(frag?.index) ? frag.index : 0
    if (!Number.isSafeInteger(index) || index < 0 || index >= MAX_TOOL_CALLS) throw streamLimitError('工具调用数量')
    if (!toolCalls[index]) {
      if (Object.keys(toolCalls).length >= MAX_TOOL_CALLS) throw streamLimitError('工具调用数量')
      toolCalls[index] = { id: '', name: '', arguments: '' }
    }
    const slot = toolCalls[index]
    if (frag.id) slot.id = String(frag.id)
    const fn = frag.function || {}
    if (fn.name) {
      const namePart = String(fn.name)
      if (!slot.name) slot.name = namePart
      else if (namePart.startsWith(slot.name)) slot.name = namePart
      else if (!slot.name.endsWith(namePart)) slot.name += namePart
    }
    if (fn.arguments != null) {
      const addition = String(fn.arguments)
      const total = Object.values(toolCalls).reduce((sum, item) => sum + item.arguments.length, 0)
      if (slot.arguments.length + addition.length > MAX_TOOL_ARGUMENT_CHARS
        || total + addition.length > MAX_TOTAL_TOOL_ARGUMENT_CHARS) throw streamLimitError('工具参数')
      slot.arguments += addition
    }
  }
}

function applyChoiceDelta(accumulator, choice) {
  if (!choice || typeof choice !== 'object') return
  const delta = choice.delta || {}
  if (delta.content) {
    const addition = String(delta.content)
    if (accumulator.content.length + addition.length > MAX_CONTENT_CHARS) throw streamLimitError('正文')
    accumulator.content += addition
  }
  if (delta.reasoning_content || delta.reasoning) accumulator.hasReasoning = true
  if (choice.finish_reason) accumulator.finishReason = String(choice.finish_reason)
  mergeToolCallDelta(accumulator.toolCalls, delta.tool_calls)
}

function applySsePayload(accumulator, payload) {
  if (!payload || payload === '[DONE]') return
  let parsed
  try {
    parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  } catch {
    return
  }
  if (parsed.error) {
    const err = new Error(parsed.error.message || JSON.stringify(parsed.error).slice(0, 200))
    err.code = 'provider_error'
    throw err
  }
  if (parsed.usage && typeof parsed.usage === 'object') {
    accumulator.usage = { ...parsed.usage }
  }
  const choice = parsed.choices?.[0]
  applyChoiceDelta(accumulator, choice)
}

function parseSseBuffer(buffer, onPayload) {
  const lines = String(buffer || '').split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload) continue
    onPayload(payload)
  }
  return remainder
}

/**
 * 向累积器喂入 SSE 文本块；返回未完成的行尾缓冲。
 */
function feedSse(accumulator, chunk) {
  const piece = String(chunk || '')
  // A provider can stream forever without a newline. Reject before copying
  // an unbounded partial frame or parsing its JSON on the main process.
  if (accumulator._buffer.length + piece.length > MAX_SSE_LINE_CHARS && !piece.includes('\n')) {
    throw streamLimitError('单行事件')
  }
  const combined = accumulator._buffer + piece
  if (combined.length > MAX_SSE_LINE_CHARS && !combined.includes('\n')) throw streamLimitError('单行事件')
  accumulator._buffer = parseSseBuffer(combined, (payload) => {
    if (payload.length > MAX_SSE_LINE_CHARS) throw streamLimitError('单行事件')
    applySsePayload(accumulator, payload)
  })
  if (accumulator._buffer.length > MAX_SSE_LINE_CHARS) throw streamLimitError('单行事件')
  return accumulator._buffer
}

/** 冲刷末尾缓冲（通常在 stream end 调用） */
function flushSse(accumulator) {
  if (accumulator._buffer.trim()) {
    feedSse(accumulator, '\n')
  }
  return accumulator._buffer
}

function toolCallsToArray(toolCalls) {
  return Object.keys(toolCalls)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      id: toolCalls[index].id,
      name: toolCalls[index].name,
      arguments: toolCalls[index].arguments,
    }))
}

// Some OpenAI-compatible gateways emit a Python-shaped request in text
// instead of returning structured tool_calls. Only recover calls inside the
// explicit envelope; ordinary code in an answer must never be executed.
function parseTextToolCalls(content) {
  const calls = []
  const addCall = (name, args) => {
    if (calls.length >= MAX_TOOL_CALLS) return
    calls.push({
      index: calls.length,
      id: `text_tool_${calls.length + 1}`,
      name,
      arguments: JSON.stringify(args),
    })
  }

  const envelopeRe = /<tool_code>\s*\n?([\s\S]*?)\n?\s*<\/tool_code>/gi
  let envelope
  while ((envelope = envelopeRe.exec(String(content || '')))) {
    const body = envelope[1].trim()
    const callRe = /(?:print\s*\(\s*)?([A-Za-z][\w.-]*)\s*\(([^()]*)\)\s*\)?/g
    let match
    while ((match = callRe.exec(body))) {
      const args = {}
      const argRe = /([A-Za-z_]\w*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^,\s]+))/g
      let arg
      while ((arg = argRe.exec(match[2]))) {
        const raw = arg[2] ?? arg[3] ?? arg[4] ?? ''
        args[arg[1]] = arg[2] != null || arg[3] != null
          ? raw.replace(/\\([\\"'])/g, '$1')
          : raw
      }
      addCall(match[1], args)
    }
  }

  // Some OpenAI-compatible providers encode function calls in a Qwen-style
  // XML envelope in assistant content instead of structured tool_calls.
  // Keep this protocol-only: the caller still validates each name/argument
  // against the active tool surface before any tool can execute.
  const xmlEnvelopeRe = /<tool_call>\s*<function=([A-Za-z][\w.-]*)\s*>([\s\S]*?)<\/function>\s*<\/tool_call>/gi
  while ((envelope = xmlEnvelopeRe.exec(String(content || '')))) {
    const args = {}
    const parameterRe = /<parameter=([A-Za-z_]\w*)\s*>([\s\S]*?)<\/parameter>/gi
    let parameter
    while ((parameter = parameterRe.exec(envelope[2]))) {
      const raw = parameter[2].trim()
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      try { args[parameter[1]] = JSON.parse(raw) } catch { args[parameter[1]] = raw }
    }
    addCall(envelope[1], args)
  }
  return calls
}

function getToolCalls(accumulator) {
  const structured = toolCallsToArray(accumulator.toolCalls)
  return structured.length ? structured : parseTextToolCalls(accumulator.content)
}

function getStreamSnapshot(accumulator, options = {}) {
  // Text-encoded tool calls are only actionable after a complete response.
  // Avoid running a regex over the growing answer on every SSE chunk.
  const parseTextTools = options.parseTextTools !== false
  const toolCalls = parseTextTools ? getToolCalls(accumulator) : toolCallsToArray(accumulator.toolCalls)
  let content = accumulator.content
  if (/<tool_(?:call|code)\b/i.test(content)) {
    // Never render provider control syntax as assistant prose. Complete,
    // recognized envelopes are removed after extraction; malformed envelopes
    // are hidden and left for the normal tool-surface validation/retry path.
    content = content
      .replace(/<tool_call\b[\s\S]*?(?:<\/tool_call>|$)/gi, '')
      .replace(/<tool_code\b[\s\S]*?(?:<\/tool_code>|$)/gi, '')
      .trim()
    if (parseTextTools && !toolCalls.length && !content) content = '模型返回了无法识别的工具调用格式，未执行该调用。请重试。'
  }
  return {
    content,
    hasReasoning: accumulator.hasReasoning,
    finishReason: accumulator.finishReason,
    usage: accumulator.usage ? { ...accumulator.usage } : null,
    toolCalls,
  }
}

/** 非 SSE 完整 JSON 响应（降级路径） */
function applyCompletionJson(accumulator, json) {
  if (!json || typeof json !== 'object') return
  if (json.error) {
    const err = new Error(json.error.message || JSON.stringify(json.error).slice(0, 200))
    err.code = 'provider_error'
    throw err
  }
  if (json.usage && typeof json.usage === 'object') {
    accumulator.usage = { ...json.usage }
  }
  const choice = json.choices?.[0]
  if (!choice) return
  const message = choice.message || {}
  if (message.content) {
    const addition = String(message.content)
    if (accumulator.content.length + addition.length > MAX_CONTENT_CHARS) throw streamLimitError('正文')
    accumulator.content += addition
  }
  if (message.reasoning_content || message.reasoning) accumulator.hasReasoning = true
  if (choice.finish_reason) accumulator.finishReason = String(choice.finish_reason)
  if (Array.isArray(message.tool_calls)) {
    message.tool_calls.forEach((tc, index) => {
      mergeToolCallDelta(accumulator.toolCalls, [{
        index: Number.isFinite(tc?.index) ? tc.index : index,
        id: tc.id,
        function: {
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        },
      }])
    })
  }
}

module.exports = {
  createStreamAccumulator,
  feedSse,
  flushSse,
  applySsePayload,
  applyCompletionJson,
  getStreamSnapshot,
  toolCallsToArray,
  parseTextToolCalls,
  mergeToolCallDelta,
}
