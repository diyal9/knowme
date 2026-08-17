'use strict'

const https = require('https')
const http = require('http')
const agentStream = require('./agent-stream')
const llmModelCatalog = require('./llm-model-catalog')

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

function requestAgentCompletion({ url, settings, body, onSnapshot, signal }) {
  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const payload = JSON.stringify(body)
    let req
    let settled = false
    let abortHandler
    const finish = result => {
      if (settled) return
      settled = true
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      resolve(result)
    }
    req = lib.request({
      hostname: url.hostname,
      port,
      method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
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
          finish({ snapshot: agentStream.getStreamSnapshot(accumulator), streamed: sawSse })
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
    req.setTimeout(120000, () => {
      req.destroy()
      finish({ error: '请求超时（120s），请检查网络或 Endpoint', timedOut: true })
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
    .replace(/^["'「『【《]|["'」』】》]$/g, '')
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

  const body = JSON.stringify({
    model: explicitModel || routedModel.model || 'gpt-4o-mini',
    messages,
    max_tokens: tokenCap,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    stream: false,
  })

  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const req = lib.request({
      hostname: url.hostname, port, method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const j = JSON.parse(data)
            resolve({ error: j.error?.message || j.message || `HTTP ${res.statusCode}` })
          } catch {
            resolve({ error: `HTTP ${res.statusCode}: ${data.substring(0, 120)}` })
          }
          return
        }
        try {
          const j = JSON.parse(data)
          if (j.error) resolve({ error: j.error.message || 'API 错误' })
          else resolve({ text: extractChatText(j) })
        } catch {
          resolve({ error: '响应解析失败' })
        }
      })
    })
    req.setTimeout(20000, () => { req.destroy(); resolve({ error: '请求超时' }) })
    req.on('error', e => resolve({ error: e.message }))
    req.write(body)
    req.end()
  })
}

module.exports = {
  normalizeChatEndpoint,
  normalizeEmbeddingsEndpoint,
  buildEmbedFn,
  parseSseLines,
  extractChatText,
  requestAgentCompletion,
  cleanSuggestedTitle,
  localTitleFromParagraph,
  chatCompletionOnce,
}
