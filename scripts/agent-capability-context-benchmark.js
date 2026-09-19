'use strict'

// Offline, synthetic comparison. Never opens a connector or reads a user profile.
const { performance } = require('node:perf_hooks')
const { selectToolDefinitions } = require('../src/lib/agent-tool-runtime')
const { discoverAuthorizedTools } = require('../src/lib/agent-tool-discovery')
const { estimateTokens } = require('../src/lib/llm-runtime')

function benchmarkCapabilityContext(size = 500) {
  const records = Array.from({ length: size }, (_, index) => ({
    type: 'function',
    function: {
      name: `inventory_operation_${index}`,
      description: `Inventory operation ${index}, available only when its documented task matches.`,
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'The exact item requested by the user.' } }, required: ['query'] },
    },
    _knowme: { source: 'builtin', capability: 'inventory', risk: 'read', sideEffects: false },
  }))
  records[size - 1].function.name = 'search_design_documents'
  records[size - 1].function.description = '搜索视觉设计文档和已确认的构图方案 Search visual design documents'
  const surface = { getToolRecords: () => records, isAllowedTool: name => records.some(record => record.function.name === name) }
  const times = []
  let selection
  for (let i = 0; i < 60; i++) {
    const started = performance.now()
    selection = selectToolDefinitions(records, { prompt: '搜索视觉设计文档', maxTools: 8 })
    if (i >= 10) times.push(performance.now() - started)
  }
  times.sort((a, b) => a - b)
  const fullTokens = estimateTokens(JSON.stringify(records.map(({ type, function: fn }) => ({ type, function: fn }))))
  const selectedTokens = estimateTokens(JSON.stringify(selection.definitions))
  const discovered = new Set()
  let cursor = 0
  do {
    const page = discoverAuthorizedTools(surface, { query: '', cursor, limit: 16 }).discovery
    page.tools.forEach(tool => discovered.add(tool.name))
    cursor = page.nextCursor
  } while (cursor !== null)
  return {
    catalogSize: size,
    selectedCount: selection.definitions.length,
    relevantToolSelected: selection.selectedNames.includes('search_design_documents'),
    discoverableCount: discovered.size,
    fullSchemaTokens: fullTokens,
    selectedSchemaTokens: selectedTokens,
    schemaTokenReduction: Number((1 - selectedTokens / fullTokens).toFixed(4)),
    selectionP50Ms: Number(times[Math.floor(times.length / 2)].toFixed(3)),
    selectionP95Ms: Number(times[Math.floor(times.length * 0.95)].toFixed(3)),
  }
}

if (require.main === module) {
  const results = [100, 500].map(benchmarkCapabilityContext)
  process.stdout.write(`${JSON.stringify({ version: 1, mode: 'offline-synthetic', results }, null, 2)}\n`)
  if (results.some(result => !result.relevantToolSelected || result.discoverableCount !== result.catalogSize || result.selectedCount > 8)) process.exitCode = 1
}

module.exports = { benchmarkCapabilityContext }
