'use strict'

/**
 * agent-stream — OpenAI 兼容 SSE 增量累积（纯函数，可单测）。
 *
 * 支持 delta.content、reasoning 提示（仅 hasReasoning，不暴露全文）、
 * finish_reason、usage、按 index 合并碎片化 tool_calls。
 */

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
    if (!toolCalls[index]) {
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
    if (fn.arguments != null) slot.arguments += String(fn.arguments)
  }
}

function applyChoiceDelta(accumulator, choice) {
  if (!choice || typeof choice !== 'object') return
  const delta = choice.delta || {}
  if (delta.content) accumulator.content += String(delta.content)
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
  accumulator._buffer = parseSseBuffer(accumulator._buffer + String(chunk || ''), (payload) => {
    applySsePayload(accumulator, payload)
  })
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
      calls.push({
        index: calls.length,
        id: `text_tool_${calls.length + 1}`,
        name: match[1],
        arguments: JSON.stringify(args),
      })
    }
  }
  return calls
}

function getToolCalls(accumulator) {
  const structured = toolCallsToArray(accumulator.toolCalls)
  return structured.length ? structured : parseTextToolCalls(accumulator.content)
}

function getStreamSnapshot(accumulator) {
  return {
    content: accumulator.content,
    hasReasoning: accumulator.hasReasoning,
    finishReason: accumulator.finishReason,
    usage: accumulator.usage ? { ...accumulator.usage } : null,
    toolCalls: getToolCalls(accumulator),
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
  if (message.content) accumulator.content += String(message.content)
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
