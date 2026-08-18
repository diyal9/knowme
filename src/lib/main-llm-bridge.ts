'use strict'

/**
 * 主进程聊天 HTTP：OpenAI 兼容 chat/completions（含 DashScope）。
 * 不负责设置页 UI、不解密密钥（调用方传入明文 apiKey）。
 */

const dns = require('dns')
const https = require('https')
const http = require('http')
const agentStream = require('./agent-stream')
const llmModelCatalog = require('./llm-model-catalog')
const logger = require('./logger')

try {
  // Windows 上 AAAA 优先时，死掉的 IPv6/VIP 会让套接字挂到 idle 超时才失败
  dns.setDefaultResultOrder('ipv4first')
} catch { /* Node 版本不支持则忽略 */ }

/** IPv4 优先但不禁止纯 IPv6 Endpoint；供 requestAgentCompletion 与单测复用。 */
function createIpv4FirstLookup() {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, verbatim: true, ...options }, (err, addresses) => {
      if (err) return callback(err)
      const list = Array.isArray(addresses) ? addresses : [addresses]
      if (!list.length) return callback(new Error(`No address found for ${hostname}`))
      const sorted = [...list].sort((a, b) => {
        const af = Number(a?.family)
        const bf = Number(b?.family)
        if (af === 4 && bf === 6) return -1
        if (af === 6 && bf === 4) return 1
        return 0
      })
      const pick = sorted[0]
      callback(null, pick.address, pick.family)
    })
  }
}

/** 连接已发出但迟迟无 HTTP 头：DNS 死 IP、防火墙拦 POST、网关排队 */
const FIRST_BYTE_TIMEOUT_MS = 15000
/** 已开始收流后的空闲超时（思考/长输出中途停顿） */
const STREAM_IDLE_TIMEOUT_MS = 120000
/** 设置页连通探测：首包与空闲都卡在 8s，避免再空等 120s */
const PROBE_TIMEOUT_MS = 8000

/** 请求级脱敏 meta：禁止 Key / Authorization / body。 */
function llmCallMeta(url, body, extra = {}) {
  return {
    host: url?.hostname || '',
    path: url?.pathname || '',
    model: String(body?.model || ''),
    stream: body?.stream !== false,
    ...extra,
  }
}

function formatLlmTimeoutError({ host, phase, firstByteMs = FIRST_BYTE_TIMEOUT_MS } = {}) {
  if (phase === 'first-byte') {
    const sec = Math.round(Number(firstByteMs) / 1000) || 15
    const where = host ? String(host) : 'Endpoint'
    return `连接超时（${sec}s）：${where} 未返回数据（API 已配置，请检查网络或稍后重试）`
  }
  return '请求超时（120s），请检查网络或 Endpoint'
}

/** Qwen3 兼容模式默认开思考，可能长时间不吐首包；未显式打开时关掉。 */
function applyProviderCompat(url, body, settings) {
  if (!body || typeof body !== 'object') return body
  const host = String(url?.hostname || '')
  const provider = String(settings?.llmProvider || '')
  const isDashscope = provider === 'dashscope' || host.includes('dashscope.aliyuncs.com')
  const model = String(body.model || '')
  if (isDashscope && /qwen/i.test(model) && body.enable_thinking == null) {
    return { ...body, enable_thinking: settings?.enableThinking === true }
  }
  return body
}

function bindLlmRequestTimeouts(req, { host, onTimeout, firstByteMs = FIRST_BYTE_TIMEOUT_MS, idleMs = STREAM_IDLE_TIMEOUT_MS } = {}) {
  let firstByte = false
  const firstTimer = setTimeout(() => {
    if (firstByte) return
    req.destroy()
    onTimeout({
      error: formatLlmTimeoutError({ host, phase: 'first-byte', firstByteMs }),
      timedOut: true,
      phase: 'first-byte',
    })
  }, firstByteMs)
  const markFirstByte = () => {
    firstByte = true
    clearTimeout(firstTimer)
  }
  req.setTimeout(idleMs, () => {
    req.destroy()
    onTimeout({
      error: formatLlmTimeoutError({ host, phase: 'idle', idleMs }),
      timedOut: true,
      phase: 'idle',
    })
  })
  req.on('close', () => clearTimeout(firstTimer))
  return { markFirstByte }
}

function normalizeChatEndpoint(endpoint) {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (/\/chat\/completions(\?|$)/.test(trimmed)) return trimmed
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return trimmed
}

function normalizeEmbeddingsEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/embeddings(\?|$)/.test(trimmed)) return trimmed
  if (/\/chat\/completions$/.test(trimmed)) return trimmed.replace(/\/chat\/completions$/, '/embeddings')
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) return `${trimmed}/embeddings`
  return `${trimmed}/embeddings`
}

