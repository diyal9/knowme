'use strict'

const mcpHost = require('./mcp-host')

const BROWSER_TOOL_NAMES = [
  'browser_navigate',
  'browser_snapshot',
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_upload_file',
  'browser_download',
  'browser_press_key',
  'browser_wait_for',
]

const DEFAULT_BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

function isPrivateIpv4(host) {
  const parts = String(host || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 127) return true
  return false
}

function isPrivateIpv6(host) {
  const h = String(host || '').toLowerCase()
  return h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
}

function isBlockedHost(host, blockedHosts = DEFAULT_BLOCKED_HOSTS) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return false
  if (blockedHosts.has(h)) return true
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (isPrivateIpv4(h)) return true
  if (isPrivateIpv6(h)) return true
  return false
}

function parseHostname(url = '') {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isDomainAllowed(url, opts = {}) {
  const host = parseHostname(url)
  if (!host) return { ok: false, code: 'invalid_url', message: '无效 URL' }
  const blocked = opts.blockedHosts || DEFAULT_BLOCKED_HOSTS
  if (isBlockedHost(host, blocked)) {
    return { ok: false, code: 'scope_denied', message: `域名被拦截: ${host}`, blocked: true }
  }
  const allowlist = Array.isArray(opts.allowlist) ? opts.allowlist.map((h) => String(h).toLowerCase()) : null
  if (allowlist && allowlist.length && !allowlist.some((a) => host === a || host.endsWith(`.${a}`))) {
    return { ok: false, code: 'scope_denied', message: `域名不在 allowlist: ${host}` }
  }
  return { ok: true, host }
}

function mapPlaywrightToolName(rawName) {
  const raw = String(rawName || '').trim()
  if (raw.startsWith('browser_')) return raw
  const aliases = {
    navigate: 'browser_navigate',
    snapshot: 'browser_snapshot',
    click: 'browser_click',
    type: 'browser_type',
    fill_form: 'browser_fill_form',
    upload_file: 'browser_upload_file',
    download: 'browser_download',
    press_key: 'browser_press_key',
    wait_for: 'browser_wait_for',
  }
  return aliases[raw] || `browser_${raw.replace(/^browser\./, '')}`
}

function buildBrowserToolDefs(mcpTools = [], connectorId = 'playwright') {
  const list = Array.isArray(mcpTools) ? mcpTools : []
  const defs = []
  for (const t of list) {
    const raw = String(t?.name || '')
    const mapped = mapPlaywrightToolName(raw)
    if (!BROWSER_TOOL_NAMES.includes(mapped) && !raw.includes('browser')) continue
    const agentName = mapped.startsWith('browser_') ? mapped : `browser_${raw}`
    defs.push({
      type: 'function',
      function: {
        name: agentName,
        description: String(t.description || `Browser automation: ${raw}`).slice(0, 500),
        parameters: t.inputSchema || t.parameters || { type: 'object', properties: {} },
      },
      _knowme: {
        source: 'mcp',
        capability: 'browser',
        risk: 'network',
        sideEffects: true,
        requiresApproval: false,
        scope: 'external',
        timeoutMs: 30000,
        idempotencySupported: false,
        rollbackSupported: false,
        mcpConnectorId: connectorId,
        mcpRawTool: raw,
      },
    })
  }
  return defs
}

function buildBrowserMcpAdapter(opts = {}) {
  const connectorId = opts.connectorId || 'playwright'
  const callMcp = opts.callMcpTool
  const allowlist = opts.allowlist || []
  const blockedHosts = opts.blockedHosts || DEFAULT_BLOCKED_HOSTS
  const confirmedHosts = new Set(Array.isArray(opts.confirmedHosts) ? opts.confirmedHosts : [])

  const handlers = {}
  for (const toolName of BROWSER_TOOL_NAMES) {
    handlers[toolName] = async (args = {}) => {
      if (!callMcp) {
        return { ok: false, code: 'tool_unavailable', text: 'Playwright MCP 未配置' }
      }
      const url = args.url || args.href || args.pageUrl
      if (url) {
        const check = isDomainAllowed(url, { allowlist, blockedHosts })
        if (!check.ok) {
          if (check.blocked || check.code === 'scope_denied') {
            return { ok: false, code: 'scope_denied', text: check.message }
          }
          return { ok: false, code: check.code, text: check.message }
        }
        const host = check.host || parseHostname(url)
        if (host && !confirmedHosts.has(host) && opts.requireHostConfirm) {
          return {
            ok: false,
            code: 'approval_required',
            text: `首次访问 ${host} 需要用户确认`,
            meta: { host, requiresHostConfirm: true },
          }
        }
      }
      const rawTool = args._mcpRawTool || toolName.replace(/^browser_/, '')
      const result = await callMcp(rawTool, args)
      return result
    }
  }

  return {
    buildBrowserToolDefs,
    handlers,
    isDomainAllowed,
    mapPlaywrightToolName,
    confirmHost(host) {
      confirmedHosts.add(String(host || '').toLowerCase())
    },
  }
}

module.exports = {
  BROWSER_TOOL_NAMES,
  DEFAULT_BLOCKED_HOSTS,
  parseHostname,
  isPrivateIpv4,
  isPrivateIpv6,
  isBlockedHost,
  isDomainAllowed,
  mapPlaywrightToolName,
  buildBrowserToolDefs,
  buildBrowserMcpAdapter,
  sanitizeConnectorId: mcpHost.sanitizeConnectorId,
}
