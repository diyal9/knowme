'use strict'

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

module.exports = {
  sanitizeConnectorId,
  buildMcpAgentToolName,
  parseMcpAgentToolName,
  mcpConfigKey,
}