function buildEmbedFn(settings) {
  if (!settings || settings.semanticRerank !== true || !settings.apiKey) return null
  const endpoint = normalizeEmbeddingsEndpoint(settings.apiEndpoint)
  if (!endpoint || typeof fetch !== 'function') return null
  const apiKey = settings.apiKey
  const model = String(settings.embeddingModel || '').trim()
    || (settings.llmProvider === 'dashscope' ? 'text-embedding-v3' : 'text-embedding-3-small')
  const embed = async (texts) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`embeddings ${res.status}`)
      const json = await res.json()
      const data = Array.isArray(json?.data) ? json.data : []
      const ordered = [...data].sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0))
      const vectors = ordered.map((d) => d.embedding)
      if (vectors.length !== texts.length) {
        throw new Error(`embeddings count mismatch: ${vectors.length}/${texts.length}`)
      }
      return vectors
    } finally {
      clearTimeout(timer)
    }
  }
  embed.cacheKey = `${endpoint}|${model}`
  return embed
}

function parseSseLines(buffer, onDelta) {
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const j = JSON.parse(payload)
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).substring(0, 200))
      const delta = j.choices?.[0]?.delta?.content
      if (delta) onDelta(delta)
    } catch (e) {
      if (e.message && !e.message.includes('Unexpected')) throw e
    }
  }
  return remainder
}

function extractChatText(json) {
  return json.choices?.[0]?.message?.content || ''
}

function requestAgentCompletion({
  url,
  settings,
  body,
  onSnapshot,
  signal,
  firstByteMs = FIRST_BYTE_TIMEOUT_MS,
  idleMs = STREAM_IDLE_TIMEOUT_MS,
}) {
  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const compatBody = applyProviderCompat(url, body, settings)
    const payload = JSON.stringify(compatBody)
    const stream = compatBody?.stream !== false
    const started = Date.now()
    const bytes = Buffer.byteLength(payload)
    try {
      logger.llm('llm-request', 'LLM 请求发出', llmCallMeta(url, compatBody, { bytes }))
    } catch { /* 日志失败不影响请求 */ }
    let req
    let timeouts
    let settled = false
    let abortHandler
    const finish = result => {
      if (settled) return
      settled = true
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      try {
        const failed = Boolean(result.error && !result.cancelled)
        logger.llm(
          'llm-response',
          failed ? 'LLM 请求结束（失败）' : 'LLM 请求结束',
          llmCallMeta(url, compatBody, {
            bytes,
            status: result.status,
            latencyMs: Date.now() - started,
            timedOut: Boolean(result.timedOut),
            phase: result.phase || (result.cancelled ? 'cancelled' : result.error ? 'error' : 'ok'),
          }),
          { level: result.timedOut || failed ? 'warn' : 'info' },
        )
      } catch { /* ignore */ }
      resolve(result)
    }
    req = lib.request({
      hostname: url.hostname,
      port,
      method: 'POST',
      path: url.pathname + url.search,
      lookup: createIpv4FirstLookup(),
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Length': bytes,
      },
    }, res => {
      timeouts?.markFirstByte()
      let raw = ''
      let sawSse = String(res.headers['content-type'] || '').includes('text/event-stream')
      let lastContent = ''
      let reasoningReported = false
      const accumulator = agentStream.createStreamAccumulator()
      const publishSnapshot = () => {
        if (signal?.aborted || settled) return
        const snapshot = agentStream.getStreamSnapshot(accumulator)
        if (snapshot.hasReasoning && !reasoningReported) {
          reasoningReported = true
          onSnapshot?.({ ...snapshot, reasoningStarted: true })
        }
        if (snapshot.content !== lastContent) {
          lastContent = snapshot.content
          onSnapshot?.(snapshot)
        }
      }

      res.on('data', chunk => {
        if (signal?.aborted || settled) return
        const piece = chunk.toString()
        raw += piece
        if (!sawSse && (raw.startsWith('data:') || piece.includes('\ndata:'))) sawSse = true
        if (!sawSse) return
        try {
          agentStream.feedSse(accumulator, piece)
          publishSnapshot()
        } catch (err) {
          req.destroy()
          finish({ error: err.message || '流式响应解析失败', status: res.statusCode })
        }
      })

      res.on('end', () => {
        if (settled) return
        if (res.statusCode !== 200) {
          let message = raw.substring(0, 300)
          try {
            const parsed = JSON.parse(raw)
            message = parsed.error?.message || parsed.message || message
          } catch { /* keep response preview */ }
          finish({ error: `HTTP ${res.statusCode}: ${message}`, status: res.statusCode })
          return
        }
        try {
          if (sawSse) {
            agentStream.flushSse(accumulator)
          } else {
            agentStream.applyCompletionJson(accumulator, JSON.parse(raw))
          }
          publishSnapshot()
          finish({
            snapshot: agentStream.getStreamSnapshot(accumulator),
            streamed: sawSse,
            status: res.statusCode,
          })
        } catch (err) {
          finish({ error: err.message || '响应格式异常', status: res.statusCode })
        }
      })
    })
    abortHandler = () => {
      req.destroy()
      finish({ error: '请求已取消', cancelled: true })
    }
    if (signal?.aborted) return abortHandler()
    signal?.addEventListener('abort', abortHandler, { once: true })
    timeouts = bindLlmRequestTimeouts(req, {
      host: url.hostname,
      firstByteMs,
      idleMs,
      onTimeout: finish,
    })
    req.on('error', err => {
      if (signal?.aborted) return finish({ error: '请求已取消', cancelled: true })
      finish({ error: `连接失败: ${err.message}` })
    })
    req.write(payload)
    req.end()
  })
}

