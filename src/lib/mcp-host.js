'use strict'

const { spawn } = require('child_process')
const readline = require('readline')
let logger = null
try { logger = require('./logger') } catch { /* logger optional */ }

const DEFAULT_TIMEOUT_MS = 15000

/**
 * Sanitize connector id for use in Agent tool names (mcp.<id>.<tool>).
 */
function sanitizeConnectorId(connectorId) {
  const raw = String(connectorId || '').trim().toLowerCase()
  const sanitized = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return sanitized || 'mcp'
}

function buildMcpAgentToolName(connectorId, rawToolName) {
  const id = sanitizeConnectorId(connectorId)
  const tool = String(rawToolName || '').trim()
  return `mcp.${id}.${tool}`
}

/**
 * Parse a projected Agent MCP tool name back to connector + raw tool.
 */
function parseMcpAgentToolName(agentName) {
  const text = String(agentName || '').trim()
  const m = /^mcp\.([a-z0-9_]+)\.(.+)$/.exec(text)
  if (!m) return null
  return { sanitizedConnectorId: m[1], rawToolName: m[2] }
}

function mcpConfigKey(mcp = {}) {
  return JSON.stringify({
    command: mcp?.command || '',
    args: mcp?.args || [],
    cwd: mcp?.cwd || '',
    envKeys: mcp?.envKeys || [],
  })
}

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
      const result = await request('tools/list', {})
      const tools = Array.isArray(result?.tools) ? result.tools : []
      return { ok: true, tools }
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
    .slice(0, 32)
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

    const session = createMcpSession({
      command: mcpConfig.command,
      args: mcpConfig.args,
      cwd: mcpConfig.cwd,
      envKeys: mcpConfig.envKeys,
      spawnImpl: opts.spawnImpl,
      timeoutMs: opts.timeoutMs,
    })
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

module.exports = {
  DEFAULT_TIMEOUT_MS,
  sanitizeConnectorId,
  buildMcpAgentToolName,
  parseMcpAgentToolName,
  mcpConfigKey,
  createMcpSession,
  projectMcpTools,
  createMcpHostRegistry,
  defaultRegistry,
}
