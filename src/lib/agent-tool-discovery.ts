'use strict'

const { parseToolArguments } = require('./agent-tools-format')
const { capabilityDiscoveryScore } = require('./agent-capability-search')

const DISCOVERY_NAME = 'discover_tools'
const DISCOVERY_TOOL = {
  type: 'function',
  function: {
    name: DISCOVERY_NAME,
    description: 'Search or page the authorized tool catalog. Returns lightweight names/descriptions, not schemas. Matching page tools are considered for the next round. Empty query lists all authorized tools; use nextCursor to continue. Discovery never grants permission or executes a discovered tool.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Tool name, capability or keywords; empty lists all.' },
        cursor: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 16 },
      },
      additionalProperties: false,
    },
  },
  _knowme: { source: 'builtin', capability: 'tool-discovery', risk: 'read', sideEffects: false,
    requiresApproval: false, scope: 'ephemeral', timeoutMs: 30000,
    idempotencySupported: false, rollbackSupported: false },
}

function authorizedToolRecords(surface) {
  return (surface?.getToolRecords?.() || surface?.getToolDefinitions?.() || [])
    .filter(record => {
      const name = record?.function?.name || record?.definition?.function?.name || record?.name
      return name && name !== DISCOVERY_NAME
        && (!surface?.isAllowedTool || surface.isAllowedTool(name))
    })
}

function validateDiscovery(raw) {
  const parsed = parseToolArguments(raw)
  if (!parsed.ok) return parsed
  const args = parsed.args
  if (Object.keys(args).some(key => !['query', 'cursor', 'limit'].includes(key))
    || (args.query != null && (typeof args.query !== 'string' || args.query.length > 1000))
    || (args.cursor != null && (!Number.isSafeInteger(args.cursor) || args.cursor < 0))
    || (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 16))) {
    return { ok: false, code: 'invalid_args', message: 'Discovery requires query:string, cursor:nonnegative integer, limit:1..16.' }
  }
  return { ok: true, args }
}

function discoverAuthorizedTools(surface, raw) {
  const validation = validateDiscovery(raw)
  if (!validation.ok) return { ...validation, text: validation.message, executionStarted: false }
  const { query = '', cursor = 0, limit = 8 } = validation.args
  const matches = authorizedToolRecords(surface).map(record => {
    const definition = record.definition || record
    const contract = record._knowme || definition._knowme || {}
    return {
      name: definition.function?.name || record.name,
      description: String(definition.function?.description || '').replace(/\s+/g, ' ').slice(0, 180),
      capability: String(contract.capability || contract.source || 'general'),
      keywords: contract.mcpSchemaLoader === true && Array.isArray(contract.mcpSchemaToolNames)
        ? contract.mcpSchemaToolNames.filter(name => typeof name === 'string').join(' ') : '',
    }
  }).map(item => ({ ...item, score: capabilityDiscoveryScore(query, { ...item, id: item.name, keywords: `${item.capability} ${item.keywords}` }) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score)
    .map(({ score, keywords, ...item }) => item)
  const page = { tools: matches.slice(cursor, cursor + limit), total: matches.length,
    nextCursor: cursor + limit < matches.length ? cursor + limit : null }
  return { ok: true, text: JSON.stringify(page), discovery: page, executionStarted: false }
}

module.exports = { DISCOVERY_NAME, DISCOVERY_TOOL, authorizedToolRecords, validateDiscovery, discoverAuthorizedTools }