function cleanSuggestedTitle(raw) {
  return (raw || '')
    .trim()
    .replace(/^["'\u300c\u300e\u3010\u300a]|["'\u300d\u300f\u3011\u300b]$/g, '')
    .replace(/^(标题|Title)[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function localTitleFromParagraph(para) {
  const line = para.split('\n').map(l => l.trim()).find(Boolean) || para
  return cleanSuggestedTitle(line.replace(/^#+\s*/, ''))
}

function chatCompletionOnce(s, messages, maxTokens = 80, options = {}) {
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  let url
  try { url = new URL(endpoint) } catch { return Promise.resolve({ error: `Endpoint 格式错误: ${s.apiEndpoint}` }) }
  const promptForRoute = (Array.isArray(messages) ? messages : [])
    .map(item => typeof item?.content === 'string' ? item.content : '')
    .join('\n')
    .slice(0, 5000)
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier: 'assist',
    prompt: promptForRoute,
    history: messages,
  })
  const explicitModel = String(options.model || '').trim()
  const temperature = options.temperature == null || options.temperature === ''
    ? 0.3
    : Number(options.temperature)
  const tokenCap = Number.isFinite(Number(options.maxTokens)) ? Number(options.maxTokens) : maxTokens
  const body = {
    model: explicitModel || routedModel.model || 'gpt-4o-mini',
    messages,
    max_tokens: tokenCap,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    stream: false,
  }
  const firstByteMs = Number.isFinite(Number(options.firstByteMs))
    ? Number(options.firstByteMs)
    : FIRST_BYTE_TIMEOUT_MS
  const idleMs = Number.isFinite(Number(options.idleMs)) ? Number(options.idleMs) : 20000

  return requestAgentCompletion({
    url,
    settings: s,
    body,
    firstByteMs,
    idleMs,
  }).then((result) => {
    if (result.error) {
      return { error: result.error, timedOut: result.timedOut, phase: result.phase }
    }
    return { text: result.snapshot?.content || '' }
  })
}

/** 设置页探测：max_tokens=4，8s 内必须有结论。 */
async function probeLlmConnection(s) {
  const started = Date.now()
  const endpoint = normalizeChatEndpoint(s?.apiEndpoint || '')
  let url
  try {
    url = new URL(endpoint)
  } catch {
    return {
      ok: false,
      error: `Endpoint 格式错误: ${s?.apiEndpoint || ''}`,
      latencyMs: 0,
      host: '',
      model: '',
    }
  }
  const host = url.hostname
  if (!s?.apiKey) {
    return {
      ok: false,
      error: '未填写 API Key',
      latencyMs: Date.now() - started,
      host,
      model: String(s?.model || ''),
    }
  }
  const routed = llmModelCatalog.resolveRuntimeModel(s, { tier: 'chat', prompt: 'ping' })
  const model = routed.model || String(s.model || 'gpt-4o-mini')
  const result = await chatCompletionOnce(s, [
    { role: 'user', content: 'ping' },
  ], 4, {
    model,
    temperature: 0,
    firstByteMs: PROBE_TIMEOUT_MS,
    idleMs: PROBE_TIMEOUT_MS,
  })
  return {
    ok: !result.error,
    error: result.error || '',
    latencyMs: Date.now() - started,
    host,
    model,
  }
}

module.exports = {
  FIRST_BYTE_TIMEOUT_MS,
  STREAM_IDLE_TIMEOUT_MS,
  PROBE_TIMEOUT_MS,
  formatLlmTimeoutError,
  applyProviderCompat,
  bindLlmRequestTimeouts,
  createIpv4FirstLookup,
  llmCallMeta,
  normalizeChatEndpoint,
  normalizeEmbeddingsEndpoint,
  buildEmbedFn,
  parseSseLines,
  extractChatText,
  requestAgentCompletion,
  cleanSuggestedTitle,
  localTitleFromParagraph,
  chatCompletionOnce,
  probeLlmConnection,
}
