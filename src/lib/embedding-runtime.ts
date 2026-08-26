'use strict'

/**
 * OpenAI-compatible Embedding 运行时。
 * 只负责配置解析、网络边界和向量校验；检索/Context Engine 自行决定何时调用。
 */

const DEFAULT_KNOWLEDGE_TIMEOUT_MS = 8000
const DEFAULT_CONTEXT_TIMEOUT_MS = 1500
const DEFAULT_PROBE_TIMEOUT_MS = 8000
const DEFAULT_MAX_INPUTS = 64
const DEFAULT_MAX_INPUT_CHARS = 8000
const DEFAULT_MAX_TOTAL_INPUT_CHARS = 96000
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024
const DEFAULT_MAX_DIMENSIONS = 8192

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeEmbeddingsEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed)
    const path = parsed.pathname.replace(/\/+$/, '')
    if (!/\/embeddings$/.test(path)) {
      parsed.pathname = /\/chat\/completions$/.test(path)
        ? path.replace(/\/chat\/completions$/, '/embeddings')
        : `${path}/embeddings`
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    if (/\/embeddings(\?|$)/.test(trimmed)) return trimmed
    if (/\/chat\/completions$/.test(trimmed)) return trimmed.replace(/\/chat\/completions$/, '/embeddings')
    return `${trimmed}/embeddings`
  }
}

function validateEmbeddingEndpoint(endpoint) {
  try {
    const parsed = new URL(normalizeEmbeddingsEndpoint(endpoint))
    if (!['https:', 'http:'].includes(parsed.protocol)) return { ok: false, error: 'Embedding Endpoint 仅支持 http/https' }
    if (parsed.username || parsed.password) return { ok: false, error: 'Embedding Endpoint 不允许包含 URL 凭据' }
    return { ok: true, endpoint: parsed.toString() }
  } catch {
    return { ok: false, error: 'Embedding Endpoint 格式错误' }
  }
}

