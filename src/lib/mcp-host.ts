'use strict'

const { spawn } = require('child_process')
const readline = require('readline')
const { listAllMcpTools } = require('./mcp-tool-pagination')
let logger = null
try { logger = require('./logger') } catch { /* logger optional */ }

const DEFAULT_TIMEOUT_MS = 15000
const {
  sanitizeConnectorId,
  buildMcpAgentToolName,
  parseMcpAgentToolName,
  mcpConfigKey,
} = require('./mcp-host-names')
const {
  oauthDir,
  schemaCacheDir,
  loadOAuthTokens,
  saveOAuthTokens,
  refreshOAuthToken,
  loadSchemaCache,
  saveSchemaCache,
} = require('./mcp-host-oauth')

/**
 * Lightweight MCP JSON-RPC client over stdio (no official SDK dependency).
 */
function createMcpSession(opts = {}) {
  const command = String(opts.command || '').trim()
  const args = Array.isArray(opts.args) ? opts.args.map(String) : []
  const cwd = opts.cwd ? String(opts.cwd) : undefined
  const envKeys = Array.isArray(opts.envKeys) ? opts.envKeys : []
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const spawnImpl = typeof opts.spawnImpl === 'function' ? opts.spawnImpl : spawn

  if (!command) {
    return {
      async listTools() {
        return { ok: false, code: 'unconfigured', message: 'MCP 命令未配置', tools: [] }
      },
      async callTool() {
        return { ok: false, code: 'unconfigured', message: 'MCP 命令未配置', text: '' }
      },
      async close() {},
    }
  }

  const env = { ...process.env }
  for (const key of envKeys) {
    const k = String(key || '').trim()
    if (k && process.env[k] != null) env[k] = process.env[k]
  }
  if (opts.env && typeof opts.env === 'object') {
    for (const [key, value] of Object.entries(opts.env)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && value != null) env[key] = String(value)
    }
  }

  let child = null
  let rl = null
  let nextId = 1
  const pending = new Map()
  let started = false
  let broken = null

  function failAll(err) {
    broken = err
    for (const [, p] of pending) p.reject(err)
    pending.clear()
  }

  function ensureStarted() {
    if (broken) return Promise.reject(broken)
    if (started) return Promise.resolve()
    started = true
    try {
      child = spawnImpl(command, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
      })
    } catch (err) {
      broken = err
      return Promise.reject(err)
    }
    rl = readline.createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      const text = String(line || '').trim()
      if (!text) return
      let msg
      try { msg = JSON.parse(text) } catch { return }
      if (msg.id == null || !pending.has(msg.id)) return
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) {
        p.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
      } else {
        p.resolve(msg.result)
      }
    })
    child.stderr?.on('data', () => { /* swallow server logs */ })
    child.on('error', (err) => failAll(err))
    child.on('close', () => failAll(new Error('MCP 进程已退出')))
    return request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'knowme', version: '0.3.0' },
    }).then(() => {
      try {
        const note = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })
        child.stdin.write(`${note}\n`)
      } catch { /* ignore */ }
    })
  }

  function request(method, params) {
    return new Promise((resolve, reject) => {
      if (!child || !child.stdin) {
        return reject(new Error('MCP 未启动'))
      }
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`MCP 请求超时: ${method}`))
      }, timeoutMs)
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
      child.stdin.write(`${payload}\n`)
    })
  }

  async function listTools() {
    try {
      await ensureStarted()
      return await listAllMcpTools(async params => ({ ok: true, result: await request('tools/list', params) }))
    } catch (err) {
      return {
        ok: false,
        code: 'mcp_error',
        message: String(err?.message || err).slice(0, 400),
        tools: [],
      }
    }
  }

  async function callTool(name, args = {}) {
    const startedAt = Date.now()
    try {
      await ensureStarted()
      const result = await request('tools/call', {
        name: String(name || ''),
        arguments: args && typeof args === 'object' ? args : {},
      })
      const content = Array.isArray(result?.content) ? result.content : []
      const text = content
        .map((c) => (c?.type === 'text' ? String(c.text || '') : JSON.stringify(c)))
        .join('\n')
        .slice(0, 24000)
      if (result?.isError) {
        try {
          logger?.mcp('mcp-call-error', `MCP 工具返回错误：${name}`, { command, tool: String(name || ''), args, preview: text.slice(0, 600) }, { level: 'warn', durationMs: Date.now() - startedAt })
        } catch { /* ignore */ }
        return { ok: false, code: 'tool_error', message: text || 'MCP 工具返回错误', text }
      }
      try {
        logger?.mcp('mcp-call-ok', `MCP 工具完成：${name}`, { command, tool: String(name || ''), args, preview: text.slice(0, 600) }, { durationMs: Date.now() - startedAt })
      } catch { /* ignore */ }
      return { ok: true, text: text || JSON.stringify(result || {}).slice(0, 24000) }
    } catch (err) {
      try {
        logger?.mcp('mcp-call-fail', `MCP 工具调用失败：${name}`, { command, tool: String(name || ''), args, error: String(err?.message || err).slice(0, 400) }, { level: 'error', durationMs: Date.now() - startedAt })
      } catch { /* ignore */ }
      return {
        ok: false,
        code: 'mcp_error',
        message: String(err?.message || err).slice(0, 400),
        text: String(err?.message || err).slice(0, 400),
      }
    }
  }

  async function close() {
    try { rl?.close() } catch { /* ignore */ }
    try { child?.kill() } catch { /* ignore */ }
    child = null
    started = false
  }

  return { listTools, callTool, close }
}

