'use strict'

// This bounds discovery requests, not the authorized catalog or model window.
const MAX_MCP_TOOL_PAGES = 1000

/** Collect a complete tools/list result; never expose partial pages on failure. */
async function listAllMcpTools(fetchPage) {
  const tools = []
  const seen = new Set()
  let cursor
  const invalid = message => ({ ok: false, code: 'mcp_pagination_error', message, tools: [] })
  try {
    for (let page = 0; page < MAX_MCP_TOOL_PAGES; page += 1) {
      const response = await fetchPage(cursor === undefined ? {} : { cursor })
      if (!response?.ok) {
        return { ok: false, code: response?.code || 'mcp_error',
          message: response?.message || 'MCP tools/list failed', tools: [] }
      }
      const result = response.result
      if (!Array.isArray(result?.tools)) return invalid('MCP tools/list returned invalid tools')
      for (const tool of result.tools) tools.push(tool)
      const next = result.nextCursor
      if (next == null) return { ok: true, tools }
      if (typeof next !== 'string') return invalid('MCP tools/list returned invalid nextCursor')
      if (seen.has(next)) return invalid('MCP tools/list repeated cursor')
      seen.add(next)
      cursor = next
    }
    return invalid(`MCP tools/list exceeded ${MAX_MCP_TOOL_PAGES} pages`)
  } catch (error) {
    return { ok: false, code: 'mcp_error', message: String(error?.message || error).slice(0, 400), tools: [] }
  }
}

module.exports = { listAllMcpTools, MAX_MCP_TOOL_PAGES }