function normalizeContextSemanticMode(value) {
  return ['shadow', 'active'].includes(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'off'
}

function defaultEmbeddingModel(settings = {}) {
  const provider = String(settings.embeddingProvider || settings.llmProvider || '').toLowerCase()
  return provider === 'dashscope' ? 'text-embedding-v3' : 'text-embedding-3-small'
}

function endpointOrigin(endpoint) {
  try { return new URL(normalizeEmbeddingsEndpoint(endpoint)).origin }
  catch { return '' }
}

function resolveEmbeddingProfile(settings = {}, options = {}) {
  const scope = ['context', 'probe'].includes(options.scope) ? options.scope : 'knowledge'
  const mode = scope === 'context'
    ? normalizeContextSemanticMode(settings.contextSemanticMode)
    : 'active'
  const enabled = options.force === true
    || (scope === 'knowledge' && settings.semanticRerank === true)
    || (scope === 'context' && mode !== 'off')
  const inheritedEndpoint = String(settings.apiEndpoint || '').trim()
  const configuredEndpoint = String(settings.embeddingEndpoint || '').trim()
  const endpoint = normalizeEmbeddingsEndpoint(configuredEndpoint || inheritedEndpoint)
  const configuredKey = String(settings.embeddingApiKey || '').trim()
  // 主模型密钥只可继承到同源地址，避免静默转发给新填的第三方 Host。
  const configuredOrigin = endpointOrigin(configuredEndpoint)
  const inheritedOrigin = endpointOrigin(inheritedEndpoint)
  const mayInheritApiKey = !configuredEndpoint
    || (!!configuredOrigin && configuredOrigin === inheritedOrigin)
  const apiKey = configuredKey || (mayInheritApiKey ? String(settings.apiKey || '').trim() : '')
  const model = String(settings.embeddingModel || '').trim() || defaultEmbeddingModel(settings)
  const defaultTimeout = scope === 'context'
    ? DEFAULT_CONTEXT_TIMEOUT_MS
    : scope === 'probe'
      ? DEFAULT_PROBE_TIMEOUT_MS
      : DEFAULT_KNOWLEDGE_TIMEOUT_MS
  return {
    scope,
    mode,
    enabled,
    endpoint,
    apiKey,
    model,
    inheritedEndpoint: !configuredEndpoint,
    inheritedApiKey: !configuredKey && mayInheritApiKey,
    requiresDedicatedApiKey: !!configuredEndpoint && !mayInheritApiKey && !configuredKey,
    allowSensitive: settings.embeddingAllowSensitive === true,
    timeoutMs: clampInt(options.timeoutMs, defaultTimeout, 250, 30000),
    maxInputs: clampInt(options.maxInputs, DEFAULT_MAX_INPUTS, 1, 256),
    maxInputChars: clampInt(options.maxInputChars, DEFAULT_MAX_INPUT_CHARS, 256, 32000),
    maxTotalInputChars: clampInt(options.maxTotalInputChars, DEFAULT_MAX_TOTAL_INPUT_CHARS, 1024, 512000),
    maxResponseBytes: clampInt(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 64 * 1024 * 1024),
  }
}

function embeddingError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeEmbeddingInputs(texts, profile) {
  if (!Array.isArray(texts) || !texts.length) {
    throw embeddingError('invalid_input', 'Embedding input 不能为空')
  }
  if (texts.length > profile.maxInputs) {
    throw embeddingError('batch_too_large', `Embedding input 超过批量上限 ${profile.maxInputs}`)
  }
  let totalChars = 0
  const normalized = texts.map((text) => {
    const value = String(text == null ? '' : text).trim()
    if (!value) throw embeddingError('invalid_input', 'Embedding input 含空文本')
    const clipped = value.slice(0, profile.maxInputChars)
    totalChars += clipped.length
    return clipped
  })
  if (totalChars > profile.maxTotalInputChars) {
    throw embeddingError('input_too_large', `Embedding input 总字符数超过上限 ${profile.maxTotalInputChars}`)
  }
  return normalized
}

function validateEmbeddingVectors(vectors, expectedCount) {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw embeddingError('count_mismatch', `Embedding 数量不匹配：${Array.isArray(vectors) ? vectors.length : 0}/${expectedCount}`)
  }
  let dimensions = 0
  return vectors.map((vector) => {
    if (!Array.isArray(vector) || !vector.length || vector.length > DEFAULT_MAX_DIMENSIONS) {
      throw embeddingError('invalid_vector', 'Embedding 返回空向量或维度超限')
    }
    if (!dimensions) dimensions = vector.length
    if (vector.length !== dimensions) {
      throw embeddingError('dimension_mismatch', 'Embedding 返回向量维度不一致')
    }
    let norm = 0
    const normalized = vector.map((item) => {
      const value = Number(item)
      if (!Number.isFinite(value)) throw embeddingError('invalid_vector', 'Embedding 返回非有限数值')
      norm += value * value
      return value
    })
    if (!norm) throw embeddingError('zero_vector', 'Embedding 返回零向量')
    return normalized
  })
}