/**
 * Project MCP tools into OpenAI-compatible function definitions, filtered by allowlist.
 * Allowlist entries are raw MCP tool names; projected Agent names use mcp.<id>.<tool>.
 */
function projectMcpTools(mcpTools, allowlist = [], connectorId = '') {
  const allow = new Set((allowlist || []).map((n) => String(n).trim()).filter(Boolean))
  const list = Array.isArray(mcpTools) ? mcpTools : []
  if (allow.size === 0) return []
  const sanitizedId = sanitizeConnectorId(connectorId)
  return list
    .filter((t) => t && t.name && allow.has(String(t.name)))
    // Keep the entire authorized execution catalog. Model schema windows are
    // budgeted separately by selectToolDefinitions, not by connector projection.
    .map((t) => {
      const rawName = String(t.name)
      return {
        type: 'function',
        function: {
          name: buildMcpAgentToolName(sanitizedId, rawName),
          description: String(t.description || rawName).slice(0, 500),
          parameters: t.inputSchema && typeof t.inputSchema === 'object'
            ? t.inputSchema
            : { type: 'object', properties: {}, additionalProperties: true },
        },
        _knowme: {
          source: 'mcp',
          connectorId: String(connectorId || ''),
          sanitizedConnectorId: sanitizedId,
          rawToolName: rawName,
          requiresApproval: false,
        },
      }
    })
}

/**
 * Persistent Map<connectorId, session> for Hub lifecycle + reuse across agent runs.
 */
function createMcpHostRegistry() {
  const clients = new Map()

  async function connect(connectorId, mcpConfig = {}, opts = {}) {
    const id = String(connectorId || '').trim()
    if (!id) throw new Error('connectorId 不能为空')
    const key = mcpConfigKey(mcpConfig)
    const prev = clients.get(id)
    if (prev && prev.configKey === key) return prev.session

    if (prev) await disconnect(id)

    const session = createMcpSessionForTransport(mcpConfig, opts)
    clients.set(id, { session, configKey: key })
    return session
  }

  function getSession(connectorId) {
    return clients.get(String(connectorId || '').trim())?.session || null
  }

  async function disconnect(connectorId) {
    const id = String(connectorId || '').trim()
    const entry = clients.get(id)
    if (!entry) return
    clients.delete(id)
    try { await entry.session.close() } catch { /* ignore */ }
  }

  async function disconnectAll() {
    const ids = [...clients.keys()]
    await Promise.all(ids.map((id) => disconnect(id)))
  }

  function listConnectedIds() {
    return [...clients.keys()]
  }

  return {
    connect,
    getSession,
    disconnect,
    disconnectAll,
    listConnectedIds,
  }
}

const defaultRegistry = createMcpHostRegistry()

/**
 * Streamable HTTP MCP session (fake-friendly for tests via fetchImpl).
 */
function createStreamableHttpSession(opts = {}) {
  const baseUrl = String(opts.url || opts.baseUrl || '').trim().replace(/\/$/, '')
  const fetchImpl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : global.fetch
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const headers = { ...(opts.headers || {}) }
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
  let nextId = 1
  let sessionId = ''
  let initialized = false
  let initializing = null

  function decodeResponse(raw, contentType, expectedId) {
    const text = String(raw || '').trim()
    if (!text) return null
    const isEventStream = /text\/event-stream/i.test(String(contentType || ''))
      || text.startsWith('event:') || text.startsWith('data:')
    if (!isEventStream) return JSON.parse(text)
    const messages = text.split(/\r?\n\r?\n/).flatMap((block) => {
      const data = block.split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n')
        .trim()
      if (!data) return []
      try { return [JSON.parse(data)] } catch { return [] }
    })
    return messages.find(message => expectedId != null && message?.id === expectedId)
      || messages.find(message => message?.id != null)
      || messages[0]
      || null
  }

  async function send(payload, { allowEmpty = false } = {}) {
    if (!baseUrl) return { ok: false, code: 'unconfigured', message: 'MCP HTTP URL 未配置' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(`${baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...headers,
          ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res?.ok === false) {
        return { ok: false, code: 'mcp_http_error', message: `MCP HTTP ${res.status || 'error'}` }
      }
      sessionId = res?.headers?.get?.('mcp-session-id') || sessionId
      const contentType = res?.headers?.get?.('content-type') || ''
      let body
      if (typeof res?.text === 'function') {
        const raw = await res.text()
        if (!String(raw || '').trim()) {
          if (allowEmpty || [202, 204].includes(Number(res?.status))) return { ok: true, result: null }
          return { ok: false, code: 'mcp_empty_response', message: 'MCP HTTP 返回空响应' }
        }
        body = decodeResponse(raw, contentType, payload?.id)
      } else if (typeof res?.json === 'function') {
        body = await res.json()
      }
      if (!body) {
        if (allowEmpty) return { ok: true, result: null }
        return { ok: false, code: 'mcp_invalid_response', message: 'MCP HTTP 返回无效响应' }
      }
      if (body.error) {
        return { ok: false, code: 'mcp_error', message: body.error.message || 'MCP HTTP error' }
      }
      return { ok: true, result: body.result }
    } catch (err) {
      clearTimeout(timer)
      return { ok: false, code: 'mcp_error', message: String(err?.message || err).slice(0, 400) }
    }
  }

  function rpc(method, params = {}) {
    return send({ jsonrpc: '2.0', id: nextId++, method, params })
  }

  async function ensureInitialized() {
    if (initialized) return { ok: true }
    if (initializing) return initializing
    initializing = (async () => {
      const init = await rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'knowme', version: '0.4.0' },
      })
      if (!init.ok) return init
      const notified = await send({ jsonrpc: '2.0', method: 'notifications/initialized' }, { allowEmpty: true })
      if (!notified.ok) return notified
      initialized = true
      return { ok: true }
    })()
    try { return await initializing } finally { initializing = null }
  }

  return {
    transport: 'streamable-http',
    async listTools() {
      const init = await ensureInitialized()
      if (!init.ok) return { ...init, tools: [] }
      return listAllMcpTools(params => rpc('tools/list', params))
    },
    async callTool(name, args = {}) {
      const init = await ensureInitialized()
      if (!init.ok) return { ok: false, code: init.code, message: init.message, text: init.message }
      const r = await rpc('tools/call', { name: String(name || ''), arguments: args })
      if (!r.ok) return { ok: false, code: r.code, message: r.message, text: r.message }
      const content = Array.isArray(r.result?.content) ? r.result.content : []
      const text = content.map((c) => (c?.type === 'text' ? c.text : JSON.stringify(c))).join('\n').slice(0, 24000)
      return { ok: !r.result?.isError, text: text || JSON.stringify(r.result || {}) }
    },
    async healthCheck() {
      const listed = await this.listTools()
      return { ok: listed.ok, transport: 'streamable-http', url: baseUrl, toolCount: listed.tools?.length || 0, message: listed.message }
    },
    async close() {},
  }
}

/**
 * Legacy MCP SSE transport: GET event stream announces a POST endpoint, while
 * JSON-RPC responses arrive as `message` events on the stream.
 */
function createLegacySseSession(opts = {}) {
  const url = String(opts.url || '').trim()
  const fetchImpl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : global.fetch
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const headers = { ...(opts.headers || {}) }
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
  const aborter = new AbortController()
  const pending = new Map()
  let nextId = 1
  let endpoint = ''
  let streamStarted = false
  let initialized = false
  let endpointResolve
  let endpointReject
  const endpointReady = new Promise((resolve, reject) => {
    endpointResolve = resolve
    endpointReject = reject
  })

  function failPending(error) {
    for (const [, item] of pending) item.reject(error)
    pending.clear()
  }

  function handleEvent(block) {
    let event = 'message'
    const data = []
    for (const line of String(block || '').split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    }
    const payload = data.join('\n').trim()
    if (!payload) return
    if (event === 'endpoint') {
      try {
        endpoint = new URL(payload, url).toString()
        endpointResolve(endpoint)
      } catch (error) { endpointReject(error) }
      return
    }
    let message
    try { message = JSON.parse(payload) } catch { return }
    if (message.id == null || !pending.has(message.id)) return
    const item = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message || 'MCP SSE error'))
    else item.resolve(message.result)
  }

  async function consumeBody(body) {
    let buffer = ''
    const accept = (chunk) => {
      buffer += Buffer.from(chunk).toString('utf8')
      let marker = buffer.search(/\r?\n\r?\n/)
      while (marker >= 0) {
        const block = buffer.slice(0, marker)
        const matched = buffer.slice(marker).match(/^\r?\n\r?\n/)[0]
        buffer = buffer.slice(marker + matched.length)
        handleEvent(block)
        marker = buffer.search(/\r?\n\r?\n/)
      }
    }
    if (body?.getReader) {
      const reader = body.getReader()
      while (true) {
        const part = await reader.read()
        if (part.done) break
        accept(part.value)
      }
    } else if (body?.[Symbol.asyncIterator]) {
      for await (const chunk of body) accept(chunk)
    } else {
      throw new Error('MCP SSE 响应不包含可读事件流')
    }
  }

  async function startStream() {
    if (streamStarted) return endpointReady
    streamStarted = true
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', ...headers },
        signal: aborter.signal,
      })
      if (!response.ok) throw new Error(`MCP SSE 连接失败: HTTP ${response.status}`)
      Promise.resolve(consumeBody(response.body)).catch((error) => {
        endpointReject(error)
        failPending(error)
      })
    } catch (error) {
      endpointReject(error)
      throw error
    }
    return Promise.race([
      endpointReady,
      new Promise((_, reject) => setTimeout(() => reject(new Error('MCP SSE endpoint 等待超时')), timeoutMs)),
    ])
  }

  async function post(payload) {
    const target = endpoint || await startStream()
    const response = await fetchImpl(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: aborter.signal,
    })
    if (!response.ok) throw new Error(`MCP SSE 消息发送失败: HTTP ${response.status}`)
  }

  async function rpc(method, params = {}) {
    await startStream()
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`MCP SSE 请求超时: ${method}`))
      }, timeoutMs)
      pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value) },
        reject: (error) => { clearTimeout(timer); reject(error) },
      })
      post({ jsonrpc: '2.0', id, method, params }).catch((error) => {
        clearTimeout(timer)
        pending.delete(id)
        reject(error)
      })
    })
  }

  async function ensureInitialized() {
    if (initialized) return
    await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'knowme', version: '0.3.0' },
    })
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    initialized = true
  }

  return {
    transport: 'sse',
    async listTools() {
      try {
        await ensureInitialized()
        return await listAllMcpTools(async params => ({ ok: true, result: await rpc('tools/list', params) }))
      } catch (error) {
        return { ok: false, code: 'mcp_error', message: String(error?.message || error).slice(0, 400), tools: [] }
      }
    },
    async callTool(name, args = {}) {
      try {
        await ensureInitialized()
        const result = await rpc('tools/call', { name: String(name || ''), arguments: args })
        const content = Array.isArray(result?.content) ? result.content : []
        const text = content.map((item) => item?.type === 'text' ? item.text : JSON.stringify(item)).join('\n').slice(0, 24000)
        return { ok: !result?.isError, text: text || JSON.stringify(result || {}) }
      } catch (error) {
        return { ok: false, code: 'mcp_error', message: String(error?.message || error).slice(0, 400), text: '' }
      }
    },
    async healthCheck() {
      const listed = await this.listTools()
      return { ok: listed.ok, transport: 'sse', url, toolCount: listed.tools?.length || 0, message: listed.message }
    },
    async close() {
      aborter.abort()
      failPending(new Error('MCP SSE 会话已关闭'))
    },
  }
}

function createMcpSessionForTransport(mcpConfig = {}, opts = {}) {
  const transport = String(mcpConfig.transport || 'stdio').trim().toLowerCase()
  if (transport === 'streamable-http' || transport === 'http') {
    return createStreamableHttpSession({
      url: mcpConfig.url,
      accessToken: opts.accessToken,
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs,
      headers: opts.headers,
    })
  }
  if (transport === 'sse') {
    return createLegacySseSession({
      url: mcpConfig.url,
      accessToken: opts.accessToken,
      fetchImpl: opts.fetchImpl,
      timeoutMs: opts.timeoutMs,
      headers: opts.headers,
    })
  }
  return createMcpSession({
    command: mcpConfig.command,
    args: mcpConfig.args,
    cwd: mcpConfig.cwd,
    envKeys: mcpConfig.envKeys,
    env: { ...(mcpConfig.env || {}), ...(opts.env || {}) },
    spawnImpl: opts.spawnImpl,
    timeoutMs: opts.timeoutMs,
  })
}

async function checkMcpHealth(session) {
  if (!session) return { ok: false, code: 'not_connected', message: 'MCP 未连接' }
  if (typeof session.healthCheck === 'function') return session.healthCheck()
  try {
    const listed = await session.listTools()
    return { ok: listed.ok, toolCount: (listed.tools || []).length }
  } catch (err) {
    return { ok: false, code: 'health_failed', message: String(err?.message || err) }
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  sanitizeConnectorId,
  buildMcpAgentToolName,
  parseMcpAgentToolName,
  mcpConfigKey,
  createMcpSession,
  createStreamableHttpSession,
  createLegacySseSession,
  createMcpSessionForTransport,
  projectMcpTools,
  createMcpHostRegistry,
  defaultRegistry,
  oauthDir,
  schemaCacheDir,
  loadOAuthTokens,
  saveOAuthTokens,
  refreshOAuthToken,
  loadSchemaCache,
  saveSchemaCache,
  checkMcpHealth,
}