async function readEmbeddingJson(response, maxResponseBytes) {
  const declaredBytes = Number(response?.headers?.get?.('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > maxResponseBytes) {
    throw embeddingError('response_too_large', `Embedding 响应超过上限 ${maxResponseBytes} bytes`)
  }
  if (response?.body?.getReader) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let bytes = 0
    let body = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value?.byteLength || 0
      if (bytes > maxResponseBytes) {
        await reader.cancel?.()
        throw embeddingError('response_too_large', `Embedding 响应超过上限 ${maxResponseBytes} bytes`)
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    try { return JSON.parse(body) }
    catch { throw embeddingError('invalid_response', 'Embedding 返回无效 JSON') }
  }
  if (typeof response?.text === 'function') {
    const body = await response.text()
    if (Buffer.byteLength(body, 'utf8') > maxResponseBytes) {
      throw embeddingError('response_too_large', `Embedding 响应超过上限 ${maxResponseBytes} bytes`)
    }
    try { return JSON.parse(body) }
    catch { throw embeddingError('invalid_response', 'Embedding 返回无效 JSON') }
  }
  const json = await response.json()
  if (Buffer.byteLength(JSON.stringify(json), 'utf8') > maxResponseBytes) {
    throw embeddingError('response_too_large', `Embedding 响应超过上限 ${maxResponseBytes} bytes`)
  }
  return json
}

function buildEmbedFn(settings, options = {}) {
  const profile = resolveEmbeddingProfile(settings, options)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const endpointValidation = validateEmbeddingEndpoint(profile.endpoint)
  if (!profile.enabled || !endpointValidation.ok || !profile.apiKey || typeof fetchImpl !== 'function') return null

  const embed = async (texts, callOptions = {}) => {
    const input = normalizeEmbeddingInputs(texts, profile)
    const controller = new AbortController()
    const externalSignal = callOptions.signal
    let timedOut = false
    const abortFromExternal = () => controller.abort(externalSignal?.reason)
    if (externalSignal?.aborted) abortFromExternal()
    else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, profile.timeoutMs)
    try {
      const response = await fetchImpl(profile.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${profile.apiKey}` },
        body: JSON.stringify({ model: profile.model, input }),
        signal: controller.signal,
      })
      if (!response?.ok) throw embeddingError('http_error', `Embedding API 返回 ${Number(response?.status) || '错误'}`)
      const json = await readEmbeddingJson(response, profile.maxResponseBytes)
      const data = Array.isArray(json?.data) ? json.data : []
      const indexes = data.map(item => Number(item?.index))
      if (indexes.some(index => !Number.isInteger(index) || index < 0 || index >= input.length)
        || new Set(indexes).size !== input.length) {
        throw embeddingError('invalid_response', 'Embedding 返回缺失、重复或越界 index')
      }
      const ordered = [...data].sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0))
      return validateEmbeddingVectors(ordered.map(item => item?.embedding), input.length)
    } catch (error) {
      if (timedOut) throw embeddingError('timeout', `Embedding API 超时（${profile.timeoutMs}ms）`)
      if (externalSignal?.aborted) throw embeddingError('aborted', 'Embedding 请求已取消')
      if (error?.code) throw error
      throw embeddingError('network_error', String(error?.message || 'Embedding 请求失败'))
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener?.('abort', abortFromExternal)
    }
  }
  embed.cacheKey = `${profile.endpoint}|${profile.model}`
  embed.profile = {
    scope: profile.scope,
    mode: profile.mode,
    model: profile.model,
    inheritedEndpoint: profile.inheritedEndpoint,
    inheritedApiKey: profile.inheritedApiKey,
    requiresDedicatedApiKey: profile.requiresDedicatedApiKey,
    allowSensitive: profile.allowSensitive,
      timeoutMs: profile.timeoutMs,
      maxTotalInputChars: profile.maxTotalInputChars,
      maxResponseBytes: profile.maxResponseBytes,
  }
  return embed
}

async function probeEmbeddingConnection(settings = {}, options = {}) {
  const startedAt = Date.now()
  const profile = resolveEmbeddingProfile(settings, { ...options, scope: 'probe', force: true })
  if (!profile.endpoint) return { ok: false, error: '未填写 Embedding Endpoint', latencyMs: 0, model: profile.model }
  const endpointValidation = validateEmbeddingEndpoint(profile.endpoint)
  if (!endpointValidation.ok) return { ok: false, error: endpointValidation.error, latencyMs: 0, model: profile.model }
  const host = new URL(endpointValidation.endpoint).hostname
  if (!profile.apiKey) return { ok: false, error: '未填写 Embedding API Key', latencyMs: 0, host, model: profile.model }
  const embed = buildEmbedFn(settings, { ...options, scope: 'probe', force: true })
  if (!embed) return { ok: false, error: '当前运行时不支持 Embedding 请求', latencyMs: 0, host, model: profile.model }
  try {
    const vectors = await embed(['KnowMe embedding probe'])
    return {
      ok: true,
      error: '',
      latencyMs: Date.now() - startedAt,
      host,
      model: profile.model,
      dimensions: vectors[0]?.length || 0,
    }
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || 'Embedding 连接失败'),
      code: String(error?.code || 'embedding_error'),
      latencyMs: Date.now() - startedAt,
      host,
      model: profile.model,
    }
  }
}

module.exports = {
  DEFAULT_KNOWLEDGE_TIMEOUT_MS,
  DEFAULT_CONTEXT_TIMEOUT_MS,
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_MAX_INPUTS,
  DEFAULT_MAX_INPUT_CHARS,
  DEFAULT_MAX_TOTAL_INPUT_CHARS,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_DIMENSIONS,
  normalizeEmbeddingsEndpoint,
  validateEmbeddingEndpoint,
  normalizeContextSemanticMode,
  resolveEmbeddingProfile,
  normalizeEmbeddingInputs,
  validateEmbeddingVectors,
  readEmbeddingJson,
  buildEmbedFn,
  probeEmbeddingConnection,
}
